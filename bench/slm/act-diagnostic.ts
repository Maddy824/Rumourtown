/** CPU-only training diagnostic. Gold is read here for comparison, never by inference. */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import { inferRequestedAct, ROUTER_ACTS } from './act-router.ts';
import { DATA, isMain, readJsonl } from './io.ts';
import { factsFor, type Behaviour, type Probe, type Scenario } from './types.ts';

export async function trainingActAgreement(scenariosPath: string, probesPath: string) {
  const scenarios = new Map<string, Scenario>();
  for await (const s of readJsonl<Scenario>(scenariosPath)) scenarios.set(s.id, s);
  const byAct = Object.fromEntries(ROUTER_ACTS.map(a => [a, { matched: 0, total: 0 }])) as Record<Behaviour, { matched: number; total: number }>;
  const confusion: Record<string, number> = {};
  let total = 0, matched = 0;
  for await (const p of readJsonl<Probe>(probesPath)) {
    const s = scenarios.get(p.scenarioId);
    if (!s) throw new Error(`Missing scenario: ${p.scenarioId}`);
    if (s.split !== 'train' || (p.split && p.split !== 'train') || p.wording) continue;
    const inferred = inferRequestedAct(p.utterance, factsFor(s, p));
    const correct = inferred === p.gold.behaviour;
    total++; matched += Number(correct);
    byAct[p.gold.behaviour].total++; byAct[p.gold.behaviour].matched += Number(correct);
    const key = `${p.gold.behaviour} -> ${inferred}`;
    confusion[key] = (confusion[key] ?? 0) + 1;
  }
  const digest = async (path: string) => {
    const h = createHash('sha256');
    for await (const chunk of createReadStream(path)) h.update(chunk);
    return h.digest('hex');
  };
  return { diagnosticOnly: true, split: 'train', total, matched, agreement: total ? matched / total : null, byAct, confusion,
    hashes: { scenarios: await digest(scenariosPath), probes: await digest(probesPath) } };
}

if (isMain(import.meta.url)) {
  if (process.argv.length > 4) throw new Error('usage: act-diagnostic.ts [scenarios.jsonl] [probes.jsonl]');
  console.log(JSON.stringify(await trainingActAgreement(process.argv[2] ?? join(DATA, 'scenarios.jsonl'),
    process.argv[3] ?? join(DATA, 'probes.jsonl')), null, 2));
}
