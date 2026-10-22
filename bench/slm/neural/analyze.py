"""CPU state analysis with locked root partitions, fit manifests and paired directions (§1–2)."""
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
from .common import atomic_json, digest, file_hash, hashes, jsonl
from . import probes
from .analysis import root_samples


def lock_partitions(partitions):
    required = ('fit', 'selection', 'confirmation')
    for name in required:
        if name not in partitions or not partitions[name]:
            raise ValueError(f'Missing/nonempty root partition: {name}')
    for i, name in enumerate(required):
        for other in required[i+1:]:
            if set(partitions[name]) & set(partitions[other]):
                raise ValueError(f'Root leakage between {name} and {other}')
    return {name: set(partitions[name]) for name in required}


def open_states(directory):
    directory = Path(directory)
    layout = json.loads((directory/'layout.json').read_text())
    rows = list(jsonl(directory/'index.jsonl'))
    if len({r['probeId'] for r in rows}) != len(rows):
        raise ValueError('Duplicate state probe IDs')
    values = np.memmap(directory/'states.f16', dtype=np.float16, mode='r', shape=tuple(layout['shape']))
    for row in rows:
        if hashlib.sha256(values[row['slot']].tobytes()).hexdigest() != row['stateHash']:
            raise ValueError('Pooled state checksum mismatch')
    return rows, values, layout


def final_fit(x, y, roots, seed=7):
    losses = []
    classes = np.unique(y)
    for C in probes.C_GRID:
        losses.append(np.mean([probes.fit_logistic(x[fit], y[fit], C, classes=classes).score(x[val], y[val])['log_loss']
                               for fit, val in probes.group_folds(roots, 5, seed)]))
    C = probes.C_GRID[int(np.argmin(losses))]
    return probes.fit_logistic(x, y, C, classes=classes)


def write_json_safe(path, value):
    """Undefined classes/intervals are JSON null, never silently discarded."""
    def safe(v):
        if isinstance(v, np.ndarray):
            return safe(v.tolist())
        if isinstance(v, (float, np.floating)):
            return float(v) if np.isfinite(v) else None
        if isinstance(v, np.integer):
            return int(v)
        if isinstance(v, dict):
            return {str(k): safe(x) for k, x in v.items()}
        if isinstance(v, (tuple, list)):
            return [safe(x) for x in v]
        return v
    atomic_json(path, safe(value))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--states', required=True, help='pooled/ directory')
    parser.add_argument('--sidecar', required=True)
    parser.add_argument('--partitions', required=True, help='JSON lists: fit, selection, confirmation roots')
    parser.add_argument('--out', required=True)
    parser.add_argument('--target-states', help='Aligned second checkpoint, same IDs and positions')
    parser.add_argument('--label', choices=('known', 'band', 'act'), default='known')
    parser.add_argument('--position', type=int, default=0, choices=(0, 1, 2))
    parser.add_argument('--permutations', type=int, default=20)
    parser.add_argument('--replicates', type=int, default=10000)
    parser.add_argument('--refits', type=int, default=100)
    args = parser.parse_args()
    partitions = lock_partitions(json.loads(Path(args.partitions).read_text()))
    sidecar = {s['probeId']: s for s in jsonl(args.sidecar)}
    index, values, layout = open_states(args.states)
    rows = [r for r in index if sidecar[r['probeId']]['root'] in partitions['fit'] and sidecar[r['probeId']]['labels'][args.label] is not None]
    if not rows:
        raise ValueError('No fitting rows for label')
    roots = np.array([sidecar[r['probeId']]['root'] for r in rows])
    raw_y = np.array([sidecar[r['probeId']]['labels'][args.label] for r in rows])
    classes, y = np.unique(raw_y, return_inverse=True)
    slots = [r['slot'] for r in rows]
    selection_rows = [r for r in index if sidecar[r['probeId']]['root'] in partitions['selection'] and
                      sidecar[r['probeId']]['labels'][args.label] is not None]
    selection_y = np.array([np.flatnonzero(classes == sidecar[r['probeId']]['labels'][args.label])[0]
                            for r in selection_rows])
    # §1 structured nulls exchange complete, aligned descendant label vectors by root.
    # Preserve public act/wording family and pair layout, not the tested knowledge label.
    strata = np.array([digest([sidecar[r['probeId']]['wordingFamily'],
                              sidecar[r['probeId']]['gold']['behaviour'] if args.label != 'act' else None]) for r in rows])
    target = None
    if args.target_states:
        target_index, target_values, target_layout = open_states(args.target_states)
        if target_layout['labels'] != layout['labels']:
            raise ValueError('Target layers differ')
        target_slots = {r['probeId']: r['slot'] for r in target_index}
        if any(r['probeId'] not in target_slots for r in rows):
            raise ValueError('Missing paired target states')
        target = target_values[[target_slots[r['probeId']] for r in rows], :, args.position].astype(float)
    manifest = {'partitions_hash': file_hash(args.partitions), 'sidecar_hash': file_hash(args.sidecar),
                'source_state_manifest': json.loads((Path(args.states)/'manifest.json').read_text()),
                'label': args.label, 'classes': classes.tolist(), 'position': args.position,
                'permutations': args.permutations, 'replicates': args.replicates, 'refits': args.refits,
                'fit_ids': [r['probeId'] for r in rows], 'fitting_only': True}
    manifest['analysis_source'] = hashes([Path(__file__), Path(probes.__file__), *Path(__file__).parent.joinpath('analysis').glob('*.py')])
    if args.target_states:
        manifest['target_state_manifest'] = json.loads((Path(args.target_states)/'manifest.json').read_text())
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    if (out/'manifest.json').exists() and json.loads((out/'manifest.json').read_text()) != manifest:
        raise ValueError('Analysis resume manifest mismatch')
    atomic_json(out/'manifest.json', manifest)
    summaries, block_scores, block_boot, block_null, block_null_boot = {}, [], [], [], []
    for layer, label in enumerate(layout['labels']):
        x = values[slots, layer, args.position].astype(float)
        missing = ~np.isfinite(x).all(axis=1)
        if missing.any():
            summaries[label] = {'missing_rows': int(missing.sum()), 'total_rows': len(x),
                                'status': 'missing; no emergence selection on incomplete rows'}
            continue
        cv = probes.nested_probe(x, y, roots)
        fit = final_fit(x, y, roots)
        fit.save(out/f'{label.replace(":", "-")}.npz')
        # Same root samples for every layer, observed/null and both checkpoints.
        ix_samples = list(root_samples(roots, args.replicates, 7))
        boot = np.array([probes.auroc(y[ix], cv['predictions'][ix]) for ix in ix_samples])
        null_scores, null_boots, null_manifests = [], [], []
        for p in range(args.permutations):
            permuted, pm = probes.structured_permutation(y, roots, strata, seed=100+p)
            if pm['exchangeable_roots'] < 2:
                raise ValueError('Structured null has no exchangeable roots; export matched root layouts')
            null = probes.nested_probe(x, permuted, roots)
            null_scores.append(null['auroc'])
            null_boots.append([probes.auroc(permuted[ix], null['predictions'][ix]) for ix in ix_samples])
            null_manifests.append(pm)
        summary = {'classes': classes.tolist(), 'missing_rows': 0, 'cv': {k: v for k, v in cv.items() if k != 'predictions'},
                   'bootstrap_interval': np.nanquantile(boot, [.025, .975]),
                   'undefined_bootstraps': int(np.isnan(boot).sum()),
                   'null_auroc': null_scores, 'null_manifests': null_manifests,
                   'fit_C': fit.C}
        if selection_rows:
            selection_x = values[[r['slot'] for r in selection_rows], layer, args.position].astype(float)
            summary['selection_transfer'] = fit.score(selection_x, selection_y)
            summary['refit_uncertainty'] = probes.refit_bootstrap(x, y, roots, selection_x, selection_y, fit.C, args.refits)
        else:
            summary['refit_uncertainty'] = {'status': 'missing selection-root states'}
        if target is not None:
            z = target[:, layer]
            target_cv = probes.nested_probe(z, y, roots)
            summary['cka'] = probes.cka_controls(x, z)
            summary['base_to_tuned'] = probes.nested_transfer(x, z, y, roots, cv)
            summary['tuned_to_base'] = probes.nested_transfer(z, x, y, roots, target_cv)
            summary['target_within_refit'] = {k: v for k, v in target_cv.items() if k != 'predictions'}
        # §2 directions fitted only on explicit matched pair IDs, not guessed from similar text.
        pair_rows = {}
        for i, r in enumerate(rows):
            pair = sidecar[r['probeId']].get('pairId')
            if pair is not None:
                pair_rows.setdefault(pair, []).append(i)
        pairs = [(ix[0], ix[1]) for ix in pair_rows.values() if len(ix) == 2 and set(y[ix]) == {0, 1}]
        if args.label == 'known' and pairs:
            from .steer import direction
            k = [a if y[a] == 1 else b for a, b in pairs]
            u = [b if y[a] == 1 else a for a, b in pairs]
            for name, d in [('mean', direction(x[k], x[u])),
                            ('probe', direction(x[k], x[u], fit.weights[:, 0], fit.scaler.scale))]:
                if d:
                    d.save(out/f'direction-{label.replace(":", "-")}-{name}.npz')
            summary['matched_pairs'] = len(pairs)
        summaries[label] = summary
        if label.startswith('block:'):
            block_scores.append(cv['auroc'])
            block_boot.append(boot)
            block_null.append(np.mean(null_scores))
            block_null_boot.append(np.mean(null_boots, axis=0))
    if len(block_scores) == len(layout['labels'])-2 and block_scores:
        summaries['emergence'] = probes.emergence(block_scores, np.array(block_boot).T,
                                                block_null, np.array(block_null_boot).T)
    write_json_safe(out/'summary.json', summaries)


if __name__ == '__main__':
    main()
