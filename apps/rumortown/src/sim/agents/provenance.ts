/** Questions about a villager's remembered trail for a claim. */
import { sigmoid, type ClaimId } from 'rumormind';
import type { GameClaim } from '../types.js';
import type { Agent, Ctx } from './context.js';
import { APOLOGY_BELIEF } from './params.js';
import { STRANGER_ID } from './text.js';

/**
 * Has the belief behind an accusation given way? Below the apology threshold, or down to half its
 * peak log-odds: corrections leave a residual (20% of the peak), so a strong belief never falls
 * below about 0.55, and the threshold alone would never let anyone say sorry.
 */
export function beliefCollapsed(agent: Agent, claimId: ClaimId): boolean {
  const b = agent.ledger.beliefs.get(claimId);
  if (!b) return true;
  return sigmoid(b.logOdds) < APOLOGY_BELIEF || (b.peakLogOdds > 0 && b.logOdds <= 0.5 * b.peakLogOdds);
}

export const remembersStranger = (agent: Agent, claimId: ClaimId): boolean =>
  agent.ledger.beliefs.get(claimId)?.provenance.some((p) => p.origin === STRANGER_ID) ?? false;

export const hasFirsthand = (agent: Agent, claimId: ClaimId): boolean =>
  agent.ledger.beliefs.get(claimId)?.provenance.some((p) => p.kind === 'saw') ?? false;

/** Distinct remembered origins behind the positive evidence for a claim. */
export function independentSources(agent: Agent, claimId: ClaimId): number {
  const b = agent.ledger.beliefs.get(claimId);
  if (!b) return 0;
  const origins = new Set<string>();
  for (const p of b.provenance) if (p.kind !== 'corrected') origins.add(p.origin);
  return origins.size;
}

/**
 * The innocent explanation of a harmful claim, if the agent believes it (confidence at least 0.6).
 * `alternativeOf` sits on the innocent claim and points at the harmful one; claims the harmful
 * one contradicts are the fallback.
 */
export function knownAlternative(ctx: Ctx, agent: Agent, harmful: GameClaim): GameClaim | undefined {
  const candidates: GameClaim[] = [];
  for (const c of ctx.claimList) if (c.alternativeOf === harmful.id) candidates.push(c);
  for (const id of harmful.contradicts ?? []) {
    const c = ctx.claims.get(id);
    if (c && c.valence >= 0 && !candidates.includes(c)) candidates.push(c);
  }
  return candidates.find((c) => agent.ledger.confidence(c.id) >= 0.6);
}
