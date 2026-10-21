import type { SignedPayload } from './types';

export type EdgeCache = Pick<Cache, 'match' | 'put'>;

// The browser response remains no-store. This internal cache contains only
// signed, structured claims, never tokens, IPs, prose or provider credentials.
export function claimCache(cache: EdgeCache | undefined, request: Request, key: string) {
  const url = new URL(`/__claims/v1/${key}`, request.url).href;
  return {
    async get(): Promise<unknown> {
      try { return await (await cache?.match(url))?.json() ?? null; }
      catch { return null; } // Cache availability must not control correctness.
    },
    async put(payload: SignedPayload): Promise<void> {
      try {
        await cache?.put(url, Response.json(payload, { headers: { 'Cache-Control': 'public, max-age=3600' } }));
      } catch { /* The durable signed cache remains the fallback. */ }
    },
  };
}
