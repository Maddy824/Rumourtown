"""Covered-alternative policy geometry, not world-truth calibration (design §6)."""
import numpy as np


def first_token_masses(probabilities, alternatives):
    p = np.asarray(probabilities, float)
    if p.ndim != 1 or np.any(p < 0) or not np.isclose(p.sum(), 1, atol=1e-6):
        raise ValueError('Expected full-vocabulary probabilities')
    used, result = set(), {}
    for group, tokens in alternatives.items():
        tokens = set(tokens)
        if any(t < 0 or t >= len(p) for t in tokens):
            raise ValueError('Alternative token outside vocabulary')
        if used & tokens:
            raise ValueError('First-token sets must be disjoint and frozen on development')
        used |= tokens
        result[group] = float(p[list(tokens)].sum())
    result['uncovered'] = float(1-sum(result.values()))
    return result


def trie_masses(alternatives, next_probabilities):
    """Probability of the union of complete alternatives; shared prefix evaluated once.

    A terminal prefix subsumes descendants in its group. Cross-group prefix ambiguity
    is rejected: otherwise complete-alternative masses would double-count probability.
    next_probabilities(prefix) returns a full normalized distribution, no oracle input.
    """
    root = {'children': {}, 'group': None}
    def insert(node, sequence, group):
        if not sequence:
            if node['group'] is not None and node['group'] != group:
                raise ValueError('Alternative belongs to multiple groups')
            node['group'] = group
            return
        child = node['children'].setdefault(sequence[0], {'children': {}, 'group': None})
        insert(child, sequence[1:], group)
    for group, sequences in alternatives.items():
        for sequence in sequences:
            if not sequence:
                raise ValueError('Empty alternative')
            insert(root, list(sequence), group)
    def groups(node):
        return ({node['group']} if node['group'] else set()).union(*(groups(c) for c in node['children'].values()))
    def validate(node):
        if node['group'] and groups(node) != {node['group']}:
            raise ValueError('Cross-group prefix overlap')
        for child in node['children'].values():
            validate(child)
    validate(root)
    masses = dict.fromkeys(alternatives, 0.)
    def visit(node, prefix, mass):
        if node['group']:
            masses[node['group']] += mass
            return
        p = np.asarray(next_probabilities(tuple(prefix)), float)
        for token, child in node['children'].items():
            visit(child, [*prefix, token], mass*p[token])
    visit(root, [], 1.)
    masses['uncovered'] = float(1-sum(masses.values()))
    return masses


def policy_ece(masses, warranted, bins=10):
    """masses columns assertion, hedge, deny/withhold; g follows formal confidence rule."""
    if bins != 10:
        raise ValueError('Design §6 freezes ten bins')
    masses, g = np.asarray(masses, float), np.asarray(warranted, float)
    if masses.shape != (len(g), 3) or np.any(masses < 0) or np.any(masses.sum(axis=1) > 1+1e-6) or not np.isin(g, [0, 1]).all():
        raise ValueError('Invalid policy masses/labels')
    covered = masses.sum(axis=1)
    valid = covered > 0
    q = np.divide(masses[:, 0], covered, out=np.full(len(g), np.nan), where=valid)
    counts, summary, ece = [], [], 0.
    for b in range(bins):
        ix = valid & (np.minimum((np.nan_to_num(q)*bins).astype(int), bins-1) == b)
        n = int(ix.sum())
        counts.append(n)
        avg_q, avg_g = (float(q[ix].mean()), float(g[ix].mean())) if n else (None, None)
        if n:
            # §6 ECE_policy = sum_b n_b/n |mean(q)_b-mean(g)_b| on covered rows.
            ece += n/max(1, valid.sum())*abs(avg_q-avg_g)
        summary.append({'n': n, 'q': avg_q, 'g': avg_g})
    return {'ece_policy': float(ece) if valid.any() else None,
            'brier': float(np.mean((q[valid]-g[valid])**2)) if valid.any() else None,
            'bin_counts': counts, 'bins': summary, 'uncovered_rows': int((~valid).sum()),
            'uncovered_mass': (1-covered).tolist(), 'q': q}


def geometry(masses, epsilon=1e-8):
    # §6 three-way masses retain denial; assertion/hedge ratio alone is incomplete.
    return np.log((np.asarray(masses)[:, 0]+epsilon)/(np.asarray(masses)[:, 1]+epsilon))
