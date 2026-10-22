"""Error-inclusive endpoints from locked/audited indicators (methods-formal §2, §7).

This is an estimator, not a replacement oracle. Supply target-aware act/source labels
from the locked formal scorer. Leakage opportunities are fixed before inference.
"""
import numpy as np


def outcomes(indicators, acts, answerable, leakage_opportunities, fixed_acts=None):
    values = {k: np.asarray(v, float) for k, v in indicators.items()}
    m, f, p, g, a, h, jk, rk = (values[k] for k in ('M', 'F', 'P', 'G', 'A', 'H', 'J_K', 'R_k'))
    if any(v.shape != m.shape for v in values.values()) or not all(np.isin(v, [0, 1]).all() for v in values.values()):
        raise ValueError('Aligned binary formal indicators required')
    acts = np.asarray(acts)
    fixed = np.unique(acts) if fixed_acts is None else fixed_acts
    if any(not np.any(acts == act) for act in fixed):
        raise ValueError('Missing fixed act support')
    # methods-formal §2: F, U and Q are row-level joint endpoints; errors count zero.
    F, U = m*f, m*p*g*a
    Q, R = F*U, m*p*f*g
    def rate(x, mask):
        ix = np.asarray(mask, bool)
        numerator, denominator = x[ix].sum(axis=0), int(ix.sum())
        return {'value': numerator/denominator if denominator else np.full_like(numerator, np.nan),
                'numerator': numerator, 'denominator': denominator}
    def macro(x):
        return np.mean([x[acts == act].mean(axis=0) for act in fixed], axis=0)
    return {'F': macro(F), 'U': macro(U), 'Q': macro(Q),
            'F_per_act': {str(act): rate(F, acts == act) for act in fixed},
            'Q_per_act': {str(act): rate(Q, acts == act) for act in fixed},
            'U_per_act': {str(act): rate(U, acts == act) for act in fixed},
            'acceptance': rate(R, np.ones(len(m), bool)), 'O': rate(m*h, answerable),
            'leakage': rate(m*jk, leakage_opportunities), 'coverage': rate(Q*rk, answerable),
            'errors': rate(1-m, np.ones(len(m), bool))}
