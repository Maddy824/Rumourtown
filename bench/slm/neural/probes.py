"""NumPy-only grouped linear probes and representation comparisons (design §1)."""
from dataclasses import dataclass
import numpy as np

C_GRID = (1e-3, 1e-2, 1e-1, 1., 10.)


def sigmoid(x):
    return np.exp(-np.logaddexp(0., -np.asarray(x)))


def auroc(y, score):
    y, score = np.asarray(y), np.asarray(score)
    if score.ndim == 2:
        values = [auroc(y == c, score[:, c]) for c in range(score.shape[1])]
        return float(np.mean(values)) if np.isfinite(values).all() else float('nan')
    positive = y.astype(bool)
    n1, n0 = positive.sum(), (~positive).sum()
    if not n1 or not n0:
        return float('nan')
    ranks = average_ranks(score)
    # §1 Mann–Whitney AUROC, with average ranks for ties.
    return float((ranks[positive].sum()-n1*(n1+1)/2)/(n1*n0))


def average_ranks(values):
    values = np.asarray(values)
    order = np.argsort(values, kind='stable')
    ranks = np.empty(len(values), float)
    i = 0
    while i < len(order):
        j = i+1
        while j < len(order) and values[order[j]] == values[order[i]]:
            j += 1
        ranks[order[i:j]] = (i+1+j)/2
        i = j
    return ranks


def log_loss(y, probabilities):
    p = np.clip(np.asarray(probabilities), 1e-12, 1-1e-12)
    y = np.asarray(y, int)
    # §1 transfer includes log loss: AUROC alone misses intercept shifts.
    return float(-np.mean(y*np.log(p)+(1-y)*np.log1p(-p))) if p.ndim == 1 else float(-np.log(p[np.arange(len(y)), y]).mean())


@dataclass
class Scaler:
    mean: np.ndarray
    scale: np.ndarray

    @classmethod
    def fit(cls, x):
        scale = np.std(x, axis=0)
        return cls(np.mean(x, axis=0), np.where(scale > 0, scale, 1.))

    def transform(self, x):
        return (np.asarray(x)-self.mean)/self.scale


@dataclass
class Fit:
    scaler: Scaler
    weights: np.ndarray
    intercept: np.ndarray
    classes: np.ndarray
    C: float

    def predict(self, x):
        p = sigmoid(self.scaler.transform(x) @ self.weights + self.intercept)
        return p[:, 0] if len(self.classes) == 2 else p/p.sum(axis=1, keepdims=True)

    def score(self, x, y):
        encoded = np.searchsorted(self.classes, y)
        if not np.isin(y, self.classes).all():
            raise ValueError('Target contains a class absent from source fit')
        p = self.predict(x)
        return {'auroc': auroc(encoded, p), 'log_loss': log_loss(encoded, p)}

    def save(self, path):
        np.savez(path, mean=self.scaler.mean, scale=self.scaler.scale, weights=self.weights,
                 intercept=self.intercept, classes=self.classes, C=self.C)

    @classmethod
    def load(cls, path):
        with np.load(path) as a:
            return cls(Scaler(a['mean'], a['scale']), a['weights'], a['intercept'], a['classes'], float(a['C']))


def fit_logistic(x, y, C=1., steps=2000, tolerance=1e-8, classes=None):
    x, y = np.asarray(x, float), np.asarray(y)
    if not np.isfinite(x).all() or C <= 0:
        raise ValueError('Nonfinite features or invalid C')
    classes = np.unique(y) if classes is None else np.asarray(classes)
    if len(classes) < 2 or not all(np.any(y == c) for c in classes):
        raise ValueError('Missing fitting class')
    scaler = Scaler.fit(x)  # §1 scaler fitted only on the fitting roots.
    z = scaler.transform(x)
    targets = (y == classes[-1])[:, None] if len(classes) == 2 else (y[:, None] == classes)
    w, b = np.zeros((x.shape[1], targets.shape[1])), np.zeros(targets.shape[1])
    # §1 L2 logistic objective: mean BCE + ||w||²/(2 C n); intercept unpenalised.
    regularizer = 1/(C*len(x))
    design = np.column_stack([z, np.ones(len(z))])
    # §1 GD step bound without a full SVD for every fold/C. Frobenius is a safe
    # spectral upper bound; backtracking below permits faster steps on wide states.
    rate = 1/(.25*np.sum(design*design)/len(z)+regularizer)
    for _ in range(steps):
        logits = z@w+b
        residual = sigmoid(logits)-targets
        dw = z.T @ residual/len(z) + regularizer*w
        db = residual.mean(axis=0)
        current = float(np.mean(np.logaddexp(0, logits)-targets*logits)*targets.shape[1] + .5*regularizer*np.sum(w*w))
        for _ in range(30):
            next_w, next_b = w-rate*dw, b-rate*db
            next_logits = z@next_w+next_b
            objective = float(np.mean(np.logaddexp(0, next_logits)-targets*next_logits)*targets.shape[1] + .5*regularizer*np.sum(next_w*next_w))
            if objective <= current+1e-12:
                break
            rate *= .5
        else:
            raise RuntimeError('Logistic GD line search failed')
        w, b = next_w, next_b
        rate *= 1.05
        if max(np.abs(dw).max(), np.abs(db).max()) < tolerance:
            break
    return Fit(scaler, w, b, classes, C)


def group_folds(roots, n=5, seed=7):
    roots = np.asarray(roots)
    unique = np.unique(roots)
    if len(unique) < n or n < 2:
        raise ValueError('Insufficient roots for grouped folds')
    shuffled = np.random.default_rng(seed).permutation(unique)
    for test_roots in np.array_split(shuffled, n):
        test = np.isin(roots, test_roots)
        yield np.flatnonzero(~test), np.flatnonzero(test)


def nested_probe(x, y, roots, outer=5, inner=4, seed=7, grid=C_GRID):
    x, y, roots = np.asarray(x), np.asarray(y), np.asarray(roots)
    classes = np.unique(y)
    oof = np.full((len(y),) if len(classes) == 2 else (len(y), len(classes)), np.nan)
    manifest = []
    for fold, (train, test) in enumerate(group_folds(roots, outer, seed)):
        losses = []
        for C in grid:
            scores = []
            for fit, val in group_folds(roots[train], inner, seed+fold+1):
                model = fit_logistic(x[train[fit]], y[train[fit]], C, classes=classes)
                scores.append(model.score(x[train[val]], y[train[val]])['log_loss'])
            losses.append(np.mean(scores))
        selected = grid[int(np.argmin(losses))]
        model = fit_logistic(x[train], y[train], selected, classes=classes)
        oof[test] = model.predict(x[test])
        manifest.append({'fold': fold, 'C': selected, 'inner_log_loss': list(map(float, losses)),
                         'fit_roots': np.unique(roots[train]).tolist(), 'test_roots': np.unique(roots[test]).tolist(),
                         'classes': classes.tolist(), 'missing_test_classes': [str(c) for c in classes if c not in y[test]],
                         **model.score(x[test], y[test])})
    encoded = np.searchsorted(classes, y)
    return {'predictions': oof, 'folds': manifest, 'classes': classes.tolist(),
            'auroc': auroc(encoded, oof), 'log_loss': log_loss(encoded, oof)}


def structured_permutation(y, roots, strata, seed=7):
    """Exchange whole root label vectors within identical structures, preserving pair order.

    Callers must order descendants identically and pass act/template/pair-layout strata.
    Singleton structures stay fixed and are reported rather than shuffled row by row.
    """
    y, roots, strata = np.asarray(y), np.asarray(roots), np.asarray(strata)
    groups = {}
    for root in np.unique(roots):
        ix = np.flatnonzero(roots == root)
        groups.setdefault(tuple(strata[ix].tolist()), []).append(ix)
    result = y.copy()
    rng, movable = np.random.default_rng(seed), 0
    for members in groups.values():
        sources = rng.permutation(len(members))
        movable += len(members) if len(members) > 1 else 0
        for target, source in zip(members, sources):
            result[target] = y[members[source]]
    return result, {'exchangeable_roots': movable, 'total_roots': len(np.unique(roots))}


def root_bootstrap(y, scores, roots, replicates=10000, seed=7):
    from .analysis import root_samples
    values = np.array([auroc(np.asarray(y)[ix], np.asarray(scores)[ix]) for ix in root_samples(roots, replicates, seed)])
    valid = values[np.isfinite(values)]
    return {'auroc': auroc(y, scores), 'interval': np.quantile(valid, [.025, .975]).tolist() if len(valid) else None,
            'undefined_replicates': int(len(values)-len(valid)), 'bootstrap': values}


def emergence(scores, boot_scores, null_scores, boot_null, thresholds=(.8, .75, .85, .9), confidence=.95):
    scores, null_scores = np.asarray(scores), np.asarray(null_scores)
    # §1 simultaneous root-bootstrap band on excess above the structured null,
    # shifted to chance .5. Shared root resamples must be used for observed/null.
    excess = scores-null_scores
    error = np.max((np.asarray(boot_scores)-np.asarray(boot_null))-excess, axis=1)
    lower = .5+excess-np.quantile(error, confidence)
    result = {}
    for threshold in thresholds:
        valid = (scores >= threshold) & (lower > .5)
        layer = next((i+1 for i in range(len(scores)-2) if valid[i:i+3].all()), None)
        result[str(threshold)] = {'layer': layer, 'fraction': layer/len(scores) if layer else None}
    return {'thresholds': result, 'simultaneous_lower': lower.tolist()}


def linear_cka(x, y, unbiased=False):
    x, y = np.asarray(x, float), np.asarray(y, float)
    if len(x) != len(y):
        raise ValueError('CKA requires identical rows')
    if unbiased:
        if len(x) < 4:
            raise ValueError('Unbiased HSIC requires n >= 4')
        def hsic(k, l):
            n = len(k)
            k, l = k.copy(), l.copy()
            np.fill_diagonal(k, 0)
            np.fill_diagonal(l, 0)
            return (np.sum(k*l)+k.sum()*l.sum()/((n-1)*(n-2))-2*np.sum(k.sum(0)*l.sum(0))/(n-2))/(n*(n-3))
        k, l = x@x.T, y@y.T
        a, b = hsic(k, k), hsic(l, l)
        return float(hsic(k, l)/np.sqrt(a*b)) if a*b > 0 else float('nan')
    x, y = x-x.mean(0), y-y.mean(0)
    # §1 column-centred linear CKA, rotation invariant.
    denom = np.linalg.norm(x.T@x)*np.linalg.norm(y.T@y)
    return float(np.linalg.norm(x.T@y)**2/denom) if denom else float('nan')


def cka_controls(x, y, sizes=(64, 128, 256), seed=7):
    rng = np.random.default_rng(seed)
    return {'cka': linear_cka(x, y), 'identical': linear_cka(x, x),
            'permuted': linear_cka(x, np.asarray(y)[rng.permutation(len(y))]),
            'unbiased': linear_cka(x, y, True),
            'sample_size': {str(n): linear_cka(np.asarray(x)[:n], np.asarray(y)[:n]) for n in sizes if n <= len(x)}}


def transfer(source_fit, target_x, target_y):
    """Source scaler, weights and intercept are all frozen (design §1)."""
    return source_fit.score(target_x, target_y)


def nested_transfer(source_x, target_x, y, roots, source_cv):
    """Frozen source fits applied only to paired outer-test roots (§1)."""
    source_x, target_x, y, roots = map(np.asarray, (source_x, target_x, y, roots))
    classes = np.unique(y)
    scores = np.full((len(y),) if len(classes) == 2 else (len(y), len(classes)), np.nan)
    for fold in source_cv['folds']:
        fitting = np.isin(roots, fold['fit_roots'])
        testing = np.isin(roots, fold['test_roots'])
        frozen = fit_logistic(source_x[fitting], y[fitting], fold['C'], classes=classes)
        scores[testing] = frozen.predict(target_x[testing])
    encoded = np.searchsorted(classes, y)
    return {'auroc': auroc(encoded, scores), 'log_loss': log_loss(encoded, scores)}


def refit_bootstrap(x, y, roots, test_x, test_y, C, replicates=100, seed=7):
    """Refit uncertainty separately from fixed-prediction root intervals (§1)."""
    from .analysis import root_samples
    x, y, test_y = np.asarray(x), np.asarray(y), np.asarray(test_y)
    classes = np.unique(y)
    metrics, missing = [], 0
    for ix in root_samples(roots, replicates, seed):
        if not np.array_equal(np.unique(y[ix]), classes):
            missing += 1
            continue
        fit = fit_logistic(x[ix], y[ix], C, classes=classes)
        score = fit.score(test_x, test_y)
        metrics.append([score['auroc'], score['log_loss']])
    return {'intervals': np.nanquantile(metrics, [.025, .975], axis=0).tolist() if metrics else None,
            'metrics': ['auroc', 'log_loss'], 'missing_class_refits': missing,
            'successful_refits': len(metrics), 'evaluation': 'fixed selection roots'}
