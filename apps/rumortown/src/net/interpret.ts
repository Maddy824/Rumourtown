import { apiBase, fields, isMetadata, isPayload, record, unsupportedReasons, type InterpretResult } from './types.js';
import { fetchPublicKey, PublicKeyError, verifySignedClaim } from './verify.js';
export type { Claim, FailureReason, InterpretResult, SignedClaim, SignedClaimPayload, UnsupportedReason } from './types.js';

export interface InterpretOptions {
  baseUrl: string;
  turnstileToken: string;
  castVersion: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}
const workerReasons = ['turnstile', 'limit-visitor', 'limit-global', 'budget', 'model', 'invalid', 'ledger'] as const;

/** The deadline covers the response body and public-key verification as well as POST. */
export async function interpretWhisper(text: string, opts: InterpretOptions): Promise<InterpretResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const trimmed = Array.from(text.trim()).slice(0, 140).join('');
    if (!trimmed || !opts.castVersion.trim() || opts.castVersion.length > 128 ||
        !opts.turnstileToken.trim() || opts.turnstileToken.length > 2048 ||
        (opts.timeoutMs !== undefined && (!Number.isFinite(opts.timeoutMs) || opts.timeoutMs < 0))) {
      return { ok: false, reason: 'invalid' };
    }
    const controller = new AbortController();
    const fetcher = opts.fetch ?? globalThis.fetch;
    const deadline = new Promise<InterpretResult>(resolve => {
      timer = setTimeout(() => {
        resolve({ ok: false, reason: 'timeout' });
        controller.abort();
      }, opts.timeoutMs ?? 6_000);
    });
    const request = async (): Promise<InterpretResult> => {
      let response: Response;
      try {
        response = await fetcher(`${apiBase(opts.baseUrl)}/interpret`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
          body: JSON.stringify({ text: trimmed, turnstileToken: opts.turnstileToken, castVersion: opts.castVersion }),
        });
      } catch { return { ok: false, reason: controller.signal.aborted ? 'timeout' : 'offline' }; }
      let body: unknown;
      try { body = await response.json(); }
      catch { return { ok: false, reason: 'invalid' }; }
      if (!response.ok) {
        const reason = record(body) ? body.reason : undefined;
        return { ok: false, reason: typeof reason === 'string' && (workerReasons as readonly string[]).includes(reason)
          ? reason as typeof workerReasons[number] : 'unknown' };
      }
      if (!record(body)) return { ok: false, reason: 'invalid' };
      if (Object.hasOwn(body, 'unsupported')) {
        if (fields(body, ['unsupported', 'castVersion', 'issuedAt'], ['unsupported', 'castVersion', 'issuedAt']) &&
            isMetadata(body) && body.castVersion === opts.castVersion && typeof body.unsupported === 'string' &&
            (unsupportedReasons as readonly string[]).includes(body.unsupported)) {
          return { ok: true, unsupported: body.unsupported as typeof unsupportedReasons[number] };
        }
        return { ok: false, reason: 'invalid' };
      }
      if (!isPayload(body) ||
          body.castVersion !== opts.castVersion) return { ok: false, reason: 'invalid' };
      if (typeof body.sig !== 'string') return { ok: false, reason: 'bad-signature' };
      if (controller.signal.aborted) return { ok: false, reason: 'timeout' };
      try {
        const jwk = await fetchPublicKey(opts.baseUrl, (input, init) => fetcher(input, { ...init, signal: controller.signal }));
        if (controller.signal.aborted) return { ok: false, reason: 'timeout' };
        if (!await verifySignedClaim(body, body.sig, jwk)) return { ok: false, reason: 'bad-signature' };
      } catch (error) {
        return { ok: false, reason: error instanceof PublicKeyError ? error.reason : 'unknown' };
      }
      return { ok: true, claim: body.claim, castVersion: body.castVersion, issuedAt: body.issuedAt, sig: body.sig };
    };
    return await Promise.race([request(), deadline]);
  } catch { return { ok: false, reason: 'unknown' }; }
  finally { if (timer !== undefined) clearTimeout(timer); }
}
