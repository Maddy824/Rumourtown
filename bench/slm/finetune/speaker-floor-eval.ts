/** Serial, fail-fast version of the confirmation best-of-1 evaluation.
 * Probe allocation matches run.ts's root-balanced axis round robin.
 * The provider is local MLX; template never calls it. No training lives here.
 */
import { appendFile, mkdir, readFile, writeFile, truncate } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { ACTS, useful, surfaceBehaviour, surfaceBehaviourLegacy, type Row } from '../run.ts';
import { AXES, type Probe, type Scenario } from '../types.ts';
import { mlx, mock } from '../providers.ts';
import { execute } from '../strategies.ts';
import { hash, isMain } from '../io.ts';

export function select(probes: Probe[], scenarios: Map<string, Scenario>, split: string, limit: number): Probe[] {
  const buckets = AXES.map(axis => probes.filter(p => p.axis === axis && (p.split ?? scenarios.get(p.scenarioId)?.split) === split));
  const roots = new Map<number, Probe[]>();
  for (let i = 0; buckets.some(b => i < b.length); i++) for (const bucket of buckets) {
    const p = bucket[i]; if (!p) continue;
    const s = scenarios.get(p.scenarioId); if (!s) throw new Error(`Missing scenario ${p.scenarioId}`);
    const group = roots.get(s.seed) ?? []; group.push(p); roots.set(s.seed, group);
  }
  if (limit < roots.size) throw new Error('Limit must cover every root');
  const groups = [...roots].sort(([a], [b]) => a - b).map(([, ps]) => ps), selected: Probe[] = [];
  for (let i = 0; selected.length < limit && groups.some(g => i < g.length); i++) for (const group of groups) {
    if (group[i] && selected.length < limit) selected.push(group[i]!);
  }
  if (!selected.length) throw new Error('No matching probes');
  return selected;
}

export function scores(rows: Row[], probes: Map<string, Probe>, scenarios: Map<string, Scenario>) {
  const rs = rows.filter(r => r.status !== 'skipped');
  if (!rs.length) throw new Error('No scored rows');
  const perAct = Object.fromEntries(ACTS.map(act => {
    const group = rs.filter(r => r.gold.behaviour === act);
    return [act, { n: group.length, Q: group.filter(useful).length, F: group.filter(r => r.status === 'ok' && r.result?.verdict.epistemicFaithful).length }];
  }));
  const represented = Object.values(perAct).filter(a => a.n);
  const opportunities = rs.filter(r => {
    const p = probes.get(r.probeId)!, s = scenarios.get(r.scenarioId)!;
    return !!p.distractors?.length || s.unknownWorldFacts.some(f => p.utterance.includes(f));
  });
  const leaks = opportunities.filter(r => r.status === 'ok' && r.result?.verdict.sentences.some(s => s.label === 'unknown-to-speaker')).length;
  return { n: rs.length, errors: rs.filter(r => r.status === 'error').length,
    Q: rs.filter(useful).length / rs.length,
    F: rs.filter(r => r.status === 'ok' && r.result?.verdict.epistemicFaithful).length / rs.length,
    macroQ: represented.reduce((n, a) => n + a.Q / a.n, 0) / represented.length,
    macroF: represented.reduce((n, a) => n + a.F / a.n, 0) / represented.length,
    leakage: opportunities.length ? leaks / opportunities.length : null,
    leakageNumerator: leaks, leakageDenominator: opportunities.length, perAct };
}

async function jsonl<T>(path: string): Promise<T[]> {
  return (await readFile(path, 'utf8')).split('\n').filter(Boolean).map(line => JSON.parse(line));
}
async function main() {
  const [mode, configPath] = process.argv.slice(2);
  if (!configPath || !['evaluate', 'summarise'].includes(mode!)) throw new Error('Use evaluate|summarise <config.json>');
  const c = JSON.parse(await readFile(configPath, 'utf8'));
  const scenarios = new Map((await jsonl<Scenario>(c.scenarios)).map(s => [s.id, s]));
  const probes = await jsonl<Probe>(c.probes), byId = new Map(probes.map(p => [p.id, p]));
  if (mode === 'summarise') {
    await writeFile(c.summary, JSON.stringify(scores(await jsonl<Row>(c.rescored), byId, scenarios), null, 2)); return;
  }
  const selected = select(probes, scenarios, c.split, c.limit);
  const directory = c.directory as string;
  await mkdir(directory, { recursive: true });
  const sha = async (p: string) => createHash('sha256').update(await readFile(p)).digest('hex');
  const settings = { ...c, probeIds: selected.map(p => p.id), scenarios: await sha(c.scenarios), probes: await sha(c.probes) };
  const fingerprint = hash(settings), manifest = join(directory, 'manifest.json'), output = join(directory, 'outputs.jsonl');
  let old: { fingerprint: string } | undefined;
  try { old = JSON.parse(await readFile(manifest, 'utf8')); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
  if (old && old.fingerprint !== fingerprint) throw new Error('Evaluation inputs changed');
  if (!old) await writeFile(manifest, JSON.stringify({ fingerprint, settings }, null, 2), { flag: 'wx' });
  let raw = '';
  try { raw = await readFile(output, 'utf8'); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
  const boundary = raw.lastIndexOf('\n') + 1;
  if (boundary < raw.length) await truncate(output, Buffer.byteLength(raw.slice(0, boundary)));
  const done = new Map<string, Row>(raw.slice(0, boundary).split('\n').filter(Boolean).map(line => { const r = JSON.parse(line) as Row; return [r.key, r]; }));
  for (const p of selected) {
    const key = hash([fingerprint, p.id]);
    if (done.get(key)?.status === 'ok') continue;
    const s = scenarios.get(p.scenarioId)!;
    const row: Row = { key, probeId: p.id, scenarioId: s.id, seed: s.seed, split: p.split ?? s.split,
      axis: p.axis, level: p.level, actualSize: p.actualSize, gold: p.gold, model: c.label, actualModel: c.model,
      strategy: c.template ? 'template' : 'best-of', status: 'ok' };
    const provider = c.template ? mock() : mlx({ fetch: async (url, init) => {
      const body = JSON.parse(init!.body as string);
      body.chat_template_kwargs.speaker_floor_key = key;
      return fetch(url, { ...init, body: JSON.stringify(body) });
    } });
    try {
      row.result = await execute(row.strategy, s, p, { provider, model: c.model, bestOf: 1, temperature: .7, maxTokens: 192 });
      row.behaviourMatched = surfaceBehaviour(p, row.result);
      row.behaviourMatchedLegacy = surfaceBehaviourLegacy(p, row.result);
      if (p.gold.injectionMarker) row.injectionSuccess = row.result.reply.includes(p.gold.injectionMarker) || !row.result.verdict.epistemicFaithful;
    } catch {
      row.status = 'error'; row.reason = 'Local evaluation failed; inspect server.log';
      await appendFile(output, JSON.stringify(row) + '\n');
      throw new Error(`Stopped model at ${p.id}; bounded retry on next explicit launch only`);
    }
    await appendFile(output, JSON.stringify(row) + '\n');
  }
}
if (isMain(import.meta.url)) await main();
