import { expect, it } from 'vitest';
import { windOffset } from './wind.js';
it('bounds seeded wind, freezes it under reduced motion, and repeats at the same tick', () => {
  for (let tick = 0; tick < 100; tick++) {
    expect(windOffset(17, tick, .5, false)).toBe(windOffset(17, tick, .5, false));
    expect(Math.abs(windOffset(17, tick, .5, false))).toBeLessThanOrEqual(2.2);
    expect(windOffset(17, tick, .5, true)).toBe(0);
  }
  expect(windOffset(17, 10, .5, false)).not.toBe(windOffset(18, 10, .5, false));
});
