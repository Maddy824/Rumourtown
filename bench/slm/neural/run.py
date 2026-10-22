"""Explicit checkpoint-stage driver. --execute is mandatory; imports never load weights."""
import argparse
import json
from pathlib import Path
import time
import numpy as np
from .common import Journal, atomic_json, checkpoint_manifest, digest, jsonl


def weight_hash(model):
    import hashlib
    import mlx.core as mx
    from mlx.utils import tree_flatten
    h = hashlib.sha256()
    for name, tensor in sorted(tree_flatten(model.parameters())):
        h.update(f'{name}:{tensor.shape}:{tensor.dtype}'.encode())
        # NumPy lacks bf16; its FP32 cast is exact. Preserve integer/quantized bits.
        value = tensor.astype(mx.float32) if tensor.dtype == mx.bfloat16 else tensor
        h.update(np.array(value).tobytes())
    return h.hexdigest()


def load_checkpoint(model_dir, adapter=None):
    from mlx_lm import load
    from .grid import load_grid_adapter
    model, tokenizer = load(str(model_dir))
    if adapter:
        if (Path(adapter)/'adapter_config.json').exists() and json.loads((Path(adapter)/'adapter_config.json').read_text()).get('neural_grid'):
            load_grid_adapter(model, adapter)
        else:
            from mlx_lm.tuner.utils import load_adapters
            load_adapters(model, adapter)
    model.eval()
    return model, tokenizer


def validate(model, tokenizer, records, tolerance=2e-5):
    """Step 0: 100 locked prompts, ordinary/instrumented/cache/slow-attention parity (§7)."""
    import mlx.core as mx
    from mlx_lm.models.cache import make_prompt_cache
    from .states import forward
    from .steer import Direction, Injection, greedy, zero_equivalence
    from .attention import instrument
    measurements = []
    for record in records:
        prompt = record['tokens']
        expected = tokenizer.apply_chat_template(record['messages'], tokenize=False, add_generation_prompt=True, enable_thinking=False)
        if expected.encode() != record['text'].encode():
            raise AssertionError('Prompt bytes changed')
        actual_ids = tokenizer.apply_chat_template(record['messages'], return_dict=False, add_generation_prompt=True, enable_thinking=False)
        if list(actual_ids) != prompt:
            raise AssertionError('Prompt token IDs changed')
        for span in record['spans'].values():
            for a, b in span['bytes']:
                if not 0 <= a <= b <= len(expected.encode()):
                    raise AssertionError('Invalid byte spans')
            if any(not 0 <= t < len(prompt) for t in span['tokens']):
                raise AssertionError('Invalid token spans')
        injection = Injection(1, Direction(np.zeros(model.args.hidden_size), 1., 1.), 0., len(prompt))
        noop = zero_equivalence(model, prompt, injection, tolerance)
        start = time.perf_counter()
        fused = forward(model, mx.array([prompt]))
        mx.eval(fused)
        prefill_time = time.perf_counter()-start
        cache = make_prompt_cache(model)
        forward(model, mx.array([prompt[:-1]]), cache=cache)
        cached = forward(model, mx.array([prompt[-1:]]), cache=cache, offset=len(prompt)-1)
        cache_error = float(mx.max(mx.abs(cached[0, -1]-fused[0, -1])).item())
        base = greedy(model, prompt, cap=8, eos_ids=tokenizer.eos_token_ids)
        with instrument(model, {l+1: {} for l in range(len(model.model.layers))}):
            slow = forward(model, mx.array([prompt]))
            slow_error = float(mx.max(mx.abs(slow.astype(mx.float32)-fused.astype(mx.float32))).item())
            slow_cache = make_prompt_cache(model)
            forward(model, mx.array([prompt]), cache=slow_cache)
            slow_decode = forward(model, mx.array([[base['tokens'][0]]]), cache=slow_cache, offset=len(prompt))
            slow_tokens = greedy(model, prompt, cap=8, eos_ids=tokenizer.eos_token_ids)
        fused_cache = make_prompt_cache(model)
        forward(model, mx.array([prompt]), cache=fused_cache)
        fused_decode = forward(model, mx.array([[base['tokens'][0]]]), cache=fused_cache, offset=len(prompt))
        decode_error = float(mx.max(mx.abs(fused_decode.astype(mx.float32)-slow_decode.astype(mx.float32))).item())
        start = time.perf_counter()
        # Measure decode alone after a completed prefill, with the same locked cache type.
        current = int(mx.argmax(fused_decode[0, -1]).item())
        for i in range(8):
            logits = forward(model, mx.array([[current]]), cache=fused_cache, offset=len(prompt)+1+i)
            current = int(mx.argmax(logits[0, -1]).item())
        decode_time = time.perf_counter()-start
        if max(cache_error, slow_error, decode_error) > tolerance or base != slow_tokens:
            raise AssertionError(f'Cache/attention parity failed for {record["probeId"]}')
        measurements.append({'probeId': record['probeId'], 'zero_error': noop, 'cache_error': cache_error,
                             'slow_error': slow_error, 'decode_error': decode_error,
                             'prefill_tokens_per_second': len(prompt)/prefill_time,
                             'decode_tokens_per_second': 8/decode_time})
    return {'rows': measurements, 'prompts': len(records), 'tolerance': tolerance,
            'passed_100_prompt_gate': len(records) >= 100}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('stage', choices=('validate', 'states', 'steer', 'attention', 'drift', 'calibration'))
    parser.add_argument('--model', required=True, help='Local checkpoint directory')
    parser.add_argument('--adapter')
    parser.add_argument('--prompts', required=True, help='prompts/prompts.jsonl export')
    parser.add_argument('--out', required=True)
    parser.add_argument('--execute', action='store_true', help='Authorize this invocation to load weights')
    parser.add_argument('--limit', type=int)
    parser.add_argument('--direction', help='Fitting-root Direction .npz')
    parser.add_argument('--layer', type=int, default=1)
    parser.add_argument('--alpha', type=float, default=0)
    parser.add_argument('--first-only', action='store_true')
    parser.add_argument('--cap', type=int, default=160)
    parser.add_argument('--scenarios', default='bench/slm/data/scenarios.jsonl')
    parser.add_argument('--probes', default='bench/slm/data/probes.jsonl')
    parser.add_argument('--continuations', help='Cached base continuations JSONL (required for drift)')
    parser.add_argument('--claims', help='JSON: probeId -> {tokens: continuation, first_claim_token: absolute index}')
    parser.add_argument('--attention-options', help='JSON mapping 1-based layer numbers to slow-path options')
    parser.add_argument('--base', help='Base checkpoint path for conditional KL')
    parser.add_argument('--alternatives', help='Frozen calibration JSON with stem_tokens and groups of token sequences')
    parser.add_argument('--tolerance', type=float, default=2e-5)
    args = parser.parse_args()
    if not args.execute:
        parser.error('--execute required; no checkpoint was loaded')
    if not Path(args.model).is_dir():
        parser.error('--model must be a local checkpoint directory')
    if args.stage == 'drift':
        if not args.base or not args.continuations:
            parser.error('Drift requires --base and --continuations')
        continuation_manifest = json.loads((Path(args.continuations).parent/'manifest.json').read_text())
        base_identity = checkpoint_manifest(args.base)
        if continuation_manifest['adapter'] or continuation_manifest['model'] != base_identity['model']:
            raise ValueError('Continuation cache must belong to this frozen base without an adapter')
    records = list(jsonl(args.prompts))
    limit = 100 if args.stage == 'validate' and args.limit is None else args.limit
    if limit is not None:
        records = records[:limit]
    if not records:
        parser.error('No prompts')
    manifest = checkpoint_manifest(args.model, args.adapter,
        [p for p in (args.prompts, args.scenarios, args.probes, args.direction, args.claims,
                     args.attention_options, args.alternatives, args.continuations) if p],
        {k: v for k, v in vars(args).items() if k not in ('out', 'execute')})
    if args.base:
        manifest['base_reference'] = checkpoint_manifest(args.base)
    journal = Journal(args.out, manifest)
    model, tokenizer = load_checkpoint(args.model, args.adapter)
    before = weight_hash(model)
    from .steer import Direction, Injection, greedy, output_row
    from .states import StateStore, capture
    from .attention import instrument, condition_options
    from .drift import Continuations, conditional_kl, teacher_forced_logits
    claims = json.loads(Path(args.claims).read_text()) if args.claims else {}
    base_cache = Continuations(Path(args.out)/'base-continuations', manifest) if args.stage == 'states' else None
    store = StateStore(Path(args.out)/'pooled', manifest, len(records), len(model.model.layers), model.args.hidden_size) if args.stage == 'states' else None
    # Evaluator material is joined only after the reply has been generated.
    scenarios = {s['id']: s for s in jsonl(args.scenarios)} if args.stage in ('steer', 'attention') else {}
    probes = {p['id']: p for p in jsonl(args.probes)} if scenarios else {}
    options = {int(k): v for k, v in json.loads(Path(args.attention_options).read_text()).items()} if args.attention_options else {}
    if args.stage == 'validate':
        atomic_json(Path(args.out)/'validation.json', validate(model, tokenizer, records, args.tolerance))
    else:
        direction = None
        if args.direction:
            with np.load(args.direction) as d:
                direction = Direction(d['vector'], float(d['sd']), float(d['orientation']))
        reference = load_checkpoint(args.base)[0] if args.stage == 'drift' and args.base else None
        continuations = {r['probeId']: r for r in jsonl(args.continuations)} if args.continuations else {}
        alternatives = json.loads(Path(args.alternatives).read_text()) if args.alternatives else None
        for record in records:
            key = digest([manifest, record['probeId']])
            if key in journal.rows:
                continue
            start = time.perf_counter()
            if args.stage == 'states':
                c = claims.get(record['probeId'], {})
                if 'tokens' not in c:
                    c = {**c, **base_cache.get_or_generate(record['probeId'], lambda: greedy(
                        model, record['tokens'], args.cap, tokenizer.eos_token_ids))}
                pooled = capture(model, record, c.get('tokens', ()), c.get('first_claim_token'))
                store.append(key, pooled, {'probeId': record['probeId']})
                row = {'key': key, 'probeId': record['probeId'],
                       'claim_position_missing': c.get('first_claim_token') is None,
                       'claimless': c.get('claimless')}
            elif args.stage in ('steer', 'attention'):
                condition = {'stage': args.stage, 'layer': args.layer, 'alpha': args.alpha,
                             'first_only': args.first_only, 'options': options}
                injection = None
                if args.stage == 'steer':
                    if direction is None:
                        raise ValueError('--direction required for steering')
                    injection = Injection(args.layer, direction, args.alpha, len(record['tokens']), args.first_only)
                from contextlib import nullcontext
                try:
                    prompt_tokens, resolved, reductions = record['tokens'], {}, {}
                    if args.stage == 'attention':
                        prompt_tokens, resolved, reductions = condition_options(record, options,
                            claims.get(record['probeId'], {}).get('factual_token_positions', []))
                    with instrument(model, resolved) if args.stage == 'attention' else nullcontext():
                        generated = greedy(model, prompt_tokens, args.cap, tokenizer.eos_token_ids, injection)
                    aligned = claims.get(record['probeId'], {})
                    if reductions and aligned.get('tokens') != generated['tokens']:
                        raise ValueError('Audited attention positions must match the regenerated condition tokens')
                    if reductions:
                        generated['span_masses'] = {str(l): r.rows for l, r in reductions.items()}
                    reply = tokenizer.decode(generated['tokens'], skip_special_tokens=True)
                    row = output_row(scenarios[record['scenarioId']], probes[record['probeId']], str(args.model),
                                     condition, reply, (time.perf_counter()-start)*1000, generation=generated)
                except RuntimeError:
                    row = output_row(scenarios[record['scenarioId']], probes[record['probeId']], str(args.model), condition, error=True)
                row['key'] = key
            elif args.stage == 'drift':
                if reference is None or record['probeId'] not in continuations:
                    raise ValueError('--base and matching --continuations required')
                c = continuations[record['probeId']]
                b = teacher_forced_logits(reference, record['tokens'], c['tokens'])
                t = teacher_forced_logits(model, record['tokens'], c['tokens'])
                result = conditional_kl(lambda a, z: np.array(b[:, a:z]), lambda a, z: np.array(t[:, a:z]), len(c['tokens']), model.args.vocab_size)
                row = {'key': key, 'probeId': record['probeId'], 'conditional_kl': result['conditional_kl'],
                       'per_token': result['per_token'].tolist(), 'eos': c['eos'], 'truncated': c['truncated']}
            else:
                if not alternatives:
                    raise ValueError('--alternatives required for calibration')
                import mlx.core as mx
                from .states import forward
                from .calibration import first_token_masses, trie_masses
                frozen = alternatives.get('by_probe', {}).get(record['probeId'], alternatives)
                if 'stem_tokens' not in frozen or 'groups' not in frozen:
                    raise ValueError('Missing target-specific frozen alternatives/stem')
                prefix = [*record['tokens'], *frozen['stem_tokens']]
                def probabilities(extra):
                    logits = forward(model, mx.array([[*prefix, *extra]]))[0, -1].astype(mx.float32)
                    return np.array(mx.softmax(logits))
                groups = frozen['groups']
                row = {'key': key, 'probeId': record['probeId'],
                       'first_token': first_token_masses(probabilities(()), {k: {s[0] for s in seqs} for k, seqs in groups.items()}),
                       'trie': trie_masses(groups, probabilities)}
            journal.append(row)
    after = weight_hash(model)
    if before != after:
        raise AssertionError('Frozen model parameters changed during instrumentation')
    atomic_json(Path(args.out)/'frozen-weights.json', {'before': before, 'after': after, 'equal': True})


if __name__ == '__main__':
    main()
