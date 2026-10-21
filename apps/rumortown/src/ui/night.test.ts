import { expect, it } from 'vitest';
import { createFakeSimulation } from '../sim/fake.js';
import { nightNow } from './night.js';
import { inReach } from './whisper.js';

it('announces a quiet night, lists awake residents in cast order and keeps recent events visible', () => {
  const snapshot = createFakeSimulation(731).snapshot();
  snapshot.tick = 1100; snapshot.minuteOfDay = 20;
  snapshot.villagers = snapshot.villagers.slice(0, 3);
  snapshot.villagers[0]!.activity = 'sleep';
  expect(nightNow(snapshot)).toEqual({ quiet: true, awake: snapshot.villagers.slice(1).map(v => v.name) });
  expect(nightNow(snapshot, { kind: 'action', tick: 1099, villager: 'dag', action: 'work', why: 'Night watch' }).quiet).toBe(false);
  expect(nightNow({ ...snapshot, minuteOfDay: 360 })).toEqual({ quiet: false, awake: [] });
});
it('excludes a sleeper beside the player from selectable whisper listeners', () => {
  const snapshot = createFakeSimulation(731).snapshot();
  snapshot.villagers = snapshot.villagers.slice(0, 2).map(v => ({ ...v, pos: snapshot.player.pos }));
  snapshot.villagers[0]!.activity = 'sleep';
  expect(inReach(snapshot).map(v => v.id)).toEqual([snapshot.villagers[1]!.id]);
});
