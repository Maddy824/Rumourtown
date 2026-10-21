import type { Payload, SignedPayload } from './types';
import { record } from './types';
import { validate } from './validate';

function fields(value: Record<string, unknown>, allowed: readonly string[], required: readonly string[]): void {
  if (Reflect.ownKeys(value).some(key => typeof key !== 'string' || !allowed.includes(key)) ||
      required.some(key => !Object.hasOwn(value, key))) throw new Error('payload');
}

function fixedPayload(value: unknown, signature?: string): Payload {
  if (!record(value)) throw new Error('payload');
  const required = ['claim', 'castVersion', 'issuedAt'];
  // A response envelope may include sig only when it matches the explicit argument.
  fields(value, signature === undefined ? required : [...required, 'sig'], required);
  if (Object.hasOwn(value, 'sig') && value.sig !== signature) throw new Error('payload');
  if (typeof value.castVersion !== 'string' || !value.castVersion.trim() || value.castVersion.length > 128 ||
      typeof value.issuedAt !== 'number' || !Number.isSafeInteger(value.issuedAt) || value.issuedAt < 0 || !record(value.claim)) throw new Error('payload');
  fields(value.claim, ['kind', 'about', 'target', 'object', 'severity', 'valence', 'confidence'],
    ['kind', 'about', 'severity', 'valence', 'confidence']);
  const c = validate(value.claim);
  if (!c || 'unsupported' in c || c.valence !== value.claim.valence ||
      (Object.hasOwn(value.claim, 'object') && c.object !== value.claim.object)) throw new Error('payload');
  // Validation may sanitise model output; signed input must already be sanitised.
  // Every accepted data field appears exactly once below, in a fixed order.
  return {
    claim: { kind: c.kind, about: c.about, ...(c.target !== undefined ? { target: c.target } : {}),
      ...(c.object !== undefined ? { object: c.object } : {}), severity: c.severity, valence: c.valence, confidence: c.confidence },
    castVersion: value.castVersion, issuedAt: value.issuedAt,
  };
}

// Canonical order makes harmless property reordering independent of the signature.
export function serialise(payload: unknown): string {
  return JSON.stringify(fixedPayload(payload));
}
function base64url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}
function parsePrivate(secret: string): JsonWebKey {
  const key: JsonWebKey = JSON.parse(secret);
  if (key.kty !== 'EC' || key.crv !== 'P-256' || !key.d || !key.x || !key.y) throw new Error('signing-key');
  return key;
}
export function publicKey(secret: string): JsonWebKey {
  const { kty, crv, x, y } = parsePrivate(secret);
  return { kty, crv, x, y, ext: true, key_ops: ['verify'] };
}
export async function sign(payload: unknown, secret: string): Promise<SignedPayload> {
  const fixed = fixedPayload(payload);
  const key = await crypto.subtle.importKey('jwk', parsePrivate(secret), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(serialise(fixed)));
  return { ...fixed, sig: base64url(signature) };
}
export async function verify(payload: unknown, sig: string, jwk: JsonWebKey): Promise<boolean> {
  try {
    if (!/^[A-Za-z0-9_-]{86}$/u.test(sig) || jwk.kty !== 'EC' || jwk.crv !== 'P-256' || jwk.d) return false;
    const fixed = fixedPayload(payload, sig);
    const bytes = Uint8Array.from(atob(sig.replace(/-/g, '+').replace(/_/g, '/') + '=='), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, bytes, new TextEncoder().encode(serialise(fixed)));
  } catch { return false; }
}
