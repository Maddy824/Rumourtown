import { describe, expect, it } from 'vitest';
import { advanceTicks } from './loop.js';

describe('fixed-step accumulator', () => {
  it.each([1 / 60, 0.1, 0.25, 0.5, 1, 2.5, 10])('accounts for all 200 ticks over ten seconds with %s second frames', (frameLength) => {
    let debt = 0;
    let stepped = 0;
    const frames = Math.ceil(10 / frameLength);
    for (let frame = 0; frame < frames; frame++) {
      const elapsed = Math.min(frameLength, 10 - frame * frameLength);
      const budget = advanceTicks(debt, elapsed, 20, 8);
      expect(budget.steps).toBeLessThanOrEqual(8);
      stepped += budget.steps;
      debt = budget.remaining;
    }
    expect(stepped + debt).toBeCloseTo(200, 8);
    // Limited catch-up takes later frames; draining the debt adds no elapsed time.
    while (debt >= 1 - 1e-9) {
      const budget = advanceTicks(debt, 0, 20, 8);
      stepped += budget.steps;
      debt = budget.remaining;
    }
    expect(stepped).toBe(200);
    expect(debt).toBeCloseTo(0, 8);
  });

  it('keeps whole and fractional debt across frames and speed changes', () => {
    expect(advanceTicks(0.5, 0.5, 20, 8)).toEqual({ steps: 8, remaining: 2.5 });
    expect(advanceTicks(2.5, 0.2, 2.5, 8)).toEqual({ steps: 3, remaining: 0 });
  });

  it('holds debt without stepping or accruing time while paused', () => {
    expect(advanceTicks(12.5, 10, 0, 8)).toEqual({ steps: 0, remaining: 12.5 });
  });

  it.each([2.5, 5, 20])('steps at %s ticks per second', (rate) => {
    expect(advanceTicks(0, 2, rate, 100)).toEqual({ steps: 2 * rate, remaining: 0 });
  });
});
