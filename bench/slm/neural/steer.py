"""Frozen-weight post-block interventions and rescorable output rows (design §2)."""
from dataclasses import dataclass
import numpy as np
from .common import digest

ALPHAS = (-3., -2., -1., -.5, 0., .5, 1., 2., 3.)


def candidate_layers(emergence_layer, total):
    # §2 development-only candidates; middle/three-quarter fallback for absent emergence.
    layers = [total//2, 3*total//4]
    if emergence_layer is not None:
        layers += [emergence_layer-2, emergence_layer, emergence_layer+2]
    return sorted({min(total, max(1, l)) for l in layers})


def select_condition(development, faithfulness_floor, leakage_ceiling, error_ceiling):
    eligible = [r for r in development if r['F'] >= faithfulness_floor and
                r['leakage'] <= leakage_ceiling and r['error'] <= error_ceiling]
    if not eligible:
        return {'alpha': 0., 'layer': None, 'reason': 'No development condition passed frozen guards'}
    # §2 maximise macro Q; ties by smaller |alpha| then shallower layer.
    return min(eligible, key=lambda r: (-r['Q'], abs(r['alpha']), r['layer']))


@dataclass
class Direction:
    vector: np.ndarray
    sd: float
    orientation: float

    def save(self, path):
        np.savez(path, vector=self.vector, sd=self.sd, orientation=self.orientation)


def direction(known, absent, weights=None, scales=None):
    known, absent = np.asarray(known, float), np.asarray(absent, float)
    if known.shape != absent.shape or known.ndim != 2:
        raise ValueError('Equal-weight matched pairs required')
    delta = np.mean(known-absent, axis=0)  # §2 equal pair weight
    v = delta if weights is None else np.asarray(weights)/np.asarray(scales)
    norm = np.linalg.norm(v)
    if norm == 0:
        return None
    orientation = 1.0 if np.dot(v, delta) >= 0 else -1.0
    v = orientation * v / norm
    # §2 projected population SD on the balanced fitting set.
    return Direction(v, float(np.std(np.concatenate([known, absent]) @ v)), orientation)


def random_directions(reference, count=20, seed=7):
    rng = np.random.default_rng(seed)
    vectors = rng.normal(size=(count, len(reference.vector)))
    vectors /= np.linalg.norm(vectors, axis=1, keepdims=True)
    return [Direction(v, reference.sd, 1.0) for v in vectors]


class Injection:
    def __init__(self, layer, direction, alpha, prompt_length, first_only=False, replacement=None):
        self.layer, self.direction, self.alpha = layer, direction, alpha
        self.prompt_length, self.first_only, self.replacement = prompt_length, first_only, replacement

    def __call__(self, layer, state, offset):
        if layer != self.layer:
            return state
        import mlx.core as mx
        positions = mx.arange(offset, offset+state.shape[1])
        active = positions == self.prompt_length-1 if self.first_only else positions >= self.prompt_length-1
        active = active[None, :, None]
        if self.replacement is not None:
            return mx.where(active, mx.array(self.replacement).astype(state.dtype), state)
        if self.alpha == 0:
            return state
        # §2 h'_{l,t} = h_{l,t} + alpha s_l v_l, exactly once per forward.
        delta = mx.array(self.alpha*self.direction.sd*self.direction.vector).astype(state.dtype)
        return state + active.astype(state.dtype)*delta


def greedy(model, prompt, cap=160, eos_ids=(), intervention=None, observer=None):
    """Every invocation rebuilds caches. No cached state crosses conditions."""
    import mlx.core as mx
    from mlx_lm.models.cache import make_prompt_cache
    from .states import forward
    if cap < 1 or not prompt:
        raise ValueError('Nonempty prompt and positive cap required')
    cache = make_prompt_cache(model)
    offset, current, output = 0, list(prompt), []
    for _ in range(cap):
        logits = forward(model, mx.array([current]), cache=cache, observer=observer,
                         intervention=intervention, offset=offset)
        token = int(mx.argmax(logits[0, -1]).item())
        output.append(token)  # §5 EOS included, never silently stripped.
        if token in eos_ids:
            break
        offset += len(current)
        current = [token]
    return {'tokens': output, 'eos': output[-1] in eos_ids,
            'truncated': len(output) == cap and output[-1] not in eos_ids}


def zero_equivalence(model, prompt, intervention, atol=0):
    import mlx.core as mx
    from .states import forward
    if intervention.alpha != 0 or intervention.replacement is not None:
        raise ValueError('Expected alpha=0 without replacement')
    x = mx.array([prompt])
    ordinary = model(x)
    instrumented = forward(model, x, intervention=intervention)
    error = float(mx.max(mx.abs(ordinary-instrumented)).item())
    if error > atol:
        raise AssertionError(f'Zero intervention logit error {error} > {atol}')
    return error


def output_row(s, p, model, condition, reply=None, latency_ms=0, error=None, generation=None):
    """Gold is joined only here, after inference; rescore.ts supplies the real verdict."""
    row = {'key': digest([model, p['id'], condition]), 'model': model, 'actualModel': model,
           'strategy': 'grounded', 'probeId': p['id'], 'scenarioId': s['id'], 'split': s['split'],
           'axis': p['axis'], 'level': p['level'], 'gold': p['gold'], 'condition': condition,
           'status': 'error' if error else 'ok'}
    if error:
        row['reason'] = 'Neural generation failed; inspect the local diagnostic log'
    else:
        # Fail-closed placeholder, overwritten by locked rescore before any analysis.
        verdict = {'epistemicFaithful': False, 'calibrated': False, 'provenanceCorrect': False,
                   'abstained': False, 'sentences': []}
        attempt = {'generations': [], 'reply': reply, 'uses': None, 'verdict': verdict,
                   'protocolValid': bool(reply and reply.strip()), 'accepted': False}
        row['result'] = {'reply': reply, 'verdict': verdict, 'accepted': False, 'attempts': [attempt],
                         'escalated': False, 'latencyMs': latency_ms}
        row['neural'] = {**(generation or {}), 'needsRescore': True, 'length': len(reply or '')}
    return row
