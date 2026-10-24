/** CPU-only paired rescoring and blinded audit export. Never instantiates a provider.
 * node --experimental-strip-types bench/slm/checker-v2.ts --data <saved data directory>
 * Results are written exclusively to results/checker-v2-rescore; raw logs stay immutable.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA, hash, isMain, readJsonl } from './io.ts';
import { rescore, runDirs, scorerFingerprint } from './rescore.ts';
import { ACTS, useful, type Row } from './run.ts';
import { factsFor, type Probe, type Scenario } from './types.ts';

export interface Pair { source: string; collection: string; model: string; arm: string; v1: Row; v2: Row }
const faithful = (r: Row) => r.status === 'ok' && r.result?.verdict.epistemicFaithful === true;
const invention = (r: Row) => r.status === 'ok' && !!r.result?.verdict.sentences.some(s => s.label === 'unknown-to-speaker');
const measurement = (r: Row) => ({ verdict: r.result?.verdict, accepted: r.result?.accepted,
  behaviourMatched: r.behaviourMatched, behaviourMatchedLegacy: r.behaviourMatchedLegacy, injectionSuccess: r.injectionSuccess });
export const changed = (p: Pair) => JSON.stringify(measurement(p.v1)) !== JSON.stringify(measurement(p.v2));

export function metrics(rows: Row[]) {
  const eligible = rows.filter(r => r.status !== 'skipped');
  const acts = ACTS.map(act => {
    const subset = eligible.filter(r => r.gold.behaviour === act);
    return { act, n: subset.length, q: subset.filter(useful).length };
  });
  const represented = acts.filter(a => a.n);
  return { n: eligible.length, errors: eligible.filter(r => r.status === 'error').length,
    skipped: rows.length - eligible.length, f: eligible.filter(faithful).length, q: eligible.filter(useful).length,
    macroQ: represented.length ? represented.reduce((sum, a) => sum + a.q / a.n, 0) / represented.length : null,
    acts, missingActs: acts.filter(a => !a.n).map(a => a.act) };
}

export function comparison(pairs: Pair[]) {
  const groups = new Map<string, Pair[]>();
  for (const p of pairs) {
    const key = JSON.stringify([p.collection, p.model, p.arm, p.v1.strategy, p.v1.split]);
    groups.set(key, [...groups.get(key) ?? [], p]);
  }
  return [...groups.values()].map(ps => {
    const p = ps[0]!;
    return { collection: p.collection, model: p.model, arm: p.arm, strategy: p.v1.strategy, split: p.v1.split,
      v1: metrics(ps.map(p => p.v1)), v2: metrics(ps.map(p => p.v2)), changed: ps.filter(changed).length,
      faithfulRescues: ps.filter(p => !faithful(p.v1) && faithful(p.v2)).length,
      faithfulLosses: ps.filter(p => faithful(p.v1) && !faithful(p.v2)).length };
  });
}

/** Equal allocation across collection × split, hash sampling within strata, then blinded shuffle.
 * Inclusion probabilities are retained separately; do not distribute the key to raters.
 */
export function auditSample(pairs: Pair[], scenarios: Map<string, Scenario>, probes: Map<string, Probe>, count = 30) {
  const selected: { pair: Pair; category: string; stratum: string; population: number; selected: number; probability: number }[] = [];
  for (const category of ['rescue', 'unchanged-invention']) {
    const pool = pairs.filter(p => category === 'rescue'
      ? invention(p.v1) && !faithful(p.v1) && faithful(p.v2)
      : invention(p.v1) && invention(p.v2) && !changed(p));
    const strata = new Map<string, Pair[]>();
    for (const p of pool) {
      const key = `${p.collection}/${p.v1.split}`;
      strata.set(key, [...strata.get(key) ?? [], p]);
    }
    if (pool.length < count) throw new Error(`Need ${count} ${category} rows; found ${pool.length}`);
    const keys = [...strata.keys()].sort();
    const quotas = new Map(keys.map(k => [k, 0]));
    for (let n = 0; n < count;) for (const k of keys) {
      if (n === count) break;
      if (quotas.get(k)! < strata.get(k)!.length) { quotas.set(k, quotas.get(k)! + 1); n++; }
    }
    for (const stratum of keys) {
      const group = strata.get(stratum)!;
      const rank = (p: Pair) => hash(['checker-v2-audit-43', category, p.source, p.v1.key]);
      group.sort((a, b) => rank(a).localeCompare(rank(b)));
      const quota = quotas.get(stratum)!;
      for (const pair of group.slice(0, quota)) selected.push({ pair, category, stratum, population: group.length, selected: quota, probability: quota / group.length });
    }
  }
  const rank = (p: Pair) => hash(['checker-v2-blind-order-43', p.source, p.v1.key]);
  selected.sort((a, b) => rank(a.pair).localeCompare(rank(b.pair)));
  const blinded: unknown[] = [], key: unknown[] = [];
  selected.forEach((selection, i) => {
    const { pair, ...sampling } = selection;
    const r = pair.v1, s = scenarios.get(r.scenarioId)!, p = probes.get(r.probeId)!;
    const auditId = `review-${String(i + 1).padStart(3, '0')}`;
    blinded.push({ auditId, speaker: s.persona.name, castNames: s.castNames, knowledge: factsFor(s, p),
      question: p.utterance, history: p.history, reply: r.result!.reply,
      annotations: { clauses: [], faithful: null, actCompleted: null, notes: '' } });
    key.push({ auditId, ...sampling, source: pair.source, key: r.key, model: pair.model, arm: pair.arm, strategy: r.strategy,
      split: r.split, gold: r.gold, v1: measurement(pair.v1), v2: measurement(pair.v2) });
  });
  return { blinded, key };
}

const digest = (text: string) => createHash('sha256').update(text).digest('hex');
async function snapshot(root: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const name of (await readdir(root)).sort()) {
    const path = join(root, name);
    if ((await stat(path)).isDirectory()) {
      for (const [child, sha] of Object.entries(await snapshot(path))) out[join(name, child)] = sha;
    } else out[name] = digest(await readFile(path, 'utf8'));
  }
  return out;
}
const pct = (n: number, d: number) => d ? (100 * n / d).toFixed(1) : 'n/a';
export function comparisonTable(groups: ReturnType<typeof comparison>): string {
  return ['| Collection | Model | Arm | Strategy | Split | n | Errors | Skipped | F v1 | F v2 | Q v1 | Q v2 | Macro Q v1 | Macro Q v2 | Changed | F rescues | F losses |',
    '|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
    ...groups.map(g => `| ${g.collection} | ${g.model} | ${g.arm} | ${g.strategy} | ${g.split} | ${g.v1.n} | ${g.v1.errors} | ${g.v1.skipped} | ${pct(g.v1.f, g.v1.n)} | ${pct(g.v2.f, g.v2.n)} | ${pct(g.v1.q, g.v1.n)} | ${pct(g.v2.q, g.v2.n)} | ${g.v1.macroQ === null ? 'n/a' : (100 * g.v1.macroQ).toFixed(1)} | ${g.v2.macroQ === null ? 'n/a' : (100 * g.v2.macroQ).toFixed(1)} | ${g.changed} | ${g.faithfulRescues} | ${g.faithfulLosses} |`)].join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--data')) throw new Error('usage: checker-v2.ts [--data <saved dataset directory>]');
  const data = resolve(args[1] ?? DATA);
  const results = fileURLToPath(new URL('./results/', import.meta.url));
  const destination = join(results, 'checker-v2-rescore');
  const roots = ['baseline-2', 'finetune/eval'];
  const before: Record<string, Record<string, string>> = {};
  for (const root of roots) before[root] = await snapshot(join(results, root));
  const scenarios = new Map<string, Scenario>(), probes = new Map<string, Probe>();
  for await (const s of readJsonl<Scenario>(join(data, 'scenarios.jsonl'))) scenarios.set(s.id, s);
  for await (const p of readJsonl<Probe>(join(data, 'probes.jsonl'))) probes.set(p.id, p);
  const datasetHashes = { scenarios: digest(await readFile(join(data, 'scenarios.jsonl'), 'utf8')), probes: digest(await readFile(join(data, 'probes.jsonl'), 'utf8')) };
  const fingerprints = { v1: await scorerFingerprint('v1'), v2: await scorerFingerprint('v2') };
  const pairs: Pair[] = [], inventory: unknown[] = [];
  for (const collection of roots) for (const dir of await runDirs(join(results, collection))) {
    const source = relative(results, dir);
    const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8'));
    for (const field of ['scenarios', 'probes'] as const) {
      if (manifest.settings?.[field] !== datasetHashes[field]) throw new Error(`Dataset hash mismatch: ${source}/${field}`);
    }
    const raw: Row[] = (await readFile(join(dir, 'outputs.jsonl'), 'utf8')).trim().split('\n').map(l => JSON.parse(l));
    const latest = [...new Map(raw.map(r => [r.key, r])).values()];
    const v1 = await rescore(latest, scenarios, probes, 'v1'), v2 = await rescore(latest, scenarios, probes, 'v2');
    for (const [version, rows] of [['v1', v1], ['v2', v2]] as const) {
      const out = join(destination, version, source);
      await mkdir(out, { recursive: true });
      await writeFile(join(out, 'rescored.jsonl'), rows.map(r => JSON.stringify(r)).join('\n') + '\n');
    }
    const folder = relative(join(results, collection), dir).split('/')[0]!;
    const arm = collection === 'baseline-2' ? 'base' : folder.split('-').at(-1)!;
    const model = collection === 'baseline-2' ? latest[0]!.model : folder.replace(/-(?:act|base|unfiltered|verifier)$/, '');
    v1.forEach((row, i) => pairs.push({ source, collection, model, arm, v1: row, v2: v2[i]! }));
    inventory.push({ source, rawRows: raw.length, latestRows: latest.length, supersededRows: raw.length - latest.length });
    console.log(`${source}: ${latest.length} final rows scored with v1 and v2`);
  }
  const groups = comparison(pairs), audit = auditSample(pairs, scenarios, probes);
  const metadata = { fingerprints, verifierVersions: ['v1', 'v2'], datasetHashes, data,
    comparisonScriptSha256: digest(await readFile(fileURLToPath(import.meta.url), 'utf8')),
    inventory, originalFiles: before, totalRows: pairs.length, changedRows: pairs.filter(changed).length,
    changedDefinition: 'Any final verdict, acceptance, behaviour proxy or injection outcome differs; includes clause segmentation.',
    denominator: 'Latest row per key within each run; errors fail, skipped configurations excluded. Macro averages represented gold acts.',
    sampling: '30 unknown-to-speaker v1 failures becoming faithful under v2; 30 completely unchanged invention flags. Equal collection × split quotas, fixed hash sample within stratum. Predictions and inclusion probabilities only in audit-key.jsonl.',
    selection: 'Original selected final replies only; attempts retain generation-time verdicts. No counterfactual reselection or model calls.',
    sourceFilesUnchanged: true };
  for (const root of roots) if (JSON.stringify(before[root]) !== JSON.stringify(await snapshot(join(results, root)))) throw new Error(`Original results changed during scoring: ${root}`);
  await writeFile(join(destination, 'manifest.json'), JSON.stringify(metadata, null, 2) + '\n');
  await writeFile(join(destination, 'comparison.json'), JSON.stringify(groups, null, 2) + '\n');
  await writeFile(join(destination, 'comparison.md'), '# Checker v1 and v2\n\nAll rates are percentages. Errors fail; skips are excluded. Per-act counts and missing acts are in comparison.json. These are unaudited classifier outputs, not corrected human estimates.\n\n' + comparisonTable(groups) + '\n');
  await writeFile(join(destination, 'audit-blinded.jsonl'), audit.blinded.map(r => JSON.stringify(r)).join('\n') + '\n');
  await writeFile(join(destination, 'audit-key.jsonl'), audit.key.map(r => JSON.stringify(r)).join('\n') + '\n');
  await writeFile(join(destination, 'audit-instructions.md'), '# Independent review\n\nDistribute only this file and audit-blinded.jsonl to two independent raters. Keep audit-key.jsonl, comparison files and the implementation report hidden until both annotations are frozen.\n\nFor each reply, segment its claims and distinguish denials of knowledge from assertions, quoted material and separate follow-on claims. Judge support against the speaker’s knowledge, confidence and direct source. Label overall faithfulness and whether the reply completes the requested act. Preserve disagreements and adjudicate separately; do not replace either original rating. Empty annotation fields are intentional.\n\nThis 60-row development audit oversamples selected cases. Inclusion probabilities and population sizes are in the withheld key. It is not the 500-output audit required for confirmatory claims and cannot estimate overall accuracy alone.\n');
  console.log(JSON.stringify({ rows: pairs.length, changed: metadata.changedRows, audit: audit.blinded.length, fingerprints }));
}

if (isMain(import.meta.url)) await main();
