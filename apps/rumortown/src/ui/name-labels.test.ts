import { expect, it } from 'vitest';
import { labelVisible, CORE_PEOPLE } from './name-labels.js';
it('labels neighbours within four tiles and the six core people at every distance', () => {
  expect(labelVisible('suri', 4, false, true)).toBe(true);
  expect(labelVisible('suri', 4.01, false, true)).toBe(false);
  for (const id of CORE_PEOPLE) expect(labelVisible(id, 50, false, true)).toBe(true);
});
it('hides names for off-screen people and anyone with a visible bubble', () => {
  expect(labelVisible('mira', 1, true, true)).toBe(false);
  expect(labelVisible('mira', 1, false, false)).toBe(false);
});
