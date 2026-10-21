import { expect, it } from 'vitest';
import { newestStoryEntries, storyBeat, storyTarget } from './story-beats.js';
import type { SimEvent, Simulation, WorldSnapshot } from '../sim/types.js';
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
  expect(nowSentence(beat, sim)).toBe('You told mira a village rumor.');
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
