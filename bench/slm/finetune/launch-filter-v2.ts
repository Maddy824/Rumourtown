/** Opt-in Qwen 0.6B seed-7 rerun. No model process starts in --check or --dry-run. */
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { access, mkdir, open, readFile, unlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { ROOT, hash, isMain, readJsonl, writeJsonl } from '../io.ts';
import { preflight, validationScore } from './confirmation.ts';
import { ARM_FAMILIES } from './rebuild-filter-v2.ts';
import { parseArgs, runBenchmark } from '../run.ts';
import { rescore, scorerFingerprint } from '../rescore.ts';
import type { Probe, Scenario } from '../types.ts';
const MODEL = 'mlx-community/Qwen3-0.6B-bf16';
const exists = (p: string) => access(p).then(() => true, () => false);
async function rows<T>(p: string) { const rs: T[] = []; for await (const r of readJsonl<T>(p)) rs.push(r); return rs; }
export function launchOptions(args: string[]) {
  const modes = ['--launch', '--check', '--dry-run'], flags = ['--data-dir', '--out', '--limit'];
  const opts = new Map<string, string>(); let mode = '';
  for (let i = 0; i < args.length; i++) {
    const k = args[i]!;
    if (modes.includes(k)) { if (mode) throw new Error('Choose one mode'); mode = k; }
    else { if (!flags.includes(k) || opts.has(k) || !args[i + 1] || args[i + 1]!.startsWith('--')) throw new Error(`Invalid option ${k}`); opts.set(k, args[++i]!); }
  }
  if (!mode || !opts.has('--data-dir') || !opts.has('--out')) throw new Error('Provide --data-dir, --out and --check|--dry-run|--launch');
  const data = resolve(opts.get('--data-dir')!), out = resolve(opts.get('--out')!), limit = Number(opts.get('--limit') ?? 1980);
  if (data === out || out.startsWith(data + '/') || data.startsWith(out + '/')) throw new Error('Data and results directories must be separate');
  if (!Number.isSafeInteger(limit) || limit < 60) throw new Error('limit must be an integer >=60');
  return { mode, data, out, limit };
}
export function trainingCommands(data: string, out: string) {
  return ARM_FAMILIES.map(arm => ['bash', 'bench/slm/finetune/train.sh', MODEL, `qwen06b-${arm}-7`, arm, '2', '--seed', '7', '--data-root', join(data, 'arms'), '--out-root', out]);
}
async function frozen(path: string, value: unknown) {
  const text = JSON.stringify(value, null, 2) + '\n';
  if (await exists(path)) { if (await readFile(path, 'utf8') !== text) throw new Error(`Frozen settings changed: ${path}`); }
  else await writeFile(path, text, { flag: 'wx' });
}
async function command(args: string[]) {
  await new Promise<void>((resolve, reject) => { const child = spawn(args[0]!, args.slice(1), { cwd: ROOT, stdio: 'inherit' }); child.once('error', reject); child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Command exited ${code}`))); });
}
async function serve<T>(model: string, out: string, task: () => Promise<T>) {
  const port = 8766;
  await new Promise<void>((resolve, reject) => { const server = createServer(); server.once('error', reject); server.listen(port, '127.0.0.1', () => server.close(() => resolve())); });
  const log = await open(join(out, 'server.log'), 'a');
  const child = spawn(process.env.RT_MLX_PYTHON ?? join(homedir(), '.venvs/rt-mlx/bin/python'), ['-m', 'mlx_lm.server', '--host', '127.0.0.1', '--port', String(port), '--model', model], { cwd: ROOT, stdio: ['ignore', log.fd, log.fd] });
  let failure: Error | undefined; child.once('error', e => { failure = e; });
  const prior = process.env.MLX_BASE_URL; process.env.MLX_BASE_URL = `http://127.0.0.1:${port}`;
  const stop = () => { child.kill('SIGTERM'); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  try {
    for (let i = 0; i < 180; i++) {
      if (failure) throw failure;
      if (child.exitCode !== null || child.signalCode !== null) throw new Error('MLX server exited');
      let ready = false;
      try { ready = (await fetch(`${process.env.MLX_BASE_URL}/v1/models`, { signal: AbortSignal.timeout(1000) })).ok; } catch {}
      if (ready) return await task();
      await new Promise(r => setTimeout(r, 1000));
    }
    throw new Error('MLX readiness timeout');
  } finally {
    stop(); if (!failure && child.exitCode === null && child.signalCode === null) await new Promise<void>(r => child.once('exit', () => r()));
    await log.close(); if (prior === undefined) delete process.env.MLX_BASE_URL; else process.env.MLX_BASE_URL = prior;
    process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
  }
}
async function evaluate(model: string, directory: string, scenariosPath: string, probesPath: string, split: string, n: number, limit: number) {
  const options = parseArgs(['--models', `mlx:${model}`, '--strategies', 'best-of', '--best-of', String(n), '--temperature', '.7', '--max-tokens', '192', '--root-balanced', 'true',
    '--scenarios', scenariosPath, '--probes', probesPath, '--split', split, '--limit', String(limit), '--concurrency', '1', await exists(join(directory, 'manifest.json')) ? '--resume' : '--out', directory]);
  const raw = await runBenchmark(options);
  if (raw.some(r => r.status === 'error')) throw new Error(`Evaluation errors: ${directory}`);
  const scenarios = new Map((await rows<Scenario>(scenariosPath)).map(s => [s.id, s])), probes = new Map((await rows<Probe>(probesPath)).map(p => [p.id, p]));
  const scored = await rescore(raw, scenarios, probes, 'v2');
  await writeJsonl(join(directory, 'rescored-v2.jsonl'), scored); return scored;
}
export async function launchV2(options: ReturnType<typeof launchOptions>, runtime = { command, serve, evaluate }) {
  const { data, out, limit } = options;
  const rebuilt = JSON.parse(await readFile(join(data, 'rebuild.json'), 'utf8'));
  if (!rebuilt.ready || (rebuilt.shortfalls.length && rebuilt.omittedShortfalls !== rebuilt.shortfalls.length)) throw new Error('Rebuilt arms have quota shortfalls; GPU launch is blocked');
  await preflight(data);
  const prepared = JSON.parse(await readFile(join(data, 'prepared.json'), 'utf8'));
  if (prepared.verifierVersion !== 'v2' || prepared.filterVersion !== 'v2') throw new Error('Expected filter/checker v2 data');
  const plan = { model: MODEL, seed: 7, epochs: 2, limit, verifierVersion: 'v2', data, out, prepared: hash(prepared), scorer: await scorerFingerprint('v2'),
    source: hash(await Promise.all(['launch-filter-v2.ts', 'confirmation.ts', 'train.sh', 'train-selected.py', 'check-data.py', '../providers.ts', '../baselines.ts', '../pairs.ts', '../io.ts'].map(f => readFile(new URL(f, import.meta.url), 'utf8')))),
    commands: trainingCommands(data, out), selection: 'validation Q with F-drop .02 and leakage-increase .01 guards; epoch 1 breaks ties',
    evaluation: 'all four arms, base, best-of 1 and 4; confirm, test-mechanism, wording, pairs; v2 final scoring; historical v1 candidate selection' };
  if (options.mode !== '--launch') { console.log(JSON.stringify(plan, null, 2)); return; }
  await mkdir(out, { recursive: true });
  const lockPath = join(out, '.filter-v2.lock');
  // Never silently recover a possibly live GPU writer; a controller can inspect stale locks.
  const lock = await open(lockPath, 'wx');
  try {
    await lock.writeFile(String(process.pid)); await frozen(join(out, 'launch.json'), plan);
    const sp = join(data, 'validation-scenarios.jsonl'), pp = join(data, 'validation-probes.jsonl');
    const ss = new Map((await rows<Scenario>(sp)).map(s => [s.id, s])), ps = new Map((await rows<Probe>(pp)).map(p => [p.id, p]));
    const validate = async (model: string, dir: string) => validationScore(await runtime.serve(model, out, () => runtime.evaluate(model, dir, sp, pp, 'train', 1, limit)), ps, ss);
    const base = await validate(MODEL, join(out, 'base-validation'));
    const selected: { arm: string; model: string }[] = [];
    for (const [i, arm] of ARM_FAMILIES.entries()) {
      const dir = join(out, `qwen06b-${arm}-7`), complete = join(dir, 'training-complete.json');
      if (!(await exists(complete))) { await runtime.command(plan.commands[i]!); await frozen(complete, { plan: hash(plan), arm }); }
      else if (JSON.parse(await readFile(complete, 'utf8')).plan !== hash(plan)) throw new Error('Training completion fingerprint differs');
      const candidates = [];
      for (const epoch of [1, 2]) {
        const model = join(dir, `epoch-${epoch}/fused`);
        if (!(await exists(model))) throw new Error(`Missing ${model}`);
        candidates.push({ epoch, model, score: await validate(model, join(dir, `validation-${epoch}`)) });
      }
      const eligible = candidates.filter(c => c.score.F >= base.F - .02 && c.score.leakage <= base.leakage + .01).sort((a, b) => b.score.Q - a.score.Q || a.epoch - b.epoch);
      const winner = eligible[0] ?? [...candidates].sort((a, b) => b.score.Q - a.score.Q || a.epoch - b.epoch)[0]!;
      await frozen(join(dir, 'selection.json'), { ...winner, guardPassed: !!eligible.length, base, candidates }); selected.push({ arm, model: winner.model });
    }
    // All checkpoints are fixed before held-out evaluation. A failed guard stays explicitly recorded.
    for (const { arm, model } of [{ arm: 'base', model: MODEL }, ...selected]) await runtime.serve(model, out, async () => {
      for (const n of [1, 4]) {
        for (const split of ['confirm', 'test-mechanism', 'wording']) await runtime.evaluate(model, join(out, 'eval', `${arm}-best-of-${n}`, split), join(data, 'scenarios.jsonl'), join(data, 'probes.jsonl'), split, n, limit);
        await runtime.evaluate(model, join(out, 'eval', `${arm}-best-of-${n}`, 'pairs'), join(data, 'scenarios.jsonl'), join(data, 'pairs-probes.jsonl'), 'all', n, 1000000);
      }
    });
  } finally { await lock.close(); await unlink(lockPath); }
}
if (isMain(import.meta.url)) await launchV2(launchOptions(process.argv.slice(2)));
