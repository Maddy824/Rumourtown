/**
 * Repair, on top of rumormind's forgivenessScore and trustRepair. Forgiveness follows apology,
 * empathy, perceived intent, anger, relationship value and exploitation risk; trust comes back in
 * small steps, faster after a denial with evidence than after an apology.
 */
import { forgivenessScore, trustRepair } from 'rumormind';
import { nameOf, type AccusationRecord, type Agent, type Ctx } from './context.js';
import { FORGIVE_THRESHOLD, TRUST } from './params.js';
import { changeTrust } from './relations.js';
import { percent } from './text.js';

export interface ForgivenessDecision {
  forgive: boolean;
  score: number;
  why: string;
}

export function considerForgiveness(ctx: Ctx, accused: Agent, accuser: Agent, record: AccusationRecord | undefined): ForgivenessDecision {
  const me = accused.d.id;
  const them = accuser.d.id;
  const isRival = accused.d.rival === them || accuser.d.rival === me;
  const perceivedIntent = isRival ? 0.8 : record?.isPublic ? 0.4 : 0.2;
  const anger = Math.max(0, -accused.mood.value(ctx.tick));
  const relationshipValue = ctx.rel.closeness(me, them);
  const exploitationRisk = 1 - ctx.rel.trust(me, them);
  const score = forgivenessScore({ apology: 1, empathy: accused.d.traits.agreeableness, perceivedIntent, anger, relationshipValue, exploitationRisk });
  const forgive = score >= FORGIVE_THRESHOLD;
  const name = nameOf(ctx, them, true);
  const why = forgive
    ? `${name} said sorry; ${relationshipValue >= 0.6 ? 'an old friend' : anger < 0.2 ? 'the anger has passed' : 'willing to let it go'}`
    : `${name} said sorry, but ${isRival ? 'they have never been friends' : anger >= 0.3 ? 'the hurt is still fresh' : 'the trust is not there'}`;
  return { forgive, score, why: `${why} (${percent(score)})` };
}

/** The accuser's trust in the accused recovers a step, scaled by how the accused answered. */
export function repairTrust(ctx: Ctx, accuser: Agent, accused: Agent, response: 'apology' | 'denial' | 'denial-with-evidence', why: string): void {
  const step = TRUST.repairBase * trustRepair({ kind: 'integrity', response });
  changeTrust(ctx, accuser.d.id, accused.d.id, step, why);
}
