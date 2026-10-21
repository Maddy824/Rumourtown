/**
 * Ground truth. While a secret act is in its window and its owner is at its place, every other
 * villager within four tiles with line of sight perceives it: they see the claims the act confirms
 * and, through contradictions, correct the harmful ones. A whisper is witnessed the same way.
 */
import type { GameClaim, Secret, VillagerId } from '../types.js';
import { matchesAuthoredFact } from '../registered-claim.js';
import { dist, emit, isAsleep, nameOf, type Agent, type Ctx } from './context.js';
import { correctBelief, seeClaim } from './hearing.js';
import { IMPORTANCE, WITNESS_RANGE } from './params.js';
import { remember } from './reflection.js';
import { atPlace } from './schedule.js';
import { dayOf, minuteOfDay } from './text.js';

export function activeSecret(agent: Agent, minute: number): Secret | undefined {
  return agent.d.secrets.find((s) => minute >= s.window[0] && minute < s.window[1]);
}

/** Clarity falls with distance: 1 up to one tile, 0.5 at the edge of the witness range. */
export const clarityAt = (d: number): number => 1 - (0.5 * Math.max(0, d - 1)) / (WITNESS_RANGE - 1);

export function tickWitnessing(ctx: Ctx): void {
  const minute = minuteOfDay(ctx.tick);
  const day = dayOf(ctx.tick);
  for (const actor of ctx.agents) {
    const secret = activeSecret(actor, minute);
    if (!secret || isAsleep(actor) || !atPlace(ctx, actor, secret.place)) continue;
    // The act is private business; the view says "errand" so the UI does not give it away.
    if (actor.conversation === null) actor.activity = 'errand';
    const confirmed: GameClaim[] = [];
    const contradicted: GameClaim[] = [];
    for (const c of ctx.claimList) {
      if (c.about !== actor.d.id) continue;
      // A shared story's category cannot prove that its particular event happened.
      if (c.id.startsWith('written_')) continue;
      if (c.id.startsWith('typed_') && !ctx.claimList.some(fact =>
        !fact.id.startsWith('typed_') && !fact.id.startsWith('written_') && matchesAuthoredFact(c, fact))) continue;
      if (secret.confirms.includes(c.kind)) confirmed.push(c);
      else if (secret.contradicts.includes(c.kind)) contradicted.push(c);
    }
    const key = `${secret.id}|${day}`;
    for (const w of ctx.agents) {
      if (w === actor || isAsleep(w) || w.witnessed.has(key)) continue;
      if (secret.nightOnly && !w.d.schedule[w.entryIndex]?.night) continue;
      const d = dist(ctx, w, actor);
      if (d > WITNESS_RANGE || !ctx.world.lineOfSight(w.mover.pos, actor.mover.pos)) continue;
      w.witnessed.add(key);
      perceive(ctx, w, actor, secret, confirmed, contradicted, clarityAt(d));
    }
  }
}

function perceive(ctx: Ctx, w: Agent, actor: Agent, secret: Secret, confirmed: GameClaim[], contradicted: GameClaim[], clarity: number): void {
  emit(ctx, { kind: 'witness', tick: ctx.tick, villager: w.d.id, what: secret.description, subject: actor.d.id, secretId: secret.id });
  const correctedIds = new Set<string>();
  let correctedHarm = false;
  for (const c of confirmed) {
    const r = seeClaim(ctx, w, c, clarity);
    for (const id of r.corrected) {
      correctedIds.add(id);
      if ((ctx.claims.get(id)?.valence ?? 0) < 0) correctedHarm = true;
    }
  }
  for (const c of contradicted) {
    if (correctedIds.has(c.id) || w.ledger.confidence(c.id) <= 0.5) continue;
    if (correctBelief(ctx, w, c.id, clarity, confirmed.length > 0, 'self', true) !== null) correctedHarm = true;
  }
  const actorName = nameOf(ctx, actor.d.id, true);
  remember(
    ctx,
    w,
    IMPORTANCE.witnessed,
    `saw ${actorName}: ${secret.description}`,
    correctedHarm ? `What people say about ${actorName} does not match what ${w.d.name} saw` : `${actorName} was seen: ${secret.description}`,
    actor.d.id,
  );
}

/** Villagers who can see a whisper to `listener`. */
export function whisperWitnesses(ctx: Ctx, listener: Agent): VillagerId[] {
  const out: VillagerId[] = [];
  for (const w of ctx.agents) {
    if (w === listener || isAsleep(w)) continue;
    if (dist(ctx, w, listener) > WITNESS_RANGE) continue;
    if (!ctx.world.lineOfSight(w.mover.pos, listener.mover.pos)) continue;
    out.push(w.d.id);
  }
  return out;
}
