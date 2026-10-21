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
it('on phones shows only neighbours within three tiles plus people in the chain', () => {
  const rules = { phone: true, chain: new Set(['suri']) };
  expect(labelVisible('mira', 3, false, true, rules)).toBe(true);
  expect(labelVisible('mira', 3.01, false, true, rules)).toBe(false);
  expect(labelVisible('suri', 30, false, true, rules)).toBe(true);
  expect(labelVisible('suri', 30, false, false, rules)).toBe(false);
});
it('focus hides names outside the chain and core six, with phone distance still applying', () => {
  const rules = { focus: true, chain: new Set(['suri']) };
  expect(labelVisible('suri', 30, false, true, rules)).toBe(true);
  expect(labelVisible('lara', 1, false, true, rules)).toBe(false);
  expect(labelVisible('mira', 30, false, true, rules)).toBe(true);
  expect(labelVisible('mira', 4, false, true, { ...rules, phone: true })).toBe(false);
});
