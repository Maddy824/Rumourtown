import { expect, it } from 'vitest';
import { createDistrictTrigger } from './district-banner.js';
it('suppresses the first ten seconds, fires once per entry and allows re-entry', () => {
  const enter = createDistrictTrigger(100);
  expect(enter({ x: 10, y: 10 }, 100)).toBeNull();
  expect(enter({ x: 44, y: 20 }, 9_000)).toBeNull();
  expect(enter({ x: 44, y: 20 }, 11_000)).toBeNull();
  expect(enter({ x: 50, y: 7 }, 11_001)).toBe('Woodland');
  expect(enter({ x: 51, y: 7 }, 12_000)).toBeNull();
  expect(enter({ x: 44, y: 20 }, 14_000)).toBe('Eastbank');
});
