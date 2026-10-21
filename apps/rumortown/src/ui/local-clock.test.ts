import { expect, it } from 'vitest';
import { localStartTick } from './local-clock.js';
import { decodeShare, encodeShare } from './share-link.js';
import { MINUTES_PER_DAY } from '../sim/types.js';

it.each([[6, 0, 0], [19, 0, 780], [21, 0, 900], [0, 0, 1080], [5, 59, 1439]])('arrives at local %s:%s on the full-day clock', (h, m, tick) => {
  expect(localStartTick(new Date(2026, 9, 21, h, m))).toBe(tick);
});
it('preserves v2 arrival and absolute interventions, and reads v1 at tick zero', () => {
  const v2 = { v: 2 as const, start: 900, seed: 731, cast: 'v4', interventions: [{ tick: 960, listener: 'mira', claimId: 'tom-stole-bread' }] };
  expect(decodeShare(encodeShare(v2))).toEqual(v2);
  const v1 = { v: 1 as const, seed: 731, cast: 'v4', interventions: [] };
  expect(decodeShare(encodeShare(v1))?.start ?? 0).toBe(0);
  for (const start of [-1, MINUTES_PER_DAY, 1.5, Infinity]) expect(() => encodeShare({ ...v2, start })).toThrow();
});
