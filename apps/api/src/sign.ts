import type { Payload, SignedPayload } from './types';

// Explicit order makes signatures independent of object insertion order in callers.
export function serialise(payload: Payload): string {
  const c = payload.claim;
  return JSON.stringify({
    claim: { kind: c.kind, about: c.about, ...(c.target !== undefined ? { target: c.target } : {}),
      ...(c.object !== undefined ? { object: c.object } : {}), severity: c.severity, valence: c.valence, confidence: c.confidence },
    castVersion: payload.castVersion, issuedAt: payload.issuedAt,
  });
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
export async function sign(payload: Payload, secret: string): Promise<SignedPayload> {
  const key = await crypto.subtle.importKey('jwk', parsePrivate(secret), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(serialise(payload)));
  return { ...payload, sig: base64url(signature) };
}
export async function verify(payload: Payload, sig: string, jwk: JsonWebKey): Promise<boolean> {
  try {
    if (!/^[A-Za-z0-9_-]{86}$/u.test(sig) || jwk.kty !== 'EC' || jwk.crv !== 'P-256' || jwk.d) return false;
    const bytes = Uint8Array.from(atob(sig.replace(/-/g, '+').replace(/_/g, '/') + '=='), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, bytes, new TextEncoder().encode(serialise(payload)));
  } catch { return false; }
}
