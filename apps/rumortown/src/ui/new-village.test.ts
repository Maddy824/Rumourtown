import { describe, expect, it } from 'vitest';
import { decodeShare, encodeShare } from './share-link.js';
import { localStartTick } from './local-clock.js';
import { newVillageUrl } from './new-village.js';

describe('starting another village', () => {
  it('replaces old whispers with a new seed and starts at the ordinary opening', () => {
    const previous = encodeShare({ v: 1, seed: 731, cast: 'v1', interventions: [
      { tick: 60, listener: 'mira', claimId: 'tom-stole-bread' },
    ] });
    const url = new URL(newVillageUrl(`https://village.test/game/?t=2699#${previous}`, 42, 'v1'));
    expect(url.origin + url.pathname).toBe('https://village.test/game/');
    expect(url.searchParams.has('t')).toBe(false);
    expect(decodeShare(url.hash.slice(1))).toEqual({ v: 2, start: localStartTick(), seed: 42, cast: 'v1', interventions: [] });
    expect(decodeShare(previous)?.interventions).toHaveLength(1);
  });

  it('retains fixture/rendering mode and accepts the full unsigned seed range', () => {
    for (const seed of [0, 0xffffffff]) {
      const url = new URL(newVillageUrl('https://village.test/?fake=1&renderer=stub&t=2700#old', seed, 'v1'));
      expect(url.searchParams.get('fake')).toBe('1');
      expect(url.searchParams.get('renderer')).toBe('stub');
      expect(decodeShare(url.hash.slice(1))?.seed).toBe(seed);
    }
  });
});
