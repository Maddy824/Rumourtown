import { expect, it } from 'vitest';
import { createHint, createRumorFocus } from './focus.js';
it('toggles focus, pauses on player movement, resumes explicitly and clears on off', () => {
  const focus = createRumorFocus();
  expect(focus.on).toBe(false);
  focus.toggle(); focus.transmission(['mira', 'ben'], 0);
  expect(focus.target(500)).toEqual(['mira', 'ben']);
  focus.move(); expect(focus.paused).toBe(true);
  focus.transmission(['ben', 'rosa'], 600);
  expect(focus.target(1000)).toEqual([]);
  focus.resume(); focus.transmission(['ben', 'rosa'], 1000);
  expect(focus.target(1000)).toEqual(['ben', 'rosa']);
  focus.toggle(false); expect(focus.target(1500)).toEqual([]); expect(focus.paused).toBe(false);
});
it('gives every transmission a two second hold in arrival order', () => {
  const focus = createRumorFocus(); focus.toggle(true);
  focus.transmission(['stranger', 'mira'], 0);
  focus.transmission(['mira', 'ben'], 100);
  focus.transmission(['ben', 'rosa'], 200);
  expect(focus.target(1999)).toEqual(['stranger', 'mira']);
  expect(focus.target(2000)).toEqual(['mira', 'ben']);
  expect(focus.target(3999)).toEqual(['mira', 'ben']);
  expect(focus.target(4000)).toEqual(['ben', 'rosa']);
});
it('dismisses the hint permanently after input or twenty seconds', () => {
  const tapped = createHint(100); expect(tapped.visible(101)).toBe(true);
  tapped.dismiss(); expect(tapped.visible(102)).toBe(false); expect(tapped.visible(0)).toBe(false);
  const timed = createHint(100); expect(timed.visible(20099)).toBe(true);
  expect(timed.visible(20100)).toBe(false); expect(timed.visible(101)).toBe(false);
});
