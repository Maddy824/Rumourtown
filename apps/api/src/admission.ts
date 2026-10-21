import { hash } from './moderation';
import type { Env, FailureReason } from './types';

export class Failure extends Error {
  constructor(readonly reason: FailureReason, readonly status = 503, readonly retryAfter?: number) { super(reason); }
}

export const MAX_BODY_BYTES = 16_384;
export const BODY_TIMEOUT_MS = 5_000;

// These approximate, per-location limits protect upstream services. Money is
// still admitted atomically by the one global ledger, never by edge counters.
export async function admit(request: Request, env: Env): Promise<void> {
  if (env.AI_ENABLED !== 'true') throw new Failure('model');
  if (!env.EDGE_VISITOR_LIMIT || !env.EDGE_TOTAL_LIMIT) throw new Failure('limit-global');
  try {
    // There are no accounts yet. Shared networks may share this conservative
    // anonymous quota; it applies only to interpretation, never to playing.
    const key = await hash(request.headers.get('CF-Connecting-IP') ?? 'unknown');
    if (!(await env.EDGE_VISITOR_LIMIT.limit({ key })).success) throw new Failure('limit-visitor', 429, 60);
    if (!(await env.EDGE_TOTAL_LIMIT.limit({ key: 'interpret' })).success) throw new Failure('limit-global', 429, 60);
  } catch (error) {
    if (error instanceof Failure) throw error;
    throw new Failure('limit-global', 503, 60);
  }
}

export async function readInput(request: Request): Promise<unknown> {
  if (request.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') throw new Failure('invalid', 415);
  const encoding = request.headers.get('Content-Encoding');
  if (encoding && encoding !== 'identity') throw new Failure('invalid', 415);
  const length = request.headers.get('Content-Length');
  if (length !== null && (!/^\d+$/u.test(length) || Number(length) > MAX_BODY_BYTES)) throw new Failure('invalid', 413);
  if (!request.body) throw new Failure('invalid', 400);
  const reader = request.body.getReader();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Failure('invalid', 408));
      void reader.cancel().catch(() => {});
    }, BODY_TIMEOUT_MS);
  });
  try {
    // A fixed buffer also bounds allocation when Content-Length is absent or false.
    const bytes = new Uint8Array(MAX_BODY_BYTES);
    let size = 0;
    for (;;) {
      const { done, value } = await Promise.race([reader.read(), timeout]);
      if (done) break;
      if (size + value.byteLength > MAX_BODY_BYTES) throw new Failure('invalid', 413);
      bytes.set(value, size);
      size += value.byteLength;
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes.subarray(0, size))) as unknown;
  } catch (error) {
    void reader.cancel().catch(() => {});
    if (error instanceof Failure) throw error;
    throw new Failure('invalid', 400);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    reader.releaseLock();
  }
}
