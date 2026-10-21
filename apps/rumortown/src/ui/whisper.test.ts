import { expect, it } from 'vitest';
import { cast } from '../content/cast/index.js';
import type { VillagerView, WorldSnapshot } from '../sim/types.js';
import { inReach, nearbyPeople } from './whisper.js';
const person = (id: string, x: number): VillagerView => ({ id, name: id, pos: { x, y: 0 }, facing: 's', moving: false, activity: 'idle', tier: 'regular', look: cast[0]!.look, mood: 0 });
it('orders people within six tiles by distance with a stable id tie break', () => {
  const villagers = [person('far', 6.01), person('zoe', 4), person('ada', -4), person('ben', 2), person('edge', 6)];
  const snap: WorldSnapshot = { tick: 0, dayIndex: 0, minuteOfDay: 420, villagers, player: { pos: { x: 0, y: 0 }, facing: 's', moving: false }, threads: [] };
  expect(nearbyPeople(snap).map(v => v.id)).toEqual(['ben', 'ada', 'zoe', 'edge']);
  expect(inReach(snap).map(v => v.id)).toEqual(['ben']);
  expect(snap.villagers).toBe(villagers); expect(villagers[0]!.id).toBe('far');
});
