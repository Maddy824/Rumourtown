/** Preparation is CPU-only. GPU commands exist only behind explicit launch mode. */
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, open, readFile, writeFile, access } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { DATA, ROOT, hash, isMain, readJsonl, writeJsonl } from '../io.ts';
import { generateScenarios } from '../scenarios.ts';
import { generateProbes } from '../probes.ts';
import { buildPairs } from '../pairs.ts';
import { filter, validationSeed } from './make-data.ts';
import { ACTS, parseArgs, runBenchmark, useful, type Row } from '../run.ts';
import { type InputRun } from '../analyse.ts';
import { rescore } from '../rescore.ts';
import type { Probe, Scenario } from '../types.ts';
const arms = { 'verifier-only': 'verifier', act: 'act', 'mix-0.5': 'mix-0.5', 'unfiltered-control': 'unfiltered' };
const exists = (p: string) => access(p).then(() => true, () => false);
async function rows<T>(path: string): Promise<T[]> { const out: T[] = []; for await (const r of readJsonl<T>(path)) out.push(r); return out; }
function command(bin: string, args: string[], env = process.env): Promise<void> {
  return new Promise((resolve, reject) => { const child = spawn(bin, args, { cwd: ROOT, stdio: 'inherit', env }); child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${bin} exited ${code}`))); });
}
async function freeze(path: string, value: unknown) {
  const text = JSON.stringify(value, null, 2) + '\n';
  if (await exists(path)) { if (await readFile(path, 'utf8') !== text) throw new Error(`Frozen settings changed: ${path}; use a new output name`); }
  else await writeFile(path, text, { flag: 'wx' });
}
async function artifactHashes(out: string) {
  const files = ['scenarios.jsonl', 'probes.jsonl', 'pairs.jsonl', 'pairs-probes.jsonl', 'validation-scenarios.jsonl', 'validation-probes.jsonl',
    'arms/stats.json', 'arms/boundary-pairs.jsonl', ...Object.values(arms).flatMap(f => [`arms/${f}/train.jsonl`, `arms/${f}/valid.jsonl`])];
  return Object.fromEntries(await Promise.all(files.map(async f => [f, hash(await readFile(join(out, f), 'utf8'))])));
}
export async function prepare(out: string, input = join(DATA, 'finetune/samples.jsonl')) {
  const scenarios = await rows<Scenario>(join(DATA, 'scenarios.jsonl')), probes = await rows<Probe>(join(DATA, 'probes.jsonl'));
  if (scenarios.some(s => s.seed > 200)) throw new Error('Fresh confirmation range 201–260 overlaps an input root; choose a new design');
  await mkdir(out, { recursive: true });
  await freeze(join(out, 'preparation.json'), { samples: hash(await readFile(input, 'utf8')), scenarios: hash(scenarios), probes: hash(probes), seeds: [201, 260], dataSeed: 37,
    source: hash(await Promise.all(['make-data.ts', 'confirmation.ts', '../scenarios.ts', '../probes.ts', '../pairs.ts'].map(p => readFile(new URL(p, import.meta.url), 'utf8')))) });
  if (!(await exists(join(out, 'prepared.json')))) {
    if (await exists(join(out, 'arms/stats.json'))) throw new Error('Partial preparation exists; inspect it and choose a new output name');
    await filter(['--input', input, '--out', join(out, 'arms'), '--match', 'act', '--balance', '--batch-multiple', '4', '--seed', '37', '--boundary-quota', '20', '--rare-state-floor', '50'], { scenarios: new Map(scenarios.map(s => [s.id, s])), probes });
    const fresh = await generateScenarios({ seeds: Array.from({ length: 60 }, (_, i) => 201 + i), split: 'confirm' });
    const confirm = fresh.filter(s => s.split === 'confirm');
    const pairs = buildPairs(fresh, 100, 37, { splits: ['confirm', 'test-mechanism'], nulls: true });
    await writeJsonl(join(out, 'scenarios.jsonl'), fresh);
    await writeJsonl(join(out, 'probes.jsonl'), [...generateProbes(fresh), ...generateProbes(confirm, { wording: true })].filter(p => p.axis !== 'quantisation'));
    await writeJsonl(join(out, 'pairs.jsonl'), pairs);
    await writeJsonl(join(out, 'pairs-probes.jsonl'), pairs.flatMap(p => p.sides));
    const validScenarios = scenarios.filter(s => s.split === 'train' && validationSeed(s.seed));
    const ids = new Set(validScenarios.map(s => s.id));
    await writeJsonl(join(out, 'validation-scenarios.jsonl'), validScenarios);
    await writeJsonl(join(out, 'validation-probes.jsonl'), probes.filter(p => ids.has(p.scenarioId) && p.axis !== 'quantisation' && !p.wording));
    await writeFile(join(out, 'prepared.json'), JSON.stringify({ confirmationRoots: [201, 260], boundaryPairsPerArm: 20, rareStatesPerArm: 50, balanced: 'seeded resampling', matched: true, hashes: await artifactHashes(out) }, null, 2));
  }
  await preflight(out);
}
export async function preflight(out: string) {
  const prepared = JSON.parse(await readFile(join(out, 'prepared.json'), 'utf8'));
  if (JSON.stringify(prepared.hashes) !== JSON.stringify(await artifactHashes(out))) throw new Error('Prepared data changed; use a fresh output directory');
  const parts = [] as { seed: number; probeId: string }[][];
  for (const family of Object.values(arms)) {
    await command('python3', ['bench/slm/finetune/check-data.py', join(out, 'arms', family)]);
    parts.push(await rows(join(out, 'arms', family, 'train.jsonl')));
  }
  const lengths = parts.map(p => p.length);
  if (new Set(lengths).size !== 1) throw new Error('Arm training counts differ');
  const signature = (rs: typeof parts[number]) => rs.map(r => r.probeId).sort().join('\n');
  if (parts.some(rs => signature(rs) !== signature(parts[0]!))) throw new Error('Arm prompts/counts differ after balancing');
  for (const f of ['scenarios.jsonl', 'probes.jsonl', 'pairs.jsonl', 'pairs-probes.jsonl', 'validation-scenarios.jsonl', 'validation-probes.jsonl']) if (!(await exists(join(out, f)))) throw new Error(`Missing ${f}`);
  const fresh = await rows<Scenario>(join(out, 'scenarios.jsonl'));
  const training = new Set(parts.flat().map(r => r.seed));
  if (fresh.some(s => s.seed <= 200 || training.has(s.seed))) throw new Error('Confirmation root leakage');
}
/** Methods §5 validation guard: raw F and opportunity-based lexical leakage proxy;
 * selection is development-only. This is not an audited leakage estimate. */
export function validationScore(rows: Row[], probes: Map<string, Probe>, scenarios: Map<string, Scenario>) {
  const rs = rows.filter(r => r.status !== 'skipped');
  const represented = ACTS.filter(a => rs.some(r => r.gold.behaviour === a));
  const F = represented.reduce((sum, a) => { const group = rs.filter(r => r.gold.behaviour === a); return sum + group.filter(r => r.status === 'ok' && r.result?.verdict.epistemicFaithful).length / group.length; }, 0) / represented.length;
  const Q = represented.reduce((sum, a) => { const group = rs.filter(r => r.gold.behaviour === a); return sum + group.filter(useful).length / group.length; }, 0) / represented.length;
  const opportunities = rs.filter(r => { const p = probes.get(r.probeId)!, s = scenarios.get(r.scenarioId)!; return !!p.distractors?.length || s.unknownWorldFacts.some(f => p.utterance.includes(f)); });
  const leaks = opportunities.filter(r => r.status === 'ok' && r.result!.verdict.sentences.some(sentence => sentence.label === 'unknown-to-speaker')).length;
  if (!rs.length || !represented.length || !opportunities.length) throw new Error('Validation has no task/act/leakage support');
  return { Q, F, leakage: leaks / opportunities.length, leakageNumerator: leaks, leakageDenominator: opportunities.length, tasks: rs.length, acts: represented };
}
async function withServer<T>(model: string, out: string, task: () => Promise<T>): Promise<T> {
  // Bind-check a private port; never kill or reuse a process belonging to another benchmark.
  const port = 8766;
  await new Promise<void>((resolve, reject) => { const s = createServer(); s.once('error', reject); s.listen(port, '127.0.0.1', () => s.close(() => resolve())); });
  const log = await open(join(out, 'server.log'), 'a');
  const child = spawn(process.env.RT_MLX_PYTHON ?? join(homedir(), '.venvs/rt-mlx/bin/python'), ['-m', 'mlx_lm.server', '--host', '127.0.0.1', '--port', String(port), '--model', model], { cwd: ROOT, stdio: ['ignore', log.fd, log.fd] });
  let spawnError: Error | undefined; child.on('error', e => { spawnError = e; });
  const prior = process.env.MLX_BASE_URL; process.env.MLX_BASE_URL = `http://127.0.0.1:${port}`;
  const stop = () => { child.kill('SIGTERM'); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  try {
    let ready = false;
    for (let i = 0; i < 180; i++) {
      if (spawnError) throw spawnError;
      if (child.exitCode !== null) throw new Error('MLX server exited; inspect server.log');
      try { if ((await fetch(`${process.env.MLX_BASE_URL}/v1/models`, { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch {}
      await new Promise(r => setTimeout(r, 1000));
    }
    if (!ready) throw new Error('MLX server readiness timeout');
    return await task();
  } finally {
    stop(); if (child.exitCode === null && !spawnError) await new Promise<void>(resolve => child.once('exit', () => resolve()));
    await log.close(); if (prior === undefined) delete process.env.MLX_BASE_URL; else process.env.MLX_BASE_URL = prior;
    process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
  }
}
async function evaluate(model: string, directory: string, scenariosPath: string, probesPath: string, split: string, bestOf: number, limit: number) {
  const scenarios = new Map((await rows<Scenario>(scenariosPath)).map(s => [s.id, s])), probes = new Map((await rows<Probe>(probesPath)).map(p => [p.id, p]));
  const options = parseArgs(['--models', `mlx:${model}`, '--strategies', 'best-of', '--best-of', String(bestOf), '--temperature', '.7', '--max-tokens', '192', '--root-balanced', 'true',
    '--scenarios', scenariosPath, '--probes', probesPath, '--split', split, '--limit', String(limit), '--concurrency', '1', await exists(join(directory, 'manifest.json')) ? '--resume' : '--out', directory]);
  const raw = await runBenchmark(options);
  if (raw.some(r => r.status === 'error')) throw new Error(`Evaluation errors in ${directory}; rerun to retry`);
  const rescored = await rescore(raw, scenarios, probes);
  await writeJsonl(join(directory, 'rescored.jsonl'), rescored);
  return rescored;
}
export async function launch(out: string, limit: number, runtime: { command?: typeof command; withServer?: typeof withServer; evaluate?: typeof evaluate } = {}) {
  const runCommand = runtime.command ?? command, serve = runtime.withServer ?? withServer, evalRun = runtime.evaluate ?? evaluate;
  await preflight(out);
  const results = join(out, 'runs'); await mkdir(results, { recursive: true });
  const source = hash(await Promise.all(['../run.ts', '../strategies.ts', '../analyse.ts', '../verifier.ts', '../providers.ts', '../baselines.ts', '../types.ts', '../pairs.ts', '../io.ts', '../rescore.ts', 'confirmation.ts', 'train.sh', 'train-selected.py', 'check-data.py'].map(p => readFile(new URL(p, import.meta.url), 'utf8'))));
  await freeze(join(out, 'launch.json'), { source, limit, temperature: .7, maxTokens: 192, epochs: 2, seeds: [7, 17, 27], margins: { F: .02, Q: .05 }, guards: { fidelityDrop: .02, leakageIncrease: .01 }, note: 'Raw proxy study; margins/power/audit not independently validated. No confirmatory claim from this script alone.' });
  const validationScenarios = join(out, 'validation-scenarios.jsonl'), validationProbes = join(out, 'validation-probes.jsonl');
  const vs = new Map((await rows<Scenario>(validationScenarios)).map(s => [s.id, s])), vp = new Map((await rows<Probe>(validationProbes)).map(p => [p.id, p]));
  const guard = (x: ReturnType<typeof validationScore>, base: ReturnType<typeof validationScore>) => x.F >= base.F - .02 && x.leakage <= base.leakage + .01;
  const student = async (label: string, model: string, seeds: number[], selected?: string) => {
    const baseDir = join(results, label + '-base'); await mkdir(baseDir, { recursive: true });
    const baseRows = await serve(model, baseDir, () => evalRun(model, join(baseDir, 'validation'), validationScenarios, validationProbes, 'train', 1, limit));
    const baseScore = validationScore(baseRows, vp, vs), scores: { arm: string; run: string; model: string; score: ReturnType<typeof validationScore> }[] = [];
    for (const [arm, family] of Object.entries(arms)) {
      if (selected && ![selected, 'verifier-only', 'unfiltered-control'].includes(arm)) continue;
      for (const seed of seeds) {
        const run = `${label}-${arm}-${seed}`, dir = join(results, run);
        if (!(await exists(join(dir, 'training-complete.json')))) {
          await runCommand('bash', ['bench/slm/finetune/train.sh', model, run, family, '2', '--seed', String(seed), '--data-root', join(out, 'arms'), '--out-root', results]);
          await writeFile(join(dir, 'training-complete.json'), JSON.stringify({ source, seed, model, family }));
        }
        const candidates = [];
        for (const epoch of [1, 2]) {
          const path = join(dir, `epoch-${epoch}/fused`);
          if (!(await exists(path))) throw new Error(`Missing checkpoint ${path}`);
          const rs = await serve(path, dir, () => evalRun(path, join(dir, `validation-${epoch}`), validationScenarios, validationProbes, 'train', 1, limit));
          candidates.push({ arm, run: String(seed), model: path, score: validationScore(rs, vp, vs) });
        }
        // Methods §5: highest validation Q satisfying both development guards; deterministic tie order.
        const eligible = candidates.filter(c => guard(c.score, baseScore)).sort((a, b) => b.score.Q - a.score.Q);
        const winner = eligible[0] ?? candidates.sort((a, b) => b.score.Q - a.score.Q)[0]!;
        await freeze(join(dir, 'selection.json'), { ...winner, guardPassed: !!eligible.length, baseScore, candidates });
        scores.push(winner);
      }
    }
    const eligible = scores.filter(c => ['act', 'mix-0.5'].includes(c.arm) && guard(c.score, baseScore)).sort((a, b) => b.score.Q - a.score.Q);
    if (!selected && !eligible.length) throw new Error('Negative screening result: no mixture clears development guards; confirmation stops');
    const chosen = selected ?? eligible[0]!.arm;
    await freeze(join(out, `${label}-comparison.json`), { chosen, baseScore, scores });
    return { chosen, scores, baseDir };
  };
  const screen = await student('qwen06b', 'mlx-community/Qwen3-0.6B-bf16', [7]);
  // No confirmation output has been read when either mixture or checkpoint is selected.
  const final = await student('llama3b', 'mlx-community/Llama-3.2-3B-Instruct', [7, 17, 27], screen.chosen);
  for (const [label, model, design] of [['qwen06b', 'mlx-community/Qwen3-0.6B-bf16', screen], ['llama3b', 'mlx-community/Llama-3.2-3B-Instruct', final]] as const) {
    const inputs: InputRun[] = [], pairInputs: InputRun[] = [];
    const evalModel = async (path: string, condition: string, run: string, n: number) => {
      const dir = join(results, `${label}-eval-${condition}-${run}`); await mkdir(dir, { recursive: true });
      await serve(path, dir, async () => {
        for (const split of ['confirm', 'test-mechanism', 'wording']) {
          const target = join(dir, split);
          await evalRun(path, target, join(out, 'scenarios.jsonl'), join(out, 'probes.jsonl'), split, n, limit);
          inputs.push({ condition, run, path: join(target, 'rescored.jsonl') });
        }
        const pairDir = join(dir, 'pairs');
        await evalRun(path, pairDir, join(out, 'scenarios.jsonl'), join(out, 'pairs-probes.jsonl'), 'all', n, 1000000);
        pairInputs.push({ condition, run, path: join(pairDir, 'rescored.jsonl') });
      });
    };
    for (const n of [1, 4]) await evalModel(model, `base-best-of-${n}`, 'base', n);
    for (const c of design.scores) for (const n of [1, 4]) await evalModel(c.model, n === 1 ? c.arm : `${c.arm}-best-of-4`, c.run, n);
    const config = { inputs, pairInputs, scenarios: join(out, 'scenarios.jsonl'), probes: join(out, 'probes.jsonl'), selected: design.chosen, pairs: join(out, 'pairs.jsonl'), seed: 37, replicates: 10000 };
    await writeFile(join(out, `${label}-analysis.json`), JSON.stringify(config, null, 2));
    await runCommand(process.execPath, ['--experimental-strip-types', 'bench/slm/analyse.ts', join(out, `${label}-analysis.json`), join(out, `${label}-analysis.md`)]);
  }
}
if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const switches = new Set(['--prepare-only', '--check', '--launch']), values = new Set(['--out', '--limit', '--samples']), seen = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const key = args[i]!;
    if (seen.has(key) || (!switches.has(key) && !values.has(key))) throw new Error(`Invalid or duplicate confirmation option: ${key}`);
    seen.add(key);
    if (values.has(key) && (!args[++i] || args[i]!.startsWith('--'))) throw new Error(`Missing value for ${key}`);
  }
  if ([...switches].filter(key => seen.has(key)).length !== 1) throw new Error('Choose exactly one of --prepare-only, --check, --launch');
  const at = (flag: string, fallback: string) => args.includes(flag) ? args[args.indexOf(flag) + 1]! : fallback;
  const out = resolve(at('--out', join(DATA, 'confirmation-37'))), limit = Number(at('--limit', '1980'));
  if (!Number.isSafeInteger(limit) || limit < 60) throw new Error('Confirmation limit must be an integer >=60');
  if (args.includes('--prepare-only')) await prepare(out, at('--samples', join(DATA, 'finetune/samples.jsonl')));
  else if (args.includes('--check')) await preflight(out);
  else {
    if (!args.includes('--launch')) throw new Error('Use --prepare-only (CPU), --check (CPU), or --launch (GPU training/evaluation)');
    const lockPath = join(out, '.confirmation.lock');
    if (await exists(lockPath)) {
      const pid = Number(await readFile(lockPath, 'utf8'));
      if (!Number.isSafeInteger(pid) || pid < 1) throw new Error('Malformed confirmation lock; inspect before recovery');
      try { process.kill(pid, 0); throw new Error('Confirmation writer is still alive'); }
      catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ESRCH') throw e; }
      const { unlink } = await import('node:fs/promises'); await unlink(lockPath);
    }
    const lock = await open(lockPath, 'wx');
    try { await lock.writeFile(String(process.pid)); await launch(out, limit); }
    finally { await lock.close(); const { unlink } = await import('node:fs/promises'); await unlink(join(out, '.confirmation.lock')); }
  }
}
