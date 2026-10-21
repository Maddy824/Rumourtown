import { expect, it } from 'vitest';
import { signVisible } from './presentation.js';
it('hides home plates on phones and limits public signs to six tiles', () => {
  expect(signVisible('home', 0, true)).toBe(false);
  expect(signVisible('bakery', 6, true)).toBe(true);
  expect(signVisible('inn', 6.01, true)).toBe(false);
  expect(signVisible('home', 50, false)).toBe(true);
});
