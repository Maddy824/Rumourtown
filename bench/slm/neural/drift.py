"""Full-vocabulary FP32 conditional KL on cached greedy-base prefixes (design §5)."""
import numpy as np
from .common import Journal, digest


def conditional_kl(base_chunk, tuned_chunk, length, vocabulary, chunk_size=4096):
    """Callbacks take vocab [a,b), return FP32 logits [prefix-position,vocab-chunk].

    Two passes: full-vocabulary log normalisers, then full KL. Never top-k KL.
    Time positions may be batched by the caller; vocabulary is always exhaustive.
    """
    if length < 1 or vocabulary < 1 or chunk_size < 1:
        raise ValueError('Positive sequence/vocabulary/chunk sizes required')
    normalizers = [np.full(length, -np.inf, np.float32) for _ in range(2)]
    for a in range(0, vocabulary, chunk_size):
        b = min(a+chunk_size, vocabulary)
        for i, fn in enumerate((base_chunk, tuned_chunk)):
            logits = np.asarray(fn(a, b), np.float32)
            if logits.shape != (length, b-a) or not np.isfinite(logits).all():
                raise ValueError('Invalid logits')
            normalizers[i] = np.logaddexp(normalizers[i], np.logaddexp.reduce(logits, axis=1))
    kl = np.zeros(length, np.float32)
    for a in range(0, vocabulary, chunk_size):
        b = min(a+chunk_size, vocabulary)
        log_b = np.asarray(base_chunk(a, b), np.float32)-normalizers[0][:, None]
        log_t = np.asarray(tuned_chunk(a, b), np.float32)-normalizers[1][:, None]
        # §5 D_i = mean_t sum_v p_b(v|x,y^b_<t) log[p_b/p_t].
        kl += np.sum(np.exp(log_b)*(log_b-log_t), axis=1, dtype=np.float32)
    return {'conditional_kl': float(kl.mean(dtype=np.float32)), 'per_token': kl}


class Continuations:
    def __init__(self, directory, manifest):
        self.journal = Journal(directory, manifest, 'continuations.jsonl')

    def get_or_generate(self, probe_id, generate):
        key = digest([self.journal.directory.name, probe_id])
        if key not in self.journal.rows:
            row = generate()
            if not row['tokens'] or not isinstance(row['eos'], bool) or not isinstance(row['truncated'], bool):
                raise ValueError('Continuation must preserve EOS and cap metadata')
            self.journal.append({'key': key, 'probeId': probe_id, **row})
        return self.journal.rows[key]


def teacher_forced_logits(model, prompt, continuation):
    """Correct off-by-one alignment, including the logits predicting a generated EOS."""
    import mlx.core as mx
    from .states import forward
    if not continuation:
        raise ValueError('Empty continuation is missing, not zero drift')
    inputs = [*prompt, *continuation[:-1]]
    logits = forward(model, mx.array([inputs]))[0, len(prompt)-1:, :]
    return logits.astype(mx.float32)


def drift_regression(kl, delta_f, stories, acts, base_length, exposure, roots, replicates=10000, seed=7):
    """Signed faithfulness association on every row, never conditioned on tuned failure (§5)."""
    from .analysis import root_samples
    kl, stories, acts = np.asarray(kl), np.asarray(stories), np.asarray(acts)
    logd = np.log1p(kl)
    columns = [np.ones(len(kl)), logd, stories, logd*stories, np.asarray(base_length)]
    columns += [(acts == a).astype(float) for a in np.unique(acts)[1:]]
    e = np.asarray(exposure)
    columns.extend(e.T if e.ndim == 2 else [e])
    x, y = np.column_stack(columns), np.asarray(delta_f)
    coef = np.linalg.lstsq(x, y, rcond=None)[0]
    boots = np.array([np.linalg.lstsq(x[ix], y[ix], rcond=None)[0]
                      for ix in root_samples(roots, replicates, seed)])
    return {'coefficients': coef, 'interval': np.quantile(boots, [.025, .975], axis=0),
            'rank': int(np.linalg.matrix_rank(x)), 'columns': x.shape[1]}
