"""Instrumented Qwen3/Llama forward and pooled FP16 storage (design §1, §8)."""
import hashlib
from pathlib import Path
import numpy as np
from .common import Journal, atomic_json


def forward(model, tokens, cache=None, observer=None, intervention=None, offset=0):
    """No persistent monkeypatches. Full, non-sliding KV caches only for these studies."""
    from mlx_lm.models.base import create_attention_mask
    core = model.model
    h = core.embed_tokens(tokens)
    if observer:
        observer('embedding', h, offset)
    caches = [None] * len(core.layers) if cache is None else cache
    if len(caches) != len(core.layers):
        raise ValueError('Cache layer count mismatch')
    for l, (block, c) in enumerate(zip(core.layers, caches), 1):
        if getattr(block, 'use_sliding', False):
            raise ValueError('Sliding attention is outside the locked checkpoint contract')
        mask = create_attention_mask(h, c)
        h = block(h, mask, c)
        if intervention:
            h = intervention(l, h, offset)
        if observer:
            observer(f'block:{l}', h, offset)
    h = core.norm(h)
    if observer:
        observer('final_norm', h, offset)
    return core.embed_tokens.as_linear(h) if model.args.tie_word_embeddings else model.lm_head(h)


class Pooler:
    """Only pooled states survive each call. Claimless positions remain explicit NaNs."""
    def __init__(self, prompt_length, utterance_tokens, first_claim_token=None):
        # §1: query predicting generated token j is at absolute position j-1.
        self.positions = {'last_prompt': [prompt_length-1], 'utterance_mean': list(utterance_tokens),
                          'pre_claim': [] if first_claim_token is None else [first_claim_token-1]}
        self.sums, self.counts = {}, {}

    def __call__(self, label, state, offset):
        if state.shape[0] != 1:
            raise ValueError('Capture is single-prompt to preserve positions')
        for position, indices in self.positions.items():
            local = [i-offset for i in indices if offset <= i < offset+state.shape[1]]
            key = (label, position)
            if local:
                if isinstance(state, np.ndarray):
                    value = state[0, local, :].astype(np.float32).sum(axis=0)
                else:
                    import mlx.core as mx
                    value = np.array(mx.sum(state[0, local, :].astype(mx.float32), axis=0))
                self.sums[key] = self.sums.get(key, 0) + value
                self.counts[key] = self.counts.get(key, 0) + len(local)

    def array(self, labels, width):
        result = np.full((len(labels), 3, width), np.nan, np.float16)
        for i, label in enumerate(labels):
            for j, position in enumerate(self.positions):
                key = (label, position)
                if key in self.sums:
                    if self.counts[key] != len(self.positions[position]):
                        raise ValueError('Incomplete pooled position')
                    result[i, j] = self.sums[key] / self.counts[key]
        return result


class StateStore:
    """Data flushed before append-only index commit; interrupted slots are overwritten."""
    def __init__(self, directory, manifest, capacity, layers, width):
        self.shape = (capacity, layers+2, 3, width)
        self.journal = Journal(directory, {**manifest, 'shape': self.shape, 'dtype': 'float16'}, 'index.jsonl')
        path = Path(directory) / 'states.f16'
        exists = path.exists()
        if not exists and self.journal.rows:
            raise ValueError('Indexed state memmap is missing')
        expected = int(np.prod(self.shape)) * 2
        if exists and path.stat().st_size != expected:
            raise ValueError('State memmap size mismatch')
        self.data = np.memmap(path, mode='r+' if exists else 'w+', dtype=np.float16, shape=self.shape)
        for row in self.journal.rows.values():
            if hashlib.sha256(self.data[row['slot']].tobytes()).hexdigest() != row['stateHash']:
                raise ValueError('Indexed pooled state checksum mismatch')
        self.labels = ['embedding', *[f'block:{i+1}' for i in range(layers)], 'final_norm']
        atomic_json(Path(directory) / 'layout.json', {'labels': self.labels,
                    'positions': ['last_prompt', 'utterance_mean', 'pre_claim'], 'shape': self.shape})

    def append(self, key, pooled, metadata):
        if key in self.journal.rows:
            return False
        slot = len(self.journal.rows)
        if slot >= self.shape[0] or pooled.shape != self.shape[1:]:
            raise ValueError('State capacity/shape mismatch')
        self.data[slot] = pooled
        self.data.flush()
        self.journal.append({**metadata, 'key': key, 'slot': slot,
                             'stateHash': hashlib.sha256(self.data[slot].tobytes()).hexdigest(),
                             'missing': np.isnan(pooled).all(axis=-1).tolist()})
        return True


def capture(model, record, continuation=(), first_claim_token=None):
    """Teacher-force a locked continuation; generated claim offsets are supplied by the audit."""
    import mlx.core as mx
    pool = Pooler(len(record['tokens']), record['spans']['utterance']['tokens'], first_claim_token)
    # No generation needed to capture the supplied claim position.
    tokens = [*record['tokens'], *continuation]
    if first_claim_token is not None and not len(record['tokens']) <= first_claim_token < len(tokens):
        raise ValueError('Claim position must be an absolute generated-token offset')
    forward(model, mx.array([tokens]), observer=pool)
    return pool.array(['embedding', *[f'block:{i+1}' for i in range(len(model.model.layers))], 'final_norm'], model.args.hidden_size)
