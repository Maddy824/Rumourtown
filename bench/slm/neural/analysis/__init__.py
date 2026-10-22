"""Paired root/run inference; one resample shared by every condition (§0, §3)."""
import numpy as np
from ..probes import average_ranks


def root_samples(roots, replicates=10000, seed=7, strata=None):
    roots = np.asarray(roots)
    unique = np.unique(roots)
    if not len(unique):
        raise ValueError('Empty roots')
    members = {r: np.flatnonzero(roots == r) for r in unique}
    # methods-formal §7: optional seed strata preserve all prespecified act support.
    if strata is None:
        pools = [unique]
    else:
        strata = np.asarray(strata)
        labels = {r: np.unique(strata[members[r]]) for r in unique}
        if any(len(v) != 1 for v in labels.values()):
            raise ValueError('A root cannot cross bootstrap strata')
        pools = [[r for r in unique if labels[r][0] == s] for s in np.unique(strata)]
    rng = np.random.default_rng(seed)
    for _ in range(replicates):
        yield np.concatenate([members[r] for pool in pools for r in rng.choice(pool, len(pool), replace=True)])


def spearman(x, y):
    x, y = average_ranks(x), average_ranks(y)
    return float(np.corrcoef(x, y)[0, 1]) if np.std(x)*np.std(y) else float('nan')


def tau_b(x, y):
    x, y = np.asarray(x), np.asarray(y)
    i, j = np.triu_indices(len(x), 1)
    a, b = np.sign(x[i]-x[j]), np.sign(y[i]-y[j])
    # §3 Kendall tau_b corrects ties on both axes.
    denom = np.sqrt(np.count_nonzero(a)*np.count_nonzero(b))
    return float(np.sum(a*b)/denom) if denom else float('nan')


def grid_associations(parameter_counts, cell_outcomes, base, roots, replicates=10000, seed=7, strata=None, acts=None):
    """Arrays are [row, cell] (18 cells for the actual factorial). Erosion is signed."""
    outcomes, base = np.asarray(cell_outcomes), np.asarray(base)
    acts = np.zeros(len(roots), int) if acts is None else np.asarray(acts)
    fixed = np.unique(acts)
    def statistic(ix):
        erosion = macro(base[ix, None]-outcomes[ix], acts[ix], fixed)  # §3 positive macro story erosion.
        return [spearman(parameter_counts, erosion), tau_b(parameter_counts, erosion)]
    estimates = statistic(np.arange(len(roots)))
    boots = np.array([statistic(ix) for ix in root_samples(roots, replicates, seed, strata)])
    return {'spearman': estimates[0], 'tau_b': estimates[1],
            'intervals': np.nanquantile(boots, [.025, .975], axis=0).tolist(),
            'undefined_replicates': np.isnan(boots).sum(0).tolist(), 'bootstrap': boots}


def holm(pvalues):
    p = np.asarray(pvalues, float)
    order = np.argsort(p, kind='stable')
    out = np.empty_like(p)
    out[order] = np.minimum(1., np.maximum.accumulate(p[order]*(len(p)-np.arange(len(p)))))
    return out


def macro(values, acts, fixed_acts):
    values, acts = np.asarray(values), np.asarray(acts)
    if any(not np.any(acts == a) for a in fixed_acts):
        raise ValueError('Bootstrap replicate lost fixed act support; supply seed strata')
    # methods-formal §7: mean of within-act paired row outcomes, never marginal products.
    return np.mean([values[acts == a].mean(axis=0) for a in fixed_acts], axis=0)


def paired_contrasts(differences, roots, acts=None, margins=None, replicates=10000, seed=7, strata=None):
    d = np.asarray(differences, float)
    if d.ndim == 1:
        d = d[:, None]
    acts = np.zeros(len(d), int) if acts is None else np.asarray(acts)
    fixed = np.unique(acts)
    estimate = macro(d, acts, fixed)
    boot = np.array([macro(d[ix], acts[ix], fixed) for ix in root_samples(roots, replicates, seed, strata)])
    h = np.zeros(d.shape[1]) if margins is None else np.asarray(margins)
    # methods-formal §7 centred one-sided bootstrap margin test and Holm family.
    p = (1+np.sum(boot-estimate >= estimate-h, axis=0))/(replicates+1)
    return {'estimate': estimate, 'interval': np.quantile(boot, [.025, .975], axis=0),
            'p': p, 'holm_p': holm(p), 'bootstrap': boot}


def crossed_bootstrap(values, roots, statistic, replicates=10000, seed=7, paired_runs=True):
    """[run,row,arm,...]; matched seeds paired, otherwise arms resampled independently."""
    a = np.asarray(values)
    rng = np.random.default_rng(seed)
    result = []
    for ix in root_samples(roots, replicates, seed+1):
        if paired_runs:
            sampled = a[rng.integers(len(a), size=len(a))][:, ix]
        else:
            sampled = np.stack([a[rng.integers(len(a), size=len(a)), :, arm][:, ix]
                                for arm in range(a.shape[2])], axis=2)
        result.append(statistic(sampled.mean(0)))
    return np.asarray(result)


def monotone_mapping(mu, training_propensity, alpha, steering_propensity):
    """Development-only monotone nearest-curve fit, dynamic programming (§2)."""
    mu, alpha = np.asarray(mu), np.asarray(alpha)
    if np.any(np.diff(mu) <= 0) or np.any(np.diff(alpha) <= 0):
        raise ValueError('mu and alpha grids must be strictly increasing')
    target, source = np.asarray(training_propensity), np.asarray(steering_propensity)
    if target.ndim == 1:
        target, source = target[:, None], source[:, None]
    loss = ((target[:, None, :]-source[None, :, :])**2).mean(-1)
    best = None
    for sign in (1, -1):
        costs = loss if sign == 1 else loss[:, ::-1]
        dp, paths = costs[0].copy(), [[j] for j in range(len(alpha))]
        for row in costs[1:]:
            parent = [int(np.argmin(dp[:j+1])) for j in range(len(alpha))]
            paths = [paths[parent[j]]+[j] for j in range(len(alpha))]
            dp = row + np.array([dp[k] for k in parent])
        j = int(np.argmin(dp))
        indices = paths[j] if sign == 1 else [len(alpha)-1-k for k in paths[j]]
        candidate = (dp[j], indices)
        if best is None or candidate[0] < best[0]:
            best = candidate
    return {'mu': mu.tolist(), 'alpha': alpha[best[1]].tolist(), 'indices': best[1], 'loss': float(best[0])}


def mapped_equivalence(steering, training, mapping, roots, margins=.02, replicates=10000, seed=7, acts=None, strata=None):
    """Confirmation [row,alpha/mu,outcome]; all four §2 outcomes jointly covered."""
    d = np.asarray(steering)[:, mapping['indices'], :]-np.asarray(training)
    acts = np.zeros(len(d), int) if acts is None else np.asarray(acts)
    fixed = np.unique(acts)
    # A caller can pass precomputed per-opportunity rate contributions for O and leakage;
    # use mapped_rate_equivalence below when the denominators differ by outcome.
    estimate = macro(d, acts, fixed)
    boot = np.array([macro(d[ix], acts[ix], fixed) for ix in root_samples(roots, replicates, seed, strata)])
    return simultaneous_equivalence(estimate, boot, margins)


def simultaneous_equivalence(estimate, boot, margins=.02, confidence=.95):
    # §2 simultaneous sup-norm intervals for every mapped mu/outcome contrast.
    radius = float(np.quantile(np.max(np.abs(boot-estimate).reshape(len(boot), -1), axis=1), confidence))
    lower, upper = estimate-radius, estimate+radius
    return {'estimate': estimate, 'lower': lower, 'upper': upper,
            'equivalent': bool(np.all((lower > -np.asarray(margins)) & (upper < np.asarray(margins)))),
            'radius': radius}


def mapped_rate_equivalence(steering, training, mapping, roots, reducer, margins=.02, replicates=10000, seed=7):
    """reducer(data, row_indices) recomputes fixed denominators/act means (§2)."""
    s, t = np.asarray(steering)[:, mapping['indices']], np.asarray(training)
    all_rows = np.arange(len(roots))
    estimate = reducer(s, all_rows)-reducer(t, all_rows)
    boot = np.array([reducer(s[ix], ix)-reducer(t[ix], ix) for ix in root_samples(roots, replicates, seed)])
    return simultaneous_equivalence(estimate, boot, margins)
