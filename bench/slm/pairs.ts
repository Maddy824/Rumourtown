/** Controlled, oracle-only held-out pair export. No generation or simulation mutation. */
import { join } from 'node:path';
import { choice, DATA, hash, isMain, readJsonl, writeJsonl } from './io.ts';
import { useful, type Row } from './run.ts';
import type { Behaviour, Probe, Scenario } from './types.ts';
export type PairKind = 'knowledge' | 'source' | 'confidence' | 'correction';
export interface SemanticProjection { proposition: string | null; polarity: number | null; confidence: string | null; source: string | null; act: Behaviour | 'other' }
export interface MinimalPair {
  id: string; split: Scenario['split']; seed: number; kind: PairKind;
  scenario: Scenario; sides: [Probe, Probe];
  nullIntervention?: boolean;
  projections?: [SemanticProjection, SemanticProjection];
}
export function buildPairs(scenarios: Scenario[], count = 100, seed = 7, options: { splits?: Scenario['split'][]; nulls?: boolean; boundaryOnly?: boolean } = {}): MinimalPair[] {
  if (!Number.isSafeInteger(count) || count < 1 || !Number.isSafeInteger(seed)) throw new Error('Invalid pair count or seed');
  const out: MinimalPair[] = [];
  for (const split of options.splits ?? ['test-seed', 'test-mechanism']) {
    const candidates = scenarios.filter(s => s.split === split).flatMap(s => s.facts.flatMap(f =>
      (['knowledge', 'source', 'confidence', 'correction'] as const).map(kind => ({ s, f, kind }))));
    const picked: MinimalPair[] = [];
    // Equal allocation across interventions; stable hash ranks within each kind.
    const groups = (['knowledge', 'source', 'confidence', 'correction'] as const).filter(kind => !options.boundaryOnly || ['knowledge', 'correction'].includes(kind)).map(kind => candidates.filter(c => c.kind === kind)
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
        // Methods §8 (unnumbered semantic projection): oracle-side gold, never a policy input.
        const projections = sides.map((side, i): SemanticProjection => ({ proposition: kind === 'knowledge' && i === 1 ? null : f.id,
          polarity: kind === 'knowledge' && i === 1 ? null : kind === 'correction' && i === 1 ? -1 : 1,
          confidence: kind === 'knowledge' && i === 1 ? null : i === 0 ? first.band : second.band,
          source: kind === 'source' ? (i === 0 ? first : second).chain[0]!.split(' told ')[0]! : null,
          act: side.gold.behaviour })) as [SemanticProjection, SemanticProjection];
        picked.push({ id, split, seed: s.seed, kind, scenario: s, sides, projections }); added = true;
      }
      if (!added) throw new Error(`Only ${picked.length} distinct pairs available for ${split}; need ${count}`);
    }
    out.push(...picked);
    if (options.nulls) for (const pair of picked) {
      const id = pair.id + '-null', base = pair.sides[0];
      // Matched null per family: irrelevant formatting leaves effective evidence and gold unchanged.
      out.push({ ...pair, id, nullIntervention: true, projections: [pair.projections![0], pair.projections![0]],
        sides: [{ ...base, id: id + ':0' }, { ...base, id: id + ':1', utterance: `  ${base.utterance}  `,
          distractors: [...(base.distractors ?? [])].reverse() }] });
    }
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
  return [...byCondition].flatMap(([condition, replies]) => [...new Set(pairs.map(p => p.split))].flatMap(split =>
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
    const pairs = buildPairs(scenarios, Number(count), Number(seed), { splits: process.argv.includes('--train') ? ['train'] : undefined, nulls: process.argv.includes('--nulls'), boundaryOnly: process.argv.includes('--train') }); await writeJsonl(output, pairs);
    await writeJsonl(output.replace(/\.jsonl$/, '') + '-probes.jsonl', pairs.flatMap(p => p.sides));
    console.log(`Exported ${pairs.length} pairs to ${output}`);
  } else if (mode === 'score') {
    const pairs: MinimalPair[] = [], rows: Row[] = [];
    for await (const p of readJsonl<MinimalPair>(input)) pairs.push(p);
    for await (const r of readJsonl<Row>(output)) rows.push(r);
    console.log(JSON.stringify(scorePairs(pairs, rows), null, 2));
  } else throw new Error('usage: pairs.ts export [scenarios pairs.jsonl count seed] | score pairs.jsonl rescored.jsonl');
}
