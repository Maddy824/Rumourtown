/**
 * Side-taking for bystanders of an accusation, on top of rumormind's sideScore and chooseSide
 * (loyalty difference + perceived wrongness + expected reciprocity - conflict cost; neutral below 0.4).
 * This file only turns game state into those inputs and a reason.
 */
import { chooseSide, sideScore, type Side } from 'rumormind';
import type { GameClaim } from '../types.js';
import { nameOf, type Agent, type Ctx } from './context.js';
import { SIDE_THRESHOLD } from './params.js';
import { independentSources } from './provenance.js';
import { percent } from './text.js';

export interface SideDecision {
  side: Side;
  score: number;
  why: string;
}

export function takeSide(ctx: Ctx, bystander: Agent, accuser: Agent, accused: Agent, claim: GameClaim, isPublic: boolean): SideDecision {
  const b = bystander.d.id;
  const loyaltyToAccuser = ctx.rel.closeness(b, accuser.d.id);
  const loyaltyToAccused = ctx.rel.closeness(b, accused.d.id);
  const confidence = bystander.ledger.confidence(claim.id);
  // Knowing versus acting: one source is not enough to be sure in public (complex contagion).
  const corroboration = independentSources(bystander, claim.id) >= 2 ? 1 : 0.7;
  const perceivedWrongness = (confidence - 0.5) * 2 * (claim.severity / 3) * corroboration;
  const expectedReciprocity = 0.2 * (loyaltyToAccuser - loyaltyToAccused);
  const conflictCost = 0.05 + 0.15 * bystander.d.traits.agreeableness + (isPublic ? 0.05 : 0);
  const score = sideScore({ loyaltyToAccuser, loyaltyToAccused, perceivedWrongness, expectedReciprocity, conflictCost });
  const side = chooseSide(score, SIDE_THRESHOLD);
  const accuserName = nameOf(ctx, accuser.d.id, true);
  const accusedName = nameOf(ctx, accused.d.id, true);
  let why: string;
  if (side === 'accuser') {
    why = `${percent(confidence)} sure ${claim.text}; ${loyaltyToAccuser > loyaltyToAccused ? `closer to ${accuserName}` : 'it sounds true'}`;
  } else if (side === 'accused') {
    why = `${loyaltyToAccused > loyaltyToAccuser ? `${accusedName} is a friend` : `only ${percent(confidence)} sure ${claim.text}`}; will not see ${accusedName} talked down`;
  } else {
    why = `not sure enough to take a side (${percent(confidence)}); ${bystander.d.traits.agreeableness >= 0.5 ? 'would rather keep the peace' : 'no stake in it'}`;
  }
  return { side, score, why: why.charAt(0).toUpperCase() + why.slice(1) };
}
