/** Read-only night guidance, ordered by distance with stable ties. */
import type { VillageMap, WorldSnapshot } from '../sim/types.js';
import { CORE_PEOPLE } from './name-labels.js';

export const isNight = (snap: WorldSnapshot): boolean => snap.minuteOfDay >= 1290 || snap.minuteOfDay < 360;
export function awakePeople(snap: WorldSnapshot) {
  const p = snap.player.pos;
  return snap.villagers.filter(v => v.activity !== 'sleep').sort((a, b) =>
    Math.hypot(a.pos.x - p.x, a.pos.y - p.y) - Math.hypot(b.pos.x - p.x, b.pos.y - p.y) || a.id.localeCompare(b.id));
}
export function meetingPerson(snap: WorldSnapshot, map: VillageMap) {
  const awake = awakePeople(snap);
  const core = awake.find(v => (CORE_PEOPLE as readonly string[]).includes(v.id));
  const inn = map.places.find(p => p.id === 'inn')?.rect;
  return core ?? awake.find(v => inn && v.pos.x >= inn.x && v.pos.x < inn.x + inn.w && v.pos.y >= inn.y && v.pos.y < inn.y + inn.h) ?? awake[0];
}
