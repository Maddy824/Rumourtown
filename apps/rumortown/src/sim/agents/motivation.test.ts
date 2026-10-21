import { describe, expect, it } from 'vitest';
import { motivationTerms } from './motivation.js';

const motives = { protect: 1, bond: 1, status: 1, verify: 1 };
const base = { act: 'gossip' as const, confidence: .5, closeness: .3, rival: false, firsthand: false };
const score = (c: Parameters<typeof motivationTerms>[1]) => motivationTerms(motives, c).reduce((sum, term) => sum + term.value, 0);

describe('contextual gossip motives', () => {
  it('distinguishes a warning, friendship and rivalry from anonymous chatter', () => {
    expect(score({ ...base, act: 'warn' })).toBeGreaterThan(score(base));
    expect(score({ ...base, closeness: .8 })).toBeGreaterThan(score(base));
    expect(score({ ...base, rival: true })).toBeGreaterThan(score(base));
    expect(score({ ...base, act: 'defend', rival: true })).toBe(score({ ...base, act: 'defend', rival: false }));
  });
  it('verification inhibits uncertain hearsay but not direct observation', () => {
    expect(score(base)).toBeLessThan(score({ ...base, firsthand: true }));
    expect(score({ ...base, confidence: .9 })).toBeGreaterThan(score(base));
    expect(motivationTerms(undefined, base)).toEqual([]);
  });
});
