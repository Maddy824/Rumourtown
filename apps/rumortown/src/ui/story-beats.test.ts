import { expect, it } from 'vitest';
import { createBeatTicker, mergeBeatPins, type StoryBeat } from './story-beats.js';
const beat = (tick: number, kind: StoryBeat['kind'] = 'whisper'): StoryBeat => ({ tick, kind, text: 'Mira told Ben a story', faces: ['mira', 'ben'], event: { kind: 'whisper', tick, listener: 'ben', claimId: 'bread', witnesses: [] } });
it('merges beats less than ten minutes apart and keeps the strongest pin', () => {
  const pins = mergeBeatPins([beat(29), beat(0), beat(9, 'exposure'), beat(19)]);
  expect(pins.map(p => [p.tick, p.kind, p.count])).toEqual([[9, 'exposure', 2], [19, 'whisper', 1], [29, 'whisper', 1]]);
});
it('merges chains of close beats and caps the timeline at 24 pins', () => {
  expect(mergeBeatPins([beat(0), beat(9), beat(18)])[0]!.count).toBe(3);
  const pins = mergeBeatPins(Array.from({ length: 30 }, (_, i) => beat(i * 10)));
  expect(pins).toHaveLength(24); expect(pins[0]!.tick).toBe(60);
});
it('throttles the running story and clears it after eight seconds', () => {
  const ticker = createBeatTicker();
  expect(ticker.update(0)).toBeNull();
  ticker.push([beat(1)]); expect(ticker.update(0)?.tick).toBe(1);
  ticker.push([beat(2)]); expect(ticker.update(3999)?.tick).toBe(1);
  expect(ticker.update(4000)?.tick).toBe(2);
  expect(ticker.update(11999)?.tick).toBe(2);
  expect(ticker.update(12000)).toBeNull();
  ticker.reset(); expect(ticker.update(12001)).toBeNull();
});
