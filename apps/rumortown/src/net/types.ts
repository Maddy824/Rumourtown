/** Wire types mirror apps/api/src/validate.ts, rather than simulation claim ids. */
export const claimKinds = [
  'theft', 'cheating', 'romance', 'lying', 'broken-promise', 'insult',
  'hoarding', 'shirking', 'boasting', 'kindness', 'paid-debt', 'nursed',
] as const;
export const unsupportedReasons = [
  'not-about-cast', 'real-person', 'protected-trait', 'sexual', 'hateful', 'unclear', 'unsupported-story',
] as const;
export type UnsupportedReason = typeof unsupportedReasons[number];
export interface Claim {
  kind: typeof claimKinds[number];
  about: string;
  target?: string;
  object?: string;
  severity: 1 | 2 | 3;
  valence: -1 | 1;
  confidence: number;
}
export interface SignedClaimPayload {
  claim: Claim;
  castVersion: string;
  issuedAt: number;
}
export interface SignedClaim extends SignedClaimPayload { sig: string }
export type FailureReason =
  | 'offline' | 'timeout' | 'turnstile' | 'limit-visitor' | 'limit-global'
  | 'alerts' | 'budget' | 'model' | 'invalid' | 'ledger' | 'bad-signature' | 'unknown';
export type InterpretResult =
  | ({ ok: true } & SignedClaim)
  | { ok: true; unsupported: UnsupportedReason }
  | { ok: false; reason: FailureReason };

const castIds: readonly string[] = [
  'mira', 'tom', 'ben', 'ada', 'rosa', 'jonah', 'elin', 'pim', 'sol', 'greta',
  'ivo', 'nell', 'otto', 'wren', 'hal', 'dag', 'una', 'cass', 'fen', 'lio',
  'mab', 'rook', 'tess', 'yan', 'suri', 'oren', 'leela', 'tavi', 'edda', 'arun', 'bram', 'nia', 'vesa', 'cora', 'dara', 'silas',
];
// Keep in sync with apps/api/src/objects.ts: signed claims are already sanitised.
const reviewedObjects: readonly string[] = [
  'bread', 'loaf', 'flour', 'sack', 'tools', 'coins', 'letter', 'ring', 'wool', 'cloth',
  'honey', 'wheel', 'boat', 'fish', 'eggs', 'milk', 'candle', 'book', 'cart', 'key',
];

export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Match sign.ts, including non-enumerable/symbol additions and own required fields. */
export function fields(value: Record<string, unknown>, allowed: readonly string[], required: readonly string[]): boolean {
  return Reflect.ownKeys(value).every(key => typeof key === 'string' && allowed.includes(key)) &&
    required.every(key => Object.hasOwn(value, key));
}

export function isMetadata(value: Record<string, unknown>): boolean {
  return typeof value.castVersion === 'string' && value.castVersion.trim().length > 0 && value.castVersion.length <= 128 &&
    typeof value.issuedAt === 'number' && Number.isSafeInteger(value.issuedAt) && value.issuedAt >= 0;
}

/** Validate without rewriting any signed fields (including valence). */
export function isClaim(value: unknown): value is Claim {
  if (!record(value) || !fields(value,
    ['kind', 'about', 'target', 'object', 'severity', 'valence', 'confidence'],
    ['kind', 'about', 'severity', 'valence', 'confidence'])) return false;
  if (typeof value.kind !== 'string' || !(claimKinds as readonly string[]).includes(value.kind) ||
      typeof value.about !== 'string' || !castIds.includes(value.about) ||
      ![1, 2, 3].includes(value.severity as number) ||
      typeof value.confidence !== 'number' || !Number.isFinite(value.confidence) ||
      value.confidence < 0 || value.confidence > 1) return false;
  const favourable = ['kindness', 'paid-debt', 'nursed'].includes(value.kind);
  if (value.valence !== (favourable ? 1 : -1)) return false;
  if (Object.hasOwn(value, 'target') &&
      (typeof value.target !== 'string' || !castIds.includes(value.target) || value.target === value.about)) return false;
  if (Object.hasOwn(value, 'object') &&
      (typeof value.object !== 'string' || !reviewedObjects.includes(value.object))) return false;
  return true;
}

export function isPayload(value: unknown): value is SignedClaimPayload {
  return record(value) && fields(value, ['claim', 'castVersion', 'issuedAt', 'sig'], ['claim', 'castVersion', 'issuedAt']) &&
    isClaim(value.claim) && isMetadata(value);
}

export function apiBase(baseUrl: string): string {
  return baseUrl.replace(/\/+$/u, '');
}
