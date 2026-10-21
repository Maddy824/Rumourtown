import { apiBase, isPayload, type SignedClaimPayload } from './types.js';

const publicKeys = new Map<string, JsonWebKey>();
const pendingKeys = new Map<string, Promise<JsonWebKey>>();

export class PublicKeyError extends Error {
  constructor(readonly reason: 'offline' | 'unknown' | 'bad-signature' | 'timeout') { super(reason); }
}

/** Successful keys are cached for the page lifetime; failed requests are not. */
export async function fetchPublicKey(baseUrl: string, fetcher: typeof fetch = globalThis.fetch): Promise<JsonWebKey> {
  const base = apiBase(baseUrl);
  const cached = publicKeys.get(base);
  if (cached) return { ...cached, key_ops: ['verify'] };
  let pending = pendingKeys.get(base);
  if (!pending) {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { reject(new PublicKeyError('timeout')); controller.abort(); }, 6_000);
    });
    const request = async (): Promise<JsonWebKey> => {
      let response: Response;
      try { response = await fetcher(`${base}/pubkey`, { method: 'GET', signal: controller.signal }); }
      catch { throw new PublicKeyError('offline'); }
      if (!response.ok) throw new PublicKeyError('unknown');
      let jwk: JsonWebKey;
      try {
        jwk = await response.json() as JsonWebKey;
        if (!jwk || jwk.kty !== 'EC' || jwk.crv !== 'P-256' || jwk.d ||
            typeof jwk.x !== 'string' || typeof jwk.y !== 'string') throw new Error('key');
        // Reject malformed keys before caching them. Cache only the public coordinates.
        jwk = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, ext: true, key_ops: ['verify'] };
        await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      } catch { throw new PublicKeyError('bad-signature'); }
      if (controller.signal.aborted) throw new PublicKeyError('timeout');
      publicKeys.set(base, jwk);
      return jwk;
    };
    pending = Promise.race([request(), deadline]).finally(() => {
      clearTimeout(timer);
      pendingKeys.delete(base);
    });
    pendingKeys.set(base, pending);
  }
  return { ...await pending, key_ops: ['verify'] };
}

/** Keep this property order byte-for-byte identical to apps/api/src/sign.ts. */
function serialise(payload: SignedClaimPayload): string {
  const c = payload.claim;
  return JSON.stringify({
    claim: { kind: c.kind, about: c.about, ...(c.target !== undefined ? { target: c.target } : {}),
      ...(c.object !== undefined ? { object: c.object } : {}), severity: c.severity, valence: c.valence, confidence: c.confidence },
    castVersion: payload.castVersion, issuedAt: payload.issuedAt,
  });
}

export async function verifySignedClaim(payload: unknown, sig: string, jwk: JsonWebKey): Promise<boolean> {
  try {
    if (!/^[A-Za-z0-9_-]{86}$/u.test(sig) || jwk.kty !== 'EC' || jwk.crv !== 'P-256' || jwk.d) return false;
    // Authenticate the complete envelope before projecting it into canonical order.
    if (!isPayload(payload) || (Object.hasOwn(payload, 'sig') && (payload as SignedClaimPayload & { sig: unknown }).sig !== sig)) return false;
    const data = new TextEncoder().encode(serialise(payload));
    const bytes = Uint8Array.from(atob(sig.replace(/-/g, '+').replace(/_/g, '/') + '=='), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, bytes, data);
  } catch { return false; }
}
