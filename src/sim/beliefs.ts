import { CLAIMS, CONTRADICTIONS } from './data';
import { TUNING as T } from './tuning';
import type { Belief, Character, ClaimId, Hop, Source } from './types';

export const confidence = (logOdds: number): number => 1 / (1 + Math.exp(-logOdds));
export const newBelief = (): Belief => ({
  logOdds: 0, confidence: 0.5, unsupported: 0, exposures: 0, familiarity: 0, provenance: [],
});
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));

export function hear(
  listener: Character, claim: ClaimId, source: Source, tick: number,
  chain: Hop[] = [{ source, tick }], firsthand = false,
): void {
  const belief = listener.beliefs[claim];
  // Only remembered testimony is available here. No global event-log lookup.
  const remembered = chain.slice(-T.memoryHops);
  const root = remembered[0]!;
  const origin = root.source === 'saw' ? (remembered[1]?.source ?? listener.id) : root.source;
  const independent = !belief.provenance.some(p => p.origin === origin && p.kind !== 'correction');
  const trust = source === 'saw' || source === 'noticed' ? 1 : listener.trust[source];
  const like = Math.max(0, listener.affinity.tom);
  const motivation = CLAIMS[claim].harmful ? 1 - T.motivatedDiscount * like : 1 + T.motivatedBoost * like;
  const familiarity = Math.min(T.familiarityCap, T.familiarityRate * Math.log(1 + belief.exposures));
  const familiarityDelta = firsthand ? 0 : familiarity - belief.familiarity;
  const evidence = independent ? T.hearsayStrength * (firsthand ? T.neutralTrust * T.firsthandMultiplier : trust) * motivation : 0;
  const before = belief.logOdds;
  belief.logOdds = clamp(before + evidence + familiarityDelta, -T.logOddsLimit, T.logOddsLimit);
  belief.confidence = confidence(belief.logOdds);
  belief.exposures++;
  if (!firsthand) belief.familiarity = familiarity;
  if (!firsthand) belief.unsupported += belief.logOdds - before;
  belief.provenance.push({
    source, tick, origin, chain: remembered, independent,
    delta: belief.logOdds - before,
    kind: firsthand ? 'firsthand' : independent ? 'hearsay' : 'familiarity',
  });
  if (CLAIMS[claim].harmful) {
    listener.affinity.tom = clamp(listener.affinity.tom - T.harmAffinity * (belief.confidence - confidence(before)), -1, 1);
  }
  // An alternative explanation corrects unsupported suspicion once per remembered origin.
  if (claim === 'gaveTo' && trust >= T.correctionTrust && independent) {
    const original = listener.beliefs[CONTRADICTIONS[claim]];
    const fraction = firsthand ? T.correctionMax : T.correctionMin + (T.correctionMax - T.correctionMin) * trust;
    const removed = Math.min(original.unsupported * fraction, Math.max(0, original.logOdds));
    original.logOdds -= removed;
    original.unsupported = Math.max(0, original.unsupported - removed);
    original.confidence = confidence(original.logOdds);
    original.provenance.push({
      source, tick, delta: -removed, origin, chain: remembered, independent,
      kind: 'correction',
    });
  }
}
