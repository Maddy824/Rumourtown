/**
 * Re-score stored replies with the current verifier, so every model in a study is judged by one oracle
 * version even when runs started before a verifier fix. Generation is not repeated.
 *
 *   node --experimental-strip-types bench/slm/rescore.ts bench/slm/results/baseline-1 [more result dirs...]
 *
 * Writes rescored.jsonl and summary-rescored.md in each run directory, and combined-rescored.md in the
 * first argument's directory. Selection-based strategies (best-of, cascade) chose their final reply
 * with the verifier of the original run; only that final reply is re-judged here.
 */
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, basename, relative, resolve } from 'node:path';
import { DATA, hash, isMain, readJsonl } from './io.ts';
import { summarise, surfaceBehaviour, surfaceBehaviourLegacy, type Row } from './run.ts';
import { passes } from './strategies.ts';
import { factsFor, oracleOptions, type Probe, type Scenario } from './types.ts';
import { verify, type VerifierVersion } from './verifier.ts';

export async function runDirs(root: string): Promise<string[]> {
  if (await stat(join(root, 'outputs.jsonl')).then(() => true, () => false)) return [root];
  const out: string[] = [];
  for (const name of (await readdir(root)).sort()) {
    const dir = join(root, name);
    if ((await stat(dir)).isDirectory()) out.push(...await runDirs(dir));
  }
  return out;
}

export async function rescore(rows: Row[], scenarios: Map<string, Scenario>, probes: Map<string, Probe>,
  verifierVersion: VerifierVersion = 'v1'): Promise<Row[]> {
  const out: Row[] = [];
  for (const row of rows) {
    if (row.status !== 'ok' || !row.result) { out.push(row); continue; }
    const p = probes.get(row.probeId), s = scenarios.get(row.scenarioId);
    if (!p || !s || p.scenarioId !== s.id) throw new Error(`Missing or mismatched context for ${row.key}`);
    const verdict = await verify(row.result.reply, factsFor(s, p), s.unknownWorldFacts, s.castNames, { ...oracleOptions(s, p), verifierVersion });
    const last = row.result.attempts.at(-1);
    const result = { ...row.result, verdict, accepted: (last?.protocolValid ?? !!row.result.reply.trim()) && passes(verdict) };
    const next: Row = { ...row, result, behaviourMatched: surfaceBehaviour(p, result), behaviourMatchedLegacy: surfaceBehaviourLegacy(p, result) };
    if (p.gold.injectionMarker) next.injectionSuccess = result.reply.includes(p.gold.injectionMarker) || !verdict.epistemicFaithful;
    out.push(next);
  }
  return out;
}

/** Hash the selected semantics as well as their source; v1 and v2 never share a fingerprint. */
export async function scorerFingerprint(verifierVersion: VerifierVersion): Promise<string> {
  return hash({ verifierVersion, sources: await Promise.all(['verifier.ts', 'run.ts', 'strategies.ts', 'types.ts', 'rescore.ts', '../../apps/rumortown/src/agentic/verifier.ts'].map(path => readFile(new URL(path, import.meta.url), 'utf8'))) });
}

async function main(): Promise<void> {
  const roots: string[] = [], flags = new Map<string, string>();
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (!arg.startsWith('--')) { roots.push(arg); continue; }
    if (!['--scenarios', '--probes', '--verifier-version', '--out'].includes(arg) || flags.has(arg) || !args[i + 1] || args[i + 1]!.startsWith('--')) throw new Error('Invalid rescore option');
    flags.set(arg, args[++i]!);
  }
  if (!roots.length) throw new Error('usage: rescore.ts <result dir> [...]');
  const verifierVersion = flags.get('--verifier-version') ?? 'v1';
  if (verifierVersion !== 'v1' && verifierVersion !== 'v2') throw new Error('verifier-version must be v1 or v2');
  const outputRoot = flags.get('--out');
  if (verifierVersion === 'v2' && !outputRoot) throw new Error('v2 rescoring requires --out to preserve historical results');
  if (outputRoot && roots.some(root => resolve(outputRoot) === resolve(root))) throw new Error('--out must differ from input roots');
  const scenariosPath = flags.get('--scenarios') ?? join(DATA, 'scenarios.jsonl');
  const probesPath = flags.get('--probes') ?? join(DATA, 'probes.jsonl');
  const digest = async (path: string) => createHash('sha256').update(await readFile(path)).digest('hex');
  const datasetHashes = { scenarios: await digest(scenariosPath), probes: await digest(probesPath) };
  const scenarios = new Map<string, Scenario>(), probes = new Map<string, Probe>();
  for await (const s of readJsonl<Scenario>(scenariosPath)) scenarios.set(s.id, s);
  for await (const p of readJsonl<Probe>(probesPath)) probes.set(p.id, p);
  const verifierHash = await scorerFingerprint(verifierVersion);
  const header = `Verifier ${verifierVersion}. Scorer sha256 ${verifierHash}. Scenarios sha256 ${datasetHashes.scenarios}. Probes sha256 ${datasetHashes.probes}.\n\n`;
  const all: Row[] = [];
  for (const root of roots) for (const dir of await runDirs(root)) {
    let manifest: { settings?: { scenarios?: string; probes?: string } } | undefined;
    try { manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8')); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    for (const key of ['scenarios', 'probes'] as const) {
      if (manifest?.settings?.[key] && manifest.settings[key] !== datasetHashes[key]) throw new Error(`Dataset ${key} differs from run manifest: ${dir}`);
    }
    const rows: Row[] = (await readFile(join(dir, 'outputs.jsonl'), 'utf8')).split('\n').filter(Boolean).map(l => JSON.parse(l));
    // An append-only log can hold an error record superseded by a later success for the same key.
    const latest = [...new Map(rows.map(r => [r.key, r])).values()];
    const rescored = await rescore(latest, scenarios, probes, verifierVersion);
    const destination = outputRoot ? join(outputRoot, verifierVersion, basename(root), relative(root, dir)) : dir;
    await mkdir(destination, { recursive: true });
    await writeFile(join(destination, 'rescored.jsonl'), rescored.map(r => JSON.stringify(r)).join('\n') + '\n');
    await writeFile(join(destination, 'summary-rescored.md'), header + summarise(rescored));
    all.push(...rescored);
    console.log(`${dir}: ${rescored.length} rows re-scored`);
  }
  const combined = outputRoot ? join(outputRoot, verifierVersion) : roots[0]!;
  await mkdir(combined, { recursive: true });
  await writeFile(join(combined, 'combined-rescored.md'), header + summarise(all));
}

if (isMain(import.meta.url)) await main();
