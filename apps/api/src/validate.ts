import cast from './cast.json';
import { isReviewedObject, objects } from './objects';

export const kinds = ['theft', 'cheating', 'romance', 'lying', 'broken-promise', 'insult', 'hoarding', 'shirking', 'boasting', 'kindness', 'paid-debt', 'nursed'] as const;
export const unsupportedReasons = ['not-about-cast', 'real-person', 'protected-trait', 'sexual', 'hateful', 'unclear'] as const;
export type Kind = typeof kinds[number];
export interface Claim {
  kind: Kind;
  about: string;
  target?: string;
  object?: string;
  severity: 1 | 2 | 3;
  valence: -1 | 1;
  confidence: number;
}
export interface Unsupported { unsupported: typeof unsupportedReasons[number] }
const ids = cast.map(person => person.id);
const favourable: readonly string[] = ['kindness', 'paid-debt', 'nursed'];

export function validate(value: unknown): Claim | Unsupported | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (Object.hasOwn(v, 'unsupported')) {
    return Object.keys(v).length === 1 && typeof v.unsupported === 'string' &&
      (unsupportedReasons as readonly string[]).includes(v.unsupported)
      ? { unsupported: v.unsupported as Unsupported['unsupported'] } : null;
  }
  const allowed = ['kind', 'about', 'target', 'object', 'severity', 'valence', 'confidence'];
  if (Object.keys(v).some(key => !allowed.includes(key))) return null;
  if (typeof v.kind !== 'string' || !(kinds as readonly string[]).includes(v.kind) ||
      typeof v.about !== 'string' || !ids.includes(v.about) ||
      ![1, 2, 3].includes(v.severity as number) || ![-1, 1].includes(v.valence as number) ||
      typeof v.confidence !== 'number' || !Number.isFinite(v.confidence) || v.confidence < 0 || v.confidence > 1) return null;
  if (Object.hasOwn(v, 'target') && (typeof v.target !== 'string' || !ids.includes(v.target) || v.target === v.about)) return null;
  if (Object.hasOwn(v, 'object') && typeof v.object !== 'string') return null;
  return {
    kind: v.kind as Kind, about: v.about,
    ...(typeof v.target === 'string' ? { target: v.target } : {}),
    ...(isReviewedObject(v.object) ? { object: v.object } : {}),
    severity: v.severity as Claim['severity'],
    valence: favourable.includes(v.kind) ? 1 : -1,
    confidence: v.confidence,
  };
}

// Each branch has all its properties required, as strict schema providers expect.
const base = {
  kind: { type: 'string', enum: kinds }, about: { type: 'string', enum: ids },
  severity: { type: 'integer', enum: [1, 2, 3] }, valence: { type: 'integer', enum: [-1, 1] },
  confidence: { type: 'number', minimum: 0, maximum: 1 },
};
export const schema = {
  anyOf: [
    ...[{}, { target: { type: 'string', enum: ids } }, { object: { type: 'string', enum: objects } },
      { target: { type: 'string', enum: ids }, object: { type: 'string', enum: objects } }]
      .map(optional => ({ type: 'object', additionalProperties: false, properties: { ...base, ...optional }, required: [...Object.keys(base), ...Object.keys(optional)] })),
    { type: 'object', additionalProperties: false, properties: { unsupported: { type: 'string', enum: unsupportedReasons } }, required: ['unsupported'] },
  ],
};
