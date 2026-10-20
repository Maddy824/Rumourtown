import type { Claim, ClaimId, CharacterId } from './claims.js';
import type { BeliefLedger, HearResult } from './belief.js';
import type { Relationships } from './relationships.js';
import { DEFAULT_TUNING, type Tuning } from './tuning.js';
import type { Rng } from './rng.js';

export interface TellScoreInput {
  /** The speaker's confidence in the claim. Belief is the strongest driver of passing a rumor on. */
  confidence: number;
  valence: -1 | 0 | 1;
  /** Speaker-listener closeness, 0..1. */
  closenessToListener: number;
  /** Listener's closeness to the person the claim is about, 0..1. Negative gossip goes to allies about distant targets. */
  listenerClosenessToTarget: number;
  /** Spreaders stop when the listener already knows (Maki-Thompson stifling). */
  listenerAlreadyKnows: boolean;
  /** 0..1: people also pass on what they only half believe if it would be interesting were it true. */
  interestingIfTrue?: number;
}

/** A utility score in roughly 0..2. Above `tellThreshold` means the speaker brings it up. Weights are tuned. */
export function tellScore(input: TellScoreInput, tuning: Tuning = DEFAULT_TUNING): number {
  const negativity = input.valence < 0 ? Math.log(tuning.negativitySharingOdds) : 0;
  return (
    input.confidence +
    negativity +
    0.3 * input.closenessToListener -
    0.3 * input.listenerClosenessToTarget * (input.valence < 0 ? 1 : 0) +
    0.2 * (input.interestingIfTrue ?? 0) -
    (input.listenerAlreadyKnows ? 0.6 : 0)
  );
}

export const tellThreshold = 0.7;

/** One character tells another. Returns how the listener's belief moved. */
export function tell(
  speaker: BeliefLedger,
  listener: BeliefLedger,
  claim: Claim,
  claims: ReadonlyMap<ClaimId, Claim>,
  rel: Relationships,
  rng: Rng,
  tick: number,
  tuning: Tuning = DEFAULT_TUNING,
): HearResult {
  const passesAttribution = rng() < tuning.attributionPassRate;
  const origin = passesAttribution ? speaker.rememberedOrigin(claim.id) : undefined;
  return listener.hear(claim, claims, {
    source: speaker.owner as CharacterId,
    strength: speaker.confidence(claim.id),
    trust: rel.trust(listener.owner, speaker.owner),
    tick,
    attributedOrigin: origin,
    affinityToTarget: rel.affinity(listener.owner, claim.about),
  });
}
