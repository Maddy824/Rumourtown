/**
 * Evaluate each introduced claim, then choose exposed, split, reconciled, grudge, quiet, died.
 */
import type { Ending } from '../types.js';
import { nameOf, type Agent, type Ctx, type StrangerClaim } from './context.js';
import { reflexive } from './text.js';

export interface Verdict {
  ending: Ending;
  summary: string;
}

const QUIET_DAY: Verdict = { ending: 'quiet', summary: 'A quiet day: the stranger kept their own counsel, and the village talked of bread and weather.' };

/** The villager who believed it most at any point, leaving out its subject. */
function mainBeliever(ctx: Ctx, sc: StrangerClaim, about: string): Agent | null {
  let main: Agent | null = null;
  let peak = -Infinity;
  for (const a of ctx.agents) {
    if (!sc.heardBy.has(a.d.id) || a.d.id === about) continue;
    const b = a.ledger.beliefs.get(sc.claimId);
    const p = b ? b.peakLogOdds : -Infinity;
    if (p > peak) {
      main = a;
      peak = p;
    }
  }
  return main;
}

const PRECEDENCE: readonly Ending[] = ['exposed', 'split', 'reconciled', 'grudge', 'quiet', 'died'];

export function judgeDay(ctx: Ctx): Verdict {
  let best: Verdict | undefined;
  for (const sc of ctx.strangerClaims) {
    const verdict = judgeClaim(ctx, sc);
    if (!best || PRECEDENCE.indexOf(verdict.ending) < PRECEDENCE.indexOf(best.ending)) best = verdict;
  }
  return best ?? QUIET_DAY;
}

function judgeClaim(ctx: Ctx, sc: StrangerClaim): Verdict {
  const claim = ctx.claims.get(sc.claimId);
  if (!claim) return QUIET_DAY;
  const subject = nameOf(ctx, claim.about, true);
  const first = ctx.castMap.get(sc.firstListener);
  const firstName = nameOf(ctx, sc.firstListener, true);
  const main = mainBeliever(ctx, sc, claim.about);
  const accusations = ctx.accusations.filter((r) => r.claimId === claim.id);
  const apology = accusations.find((r) => r.apologized);

  if (main && sc.correctedFirsthand.has(main.d.id) && sc.trustLost) {
    return { ending: 'exposed', summary: `The story that ${claim.text} fell apart in front of ${main.d.name}; the stranger's word is worth less in the village now.` };
  }
  if (sc.backedAccuser.size >= 3 && sc.backedAccused.size >= 3) {
    const r = accusations[0];
    const sides = r ? `${sc.backedAccuser.size} stood with ${nameOf(ctx, r.accuser, true)}, ${sc.backedAccused.size} with ${nameOf(ctx, r.accused, true)}` : 'two camps dug in';
    return { ending: 'split', summary: `The village split over whether ${claim.text}: ${sides}.` };
  }
  if (apology) {
    return {
      ending: 'reconciled',
      summary: `${nameOf(ctx, apology.accuser, true)} accused ${nameOf(ctx, apology.accused, true)} over the story that ${claim.text}, then said sorry; ${apology.forgiven ? 'they made up before dark' : 'forgiveness has yet to follow'}.`,
    };
  }
  if (sc.heardBy.size < 2) {
    return { ending: 'died', summary: `${firstName} heard the stranger's story about ${subject} and kept it to ${reflexive(first)}; it went no further.` };
  }
  if (main && main.ledger.confidence(claim.id) > 0.6) {
    return { ending: 'grudge', summary: `${main.d.name} still believes ${claim.text}; nobody proved otherwise, and ${main.d.pronouns.subject} holds it against ${subject}.` };
  }
  return { ending: 'quiet', summary: `The story that ${claim.text} reached ${sc.heardBy.size} people and faded; nothing came of it.` };
}
