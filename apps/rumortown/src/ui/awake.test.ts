import { expect, it } from 'vitest';
import { createFakeSimulation } from '../sim/fake.js';
import { villageMap } from '../content/map/index.js';
import { awakePeople, meetingPerson } from './awake.js';

it('chooses the nearest awake core villager and falls back to the inn regulars', () => {
  const snap = createFakeSimulation(731).snapshot();
  snap.player.pos = { x: 0, y: 0 };
  const people = snap.villagers.slice(0, 3);
  snap.villagers = people.map((v, i) => ({ ...v, id: ['mira', 'tom', 'kit'][i]!, pos: { x: i + 1, y: 0 }, activity: i === 0 ? 'sleep' : 'idle' }));
  expect(awakePeople(snap).map(v => v.id)).toEqual(['tom', 'kit']);
  expect(meetingPerson(snap, villageMap)?.id).toBe('tom');
  snap.villagers[1]!.activity = 'sleep';
  expect(meetingPerson(snap, villageMap)?.id).toBe('kit');
  snap.villagers[2]!.activity = 'sleep';
  expect(meetingPerson(snap, villageMap)).toBeUndefined();
});
