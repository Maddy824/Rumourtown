import { DatabaseSync } from 'node:sqlite';
import { BudgetLedger } from '../src/ledger';
import type { Env, Fetcher } from '../src/types';

// A DO storage stub backed by Node's in-memory SQLite: it executes production SQL,
// including actual UNIQUE constraints, ON CONFLICT updates and rollback semantics.
export function memoryLedger(config: Partial<Env> = {}) {
  const db = new DatabaseSync(':memory:');
  const sql = {
    exec(query: string, ...values: (string | number | null)[]) {
      const rows = db.prepare(query).all(...values);
      return { toArray: () => rows };
    },
  };
  const ctx = {
    storage: {
      sql,
      transactionSync<T>(action: () => T): T {
        db.exec('BEGIN IMMEDIATE');
        try { const result = action(); db.exec('COMMIT'); return result; }
        catch (error) { db.exec('ROLLBACK'); throw error; }
      },
    },
  } as unknown as DurableObjectState;
  const object = new BudgetLedger(ctx, config as Env);
  const calls: { method: string; body: Record<string, unknown> }[] = [];
  const fetcher = async (url: string, init?: RequestInit) => {
    const request = new Request(url, init);
    calls.push({ method: new URL(url).pathname.slice(1), body: await request.clone().json() as Record<string, unknown> });
    return object.fetch(request);
  };
  const namespace = {
    idFromName: (name: string) => name,
    get: () => ({ fetch: fetcher }),
  } as unknown as DurableObjectNamespace;
  return {
    db, calls, namespace,
    async rpc(method: string, body: unknown): Promise<Record<string, unknown>> {
      const response = await fetcher(`https://ledger/${method}`, { method: 'POST', body: JSON.stringify(body) });
      return await response.json() as Record<string, unknown>;
    },
  };
}

export const good = { kind: 'theft', about: 'mira', target: 'tom', object: 'bread', severity: 2, valence: -1, confidence: 0.9 } as const;
export const origin = 'https://rumortown.test';
export const now = Date.UTC(2026, 9, 21, 12);
export const visitor = 'a'.repeat(64);

export async function keys() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  if (!('privateKey' in pair)) throw new Error('keys');
  return {
    secret: JSON.stringify(await crypto.subtle.exportKey('jwk', pair.privateKey)),
    publicJwk: await crypto.subtle.exportKey('jwk', pair.publicKey) as JsonWebKey,
  };
}
export function makeEnv(namespace: DurableObjectNamespace, secret: string, config: Partial<Env> = {}): Env {
  return { LEDGER: namespace, ALLOWED_ORIGIN: origin, SIGNING_KEY_JWK: secret,
    EDGE_VISITOR_LIMIT: { limit: async () => ({ success: true }) }, EDGE_TOTAL_LIMIT: { limit: async () => ({ success: true }) },
    AI_ENABLED: 'true', USAGE_ALERT_URL: 'https://ntfy.sh/rumortown-test-topic-not-real-123456789', TURNSTILE_SECRET: 'test-turnstile', OPENROUTER_API_KEY: 'test-openrouter', ...config };
}
export function interpretRequest(text = 'Mira stole bread from Tom.', overrides: Record<string, unknown> = {}, headers: Record<string, string> = {}): Request {
  return new Request('https://api.test/interpret', {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1', 'User-Agent': 'test', ...headers },
    body: JSON.stringify({ text, turnstileToken: 'test-token', castVersion: 'v1', ...overrides }),
  });
}
export function provider(output: unknown = good, extras: Record<string, unknown> = {}) {
  return { model: 'google/gemini-2.5-flash-lite', usage: { prompt_tokens: 500, completion_tokens: 50 },
    choices: [{ message: { content: JSON.stringify(output) } }], ...extras };
}
export function mockFetch(modelResult: unknown = provider()) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.startsWith('https://ntfy.sh/')) return Response.json({ id: 'test-receipt', event: 'message' });
    if (url.includes('siteverify')) return Response.json({ success: true, hostname: 'rumortown.test' });
    return Response.json(modelResult);
  }) as Fetcher;
  return { fetcher, calls };
}
