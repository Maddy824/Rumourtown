import { expect, it } from 'vitest';
import { newestStoryEntries, storyBeat, storyTarget } from './story-beats.js';
import type { GameClaim, SimEvent, Simulation, WorldSnapshot } from '../sim/types.js';
import { HOW_IT_WORKS } from './how-it-works.js';
import css from '../styles/app.css?raw';
const sim = { cast: new Map(), claims: new Map() } as Pick<Simulation, 'cast' | 'claims'>;
const whisper = (tick: number, listener: string): SimEvent => ({ kind: 'whisper', tick, listener, claimId: 'bread', witnesses: [] });
it('orders beat cards newest first, preserves same-tick event order backwards and excludes small talk', () => {
  const first = whisper(1, 'mira'), next = whisper(3, 'ben'), last = whisper(3, 'rosa');
  const talk = { kind: 'line', tick: 4, speaker: 'mira', listeners: ['ben'], act: 'greet', text: 'Hello' } as SimEvent;
  expect(newestStoryEntries([first, next, last, talk], sim)).toEqual([last, next, first]);
});
it('Show me uses both beat faces and targets their current midpoint, including the player', () => {
  const beat = storyBeat(whisper(1, 'mira'), sim)!;
  expect(beat.faces).toEqual(['stranger', 'mira']);
  const snapshot = { player: { pos: { x: 2, y: 4 } }, villagers: [{ id: 'mira', pos: { x: 8, y: 6 } }] } as WorldSnapshot;
  expect(storyTarget(beat.faces, snapshot)).toEqual({ x: 5, y: 5 });
  expect(storyTarget(['missing'], snapshot)).toBeNull();
});
it('the Now sentence wraps at 15px with no clipping, line clamp or ellipsis', () => {
  const rules = css.match(/\.now-sentence\s*\{([^}]+)\}/)?.[1] ?? '';
  expect(rules).toContain('font-size: 15px');
  expect(rules).toContain('white-space: normal');
  expect(rules).not.toMatch(/ellipsis|line-clamp|overflow:\s*hidden|text-overflow|max-height/);
});
it('keeps the guide sections short and the first arrival card below sixty words', () => {
  for (const section of HOW_IT_WORKS) expect(section.text.split(/\s+/).length).toBeLessThan(80);
  expect(HOW_IT_WORKS[0].text.split(/\s+/).length).toBeLessThan(60);
  expect(HOW_IT_WORKS[1].text.split(/\s+/).length).toBeLessThan(60);
});

it('gives a complete short sentence to the Now bar when a full beat is long', async () => {
  const { nowSentence } = await import('./story-beats.js');
  const event = whisper(1, 'mira');
  const beat = storyBeat(event, sim)!;
  beat.text = 'You told Mira that a very long story about the village and the coming fair was going around today';
  expect(nowSentence(beat, sim)).toBe(beat.text + '.');
  expect(beat.text).toContain('a very long story');
});
it('zooms out enough to show both participants after they have walked apart', async () => {
  const { storyZoom } = await import('./story-beats.js');
  const snapshot = { player: { pos: { x: 2, y: 4 } }, villagers: [{ id: 'mira', pos: { x: 24, y: 14 } }] } as WorldSnapshot;
  const zoom = storyZoom(['stranger', 'mira'], snapshot, 336, 260)!;
  expect(zoom).toBeLessThan(32);
  expect((24 - 2 + 4) * zoom).toBeLessThanOrEqual(336);
  expect((14 - 4 + 4) * zoom).toBeLessThanOrEqual(260);
});

it('names every library rumor in long Now beats rather than replacing it with generic gossip', async () => {
  const { nowSentence } = await import('./story-beats.js');
  const { rumorLibrary } = await import('../content/rumor-packs/index.js');
  for (const { claim } of rumorLibrary.flatMap(pack => pack.stories)) {
    const village = { cast: new Map(), claims: new Map([[claim.id, claim]]) };
    const event = { kind: 'line', tick: 1, speaker: 'mira', listeners: ['ben'], act: 'gossip', text: claim.text, lineId: 'test', claimId: claim.id } as SimEvent;
    const sentence = nowSentence(storyBeat(event, village)!, village);
    expect(sentence).toContain(claim.text);
    expect(sentence).not.toContain('a village rumor');
  }
});

it('filters two player stories by the selected claim and its supported correction, including same-tick order', async () => {
  const { selectedStoryEvents } = await import('./story-beats.js');
  const claims = new Map<string, GameClaim>([
    ['a', { id: 'a', about: 'tom', text: 'Tom stole bread', kind: 'theft', severity: 2, valence: -1 }],
    ['b', { id: 'b', about: 'jonah', text: 'Jonah met Rosa', kind: 'romance', severity: 1, valence: -1 }],
    ['correction', { id: 'correction', about: 'tom', text: 'Tom brought bread to Ada', alternativeOf: 'a', kind: 'kindness', severity: 1, valence: 1 }],
  ]) as Simulation['claims'];
  const view = { claims };
  const line = (claimId: string): SimEvent => ({ kind: 'line', tick: 10, claimId, speaker: 'ben', listeners: ['mira'], text: claimId, act: 'gossip', lineId: 'same' });
  const earlier = line('a'), a = { ...whisper(10, 'mira'), claimId: 'a' } as SimEvent;
  const b = { ...whisper(10, 'ben'), claimId: 'b' } as SimEvent;
  const correction = line('correction'), laterA = line('a'), laterB = line('b');
  const exposure: SimEvent = { kind: 'relationship', tick: 12, from: 'ben', to: 'stranger', trust: -0.1, affinity: 0, why: 'The story that Tom stole bread came from the stranger and did not hold up' };
  const events = [earlier, a, b, correction, laterA, laterB, exposure];
  expect([...selectedStoryEvents(events, view, 'a')]).toEqual([a, correction, laterA, exposure]);
  expect([...selectedStoryEvents(events, view, 'b')]).toEqual([b, laterB]);
});
it('keeps event keys distinct for different stories told to the same listener at one paused tick', async () => {
  const { eventKey } = await import('./story-beats.js');
  const a = { kind: 'whisper', tick: 10, listener: 'mira', claimId: 'bread', witnesses: [] } as const;
  expect(eventKey({ ...a, witnesses: [] })).not.toBe(eventKey({ ...a, witnesses: [], claimId: 'other' }));
});
it('retains selected authored village stories even when the player has not whispered that claim', async () => {
  const { selectedStoryEvents } = await import('./story-beats.js');
  const village: SimEvent = { kind: 'line', tick: 8, claimId: 'village', speaker: 'ben', listeners: ['mira'], text: 'Village news', act: 'gossip', lineId: 'village' };
  expect([...selectedStoryEvents([whisper(1, 'mira'), village], sim, 'village')]).toEqual([village]);
  expect([...selectedStoryEvents([village], sim, '')]).toEqual([]);
});
