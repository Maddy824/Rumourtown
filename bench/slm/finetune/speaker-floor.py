"""Offline, resumable speaker-floor controller. Preparation imports no MLX code."""
import argparse
from contextlib import contextmanager
import fcntl
from importlib.metadata import distribution, version
import json
import math
import os
from pathlib import Path
import re
import shutil
import signal
import socket
import struct
import subprocess
import sys
import threading
import time

from speaker_floor_common import atomic_json, digest, latest_jsonl, messages_for_model

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
OUT = ROOT / 'bench/slm/data/speaker-floor-45'
MODELS = [
    ('smol360m', 'HuggingFaceTB/SmolLM2-360M-Instruct', 'Apache-2.0'),
    # Gemma 3 270M is gated on Hugging Face; excluded until the owner accepts its terms (controller ruling, 24 Oct).
    # ('gemma270m', 'google/gemma-3-270m-it', 'Gemma terms'),
    ('lfm350m', 'LiquidAI/LFM2-350M', 'LFM licence; research only in this experiment'),
    ('qwen06b', 'mlx-community/Qwen3-0.6B-bf16', 'Apache-2.0'),
]
DATA_FILES = ['scenarios.jsonl', 'probes.jsonl', 'validation-scenarios.jsonl',
              'validation-probes.jsonl', 'arms/act/train.jsonl', 'arms/act/valid.jsonl']
NODE = [shutil.which('node') or 'node', '--experimental-strip-types']
BRIDGE = str(HERE / 'speaker-floor-eval.ts')


def read(path):
    return json.loads(Path(path).read_text())


def freeze(path, value):
    path = Path(path)
    if path.exists() and read(path) != value:
        raise ValueError(f'Frozen inputs changed: {path}; preserve results and investigate')
    if not path.exists():
        atomic_json(path, value)


def copy_frozen(source, target):
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        if digest(source) != digest(target):
            raise ValueError(f'Frozen dataset changed: {source}')
    else:
        shutil.copyfile(source, target)


def source_hashes():
    paths = list(HERE.glob('speaker*')) + [HERE / 'train-selected.py', HERE / 'check-data.py']
    paths += list((ROOT / 'bench/slm').glob('*.ts'))
    paths += [ROOT / 'apps/rumortown/src/agentic/verifier.ts']
    return {str(p.relative_to(ROOT)): digest(p) for p in sorted(paths) if p.is_file()}


def installed_sources():
    if version('mlx-lm') != '0.32.2':
        raise ValueError('This experiment requires the inspected mlx-lm 0.32.2')
    package = Path(distribution('mlx-lm').locate_file('mlx_lm'))
    names = ['server.py', 'generate.py', 'utils.py', 'lora.py', 'tuner/utils.py',
             'tuner/datasets.py', 'tuner/trainer.py', 'models/cache.py',
             'models/llama.py', 'models/gemma3_text.py', 'models/lfm2.py', 'models/qwen3.py']
    return {n: digest(package / n) for n in names if (package / n).is_file()}


def weights_info(path):
    """Read safetensors headers only; do not import tensor runtimes or load weights."""
    path = Path(path)
    files = sorted(path.glob('*.safetensors'))
    if not files:
        raise ValueError('No local safetensors weights')
    index = path / 'model.safetensors.index.json'
    if index.exists() and not set(read(index)['weight_map'].values()) <= {p.name for p in files}:
        raise ValueError('Incomplete sharded snapshot')
    tensors = {}
    for f in files:
        with f.open('rb') as handle:
            size = struct.unpack('<Q', handle.read(8))[0]
            if size > 100_000_000:
                raise ValueError('Invalid safetensors header')
            header = json.loads(handle.read(size))
        for key, entry in header.items():
            if key == '__metadata__':
                continue
            if entry['data_offsets'][1] + size + 8 > f.stat().st_size:
                raise ValueError('Truncated weights')
            tensors[key] = entry
    return {'parameters': sum(math.prod(t['shape']) for t in tensors.values()),
            'dtypes': sorted({t['dtype'] for t in tensors.values()}),
            'files': {p.name: digest(p) for p in sorted(path.iterdir()) if p.is_file()},
            'projectionNames': sorted({k.rsplit('.', 2)[-2] for k in tensors if any(x in k for x in ['q_proj', 'k_proj', 'v_proj', 'o_proj', 'out_proj'])})}


def prepare_model(label, repo, licence, source, download):
    from huggingface_hub import snapshot_download
    from transformers import AutoTokenizer
    if label == 'lfm350m' and 'models/lfm2.py' not in installed_sources():
        return {'label': label, 'repo': repo, 'status': 'unsupported', 'reason': 'Installed MLX has no lfm2 architecture'}
    snapshot = Path(snapshot_download(repo, local_files_only=not download,
                                     allow_patterns=['*.json', '*.jinja', '*.model', '*.safetensors', '*.txt', 'LICENSE*', 'README.md'], max_workers=2))
    info = weights_info(snapshot)
    config = read(snapshot / 'config.json')
    tokenizer = AutoTokenizer.from_pretrained(str(snapshot), local_files_only=True, trust_remote_code=False)
    directory = OUT / 'prepared' / label
    directory.mkdir(parents=True, exist_ok=True)
    lengths, counts = {}, {}
    for part in ['train', 'valid']:
        rows = [json.loads(line) for line in (source / f'arms/act/{part}.jsonl').read_text().splitlines() if line]
        rendered = []
        sizes = []
        for row in rows:
            row = dict(row, messages=messages_for_model(row['messages'], label == 'gemma270m'))
            messages = row['messages']
            tokens = tokenizer.apply_chat_template(messages, return_dict=False)
            prefix = tokenizer.apply_chat_template(messages[:-1], add_generation_prompt=True, return_dict=False)
            if tokens[:len(prefix)] != prefix or len(prefix) >= len(tokens):
                raise ValueError(f'{label}: assistant loss mask is not aligned')
            if len(tokens) > 4608:
                raise ValueError(f'{label}: example exceeds 4608 tokens; refuse silent truncation')
            text = tokenizer.apply_chat_template(messages, tokenize=False)
            if any(m['content'].strip() not in text for m in messages):
                raise ValueError(f'{label}: template dropped message content')
            sizes.append(len(tokens))
            rendered.append(json.dumps(row, ensure_ascii=False))
        content = '\n'.join(rendered) + '\n'
        target = directory / f'{part}.jsonl'
        if target.exists() and target.read_text() != content:
            raise ValueError('Prepared training data changed')
        target.write_text(content)
        counts[part] = len(rows)
        lengths[part] = {'min': min(sizes), 'max': max(sizes), 'total': sum(sizes)}
        (directory / f'{part}-template-example.txt').write_text(tokenizer.apply_chat_template(
            messages_for_model(rows[0]['messages'], label == 'gemma270m'), tokenize=False))
    if counts['train'] % 4:
        raise ValueError('Training data must be a multiple of four')
    epoch_iters = counts['train'] // 4
    output_proj = 'out_proj' if label == 'lfm350m' else 'o_proj'
    keys = [f'self_attn.{p}' for p in ['q_proj', 'k_proj', 'v_proj', output_proj]]
    run = OUT / 'runs' / label
    lora = dict(model=str(snapshot), train=True, data=str(directory), fine_tune_type='lora',
                num_layers=config['num_hidden_layers'], batch_size=4, iters=epoch_iters * 2,
                learning_rate=1e-4, steps_per_report=epoch_iters, steps_per_eval=epoch_iters,
                val_batches=-1, save_every=epoch_iters, max_seq_length=4608, mask_prompt=True,
                grad_checkpoint=True, seed=7, adapter_path=str(run / 'adapter'),
                lora_parameters=dict(keys=keys, rank=8, scale=20.0, dropout=0.05))
    # JSON is valid YAML, and avoids a separate configuration rendering path.
    freeze(directory / 'lora.json', lora)
    return dict(label=label, repo=repo, licence=licence, status='ready', snapshot=str(snapshot),
                revision=snapshot.name, weights=info, counts=counts, tokenLengths=lengths,
                config=str(directory / 'lora.json'),
                preparedHashes={p.name: digest(p) for p in sorted(directory.iterdir()) if p.is_file()},
                note='LFM attention blocks only (6 of 16); convolution blocks have no q/k/v/o' if label == 'lfm350m' else '')


def prepare(source, download):
    # Reuse the original CPU data validator without importing train-selected/MLX.
    import runpy
    runpy.run_path(str(HERE / 'check-data.py'))['check'](source / 'arms/act')
    for name in DATA_FILES:
        copy_frozen(source / name, OUT / 'inputs' / name)
    models = []
    for label, repo, licence in MODELS:
        print(f'Preparing {label}', flush=True)
        try:
            models.append(prepare_model(label, repo, licence, OUT / 'inputs', download))
        except Exception as error:
            # Hub exceptions may embed auth-bearing request URLs. Record type only.
            reason = str(error) if isinstance(error, ValueError) else type(error).__name__
            print(f'{label}: unavailable ({reason})', flush=True)
            models.append(dict(label=label, repo=repo, status='unavailable', reason=reason))
    qwen = source / 'runs/qwen06b-act-7'
    selection = read(qwen / 'selection.json')
    reused = {'directory': str(qwen), 'historicalSelection': selection,
              'files': {str(p): digest(p) for p in [qwen / 'selection.json', qwen / 'training-complete.json',
                         *[qwen / f'epoch-{i}/fused/config.json' for i in [1, 2]],
                         *[p for i in [1, 2] for p in sorted((qwen / f'epoch-{i}/fused').glob('*.safetensors'))]]}}
    for name in ['qwen06b-base/validation', 'qwen06b-act-7/validation-1', 'qwen06b-act-7/validation-2']:
        for f in ['manifest.json', 'outputs.jsonl']:
            copy_frozen(source / 'runs' / name / f, OUT / 'reuse' / name / f)
    prepared = dict(source=str(source), models=models, reusedQwen=reused, mlxVersion=version('mlx-lm'),
                    installedSources=installed_sources(),
                    inputHashes={str(p.relative_to(OUT)): digest(p) for base in ['inputs', 'reuse']
                                 for p in sorted((OUT / base).rglob('*')) if p.is_file()})
    if (OUT / 'launch.json').exists():
        prior = read(OUT / 'prepared.json')
        if {k: v for k, v in prior.items() if k != 'models'} != {k: v for k, v in prepared.items() if k != 'models'}:
            raise ValueError('Frozen preparation inputs changed')
        current = {m['label']: m for m in models}
        if any(m['status'] == 'ready' and current.get(m['label']) != m for m in prior['models']):
            raise ValueError('A previously ready model changed')
        # A gated model becoming available may join an otherwise identical run.
    atomic_json(OUT / 'prepared.json', prepared)
    return check()


def validate_model(model):
    for name, expected in model['weights']['files'].items():
        if digest(Path(model['snapshot']) / name) != expected:
            raise ValueError(f'Model snapshot changed: {model["label"]}/{name}')
    for name, expected in model['preparedHashes'].items():
        if digest(OUT / 'prepared' / model['label'] / name) != expected:
            raise ValueError(f'Prepared data/config changed: {model["label"]}/{name}')


def check(models=True):
    prepared = read(OUT / 'prepared.json')
    if prepared['installedSources'] != installed_sources():
        raise ValueError('Installed MLX source changed')
    for name, expected in prepared['inputHashes'].items():
        if digest(OUT / name) != expected:
            raise ValueError(f'Input changed: {name}')
    for name, expected in prepared['reusedQwen']['files'].items():
        if digest(name) != expected:
            raise ValueError(f'Reused Qwen artifact changed: {name}')
    if models:
        for model in prepared['models']:
            if model['status'] == 'ready':
                validate_model(model)
    for m in prepared['models']:
        print(f'{m["label"]}: {m["status"]}', flush=True)
    return all(m['status'] in ['ready', 'unsupported'] for m in prepared['models'])


def stop(child):
    if child.poll() is None:
        try:
            os.killpg(child.pid, signal.SIGTERM)
        except ProcessLookupError:
            child.wait(timeout=10)
            return
        try:
            child.wait(timeout=10)
        except subprocess.TimeoutExpired:
            os.killpg(child.pid, signal.SIGKILL)
            child.wait(timeout=10)


def command(args, log, env=None, timeout=21600):
    log.parent.mkdir(parents=True, exist_ok=True)
    with log.open('a') as handle:
        child = subprocess.Popen([str(x) for x in args], cwd=ROOT, env=env, stdout=handle,
                                 stderr=subprocess.STDOUT, start_new_session=True)
        try:
            if child.wait(timeout=timeout):
                raise RuntimeError(f'Command failed; see {log.relative_to(OUT)}')
        finally:
            stop(child)


def power_reading():
    try:
        raw = subprocess.check_output(['/usr/sbin/ioreg', '-r', '-c', 'AppleSmartBattery'], timeout=3, stderr=subprocess.DEVNULL).decode()
        telemetry = re.search(r'"PowerTelemetryData"\s*=\s*\{([^\n]+)\}', raw)
        if telemetry:
            fields = dict(re.findall(r'"(\w+)"\s*=\s*(-?\d+)', telemetry[1]))
            load = int(fields.get('SystemLoad', '-1')) / 1000
            if 0 < load < 250:
                return dict(watts=load, source='ioreg SystemLoad (mW / 1000)',
                            publicationCount=int(fields.get('SystemLoadAccumulatorCount', '-1')))
        # Adapter Watts is a nameplate, NOT instantaneous consumption. On AC,
        # battery current is charging/net battery flow, NOT system/package power.
        if not re.search(r'"ExternalConnected"\s*=\s*No', raw):
            return dict(watts=None, source='unavailable')
        voltage = int(re.search(r'"Voltage"\s*=\s*(\d+)', raw)[1])
        current = int(re.search(r'"InstantAmperage"\s*=\s*(-?\d+)', raw)[1])
        if current >= 2**63:
            current -= 2**64
        watts = -current * voltage / 1e6
        return dict(watts=watts if 0 < watts < 250 else None, source='ioreg net battery discharge')
    except (OSError, subprocess.SubprocessError, TypeError, ValueError):
        return dict(watts=None, source='unavailable')


@contextmanager
def measure(path):
    start = time.monotonic()
    samples, done = [], threading.Event()
    def sample():
        while not done.is_set():
            reading = power_reading()
            samples.append({'seconds': time.monotonic() - start, **reading})
            done.wait(1)
    thread = threading.Thread(target=sample, daemon=True)
    thread.start()
    success = False
    try:
        yield
        success = True
    finally:
        done.set()
        thread.join(timeout=5)
        wall = time.monotonic() - start
        valid = [s for s in samples if s['watts'] is not None]
        publications = {s.get('publicationCount') for s in valid}
        scope = {s['source'] for s in valid}
        joules = None
        # SystemLoad may republish only about once a minute. Keep that cadence
        # visible, and do not turn a single stale publication into measured joules.
        fresh = publications == {None} or (len(publications) >= 2 and -1 not in publications)
        if len(valid) == len(samples) and len(valid) >= 2 and len(scope) == 1 and fresh:
            joules = sum((b['seconds'] - a['seconds']) * (a['watts'] + b['watts']) / 2 for a, b in zip(valid, valid[1:]))
        try:
            batt = subprocess.check_output(['pmset', '-g', 'batt'], timeout=3).decode().strip()
        except (OSError, subprocess.SubprocessError):
            batt = 'unavailable'
        with path.open('a') as f:
            f.write(json.dumps(dict(wallSeconds=wall, success=success, samples=samples, deviceJoulesEstimate=joules,
                                   packageJoules=None, pmset=batt, distinctPublications=len(publications),
                                   energyNote='Coarse whole-system estimate over sampled interval, including other processes. SystemLoad publication can be slow; no per-request or package energy attribution.' if joules is not None else 'Insufficient fresh power readings for energy; wall time/tokens and available watt samples only. pmset has no watt reading.')) + '\n')


@contextmanager
def server(model, directory, mode, gemma):
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    env = dict(os.environ, SF_CACHE_MODE=mode, SF_GEMMA=str(int(gemma)),
               SF_TELEMETRY=str(directory / 'telemetry.jsonl'))
    with (directory / 'server.log').open('a') as log:
        child = subprocess.Popen([sys.executable, str(HERE / 'speaker-floor-server.py'), '--host', '127.0.0.1',
                                  '--port', str(port), '--model', str(model), '--prompt-cache-size', '1'],
                                 cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
        try:
            import urllib.request
            for _ in range(180):
                if child.poll() is not None:
                    raise RuntimeError('MLX server exited; see server.log')
                try:
                    with urllib.request.urlopen(f'http://127.0.0.1:{port}/v1/models', timeout=1) as response:
                        if response.status == 200:
                            break
                except OSError:
                    pass
                time.sleep(1)
            else:
                raise TimeoutError('MLX server readiness exceeded 180 seconds')
            yield dict(os.environ, MLX_BASE_URL=f'http://127.0.0.1:{port}')
        finally:
            stop(child)


def rescore(raw, directory, validation=False):
    scenarios = OUT / 'inputs' / ('validation-scenarios.jsonl' if validation else 'scenarios.jsonl')
    probes = OUT / 'inputs' / ('validation-probes.jsonl' if validation else 'probes.jsonl')
    scored = directory / 'checker-v2'
    command(NODE + ['bench/slm/rescore.ts', str(raw), '--verifier-version', 'v2', '--out', str(scored),
                    '--scenarios', str(scenarios), '--probes', str(probes)], directory / 'rescore.log', timeout=600)
    config = dict(scenarios=str(scenarios), probes=str(probes), summary=str(directory / 'scores.json'),
                  rescored=str(scored / 'v2' / raw.name / 'rescored.jsonl'))
    atomic_json(directory / 'summary-config.json', config)
    command(NODE + [BRIDGE, 'summarise', str(directory / 'summary-config.json')], directory / 'rescore.log', timeout=600)
    return read(directory / 'scores.json')


def evaluation(label, model, split, mode, limit, gemma=False, template=False):
    directory = OUT / 'eval' / label / split / mode
    directory.mkdir(parents=True, exist_ok=True)
    completed = directory / 'complete.json'
    if completed.exists():
        stats = read(completed)
        for name, expected in stats['artifactHashes'].items():
            if digest(directory / name) != expected:
                raise ValueError('Completed evaluation artifact changed')
        return stats
    validation = split == 'validation'
    config = dict(label=label, model=str(model), split='train' if validation else split, limit=limit,
                  scenarios=str(OUT / 'inputs' / ('validation-scenarios.jsonl' if validation else 'scenarios.jsonl')),
                  probes=str(OUT / 'inputs' / ('validation-probes.jsonl' if validation else 'probes.jsonl')),
                  directory=str(directory), template=template, cacheMode=mode,
                  launchHash=digest(OUT / 'launch.json'))
    freeze(directory / 'config.json', config)
    # A killed server can return an answer before its telemetry append reaches
    # disk. Preserve that answer in the append-only log, but retry its key once on
    # this explicit launch rather than accepting an unmeasured observation.
    if not template:
        measured = {r['key']: r for r in latest_jsonl(directory / 'telemetry.jsonl')}
        for row in latest_jsonl(directory / 'outputs.jsonl'):
            t = measured.get(row['key'], {})
            if row['status'] == 'ok' and ('decodeTps' not in t or 'error' in t):
                with (directory / 'outputs.jsonl').open('a') as f:
                    f.write(json.dumps(dict(row, status='error', reason='Retry interrupted or invalid telemetry')) + '\n')
    print(f'Evaluating {label} / {split} / {mode}', flush=True)
    with measure(directory / 'evaluation-cost.jsonl'):
        if template:
            command(NODE + [BRIDGE, 'evaluate', str(directory / 'config.json')], directory / 'eval.log')
        else:
            with server(model, directory, mode, gemma) as env:
                command(NODE + [BRIDGE, 'evaluate', str(directory / 'config.json')], directory / 'eval.log', env)
    rows = latest_jsonl(directory / 'outputs.jsonl')
    if not rows or any(r['status'] != 'ok' for r in rows):
        raise RuntimeError('Incomplete evaluation')
    stats = rescore(directory, directory, validation)
    telemetry = latest_jsonl(directory / 'telemetry.jsonl')
    if not template:
        by_key = {r['key']: r for r in telemetry}
        telemetry = [by_key.get(r['key'], {}) for r in rows]
        if any('decodeTps' not in r or 'error' in r for r in telemetry):
            raise RuntimeError('Missing or invalid timing/cache telemetry')
    stats['timing'] = timing(telemetry)
    files = ['outputs.jsonl', 'scores.json', 'evaluation-cost.jsonl',
             f'checker-v2/v2/{directory.name}/rescored.jsonl']
    if not template:
        files.append('telemetry.jsonl')
    stats['artifactHashes'] = {name: digest(directory / name) for name in files}
    atomic_json(completed, stats)
    return stats


def timing(rows):
    if not rows:
        return None
    prefill = sum(r['prefillSeconds'] for r in rows)
    decode = sum(r['decodeSeconds'] for r in rows)
    times = sorted(r['turnSeconds'] for r in rows)
    return dict(prefillTps=sum(r['promptTokens'] for r in rows) / prefill,
                decodeTps=sum(r['outputTokens'] for r in rows) / decode,
                cachedTokens=sum(r['cachedTokens'] for r in rows),
                prefixPreparationSeconds=sum(r.get('prefixPreparation', {}).get('seconds', 0) for r in rows),
                p50Seconds=times[math.ceil(len(times) * .5) - 1], p95Seconds=times[math.ceil(len(times) * .95) - 1],
                note='Native MLX counters: prefill includes first sample; decode count follows MLX convention. Turn excludes controlled prefix preparation; HTTP and evaluation costs include it.')


def train(model):
    label = model['label']
    directory = OUT / 'runs' / label
    directory.mkdir(parents=True, exist_ok=True)
    complete = directory / 'training-complete.json'
    if complete.exists():
        for name, expected in read(complete)['artifactHashes'].items():
            if digest(directory / name) != expected:
                raise ValueError('Completed training artifacts changed')
        return
    print(f'Training {label}: two epochs, seed 7', flush=True)
    # A partial deterministic training run starts over; finished training is reused.
    command([sys.executable, HERE / 'train-selected.py', model['config']], directory / 'train.log', timeout=14400)
    for epoch in [1, 2]:
        target = directory / f'epoch-{epoch}'
        adapter = target / 'adapter'
        adapter.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(directory / 'adapter/adapter_config.json', adapter / 'adapter_config.json')
        shutil.copyfile(directory / f'adapter/epoch-{epoch}.safetensors', adapter / 'adapters.safetensors')
        command([sys.executable, '-m', 'mlx_lm.fuse', '--model', model['snapshot'], '--adapter-path', adapter,
                 '--save-path', target / 'fused'], directory / 'fuse.log', timeout=600)
    atomic_json(complete, {'launchHash': digest(OUT / 'launch.json'), 'configHash': digest(model['config']),
                          'artifactHashes': {str(p.relative_to(directory)): digest(p)
                                             for epoch in [1, 2] for p in sorted((directory / f'epoch-{epoch}/fused').iterdir()) if p.is_file()}})


def choose(base, candidates):
    if base['leakage'] is None or any(c['score']['leakage'] is None for c in candidates):
        raise ValueError('Validation has no leakage opportunities')
    eligible = [c for c in candidates if c['score']['macroF'] >= base['macroF'] - .02
                and c['score']['leakage'] <= base['leakage'] + .01]
    winner = sorted(eligible or candidates, key=lambda c: (-c['score']['macroQ'], c['epoch']))[0]
    return dict(winner, guardPassed=bool(eligible), baseScore=base, candidates=candidates,
                rule='Highest v2 act-macro Q subject to macro-F >= base - .02 and leakage <= base + .01; fallback highest Q marked guardFailed; earlier epoch wins ties')


def selected(model, prepared):
    label = model['label']
    destination = OUT / 'runs' / label
    destination.mkdir(parents=True, exist_ok=True)
    selection_file = destination / 'selection.json'
    if selection_file.exists():
        if label != 'qwen06b':
            train(model)  # validate completion hashes; does not retrain
        return read(selection_file)['model']
    if label == 'qwen06b':
        base = rescore(OUT / 'reuse/qwen06b-base/validation', destination / 'base-validation', True)
        if base['n'] != 1980 or base['errors']:
            raise ValueError('Saved Qwen base validation is incomplete')
        candidates = []
        for epoch in [1, 2]:
            score = rescore(OUT / f'reuse/qwen06b-act-7/validation-{epoch}', destination / f'validation-{epoch}', True)
            if score['n'] != 1980 or score['errors']:
                raise ValueError('Saved Qwen validation is incomplete')
            candidates.append(dict(epoch=epoch, model=str(Path(prepared['reusedQwen']['directory']) / f'epoch-{epoch}/fused'), score=score))
    else:
        train(model)
        base = evaluation(label + '-base', model['snapshot'], 'validation', 'cold', 1980, label == 'gemma270m')
        candidates = []
        for epoch in [1, 2]:
            path = destination / f'epoch-{epoch}/fused'
            score = evaluation(label + f'-epoch-{epoch}', path, 'validation', 'cold', 1980, label == 'gemma270m')
            candidates.append(dict(epoch=epoch, model=str(path), score=score))
    selection = choose(base, candidates)
    freeze(selection_file, selection)
    return selection['model']


def summary(prepared, failures):
    lines = ['# Speaker floor', '', 'Checker v2 proxies; one training seed. Rates are unaudited. Leakage denominator is recorded in scores.json.', '',
             '| Model | Parameters | Split | Cache | n | Q | F | Act-macro Q | Leakage | Prefill tok/s | Decode tok/s |',
             '|---|---:|---|---|---:|---:|---:|---:|---:|---:|---:|']
    params = {m['label']: m.get('weights', {}).get('parameters') for m in prepared['models']}
    for path in sorted((OUT / 'eval').glob('*/*/*/complete.json')):
        mode, split, label = path.parent.name, path.parent.parent.name, path.parent.parent.parent.name
        if split == 'validation':
            continue
        s = read(path)
        number = 0 if label == 'template' else next((n for k, n in params.items() if label.startswith(k)), None)
        pct = lambda v: 'n/a' if v is None else f'{100*v:.2f}%'
        t = s['timing']
        lines.append(f'| {label} | {number} | {split} | {mode} | {s["n"]} | {pct(s["Q"])} | {pct(s["F"])} | {pct(s["macroQ"])} | {pct(s["leakage"])} | ' +
                     (f'{t["prefillTps"]:.1f} | {t["decodeTps"]:.1f} |' if t else 'n/a | n/a |'))
    lines += ['', 'Cold = empty prompt cache, weights already loading/loaded by the server. Ledger = controlled prefix prefill followed by a seeded answer. Prefix setup is charged separately and included in evaluation wall/energy logs.',
              'Every evaluation-cost.jsonl records all launch attempts, including failed/resumed work and server loading. telemetry.jsonl records native per-request timing; template has no language-model tokens.',
              'No package-power claim: use coarse ioreg SystemLoad or battery discharge estimates only with sufficient fresh readings; otherwise wall time and tokens.', '', '## Errors', '', *[f'- {k}: {v}' for k, v in failures.items()]]
    text = '\n'.join(lines) + '\n'
    (OUT / 'summary.md').write_text(text)
    print(text, flush=True)


def launch(limit):
    check(models=False)  # global dataset integrity is fatal; model failures are isolated below
    prepared = read(OUT / 'prepared.json')
    freeze(OUT / 'launch.json', dict(preparedInputs={k: v for k, v in prepared.items() if k != 'models'},
                                    modelPlan=[[label, repo] for label, repo, _ in MODELS], sources=source_hashes(),
                                    limit=limit, validationLimit=1980, temperature=.7, maxTokens=192, bestOf=1,
                                    seed='scenario.seed (existing harness convention)', caches=['cold', 'ledger']))
    # All hub access fails locally rather than attempting weekend network traffic.
    os.environ.update(HF_HUB_OFFLINE='1', TRANSFORMERS_OFFLINE='1')
    # The shared GPU must be free. Check known local MLX/Ollama workers without
    # printing their command lines (which may contain unrelated private values).
    processes = subprocess.check_output(['ps', '-axo', 'pid=,command='], text=True)
    workers = []
    for line in processes.splitlines():
        fields = line.strip().split(None, 1)
        if len(fields) != 2 or int(fields[0]) == os.getpid():
            continue
        if any(token in fields[1] for token in ['-m mlx_lm.server', '-m mlx_lm.lora', 'finetune/train-selected.py',
                                              'finetune/sample.py', 'finetune/speaker-floor-server.py', 'ollama runner']):
            workers.append(int(fields[0]))
    if workers:
        raise RuntimeError(f'GPU worker processes are already present (PIDs {workers}); wait for the controller to release the GPU')
    failures = {}
    try:
        for split in ['confirm', 'test-mechanism', 'wording']:
            evaluation('template', 'template', split, 'none', limit, template=True)
    except Exception as error:
        failures['template'] = str(error)
    for model in prepared['models']:
        label = model['label']
        try:
            if model['status'] != 'ready':
                if model['status'] == 'unsupported':
                    print(f'Skipping optional unsupported model {label}')
                    continue
                raise RuntimeError(model['reason'])
            validate_model(model)
            freeze(OUT / 'runs' / label / 'model.json', model)
            student = selected(model, prepared)
            for arm, path in [('base', model['snapshot']), ('act', student)]:
                for split in ['confirm', 'test-mechanism', 'wording']:
                    for mode in ['cold', 'ledger']:
                        evaluation(f'{label}-{arm}', path, split, mode, limit, label == 'gemma270m')
        except Exception as error:
            failures[label] = str(error)
            print(f'{label} stopped: {error}', flush=True)
        atomic_json(OUT / 'errors.json', failures)
        summary(prepared, failures)
    return not failures


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group(required=True)
    for mode in ['prepare', 'check', 'launch']:
        modes.add_argument('--' + mode, action='store_true')
    parser.add_argument('--download', action='store_true', help='Only with --prepare; network prefetch, never inference')
    parser.add_argument('--source', type=Path, default=None, help='Read-only confirmation-37 directory')
    parser.add_argument('--limit', type=int, default=240, help='Same held-out limit for every model, split and cache mode (default 240)')
    args = parser.parse_args()
    if args.limit < 60 or (args.download and not args.prepare):
        parser.error('limit must be >=60; --download requires --prepare')
    source = args.source or ROOT / 'bench/slm/data/confirmation-37'
    if not source.exists() and args.source is None:
        source = ROOT.parent / 'rumortown/bench/slm/data/confirmation-37'
    OUT.mkdir(parents=True, exist_ok=True)
    with (OUT / '.controller.lock').open('a+') as lock, (OUT / 'controller.log').open('a', buffering=1) as log:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        class Tee:
            def __init__(self, original): self.original = original
            def write(self, text): self.original.write(text); log.write(text)
            def flush(self): self.original.flush(); log.flush()
        sys.stdout, sys.stderr = Tee(sys.stdout), Tee(sys.stderr)
        def interrupted(*_):
            raise KeyboardInterrupt()
        signal.signal(signal.SIGTERM, interrupted)
        try:
            success = prepare(source.resolve(), args.download) if args.prepare else check() if args.check else launch(args.limit)
            print('STATUS: DONE' if success else 'STATUS: BLOCKED')
            return 0 if success else 1
        except KeyboardInterrupt:
            print('Interrupted; owned child processes stopped. Rerun --launch to resume.\nSTATUS: BLOCKED')
            return 130
        except Exception as error:
            print(f'{type(error).__name__}: {error}\nSTATUS: BLOCKED')
            return 1
        finally:
            sys.stdout, sys.stderr = sys.stdout.original, sys.stderr.original


if __name__ == '__main__':
    sys.exit(main())
