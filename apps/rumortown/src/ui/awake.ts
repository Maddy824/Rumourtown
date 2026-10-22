/** Read-only night guidance, ordered by distance with stable ties. */
import type { Place, Vec2, VillageMap, WorldApi, WorldSnapshot } from '../sim/types.js';
import { CORE_PEOPLE } from './name-labels.js';

export const isNight = (snap: WorldSnapshot): boolean => snap.minuteOfDay >= 1290 || snap.minuteOfDay < 360;
export function awakePeople(snap: WorldSnapshot) {
  const p = snap.player.pos;
  return snap.villagers.filter(v => v.activity !== 'sleep').sort((a, b) =>
    Math.hypot(a.pos.x - p.x, a.pos.y - p.y) - Math.hypot(b.pos.x - p.x, b.pos.y - p.y) || a.id.localeCompare(b.id));
}
/** Mirror player travel limits without issuing a move or entering a private home. */
export function canReachListener(snap: WorldSnapshot, world: WorldApi, id: string): boolean {
  const person = snap.villagers.find(v => v.id === id);
  if (!person || person.activity === 'sleep') return false;
  if (world.distance(snap.player.pos, person.pos) <= 2) return true;
  const inside = (p: Place, pos: Vec2) => pos.x >= p.rect.x && pos.x < p.rect.x + p.rect.w && pos.y >= p.rect.y && pos.y < p.rect.y + p.rect.h;
  const homes = world.map.places.filter(p => p.kind === 'home');
  const home = homes.find(p => inside(p, person.pos));
  const origin = homes.find(p => inside(p, snap.player.pos));
  const goal = home?.door ?? person.pos;
  if (home && world.distance({ x: goal.x + .5, y: goal.y + .5 }, person.pos) > 2) return false;
  const path = world.findPath(snap.player.pos, goal);
  return path !== null && !path.some(tile => homes.some(p => p !== origin && inside(p, tile) &&
    !(tile.x === p.door.x && tile.y === p.door.y)));
}
export function meetingPerson(snap: WorldSnapshot, map: VillageMap) {
  const awake = awakePeople(snap);
  const core = awake.find(v => (CORE_PEOPLE as readonly string[]).includes(v.id));
  const inn = map.places.find(p => p.id === 'inn')?.rect;
  return core ?? awake.find(v => inn && v.pos.x >= inn.x && v.pos.x < inn.x + inn.w && v.pos.y >= inn.y && v.pos.y < inn.y + inn.h) ?? awake[0];
}
