// Reviewed item vocabulary: model text outside this list must never be echoed.
export const objects = [
  'bread', 'loaf', 'flour', 'sack', 'tools', 'coins', 'letter', 'ring', 'wool', 'cloth',
  'honey', 'wheel', 'boat', 'fish', 'eggs', 'milk', 'candle', 'book', 'cart', 'key',
] as const;

export function isReviewedObject(value: unknown): value is typeof objects[number] {
  return typeof value === 'string' && (objects as readonly string[]).includes(value);
}
