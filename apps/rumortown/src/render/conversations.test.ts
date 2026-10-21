import { expect, it } from 'vitest';
import { cast } from '../content/cast/index.js';
import type { VillagerView, WorldSnapshot } from '../sim/types.js';
import { conversationGroups } from './conversations.js';
const person = (id: string, x: number, to?: string): VillagerView => ({ id, name: id, pos: { x, y: 0 }, facing: 's', moving: false, activity: 'talk', tier: 'regular', look: cast[0]!.look, mood: 0, bubble: to ? { text: 'Hello', untilTick: 100, to } : undefined });
it('joins conversations once, ranks by their nearest participant and excludes idle villagers', () => {
  const villagers = [person('ada', 10, 'ben'), person('ben', 11), person('mira', 2), person('tom', 3), person('rosa', 20), person('jonah', 30), { ...person('idle', 0), activity: 'idle' as const }];
  const snap: WorldSnapshot = { tick: 5, dayIndex: 0, minuteOfDay: 425, villagers, player: { pos: { x: 0, y: 0 }, facing: 's', moving: false }, threads: [] };
  const groups = conversationGroups(snap, snap.player.pos);
  expect(groups.map(g => [...g.ids])).toEqual([['mira', 'tom'], ['ada', 'ben'], ['rosa'], ['jonah']]);
  expect(groups.map(g => g.distance)).toEqual([2, 10, 20, 30]);
});
