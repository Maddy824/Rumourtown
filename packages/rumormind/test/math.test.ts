import { describe, expect, it, vi } from 'vitest';
import { deterministicExp as exp, deterministicLog as log, deterministicSqrt as sqrt,
  deterministicHypot as hypot, deterministicPow as pow } from '../src/math.js';

describe('fixed-order replay maths', () => {
  it('tracks reference exp/log over the model range and extreme finite inputs', () => {
    for (const x of [-700, -100, -12, -1, -.1, 0, .1, 1, 12, 100, 700]) {
      expect(Math.abs(exp(x) / Math.exp(x) - 1)).toBeLessThan(1e-12);
    }
    for (const x of [Number.MIN_VALUE, 1e-200, .001, .1, .5, 1, 1.5, 2, 100, 1e200, Number.MAX_VALUE]) {
      expect(Math.abs(log(x) - Math.log(x))).toBeLessThan(1e-12);
      expect(Math.abs(sqrt(x) / Math.sqrt(x) - 1)).toBeLessThan(1e-12);
    }
  });
  it('matches distance, familiarity and decay to tighter than game precision', () => {
    for (let i = 0; i < 1000; i++) {
      const x = i / 13, y = (i % 17) / 7;
      expect(Math.abs(hypot(x, y) - Math.hypot(x, y))).toBeLessThan(1e-10);
      expect(Math.abs(pow(.995, i / 60) - Math.pow(.995, i / 60))).toBeLessThan(1e-12);
      expect(Math.abs(sqrt(sqrt(i)) - Math.pow(i, .25))).toBeLessThan(1e-12);
    }
  });
  it('handles zero, infinities, NaN and subnormal values without convergence loops', () => {
    expect(exp(Infinity)).toBe(Infinity); expect(exp(-Infinity)).toBe(0);
    expect(exp(0)).toBe(1); expect(exp(-745)).toBe(Number.MIN_VALUE);
    expect(log(0)).toBe(-Infinity); expect(log(Infinity)).toBe(Infinity);
    expect(log(-1)).toBeNaN(); expect(sqrt(-1)).toBeNaN();
    expect(Object.is(sqrt(-0), -0)).toBe(true); expect(sqrt(Infinity)).toBe(Infinity);
    expect(hypot(Infinity, NaN)).toBe(Infinity); expect(hypot(NaN, 1)).toBeNaN();
    expect(hypot(0, 0)).toBe(0); expect(pow(0, 2)).toBe(0);
    expect(pow(0, -2)).toBe(Infinity); expect(pow(NaN, 0)).toBe(1);
    expect(pow(1, NaN)).toBeNaN(); expect(pow(1, Infinity)).toBeNaN();
    expect(exp(NaN)).toBeNaN(); expect(log(NaN)).toBeNaN(); expect(sqrt(NaN)).toBeNaN();
  });
  it('does not delegate to host transcendental implementations', () => {
    const mocks = (['exp', 'log', 'sqrt', 'pow', 'hypot'] as const).map(name =>
      vi.spyOn(Math, name).mockImplementation(() => { throw new Error('host maths'); }));
    try {
      expect(exp(0)).toBe(1); expect(log(1)).toBe(0); expect(sqrt(4)).toBe(2);
      expect(hypot(3, 4)).toBe(5); expect(pow(.995, 2)).toBeCloseTo(.990025, 12);
    } finally { mocks.forEach(mock => mock.mockRestore()); }
  });
});
