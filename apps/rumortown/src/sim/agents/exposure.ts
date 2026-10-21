/**
 * Exposure. When first-hand evidence contradicts a claim that someone remembers coming from the
 * stranger, everyone who remembers that origin trusts the stranger less, with a ceiling they never
 * get back above, and the audience of any public accusation built on the claim trusts the accuser less.
 */
import type { GameClaim } from '../types.js';
import { agentOf, emit, nameOf, strangerClaimOf, type Agent, type Ctx } from './context.js';
import { IMPORTANCE, MOOD, TRUST } from './params.js';
import { remembersStranger } from './provenance.js';
import { remember } from './reflection.js';
import { changeTrust, exposeTrust } from './relations.js';
import { dayOf, STRANGER_ID } from './text.js';

/** Once per claim per day. `witness` is the villager whose belief first-hand evidence just corrected. */
export function exposeStranger(ctx: Ctx, claim: GameClaim, witness: Agent): void {
  const sc = strangerClaimOf(ctx, claim.id);
  if (!sc) return;
  sc.correctedFirsthand.add(witness.d.id);
  const day = dayOf(ctx.tick);
  if (sc.exposedDay === day) return;
  sc.exposedDay = day;
  const why = `The story that ${claim.text} came from the stranger and did not hold up`;
  for (const a of ctx.agents) {
    if (!remembersStranger(a, claim.id)) continue;
    exposeTrust(ctx, a.d.id, STRANGER_ID, TRUST.strangerExposed, why);
    sc.trustLost = true;
    a.mood.add(MOOD.liedTo.label, MOOD.liedTo.delta, ctx.tick + MOOD.liedTo.ticks);
    emit(ctx, { kind: 'mood', tick: ctx.tick, villager: a.d.id, label: MOOD.liedTo.label, delta: MOOD.liedTo.delta, untilTick: ctx.tick + MOOD.liedTo.ticks });
    remember(ctx, a, IMPORTANCE.strangerExposed, `the stranger's story about ${nameOf(ctx, claim.about, true)} fell apart`, 'The stranger’s stories do not hold up');
  }
  for (const rec of ctx.accusations) {
    if (rec.claimId !== claim.id || !rec.isPublic || rec.accuserExposed) continue;
    rec.accuserExposed = true;
    const accusedName = nameOf(ctx, rec.accused, true);
    for (const id of rec.audience) {
      changeTrust(ctx, id, rec.accuser, TRUST.accuserExposed, `${nameOf(ctx, rec.accuser, true)} accused ${accusedName} of something that turned out to be false`);
    }
    const accuser = agentOf(ctx, rec.accuser);
    if (accuser) {
      accuser.mood.add(MOOD.caughtOut.label, MOOD.caughtOut.delta, ctx.tick + MOOD.caughtOut.ticks);
      emit(ctx, { kind: 'mood', tick: ctx.tick, villager: accuser.d.id, label: MOOD.caughtOut.label, delta: MOOD.caughtOut.delta, untilTick: ctx.tick + MOOD.caughtOut.ticks });
    }
  }
}
