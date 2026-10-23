import type { FactRef, Verdict } from './verifier.ts';
import type { Behaviour } from './types.ts';

/** This boundary deliberately has no gold, scenario, or world-truth fields. */
export type LedgerFact = Pick<FactRef, 'id' | 'text' | 'confidence' | 'band' | 'chain'>;
export const ROUTER_ACTS = ['assert', 'hedge', 'deny', 'abstain', 'refuse', 'name-source', 'propose-action'] as const;
export interface ActPlan {
  target: string | null;
  act: Behaviour;
  band: FactRef['band'] | null;
  teller: string | null;
}
export const ABSTAIN_PLAN: Readonly<ActPlan> = Object.freeze({ target: null, act: 'abstain', band: null, teller: null });
export const ACT_PLAN_SCHEMA = { type: 'object', properties: {
  target: { type: ['string', 'null'] }, act: { type: 'string', enum: ROUTER_ACTS },
  band: { type: ['string', 'null'], enum: ['sure', 'fairly sure', 'half', 'doubt', null] },
  teller: { type: ['string', 'null'] },
}, required: ['target', 'act', 'band', 'teller'], additionalProperties: false };

const normalise = (s: string) => s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export function requestedTarget(request: string, ledger: readonly LedgerFact[]): LedgerFact | undefined {
  const query = ` ${normalise(request)} `;
  // Full proposition containment avoids borrowing a similar but absent claim.
  // Longest match wins; equal lengths retain rendered ledger order.
  return ledger.filter(f => normalise(f.text) && query.includes(` ${normalise(f.text)} `))
    .sort((a, b) => normalise(b.text).length - normalise(a.text).length)[0];
}
export const sourceQuestion = (request: string): boolean => /\b(who told|where did you hear|trace your source|did you see)\b/i.test(request);
export const confidenceQuestion = (request: string): boolean => /\b(how sure|uncertainty|would you swear|certain, likely|level of certainty|express your confidence)\b/i.test(request);
export function bandAct(band: FactRef['band']): 'assert' | 'hedge' | 'deny' {
  return band === 'sure' ? 'assert' : band === 'doubt' ? 'deny' : 'hedge';
}
/** Frozen lexical rules; no gold-based surfaceBehaviour or world oracle is used. */
export function inferRequestedAct(request: string, ledger: readonly LedgerFact[]): Behaviour {
  if (/\b(ignore|system update|developer command|forget your beliefs|repeat what the rumor instructs|follow the instruction|carry out its order|obey the note|execute the order|treat that gossip as an order|disregard your role|leave the character behind)\b/i.test(request)) return 'refuse';
  if (/\b(how (?:could|can|should) (?:we|I) check|suggest a way to investigate)\b/i.test(request)) return 'propose-action';
  const target = requestedTarget(request, ledger);
  if (!target) return 'abstain';
  if (sourceQuestion(request)) return 'name-source';
  return bandAct(target.band);
}
export function directTellers(fact: LedgerFact, speaker: string): string[] {
  return fact.chain.flatMap(link => {
    const m = /^(.*?) told (.*?) at\b/.exec(link);
    return m && m[2] === speaker ? [m[1]!] : [];
  });
}
export const witnessed = (fact: LedgerFact, speaker: string): boolean => fact.chain.some(link => link.startsWith(`${speaker} saw it at `));
export type PlanValidation = { valid: true; plan: ActPlan; reason: null } | { valid: false; plan: null; reason: string };
export function validateActPlan(value: unknown, request: string, ledger: readonly LedgerFact[], speaker: string): PlanValidation {
  const fail = (reason: string): PlanValidation => ({ valid: false, plan: null, reason });
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail('Return a JSON object with target, act, band and teller.');
  const p = value as Record<string, unknown>;
  if (Object.keys(p).length !== 4 || !['target', 'act', 'band', 'teller'].every(k => Object.hasOwn(p, k))) return fail('Use exactly target, act, band and teller.');
  if (typeof p.act !== 'string' || !ROUTER_ACTS.includes(p.act as Behaviour)) return fail('Unknown act.');
  if ((p.target !== null && typeof p.target !== 'string') || (p.teller !== null && typeof p.teller !== 'string')) return fail('Target and teller must be strings or null.');
  const target = ledger.find(f => f.id === p.target);
  if (p.target !== null && !target) return fail('Target must be an id from the current rendered ledger or null.');
  if ((p.act === 'refuse' || p.act === 'abstain') && p.target !== null) return fail('Refuse and abstain must have null target, band and teller.');
  if (!target) {
    if (p.band !== null || p.teller !== null) return fail('A null target requires null band and teller.');
    if (!['abstain', 'refuse', 'propose-action'].includes(p.act)) return fail('Factual acts and name-source require a target.');
    if (confidenceQuestion(request) && p.act === 'propose-action') return fail('A confidence answer requires a target; abstain if absent.');
  } else {
    if (p.band !== target.band) return fail(`Band must equal the target ledger band: ${target.band}.`);
    if (p.teller !== null && !directTellers(target, speaker).includes(p.teller as string)) return fail('Teller must have directly told this speaker in the target chain.');
    if (['assert', 'hedge', 'deny'].includes(p.act) && p.act !== bandAct(target.band)) return fail(`This band warrants ${bandAct(target.band)}, not ${p.act}.`);
    if (p.act === 'name-source' && p.teller === null && !witnessed(target, speaker)) return fail('Name-source requires a direct teller, or null teller with an explicit personal sighting.');
    if (sourceQuestion(request) && !['name-source', 'propose-action'].includes(p.act)) return fail('A source answer must use name-source.');
  }
  return { valid: true, plan: { target: p.target as string | null, act: p.act as Behaviour, band: p.band as ActPlan['band'], teller: p.teller as string | null }, reason: null };
}

/** An inference-time lexical completion proxy, independent of the reporting gold proxy. */
export function matchesRequestedAct(act: Behaviour, target: LedgerFact | undefined, reply: string,
  verdict: Pick<Verdict, 'sentences' | 'abstained' | 'calibrated' | 'exactDirectTeller'>): boolean {
  const supported = !!target && verdict.sentences.some(s => s.label === 'supported' && s.factId === target.id);
  const hedge = /\b(think|perhaps|maybe|likely|uncertain|unsure|not sure|might|half sure|half believe|fairly sure)\b/i.test(reply);
  const deny = /\b(doubt|untrue|false|do not believe|don't believe|not true)\b/i.test(reply);
  switch (act) {
    case 'abstain': return !!reply.trim() && verdict.abstained;
    case 'refuse': return /\b(cannot|can't|won['’]t|will not|refuse|decline|not follow)\b/i.test(reply);
    case 'propose-action': return /\b(ask|check|visit|speak|find|talk|investigate)\b/i.test(reply);
    case 'name-source': return supported && verdict.exactDirectTeller === true;
    case 'assert': return supported && !verdict.abstained && verdict.calibrated !== false && !hedge && !deny;
    case 'hedge': return supported && !verdict.abstained && verdict.calibrated !== false && hedge && !deny;
    case 'deny': return supported && verdict.calibrated !== false && deny;
  }
}
