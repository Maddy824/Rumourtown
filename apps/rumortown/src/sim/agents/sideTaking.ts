/**
 * Public backing needs belief above 0.75 and two remembered origins. Otherwise the library's
 * loyalty score chooses between defending the accused and staying out, with a plain-word reason.
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

export function takeSide(ctx: Ctx, bystander: Agent, accuser: Agent, accused: Agent, claim: GameClaim, _isPublic: boolean): SideDecision {
  const b = bystander.d.id;
  const loyaltyToAccuser = ctx.rel.closeness(b, accuser.d.id);
  const loyaltyToAccused = ctx.rel.closeness(b, accused.d.id);
  const confidence = bystander.ledger.confidence(claim.id);
  const evidenceGate = confidence > 0.75 && independentSources(bystander, claim.id) >= 2;
  // Evidence alone gates public backing; loyalty only chooses defend versus doubt otherwise.
  const score = sideScore({
    loyaltyToAccuser, loyaltyToAccused, perceivedWrongness: 0, expectedReciprocity: 0, conflictCost: 0,
  });
  const side: Side = evidenceGate ? 'accuser' : chooseSide(Math.min(0, score), SIDE_THRESHOLD);
  const accuserName = nameOf(ctx, accuser.d.id, true);
  const accusedName = nameOf(ctx, accused.d.id, true);
  let why: string;
  if (side === 'accuser') {
    why = `${percent(confidence)} sure ${claim.text}; ${loyaltyToAccuser > loyaltyToAccused ? `closer to ${accuserName}` : 'it sounds true'}`;
  } else if (side === 'accused') {
    why = `${loyaltyToAccused > loyaltyToAccuser ? `${accusedName} is a friend` : `only ${percent(confidence)} sure ${claim.text}`}; will not see ${accusedName} talked down`;
  } else {
    why = `not sure enough to choose between ${accuserName} and ${accusedName} (${percent(confidence)}); ${bystander.d.traits.agreeableness >= 0.5 ? 'would rather keep the peace' : 'no stake in it'}`;
  }
  return { side, score, why: why.charAt(0).toUpperCase() + why.slice(1) };
}
