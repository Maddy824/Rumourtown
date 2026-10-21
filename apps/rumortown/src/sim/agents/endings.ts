/**
 * The day's ending, judged over the claims the stranger introduced. The claim that travelled
 * furthest decides; the ladder is died, exposed, reconciled, split, grudge, quiet.
 */
import type { Ending } from '../types.js';
import { nameOf, type Agent, type Ctx, type StrangerClaim } from './context.js';
import { reflexive } from './text.js';

export interface Verdict {
  ending: Ending;
  summary: string;
}

const QUIET_DAY: Verdict = { ending: 'quiet', summary: 'A quiet day: the stranger kept their own counsel, and the village talked of bread and weather.' };

function mainClaim(ctx: Ctx): StrangerClaim | undefined {
  let best: StrangerClaim | undefined;
  for (const s of ctx.strangerClaims) if (!best || s.heardBy.size > best.heardBy.size) best = s;
  return best;
}

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

export function judgeDay(ctx: Ctx): Verdict {
  const sc = mainClaim(ctx);
  const claim = sc ? ctx.claims.get(sc.claimId) : undefined;
  if (!sc || !claim) return QUIET_DAY;
  const subject = nameOf(ctx, claim.about, true);
  const first = ctx.castMap.get(sc.firstListener);
  const firstName = nameOf(ctx, sc.firstListener, true);
  const main = mainBeliever(ctx, sc, claim.about);
  const accusations = ctx.accusations.filter((r) => r.claimId === claim.id);
  const apology = accusations.find((r) => r.apologized);

  if (sc.heardBy.size < 2) {
    return { ending: 'died', summary: `${firstName} heard the stranger's story about ${subject} and kept it to ${reflexive(first)}; it went no further.` };
  }
  if (main && sc.correctedFirsthand.has(main.d.id) && sc.trustLost) {
    return { ending: 'exposed', summary: `The story that ${claim.text} fell apart in front of ${main.d.name}; the stranger's word is worth less in the village now.` };
  }
  if (apology) {
    return {
      ending: 'reconciled',
      summary: `${nameOf(ctx, apology.accuser, true)} accused ${nameOf(ctx, apology.accused, true)} over the story that ${claim.text}, then said sorry; they made up before dark.`,
    };
  }
  if (sc.backedAccuser.size >= 3 && sc.backedAccused.size >= 3) {
    const r = accusations[0];
    const sides = r ? `${sc.backedAccuser.size} stood with ${nameOf(ctx, r.accuser, true)}, ${sc.backedAccused.size} with ${nameOf(ctx, r.accused, true)}` : 'two camps dug in';
    return { ending: 'split', summary: `The village split over whether ${claim.text}: ${sides}.` };
  }
  if (main && main.ledger.confidence(claim.id) > 0.6) {
    return { ending: 'grudge', summary: `${main.d.name} still believes ${claim.text}; nobody proved otherwise, and ${main.d.pronouns.subject} holds it against ${subject}.` };
  }
  return { ending: 'quiet', summary: `The story that ${claim.text} reached ${sc.heardBy.size} people and faded; nothing came of it.` };
}
