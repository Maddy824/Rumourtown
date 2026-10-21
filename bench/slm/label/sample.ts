import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { DATA, hash, isMain, readJsonl } from '../io.ts';
import type { Row } from '../run.ts';
import { factsFor, type Probe, type Scenario } from '../types.ts';
import { sentences } from '../verifier.ts';
import { LABELS, options, replyLabel, type Item, type ItemFile, type KeyFile, type KeyItem } from './schema.ts';

const sha256 = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');
const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const exists = async (path: string): Promise<boolean> => stat(path).then(() => true, () => false);

/** Prefer one rescored file per run; never double-count its original output. */
export async function resultFiles(paths: string[]): Promise<string[]> {
  const found = new Set<string>();
  async function visit(path: string): Promise<void> {
    path = resolve(path);
    if (!(await stat(path)).isDirectory()) {
      if (!['outputs.jsonl', 'rescored.jsonl'].includes(path.split(/[\\/]/).at(-1)!)) throw new Error(`Expected a result directory or outputs.jsonl/rescored.jsonl: ${path}`);
      found.add(path); return;
    }
    for (const name of ['rescored.jsonl', 'outputs.jsonl']) {
      if (await exists(join(path, name))) { found.add(join(path, name)); return; }
    }
    for (const entry of (await readdir(path, { withFileTypes: true })).sort((a, b) => compare(a.name, b.name))) {
      if (entry.isDirectory()) await visit(join(path, entry.name));
    }
  }
  for (const path of paths) await visit(path);
  // Explicitly specifying both formats in one run would silently duplicate it.
  const dirs = new Set<string>();
  for (const file of found) {
    if (dirs.has(dirname(file))) throw new Error('Choose only one result file per run');
    dirs.add(dirname(file));
  }
  if (!found.size) throw new Error('No result files found');
  return [...found].sort(compare);
}

export interface Candidate { row: Row; source: string; sourceHash: string; scenario: Scenario; probe: Probe }

/** Hash ranks provide seeded sampling without relying on input or locale order. */
export function draw(candidates: Candidate[], n = 500, seed = '7'): { items: ItemFile; key: KeyFile } {
  if (!Number.isSafeInteger(n) || n < 1) throw new Error('--n must be a positive safe integer');
  const buckets = new Map<string, { candidates: Candidate[]; verdict: ReturnType<typeof replyLabel> }>();
  for (const candidate of candidates) {
    const row = candidate.row;
    if (row.status !== 'ok' || !row.result) continue;
    const texts = sentences(row.result.reply), oracle = row.result.verdict;
    if (texts.length !== oracle.sentences.length || oracle.sentences.some((s, i) => s.text !== texts[i] || !LABELS.includes(s.label))) {
      throw new Error(`Sentence or label mismatch for ${row.key}; re-score the run with the fixed verifier first`);
    }
    const verdict = replyLabel(oracle.sentences.map(s => s.label));
    const stratum = JSON.stringify([row.model, row.axis, verdict]);
    if (!buckets.has(stratum)) buckets.set(stratum, { candidates: [], verdict });
    buckets.get(stratum)!.candidates.push(candidate);
  }
  if (!buckets.size) throw new Error('No successful replies to sample');
  const rank = (c: Candidate): string => hash([seed, c.source, c.sourceHash, c.row.key]);
  for (const bucket of buckets.values()) bucket.candidates.sort((a, b) => compare(rank(a), rank(b)));
  const strata = [...buckets.keys()].sort((a, b) => compare(hash([seed, a]), hash([seed, b])));
  const selected: Candidate[] = [];
  // Water-fill evenly: exhaust rare strata, then redistribute unused capacity.
  for (let depth = 0; selected.length < n; depth++) {
    let added = false;
    for (const stratum of strata) {
      const candidate = buckets.get(stratum)!.candidates[depth];
      if (candidate && selected.length < n) { selected.push(candidate); added = true; }
    }
    if (!added) break;
  }
  // Shuffle presentation separately so adjacent items do not reveal strata.
  selected.sort((a, b) => compare(hash(['presentation', rank(a)]), hash(['presentation', rank(b)])));
  const privateItems: KeyItem[] = [], publicItems: Item[] = [];
  for (const { row, source, sourceHash, scenario: s, probe: p } of selected) {
    const id = hash(['item', seed, source, sourceHash, row.key]);
    const facts = factsFor(s, p), result = row.result!;
    publicItems.push({ id, speaker: { name: s.persona.name, role: s.persona.role, voice: s.persona.voice },
      beliefs: facts.map(f => ({ text: f.text, band: f.band, sources: [...f.chain] })),
      // Only the probe's displayed distractors, never the whole village ledger.
      distractors: (row.strategy === 'persona' ? [] : p.distractors ?? []).map(d => ({ speaker: d.speaker, text: d.text })),
      utterance: p.utterance, history: p.history.map(t => ({ role: t.role, content: t.content })), reply: result.reply });
    privateItems.push({ id, rowKey: row.key, source, model: row.model, actualModel: row.actualModel,
      strategy: row.strategy, axis: row.axis, split: row.split, scenarioId: row.scenarioId, probeId: row.probeId,
      oracle: result.verdict, oracleReply: replyLabel(result.verdict.sentences.map(t => t.label)),
      behaviourMatched: row.behaviourMatched ?? null, gold: row.gold,
      worldTruth: { beliefs: facts.map(f => ({ text: f.text, trueInWorld: f.trueInWorld })), unknownWorldFacts: [...s.unknownWorldFacts] },
      sentences: sentences(result.reply) });
  }
  const sampleId = hash(publicItems);
  return { items: { version: 1, sampleId, items: publicItems }, key: { version: 1, sampleId, seed, requested: n,
    population: [...buckets.values()].reduce((sum, b) => sum + b.candidates.length, 0), inputs: [],
    strata: strata.map(stratum => {
      const bucket = buckets.get(stratum)!, first = bucket.candidates[0]!.row;
      return { model: first.model, axis: first.axis, verdict: bucket.verdict, population: bucket.candidates.length,
        sampled: privateItems.filter(i => i.model === first.model && i.axis === first.axis && i.oracleReply === bucket.verdict).length };
    }), items: privateItems } };
}

export async function sample(args: string[]): Promise<{ items: ItemFile; key: KeyFile }> {
  const { flags, paths } = options(args, ['n', 'seed', 'scenarios', 'probes', 'out']);
  if (!paths.length) throw new Error('Usage: sample.ts <result dir> [...] --out <new folder> [--n 500 --seed 7 --scenarios file --probes file]');
  if (!flags.has('out')) throw new Error('--out is required (a new folder; keep the key private)');
  const scenarioPath = resolve(flags.get('scenarios') ?? join(DATA, 'scenarios.jsonl'));
  const probePath = resolve(flags.get('probes') ?? join(DATA, 'probes.jsonl'));
  const inputs: KeyFile['inputs'] = [];
  for (const path of [scenarioPath, probePath]) inputs.push({ path, sha256: sha256(await readFile(path)) });
  const scenarios = new Map<string, Scenario>(), probes = new Map<string, Probe>();
  for await (const s of readJsonl<Scenario>(scenarioPath)) {
    if (scenarios.has(s.id)) throw new Error(`Duplicate scenario: ${s.id}`);
    scenarios.set(s.id, s);
  }
  for await (const p of readJsonl<Probe>(probePath)) {
    if (probes.has(p.id)) throw new Error(`Duplicate probe: ${p.id}`);
    probes.set(p.id, p);
  }
  const candidates: Candidate[] = [];
  const seenRows = new Set<string>();
  for (const path of await resultFiles(paths)) {
    const manifestPath = join(dirname(path), 'manifest.json');
    if (await exists(manifestPath)) {
      const raw = await readFile(manifestPath, 'utf8');
      const manifest = JSON.parse(raw) as { settings?: { scenarios?: string; probes?: string } };
      for (const [i, name] of ['scenarios', 'probes'].entries()) {
        const expected = manifest.settings?.[name as 'scenarios' | 'probes'];
        if (expected && expected !== inputs[i]!.sha256) throw new Error(`${name} do not match ${manifestPath}; pass the run's original dataset`);
      }
      inputs.push({ path: manifestPath, sha256: sha256(raw) });
    }
    // Read a snapshot; fail rather than silently dropping an unfinished JSON line.
    const raw = await readFile(path, 'utf8'), sourceHash = sha256(raw);
    inputs.push({ path, sha256: sourceHash });
    const latest = new Map<string, Row>();
    for (const line of raw.split('\n').filter(l => l.trim())) {
      const row = JSON.parse(line) as Row;
      if (typeof row.key !== 'string') throw new Error(`Missing row key in ${path}`);
      latest.set(row.key, row);
    }
    for (const row of latest.values()) {
      if (row.status !== 'ok' || !row.result) continue;
      if (seenRows.has(row.key)) throw new Error(`Duplicate generation ${row.key} across result files; remove overlapping run copies`);
      seenRows.add(row.key);
      const scenario = scenarios.get(row.scenarioId), probe = probes.get(row.probeId);
      if (!scenario || !probe || probe.scenarioId !== scenario.id || probe.axis !== row.axis || scenario.split !== row.split) {
        throw new Error(`Missing or inconsistent context for ${row.key} in ${path}`);
      }
      candidates.push({ row, source: path, sourceHash, scenario, probe });
    }
  }
  const result = draw(candidates, Number(flags.get('n') ?? 500), flags.get('seed') ?? '7');
  result.key.inputs = inputs;
  const out = resolve(flags.get('out')!);
  await mkdir(dirname(out), { recursive: true });
  await mkdir(out); // Exclusive directory creation prevents mixing an old key and new items.
  await writeFile(join(out, 'items.json'), JSON.stringify(result.items, null, 2) + '\n', { flag: 'wx' });
  await writeFile(join(out, 'key.private.json'), JSON.stringify(result.key, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return result;
}

if (isMain(import.meta.url)) {
  const result = await sample(process.argv.slice(2));
  console.log(`${result.items.items.length} items from ${result.key.population} replies; ${result.key.strata.filter(s => s.sampled).length}/${result.key.strata.length} strata represented. Share only items.json and index.html.`);
}
