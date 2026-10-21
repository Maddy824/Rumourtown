import { expect, it } from 'vitest';
import { createStatusLine } from './status-line.js';
it('retires old guidance after six seconds and gives a replacement its own lifetime', () => {
  const el = { textContent: 'Loading', hidden: false } as HTMLElement;
  let now = 0;
  const line = createStatusLine(el, () => now);
  line.update(5999); expect(el.hidden).toBe(false);
  line.update(6000); expect(el.textContent).toBe(''); expect(el.hidden).toBe(true);
  now = 7000; line.show('Walking');
  now = 8000; line.show('Arrived');
  line.update(13000); expect(el.textContent).toBe('Arrived');
  line.update(14000); expect(el.hidden).toBe(true);
  line.show('Another walk'); line.clear(); expect(el.textContent).toBe('');
});
