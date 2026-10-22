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

it('rejects sleeping, disconnected and private-home listeners while allowing public places and a person within reach', async () => {
  const { canReachListener } = await import('./awake.js');
  const { createWorld } = await import('../sim/world/index.js');
  const snap = createFakeSimulation(731).snapshot();
  const home = villageMap.places.find(place => place.kind === 'home')!;
  snap.player.pos = { ...villageMap.places.find(place => place.id === 'square')!.door };
  const person = snap.villagers[0]!;
  snap.villagers = [{ ...person, pos: { x: home.rect.x + home.rect.w / 2, y: home.rect.y + 1 }, activity: 'idle' }];
  const world = createWorld(villageMap);
  expect(canReachListener(snap, world, person.id)).toBe(false);
  snap.villagers[0]!.pos = { x: snap.player.pos.x + .5, y: snap.player.pos.y + .5 };
  expect(canReachListener(snap, world, person.id)).toBe(true);
  snap.villagers[0]!.activity = 'sleep';
  expect(canReachListener(snap, world, person.id)).toBe(false);
  snap.villagers[0]!.activity = 'idle';
  snap.villagers[0]!.pos = { x: snap.player.pos.x + 3, y: snap.player.pos.y + 3 };
  expect(canReachListener(snap, { ...world, findPath: () => null }, person.id)).toBe(false);
  const inn = villageMap.places.find(place => place.id === 'inn')!;
  snap.villagers[0]!.pos = { ...inn.spots[0]! };
  expect(canReachListener(snap, world, person.id)).toBe(true);
});
