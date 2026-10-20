import { describe, expect, it } from 'vitest';
import { Mood, appraise, createRng } from '../src/index.js';

describe('Mood', () => {
  it('sums named causes and stops applying them exactly at expiry without requiring expire', () => {
    const mood = new Mood();
    expect(mood.value(0)).toBe(0);
    mood.add('accused in public', -0.7, 10);
    mood.add('defended by a friend', 0.3, 5);
    expect(mood.value(4)).toBeCloseTo(-0.4);
    expect(mood.value(5)).toBe(-0.7);
    expect(mood.value(10)).toBe(0);
    expect(mood.list(10)).toEqual([]);
  });

  it('replaces a repeated label and returns independent copies in insertion order', () => {
    const mood = new Mood();
    mood.add('rested', 0.2, 5);
    mood.add('fed', 0.1, 10);
    mood.add('rested', 0.4, 20);
    expect(mood.value(6)).toBeCloseTo(0.5);
    const list = mood.list(6);
    expect(list.map((modifier) => modifier.label)).toEqual(['rested', 'fed']);
    list[0]!.delta = -100;
    list.pop();
    expect(mood.value(6)).toBeCloseTo(0.5);
    expect(mood.list(6)).toHaveLength(2);
  });

  it('physically removes expired causes and is safe to expire repeatedly', () => {
    const mood = new Mood();
    mood.add('rested', 0.2, 5);
    mood.add('fed', 0.1, 10);
    mood.expire(5);
    mood.expire(5);
    expect(mood.list(0)).toEqual([{ label: 'fed', delta: 0.1, untilTick: 10 }]);
    mood.expire(10);
    expect(mood.list(0)).toEqual([]);
  });

  it('clamps the final sum and always stays in -1..1 across seeded additions and expiries', () => {
    const mood = new Mood();
    mood.add('happy', 2, 2);
    expect(mood.value(0)).toBe(1);
    mood.add('sad', -3, 3);
    expect(mood.value(0)).toBe(-1);
    expect(mood.value(2)).toBe(-1);
    const rng = createRng(12);
    for (let tick = 3; tick < 1000; tick++) {
      mood.add(`cause-${tick % 20}`, rng() * 10 - 5, tick + Math.floor(rng() * 30));
      const expected = Math.max(-1, Math.min(1, mood.list(tick).reduce((sum, cause) => sum + cause.delta, 0)));
      expect(mood.value(tick)).toBe(expected);
      expect(mood.value(tick)).toBeGreaterThanOrEqual(-1);
      expect(mood.value(tick)).toBeLessThanOrEqual(1);
      mood.expire(tick);
      expect(mood.value(tick)).toBe(expected);
    }
  });

  it('rejects non-finite modifiers before they can poison the sum', () => {
    const mood = new Mood();
    for (const value of [NaN, Infinity, -Infinity]) {
      expect(() => mood.add('bad delta', value, 10)).toThrow(RangeError);
      expect(() => mood.add('bad expiry', 0.1, value)).toThrow(RangeError);
    }
    expect(mood.value(0)).toBe(0);
  });
});

describe('appraise', () => {
  it('distinguishes other-blame, self-blame, helplessness and gratitude', () => {
    const harm = { goalImpact: -1, blame: 1, certainty: 1, control: 1 };
    expect(appraise(harm)).toEqual({ anger: 1, fear: 0, shame: 0, gratitude: 0 });
    expect(appraise({ ...harm, blame: -1 }).shame).toBe(1);
    expect(appraise({ ...harm, blame: -1 }).anger).toBe(0);
    expect(appraise({ ...harm, control: 0 }).fear).toBe(1);
    expect(appraise({ ...harm, certainty: 0 }).fear).toBe(1);
    expect(appraise({ ...harm, goalImpact: 1 })).toEqual({ anger: 0, fear: 0, shame: 0, gratitude: 1 });
    expect(appraise({ ...harm, goalImpact: 0 })).toEqual({ anger: 0, fear: 0, shame: 0, gratitude: 0 });
  });

  it('keeps every emotion within 0..1, including finite inputs outside the documented ranges', () => {
    const rng = createRng(2);
    for (let i = 0; i < 1000; i++) {
      const result = appraise({
        goalImpact: rng() * 6 - 3, blame: rng() * 6 - 3,
        certainty: rng() * 6 - 3, control: rng() * 6 - 3,
      });
      for (const value of Object.values(result)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });
});
