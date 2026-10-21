/** The dossier schedule, walking to places and to people. */
import type { Activity, Place, PlaceId, ScheduleEntry, Vec2 } from '../types.js';
import { tileOf, visibleActivity, type Agent, type Ctx, type Goal } from './context.js';
import { TALK_RANGE } from './params.js';
import { minuteOfDay } from './text.js';

const FALLBACK_ENTRY: ScheduleEntry = { start: 0, place: '', activity: 'idle' };

export function currentEntryIndex(schedule: readonly ScheduleEntry[], minute: number): number {
  let idx = 0;
  for (let i = 0; i < schedule.length; i++) {
    if (schedule[i]!.start <= minute) idx = i;
    else break;
  }
  return idx;
}

export const entryOf = (agent: Agent): ScheduleEntry => agent.d.schedule[agent.entryIndex] ?? agent.d.schedule[0] ?? FALLBACK_ENTRY;

export const placeOf = (ctx: Ctx, id: PlaceId): Place | undefined => ctx.world.map.places.find((p) => p.id === id);

export function insidePlace(place: Place, pos: Vec2): boolean {
  const { x, y, w, h } = place.rect;
  return pos.x >= x && pos.x < x + w && pos.y >= y && pos.y < y + h;
}

export function atPlace(ctx: Ctx, agent: Agent, placeId: PlaceId): boolean {
  const here = ctx.world.placeAt(agent.mover.pos);
  if (here?.id === placeId) return true;
  const place = placeOf(ctx, placeId);
  return place !== undefined && insidePlace(place, agent.mover.pos);
}

/** A path from a world position: the tile under it, or a walkable neighbour when separation pushed it onto a wall. */
export function pathFrom(ctx: Ctx, from: Vec2, to: Vec2): Vec2[] | null {
  const start = tileOf(from);
  const goal = tileOf(to);
  const direct = ctx.world.findPath(start, goal);
  if (direct) return direct;
  const neighbours: Vec2[] = [
    { x: start.x, y: start.y - 1 },
    { x: start.x - 1, y: start.y },
    { x: start.x + 1, y: start.y },
    { x: start.x, y: start.y + 1 },
  ];
  for (const n of neighbours) {
    if (!ctx.world.isWalkable(n.x, n.y)) continue;
    const p = ctx.world.findPath(n, goal);
    if (p) return [n, ...p];
  }
  return null;
}

function occupiedFor(ctx: Ctx, agent: Agent, placeId: PlaceId): Vec2[] {
  const out: Vec2[] = [];
  for (const o of ctx.agents) {
    if (o === agent) continue;
    out.push(o.mover.pos);
    if (o.spot && o.goal.place === placeId) out.push({ x: o.spot.x + 0.5, y: o.spot.y + 0.5 });
  }
  return out;
}

/** Walk to a standing spot in a place. False when the place is unknown or unreachable. */
export function goToPlace(ctx: Ctx, agent: Agent, placeId: PlaceId, activity: Activity, goal: Goal): boolean {
  const place = placeOf(ctx, placeId);
  if (!place) return false;
  if (agent.spot && agent.goal.place === placeId && insidePlace(place, agent.mover.pos)) {
    agent.goal = { ...goal, place: placeId };
    agent.activity = visibleActivity(activity);
    return true;
  }
  let spot: Vec2;
  try {
    spot = ctx.world.spotFor(placeId, occupiedFor(ctx, agent, placeId), ctx.rng);
  } catch {
    spot = place.door;
  }
  let path = pathFrom(ctx, agent.mover.pos, spot);
  if (!path) {
    spot = place.door;
    path = pathFrom(ctx, agent.mover.pos, spot);
  }
  if (!path) return false;
  agent.spot = spot;
  agent.mover.setPath(path);
  agent.goal = { ...goal, place: placeId };
  // Nobody sleeps on the way home; the arrival handler sets the entry's activity.
  agent.activity = activity === 'sleep' ? 'rest' : visibleActivity(activity);
  return true;
}

/** On arriving at a routine place, take up the entry's activity (this is where sleep begins). */
export function onArrived(agent: Agent): void {
  if (agent.goal.kind === 'schedule') agent.activity = visibleActivity(entryOf(agent).activity);
}

/** Walk toward another villager's current tile. False when unreachable. */
export function walkToward(ctx: Ctx, agent: Agent, target: Agent): boolean {
  if (ctx.world.distance(agent.mover.pos, target.mover.pos) <= TALK_RANGE) {
    agent.mover.stop();
    agent.goal.pathedTo = { ...target.mover.pos };
    return true;
  }
  const goal = tileOf(target.mover.pos);
  let path = pathFrom(ctx, agent.mover.pos, goal);
  if (!path) {
    const around: Vec2[] = [
      { x: goal.x, y: goal.y - 1 },
      { x: goal.x - 1, y: goal.y },
      { x: goal.x + 1, y: goal.y },
      { x: goal.x, y: goal.y + 1 },
    ];
    for (const a of around) {
      if (!ctx.world.isWalkable(a.x, a.y)) continue;
      path = pathFrom(ctx, agent.mover.pos, a);
      if (path) break;
    }
  }
  if (!path) return false;
  agent.spot = null;
  agent.mover.setPath(path);
  agent.goal.pathedTo = { ...target.mover.pos };
  return true;
}

/** Back to the routine entry's place. */
export function followSchedule(ctx: Ctx, agent: Agent): boolean {
  const entry = entryOf(agent);
  return goToPlace(ctx, agent, entry.place, entry.activity, { kind: 'schedule', since: ctx.tick });
}

/** At each entry's start, villagers on their routine head for the new place. */
export function updateSchedule(ctx: Ctx, agent: Agent): void {
  const idx = currentEntryIndex(agent.d.schedule, minuteOfDay(ctx.tick));
  if (idx === agent.entryIndex) return;
  agent.entryIndex = idx;
  if (agent.conversation !== null) return;
  if (agent.goal.kind === 'schedule' || agent.goal.kind === 'need' || agent.goal.kind === 'avoid') followSchedule(ctx, agent);
}

/** After a conversation, pick the walk back up. */
export function resumeGoal(ctx: Ctx, agent: Agent): void {
  const g = agent.goal;
  if (g.target) {
    const t = ctx.byId.get(g.target);
    if (t) {
      walkToward(ctx, agent, t);
      return;
    }
  }
  if (g.place) {
    const place = placeOf(ctx, g.place);
    if (place && agent.spot && !insidePlace(place, agent.mover.pos)) {
      const path = pathFrom(ctx, agent.mover.pos, agent.spot);
      if (path) agent.mover.setPath(path);
    }
    return;
  }
  followSchedule(ctx, agent);
}
