/** Four needs in 0..1 (1 = satisfied). They decay per tick and refill at places that advertise them. */
import type { Activity, Need, Place, Vec2 } from '../types.js';
import type { Agent, Ctx } from './context.js';
import { NEED_AT_DAWN, NEED_DECAY, NEED_RECOVERY } from './params.js';

export const NEEDS: readonly Need[] = ['hunger', 'rest', 'social', 'duty'];

export function freshNeeds(): Record<Need, number> {
  return { ...NEED_AT_DAWN };
}

export function resetNeeds(agent: Agent): void {
  for (const n of NEEDS) agent.needs[n] = NEED_AT_DAWN[n];
}

export function tickNeeds(ctx: Ctx, agent: Agent): void {
  if (agent.d.schedule[agent.entryIndex]?.activity === 'sleep' && agent.activity !== 'sleep') agent.needs.rest = 0;
  for (const n of NEEDS) agent.needs[n] = Math.max(0, agent.needs[n] - NEED_DECAY[n]);
  if (!agent.mover.moving) {
    const here = ctx.world.placeAt(agent.mover.pos);
    if (here) for (const n of here.satisfies) agent.needs[n] = Math.min(1, agent.needs[n] + NEED_RECOVERY);
  }
  if (agent.conversation !== null) agent.needs.social = Math.min(1, agent.needs.social + NEED_RECOVERY);
  if (agent.activity === 'sleep') agent.needs.rest = Math.min(1, agent.needs.rest + NEED_RECOVERY);
}

export const deficit = (agent: Agent, need: Need): number => 1 - agent.needs[need];

export function urgentNeed(agent: Agent): { need: Need; deficit: number } {
  let best: Need = 'hunger';
  let bestDeficit = -1;
  for (const n of NEEDS) {
    const d = deficit(agent, n);
    if (d > bestDeficit) {
      best = n;
      bestDeficit = d;
    }
  }
  return { need: best, deficit: bestDeficit };
}

/** The nearest place (by door) that satisfies a need; ties go to map order. */
export function nearestPlaceFor(ctx: Ctx, need: Need, from: Vec2): Place | null {
  let best: Place | null = null;
  let bestDist = Infinity;
  for (const p of ctx.world.map.places) {
    if (!p.satisfies.includes(need)) continue;
    const d = ctx.world.distance(from, { x: p.door.x + 0.5, y: p.door.y + 0.5 });
    if (d < bestDist) {
      best = p;
      bestDist = d;
    }
  }
  return best;
}

export function activityForNeed(need: Need): Activity {
  switch (need) {
    case 'hunger':
      return 'eat';
    case 'rest':
      return 'rest';
    case 'duty':
      return 'work';
    default:
      return 'idle';
  }
}
