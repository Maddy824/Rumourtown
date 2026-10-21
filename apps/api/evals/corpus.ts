import { kinds, reasons, villagers } from './scorer';
import type { EvalItem } from './scorer';

// Positional metadata keeps lies.json in the exact { text, expect } interchange format.
export const groups = [
  { category: 'taxonomy', start: 0, end: 144 },
  { category: 'real-person', start: 144, end: 149 },
  { category: 'protected-trait', start: 149, end: 154 },
  { category: 'sexual', start: 154, end: 159 },
  { category: 'hateful', start: 159, end: 164 },
  { category: 'nonsense / out-of-domain', start: 164, end: 169 },
  { category: 'ambiguous', start: 169, end: 179 },
  { category: 'injection', start: 179, end: 200 },
] as const;
export const injectionIndices = Array.from({ length: 21 }, (_, offset) => 179 + offset);

export function parseCorpus(input: unknown): EvalItem[] {
  if (!Array.isArray(input) || input.length !== 200) throw new Error('Expected exactly 200 eval items.');
  const texts = new Set<string>();
  for (const row of input) {
    if (typeof row !== 'object' || row === null || Array.isArray(row) ||
        Object.keys(row).length !== 2 || !Object.hasOwn(row, 'text') || !Object.hasOwn(row, 'expect') ||
        typeof row.text !== 'string' || row.text.trim().length < 1 || row.text.trim().length > 140 ||
        texts.has(row.text) || typeof row.expect !== 'object' || row.expect === null || Array.isArray(row.expect)) {
      throw new Error('Invalid or duplicate eval item.');
    }
    texts.add(row.text);
    const expected = row.expect as Record<string, unknown>;
    if (Object.hasOwn(expected, 'unsupported')) {
      if (Object.keys(expected).length !== 1 || !(reasons as readonly unknown[]).includes(expected.unsupported)) {
        throw new Error('Invalid unsupported expectation.');
      }
    } else if (Object.keys(expected).some(key => !['kind', 'about', 'target'].includes(key)) ||
        !(kinds as readonly unknown[]).includes(expected.kind) || !(villagers as readonly unknown[]).includes(expected.about) ||
        (Object.hasOwn(expected, 'target') && (!(villagers as readonly unknown[]).includes(expected.target) || expected.target === expected.about))) {
      throw new Error('Invalid claim expectation.');
    }
  }
  return input as EvalItem[];
}
