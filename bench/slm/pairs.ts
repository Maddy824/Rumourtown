/** Controlled, oracle-only held-out pair export. No generation or simulation mutation. */
import { join } from 'node:path';
import { choice, DATA, hash, isMain, readJsonl, writeJsonl } from './io.ts';
import { useful, type Row } from './run.ts';
import type { Behaviour, Probe, Scenario } from './types.ts';
export type PairKind = 'knowledge' | 'source' | 'confidence' | 'correction';
export interface MinimalPair {
  id: string; split: Scenario['split']; seed: number; kind: PairKind;
  scenario: Scenario; sides: [Probe, Probe];
}
export function buildPairs(scenarios: Scenario[], count = 100, seed = 7): MinimalPair[] {
  if (!Number.isSafeInteger(count) || count < 1 || !Number.isSafeInteger(seed)) throw new Error('Invalid pair count or seed');
  const out: MinimalPair[] = [];
  for (const split of ['test-seed', 'test-mechanism'] as const) {
    const candidates = scenarios.filter(s => s.split === split).flatMap(s => s.facts.flatMap(f =>
      (['knowledge', 'source', 'confidence', 'correction'] as const).map(kind => ({ s, f, kind }))));
    const picked: MinimalPair[] = [];
    // Equal allocation across interventions; stable hash ranks within each kind.
    const groups = (['knowledge', 'source', 'confidence', 'correction'] as const).map(kind => candidates.filter(c => c.kind === kind)
      .sort((a, b) => hash([seed, a.s.id, a.f.id, kind]).localeCompare(hash([seed, b.s.id, b.f.id, kind]))));
    for (let round = 0; picked.length < count; round++) {
      let added = false;
      for (const group of groups) {
        const c = group[round];
        if (!c || picked.length === count) continue;
        const { s, f, kind } = c;
        const names = s.castNames.filter(n => n !== s.persona.name);
        if (kind === 'source' && names.length < 2) continue;
        const id = `pair-${hash([seed, split, s.id, f.id, kind]).slice(0, 20)}`;
        const first = { ...f, confidence: .95, band: 'sure' as const };
        const second = { ...first };
        let utterance = `What do you believe about this account: ${f.text}?`;
        let acts: [Behaviour, Behaviour] = ['assert', 'assert'];
        if (kind === 'knowledge') acts = ['assert', 'abstain'];
        if (kind === 'source') {
          const a = choice(names, id), b = choice(names.filter(n => n !== a), id);
          first.chain = [`${a} told ${s.persona.name} at 09:00`]; second.chain = [`${b} told ${s.persona.name} at 09:00`];
          utterance = `Who told you that ${f.text}?`; acts = ['name-source', 'name-source'];
        }
        if (kind === 'confidence') {
          second.confidence = .5; Object.assign(second, { band: 'half' });
          utterance = `How sure are you that ${f.text}?`; acts = ['assert', 'hedge'];
        }
        if (kind === 'correction') {
          second.text = `It is not true that ${f.text}`; second.trueInWorld = !f.trueInWorld;
          utterance = `Do you still believe this account: ${f.text}?`; acts = ['assert', 'deny'];
        }
        const sides = [first, second].map((fact, i): Probe => ({ id: `${id}:${i}`, scenarioId: s.id,
          axis: kind === 'knowledge' ? 'facts' : kind === 'source' ? 'provenance' : kind === 'confidence' ? 'confidence' : 'corrections',
          level: i, templateId: `pair-${kind}`, utterance, history: [],
          facts: kind === 'knowledge' && i === 1 ? s.facts.filter(item => item.id !== f.id) : s.facts.map(item => item.id === f.id ? fact : item),
          gold: { behaviour: acts[i]!, ...(kind === 'knowledge' && i === 1 ? {} : { factId: f.id }) } })) as [Probe, Probe];
        picked.push({ id, split, seed: s.seed, kind, scenario: s, sides }); added = true;
      }
      if (!added) throw new Error(`Only ${picked.length} distinct pairs available for ${split}; need ${count}`);
    }
    out.push(...picked);
  }
  return out;
}
/** Missing sides, failed tasks and explicit abstention on a known side all fail. */
export function scorePairs(pairs: MinimalPair[], rows: Row[]) {
  const byCondition = new Map<string, Map<string, Row>>();
  for (const row of rows) {
    const key = `${row.model}/${row.strategy}`;
    if (!byCondition.has(key)) byCondition.set(key, new Map());
    const existing = byCondition.get(key)!;
    if (existing.has(row.probeId)) throw new Error(`Duplicate pair response: ${key}/${row.probeId}`);
    existing.set(row.probeId, row);
  }
  return [...byCondition].flatMap(([condition, replies]) => ['test-seed', 'test-mechanism'].flatMap(split =>
    ['all', 'knowledge', 'source', 'confidence', 'correction'].map(kind => {
      const subset = pairs.filter(p => p.split === split && (kind === 'all' || p.kind === kind));
      const correct = subset.filter(p => p.sides.every(side => { const row = replies.get(side.id); return !!row && useful(row); })).length;
      return { condition, split, kind, correct, total: subset.length, bothRight: subset.length ? correct / subset.length : null };
    })));
}
if (isMain(import.meta.url)) {
  const [mode = 'export', input = join(DATA, 'scenarios.jsonl'), output = join(DATA, 'pairs.jsonl'), count = '100', seed = '7'] = process.argv.slice(2);
  if (mode === 'export') {
    const scenarios: Scenario[] = []; for await (const s of readJsonl<Scenario>(input)) scenarios.push(s);
    const pairs = buildPairs(scenarios, Number(count), Number(seed)); await writeJsonl(output, pairs);
    await writeJsonl(output.replace(/\.jsonl$/, '') + '-probes.jsonl', pairs.flatMap(p => p.sides));
    console.log(`Exported ${pairs.length} pairs to ${output}`);
  } else if (mode === 'score') {
    const pairs: MinimalPair[] = [], rows: Row[] = [];
    for await (const p of readJsonl<MinimalPair>(input)) pairs.push(p);
    for await (const r of readJsonl<Row>(output)) rows.push(r);
    console.log(JSON.stringify(scorePairs(pairs, rows), null, 2));
  } else throw new Error('usage: pairs.ts export [scenarios pairs.jsonl count seed] | score pairs.jsonl rescored.jsonl');
}
