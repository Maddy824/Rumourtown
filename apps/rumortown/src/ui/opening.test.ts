import { expect, it } from 'vitest';
import { claimOpening, finishOpeningDay, OPENING_CARDS, OPENING_KEY } from './opening.js';
it('shows on every visit until a day finishes, storing only that flag', () => {
  const data = new Map<string, string>();
  const storage = () => ({ getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } });
  expect(claimOpening(storage)).toBe(true);
  expect(claimOpening(storage)).toBe(true);
  expect(data.size).toBe(0);
  finishOpeningDay(storage);
  expect(data.get(OPENING_KEY)).toBe('yes');
  expect(data.size).toBe(1);
  expect(claimOpening(storage)).toBe(false);
});
it('survives denied storage access, reads and writes', () => {
  expect(claimOpening(() => { throw Error('denied'); })).toBe(true);
  expect(claimOpening(() => ({ getItem() { throw Error('denied'); }, setItem() {} }))).toBe(true);
  expect(() => finishOpeningDay(() => { throw Error('denied'); })).not.toThrow();
  expect(() => finishOpeningDay(() => ({ getItem: () => null, setItem() { throw Error('full'); } }))).not.toThrow();
});

it('keeps each swipe card below sixty words', () => {
  for (const card of OPENING_CARDS) expect(card.text.split(/\s+/).length).toBeLessThan(60);
});
