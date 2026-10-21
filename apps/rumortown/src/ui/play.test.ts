import { expect, it } from 'vitest';
import { createFakeSimulation } from '../sim/fake.js';
import { conversationChoices } from './play.js';

it('never substitutes another speaker when a requested villager is asleep or out of reach', () => {
  const snap = createFakeSimulation(731).snapshot();
  snap.villagers = snap.villagers.map((v, index) => ({ ...v, pos: { ...snap.player.pos }, activity: index ? 'idle' : 'sleep' }));
  const asleep = snap.villagers[0]!;
  const choice = conversationChoices(snap, asleep.id);
  expect(choice.selected).toBe(''); expect(choice.notice).toContain(`${asleep.name} is asleep`);
  expect(choice.people.length).toBeGreaterThan(0);
  asleep.activity = 'idle'; asleep.pos = { x: snap.player.pos.x + 20, y: snap.player.pos.y };
  expect(conversationChoices(snap, asleep.id)).toMatchObject({ selected: '', notice: `${asleep.name} is not close enough to talk. You can talk to the village or visit later.` });
  expect(conversationChoices(snap).selected).toBeTruthy();
});
it('includes the specifically requested awake person even in a crowded space', () => {
  const snap = createFakeSimulation(731).snapshot(), original = snap.villagers[0]!;
  snap.villagers = Array.from({ length: 10 }, (_, i) => ({ ...original, id: `person${i}`, pos: { ...snap.player.pos }, activity: 'idle' }));
  const choice = conversationChoices(snap, 'person9');
  expect(choice.selected).toBe('person9'); expect(choice.people).toHaveLength(8); expect(choice.people[0]!.id).toBe('person9');
});
