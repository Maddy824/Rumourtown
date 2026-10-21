import { expect, it, vi } from 'vitest';
import { blockedSharedText, slurs, sexual } from './blocklist.js';
import { objects } from './local-lexicons.js';

// Vitest runs these source reads in Node; keep browser TypeScript free of Node globals.
const { readFileSync } = await vi.importActual<{ readFileSync(path: string, encoding: 'utf8'): string }>('node:fs');

it('keeps both browser blocklists identical to the actual Worker source', () => {
  const worker = readFileSync('apps/api/src/moderation.ts', 'utf8');
  for (const [name, list] of [['slurs', slurs], ['sexual', sexual]] as const) {
    const source = new RegExp(`const ${name} = new Set\\(\\[([^\\]]+)\\]\\)`, 'u').exec(worker)?.[1];
    expect(source, `${name} must remain readable from the Worker source`).toBeDefined();
    expect([...source!.matchAll(/'([^']+)'/gu)].map(match => match[1])).toEqual([...list]);
  }
});
it('keeps the browser object vocabulary identical to the Worker allowlist', () => {
  const worker = readFileSync('apps/api/src/objects.ts', 'utf8');
  const source = /export const objects = \[([^\]]+)\]/u.exec(worker)?.[1];
  expect(source).toBeDefined();
  expect([...source!.matchAll(/'([^']+)'/gu)].map(match => match[1])).toEqual([...objects]);
});

it.each(['f.u.c.k', 'F U C K', 'f-u-c-k', 'f u ck', 's.e.x', 'n i g g e r', 'f.a.g.g.o.t', 'p.o.r.n', 'n u d e s', 'ＦＵＣＫ'])('blocks obfuscated shared text: %s', text => {
  expect(blockedSharedText(`Tom said ${text}`)).toBe(true);
});
it.each(['Tom carried grapes', 'The mill has scrap metal', 'Mira gave bread to Tom', 'A fair in Essex'])('preserves word boundaries in shared text: %s', text => {
  expect(blockedSharedText(text)).toBe(false);
});
