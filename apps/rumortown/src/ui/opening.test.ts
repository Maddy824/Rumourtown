import { expect, it } from 'vitest';
import { claimOpening, OPENING_KEY } from './opening.js';
it('shows once per browser store, claiming display before dismissal', () => {
  const data = new Map<string, string>();
  const storage = () => ({ getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } });
  expect(claimOpening(storage)).toBe(true);
  expect(data.get(OPENING_KEY)).toBe('seen');
  expect(claimOpening(storage)).toBe(false);
});
it('survives denied storage access, reads and writes', () => {
  expect(claimOpening(() => { throw Error('denied'); })).toBe(true);
  expect(claimOpening(() => ({ getItem() { throw Error('denied'); }, setItem() {} }))).toBe(true);
  expect(claimOpening(() => ({ getItem: () => null, setItem() { throw Error('full'); } }))).toBe(true);
});
