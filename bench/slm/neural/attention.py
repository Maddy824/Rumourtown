"""Slow Qwen3/Llama attention with online reductions, never archived matrices (§4)."""
from contextlib import contextmanager
import numpy as np


def slow_attention(module, x, mask=None, cache=None, spans=None, block_spans=(),
                   decode_only=False, prompt_length=0, ablate_heads=(), reducer=None):
    import mlx.core as mx
    batch, length, _ = x.shape
    offset = cache.offset if cache is not None else 0
    if not isinstance(offset, int):
        raise ValueError('Only single-sequence, nonrotating KVCache is supported')
    q, k, v = module.q_proj(x), module.k_proj(x), module.v_proj(x)
    q = q.reshape(batch, length, module.n_heads, -1)
    k = k.reshape(batch, length, module.n_kv_heads, -1)
    # Installed Qwen3 applies head RMSNorm before RoPE; Llama has neither q_norm nor k_norm.
    if hasattr(module, 'q_norm'):
        q, k = module.q_norm(q), module.k_norm(k)
    q, k = q.transpose(0, 2, 1, 3), k.transpose(0, 2, 1, 3)
    v = v.reshape(batch, length, module.n_kv_heads, -1).transpose(0, 2, 1, 3)
    q, k = module.rope(q, offset=offset), module.rope(k, offset=offset)
    if cache is not None:
        k, v = cache.update_and_fetch(k, v)
    if k.shape[-2] != offset+length:
        raise ValueError('Rotating/truncated caches cannot preserve absolute spans')
    if module.n_heads % module.n_kv_heads:
        raise ValueError('Invalid GQA mapping')
    group = module.n_heads//module.n_kv_heads
    # §4 each contiguous group of query heads shares one key/value head.
    k, v = mx.repeat(k, group, axis=1), mx.repeat(v, group, axis=1)
    logits = (q.astype(mx.float32) @ k.astype(mx.float32).swapaxes(-1, -2))*module.scale
    queries, keys = mx.arange(offset, offset+length)[:, None], mx.arange(k.shape[-2])[None, :]
    allowed = keys <= queries
    for a, b in block_spans:
        active = (queries >= prompt_length) if decode_only else mx.ones_like(queries, dtype=mx.bool_)
        # §4 preserve positions/causality, block distractor keys for every later query.
        allowed &= ~(active & (keys >= a) & (keys < b) & (queries > keys))
    logits = mx.where(allowed, logits, -float('inf'))
    if mask is not None and not isinstance(mask, str):
        logits = mx.where(mask, logits, -float('inf')) if mask.dtype == mx.bool_ else logits+mask
    elif isinstance(mask, str) and mask != 'causal':
        raise ValueError('Unknown mask')
    probability = mx.softmax(logits, axis=-1)
    if reducer is not None:
        # Reduce on device immediately: only [batch,head,selected-query] span masses leave it.
        reducer(probability, offset, spans or {})
    per_head = (probability.astype(v.dtype) @ v)
    if ablate_heads:
        keep = np.ones(module.n_heads, np.float32)
        keep[list(ablate_heads)] = 0
        per_head *= mx.array(keep)[None, :, None, None]
    output = per_head.transpose(0, 2, 1, 3).reshape(batch, length, -1)
    return module.o_proj(output)


class SpanMass:
    """Queries are factual token j-1, including first-token claims at last prompt token."""
    def __init__(self, factual_token_positions):
        self.queries = {j-1 for j in factual_token_positions}
        self.rows = []

    def __call__(self, probability, offset, spans):
        import mlx.core as mx
        queries = [j-offset for j in sorted(self.queries) if offset <= j < offset+probability.shape[-2]]
        if not queries:
            return
        masses = {}
        for name, indices in spans.items():
            indices = [i for i in indices if i < probability.shape[-1]]
            value = mx.sum(probability[:, :, queries, :][:, :, :, indices], axis=-1)
            masses[name] = np.array(value).tolist()
        self.rows.append({'queries': [q+offset for q in queries], 'masses': masses})


@contextmanager
def instrument(model, layer_options):
    """Layer indices are 1-based; restoration occurs even after generation errors."""
    import mlx.nn as nn
    class Slow(nn.Module):
        def __init__(self, base, options):
            super().__init__()
            self.base = base
            self._options = options

        def __call__(self, x, mask=None, cache=None):
            return slow_attention(self.base, x, mask, cache, **self._options)
    originals = []
    try:
        for layer, options in layer_options.items():
            block = model.model.layers[layer-1]
            originals.append((block, block.self_attn))
            block.self_attn = Slow(block.self_attn, options)
        yield
    finally:
        for block, original in originals:
            block.self_attn = original


def span_statistics(distractor_mass, ledger_mass, distractor_count, ledger_count, epsilon=1e-8):
    if min(distractor_count, ledger_count) <= 0:
        return {'raw_D': distractor_mass, 'raw_L': ledger_mass, 'per_token_D': None,
                'per_token_L': None, 'log_ratio': None}
    # §4 length-normalised distractor preference, not causal contribution.
    d, l = np.asarray(distractor_mass)/distractor_count, np.asarray(ledger_mass)/ledger_count
    return {'raw_D': distractor_mass, 'raw_L': ledger_mass, 'per_token_D': d,
            'per_token_L': l, 'log_ratio': np.log((d+epsilon)/(l+epsilon))}


def random_spans(length, count, ranges, excluded=(), controls=20, seed=7):
    """Uniform fixed-seed equal-length spans in prespecified matched position ranges."""
    forbidden = set(excluded)
    starts = [a for low, high in ranges for a in range(low, min(high, length)-count+1)
              if not forbidden.intersection(range(a, a+count))]
    if not starts:
        raise ValueError('No eligible random span controls')
    return [(int(a), int(a)+count) for a in np.random.default_rng(seed).choice(starts, controls)]


def content_swap(tokens, start, end, replacement):
    if len(replacement) != end-start:
        raise ValueError('Content swaps must preserve token length')
    return [*tokens[:start], *replacement, *tokens[end:]]


def token_runs(indices):
    result = []
    for i in sorted(set(indices)):
        if result and result[-1][1] == i:
            result[-1] = (result[-1][0], i+1)
        else:
            result.append((i, i+1))
    return result


def condition_options(record, options, factual_positions=()):
    """Resolve named prompt spans per row rather than reusing token offsets across prompts."""
    resolved, reductions, tokens = {}, {}, record['tokens']
    for layer, original in options.items():
        value = dict(original)
        section = value.pop('block_section', None)
        if section:
            value['block_spans'] = token_runs(record['spans'][section]['tokens'])
        swaps = value.pop('swaps', [])
        for swap in swaps:
            runs = token_runs(record['spans'][swap['section']]['tokens'])
            if len(runs) != 1:
                raise ValueError('Content swap requires one contiguous span')
            tokens = content_swap(tokens, *runs[0], swap['tokens'])
        value['prompt_length'] = len(tokens)
        value['spans'] = {name: span['tokens'] for name, span in record['spans'].items()}
        if factual_positions:
            reducer = SpanMass(factual_positions)
            value['reducer'] = reducer
            reductions[layer] = reducer
        resolved[layer] = value
    return tokens, resolved, reductions


def causal_statistic(base, masked, random_controls, opportunities):
    """Opportunity set fixed before execution; failures must be supplied explicitly, not removed."""
    base, masked, controls = np.asarray(base), np.asarray(masked), np.asarray(random_controls)
    ix = np.asarray(opportunities, bool)
    if not ix.any() or controls.shape[0] != len(ix) or controls.ndim != 2:
        raise ValueError('Invalid fixed opportunities/control shape')
    # §4 S_L = (L_mask-L_0) - E_c(L_random,c-L_0); same for S_Q/S_U.
    return float(np.mean(masked[ix]-base[ix])-np.mean(controls[ix]-base[ix, None]))
