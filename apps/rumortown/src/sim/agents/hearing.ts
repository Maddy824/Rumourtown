/**
 * How a spoken claim reaches a listener's ledger, and the bookkeeping around it: belief events,
 * threads, the stranger's claim records, and exposure when the evidence was first-hand.
 */
import { tell, type ClaimId, type HearResult } from 'rumormind';
import type { GameClaim, VillagerId } from '../types.js';
import { emit, strangerClaimOf, type Agent, type Ctx } from './context.js';
import { exposeStranger } from './exposure.js';
import { remembersStranger } from './provenance.js';
import { STRANGER_ID } from './text.js';

export type Source = VillagerId | 'stranger' | 'self';

function contradictedBefore(ctx: Ctx, listener: Agent, claim: GameClaim): Map<ClaimId, number> {
  const before = new Map<ClaimId, number>();
  for (const id of claim.contradicts ?? []) if (ctx.claims.has(id)) before.set(id, listener.ledger.confidence(id));
  return before;
}

/**
 * Record what a hearing (or seeing) did: belief events for the claim and for every claim it
 * corrected, a thread for the transmission, and exposure when the evidence counts as first-hand.
 */
function afterHear(ctx: Ctx, listener: Agent, claim: GameClaim, source: Source, result: HearResult, before: Map<ClaimId, number>, evidence: boolean): void {
  const id = listener.d.id;
  emit(ctx, { kind: 'belief', tick: ctx.tick, villager: id, claimId: claim.id, before: result.before, after: result.after, source, independent: result.independent });
  if (source !== 'self') ctx.threads.push({ from: source, to: id, claimId: claim.id, tick: ctx.tick });
  strangerClaimOf(ctx, claim.id)?.heardBy.add(id);
  for (const correctedId of result.corrected) {
    const corrected = ctx.claims.get(correctedId);
    if (!corrected) continue;
    const prior = before.get(correctedId) ?? listener.ledger.confidence(correctedId);
    emit(ctx, { kind: 'belief', tick: ctx.tick, villager: id, claimId: correctedId, before: prior, after: listener.ledger.confidence(correctedId), source, independent: false });
    if (evidence && remembersStranger(listener, correctedId)) exposeStranger(ctx, corrected, listener);
  }
}

/**
 * One villager hears a claim another villager spoke. Null when the listener is the claim's subject:
 * villagers know what they did and never take on hearsay about themselves.
 */
export function hearFrom(ctx: Ctx, speaker: Agent, listener: Agent, claim: GameClaim, evidence: boolean): HearResult | null {
  if (listener.d.id === claim.about) return null;
  const before = contradictedBefore(ctx, listener, claim);
  let result: HearResult;
  if (listener.whisperWitnessed.has(claim.id)) {
    // They saw the stranger whisper: whoever tells them, they attach the origin themselves.
    result = listener.ledger.hear(claim, ctx.claims, {
      source: speaker.d.id,
      strength: speaker.ledger.confidence(claim.id),
      trust: ctx.rel.trust(listener.d.id, speaker.d.id),
      tick: ctx.tick,
      attributedOrigin: STRANGER_ID,
      affinityToTarget: ctx.rel.affinity(listener.d.id, claim.about),
    });
  } else {
    result = tell(speaker.ledger, listener.ledger, claim, ctx.claims, ctx.rel, ctx.rng, ctx.tick, ctx.tuning);
  }
  afterHear(ctx, listener, claim, speaker.d.id, result, before, evidence);
  return result;
}

/** The stranger whispers. */
export function hearFromStranger(ctx: Ctx, listener: Agent, claim: GameClaim): HearResult | null {
  if (listener.d.id === claim.about) return null;
  const before = contradictedBefore(ctx, listener, claim);
  const result = listener.ledger.hear(claim, ctx.claims, {
    source: STRANGER_ID,
    strength: 1,
    trust: ctx.rel.trust(listener.d.id, STRANGER_ID),
    tick: ctx.tick,
    affinityToTarget: ctx.rel.affinity(listener.d.id, claim.about),
  });
  afterHear(ctx, listener, claim, STRANGER_ID, result, before, false);
  return result;
}

/** Seeing something first-hand. */
export function seeClaim(ctx: Ctx, witness: Agent, claim: GameClaim, clarity: number): HearResult {
  const before = contradictedBefore(ctx, witness, claim);
  const result = witness.ledger.see(claim, ctx.claims, ctx.tick, clarity);
  afterHear(ctx, witness, claim, 'self', result, before, true);
  return result;
}

/**
 * A correction with no claim behind it: a bare denial, or a witnessed act that contradicts a
 * claim without confirming an authored alternative. Mirrors the library's correction maths
 * (removal fraction x credibility, floored at the residual) because the ledger has no public
 * entry point for it. Returns the new confidence, or null when nothing moved.
 */
export function correctBelief(ctx: Ctx, listener: Agent, claimId: ClaimId, credibility: number, alternative: boolean, source: Source, evidence: boolean): number | null {
  const b = listener.ledger.beliefs.get(claimId);
  if (!b || b.logOdds <= 0) return null;
  const t = ctx.tuning;
  const removal = (alternative ? t.correctionRemoval : t.correctionRemovalBare) * Math.min(1, Math.max(0, credibility));
  const floor = t.residualFraction * Math.max(b.peakLogOdds, 0);
  const next = Math.max(b.logOdds * (1 - removal), floor);
  const delta = Math.min(0, next - b.logOdds);
  if (delta === 0) return null;
  const before = listener.ledger.confidence(claimId);
  b.logOdds += delta;
  b.provenance.push({ kind: 'corrected', source, origin: source, tick: ctx.tick, delta });
  const after = listener.ledger.confidence(claimId);
  emit(ctx, { kind: 'belief', tick: ctx.tick, villager: listener.d.id, claimId, before, after, source, independent: false });
  const claim = ctx.claims.get(claimId);
  if (evidence && claim && remembersStranger(listener, claimId)) exposeStranger(ctx, claim, listener);
  return after;
}
