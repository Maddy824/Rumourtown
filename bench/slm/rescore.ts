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
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DATA, hash, isMain, readJsonl } from './io.ts';
import { summarise, surfaceBehaviour, type Row } from './run.ts';
import { passes } from './strategies.ts';
import { factsFor, type Probe, type Scenario } from './types.ts';
import { verify } from './verifier.ts';

async function runDirs(root: string): Promise<string[]> {
  if (await stat(join(root, 'outputs.jsonl')).then(() => true, () => false)) return [root];
  const out: string[] = [];
  for (const name of (await readdir(root)).sort()) {
    const dir = join(root, name);
    if ((await stat(dir)).isDirectory() && await stat(join(dir, 'outputs.jsonl')).then(() => true, () => false)) out.push(dir);
  }
  return out;
}

export async function rescore(rows: Row[], scenarios: Map<string, Scenario>, probes: Map<string, Probe>): Promise<Row[]> {
  const out: Row[] = [];
  for (const row of rows) {
    if (row.status !== 'ok' || !row.result) { out.push(row); continue; }
    const p = probes.get(row.probeId)!, s = scenarios.get(row.scenarioId)!;
    const verdict = await verify(row.result.reply, factsFor(s, p), s.unknownWorldFacts, s.castNames);
    const last = row.result.attempts.at(-1);
    const result = { ...row.result, verdict, accepted: (last?.protocolValid ?? !!row.result.reply.trim()) && passes(verdict) };
    const next: Row = { ...row, result, behaviourMatched: surfaceBehaviour(p, result) };
    if (p.gold.injectionMarker) next.injectionSuccess = result.reply.includes(p.gold.injectionMarker) || !verdict.epistemicFaithful;
    out.push(next);
  }
  return out;
}

async function main(): Promise<void> {
  const roots = process.argv.slice(2);
  if (!roots.length) throw new Error('usage: rescore.ts <result dir> [...]');
  const scenarios = new Map<string, Scenario>(), probes = new Map<string, Probe>();
  for await (const s of readJsonl<Scenario>(join(DATA, 'scenarios.jsonl'))) scenarios.set(s.id, s);
  for await (const p of readJsonl<Probe>(join(DATA, 'probes.jsonl'))) probes.set(p.id, p);
  const verifierHash = hash(await readFile(new URL('../../apps/rumortown/src/agentic/verifier.ts', import.meta.url), 'utf8'));
  const all: Row[] = [];
  for (const root of roots) for (const dir of await runDirs(root)) {
    const rows: Row[] = (await readFile(join(dir, 'outputs.jsonl'), 'utf8')).split('\n').filter(Boolean).map(l => JSON.parse(l));
    // An append-only log can hold an error record superseded by a later success for the same key.
    const latest = [...new Map(rows.map(r => [r.key, r])).values()];
    const rescored = await rescore(latest, scenarios, probes);
    await writeFile(join(dir, 'rescored.jsonl'), rescored.map(r => JSON.stringify(r)).join('\n') + '\n');
    await writeFile(join(dir, 'summary-rescored.md'), `Verifier sha256 ${verifierHash.slice(0, 12)}.\n\n${summarise(rescored)}`);
    all.push(...rescored);
    console.log(`${dir}: ${rescored.length} rows re-scored`);
  }
  await writeFile(join(roots[0]!, 'combined-rescored.md'), `Verifier sha256 ${verifierHash.slice(0, 12)}.\n\n${summarise(all)}`);
}

if (isMain(import.meta.url)) await main();
