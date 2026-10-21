import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createWorker } from '../src/index';
import { BODY_TIMEOUT_MS, MAX_BODY_BYTES } from '../src/admission';
import type { EdgeCache } from '../src/edge-cache';
import type { Env } from '../src/types';
import { interpretRequest, keys, makeEnv, memoryLedger, mockFetch, now, origin, visitor } from './helpers';

let key: Awaited<ReturnType<typeof keys>>;
beforeAll(async () => { key = await keys(); });
const stores: ReturnType<typeof memoryLedger>[] = [];
afterEach(() => { vi.useRealTimers(); for (const store of stores.splice(0)) store.db.close(); });
function setup(config: Partial<Env> = {}, cache?: EdgeCache) {
  const store = memoryLedger(config); stores.push(store);
  const mock = mockFetch();
  const env = makeEnv(store.namespace, key.secret, config);
  return { store, mock, env, worker: createWorker({ fetch: mock.fetcher, now: () => now, cache }) };
}
function memoryCache() {
  const rows = new Map<string, Response>();
  const cache: EdgeCache = {
    match: async input => rows.get(String(input))?.clone(),
    put: async (input, response) => { rows.set(String(input), response.clone()); },
  };
  return { rows, cache };
}
function streamRequest(chunks: Uint8Array[], headers: Record<string, string> = {}) {
  return new Request('https://api.test/interpret', {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...headers },
    body: new ReadableStream({ start(controller) { chunks.forEach(chunk => controller.enqueue(chunk)); controller.close(); } }),
    // Node's Request requires duplex; workerd accepts the standard stream body.
    ...{ duplex: 'half' },
  });
}

describe('traffic admission', () => {
  it('rejects a burst of 1000 disabled-AI requests without reading bodies, rate limits, storage or network', async () => {
    const limit = vi.fn(async () => ({ success: true }));
    const { worker, env, store, mock } = setup({ AI_ENABLED: 'false', EDGE_VISITOR_LIMIT: { limit } });
    const requests = Array.from({ length: 1000 }, () => interpretRequest());
    const responses = await Promise.all(requests.map(request => worker.fetch(request, env)));
    expect(responses.every(response => response.status === 503)).toBe(true);
    expect(requests.every(request => !request.bodyUsed)).toBe(true);
    expect(limit).not.toHaveBeenCalled();
    expect(store.calls).toHaveLength(0);
    expect(mock.calls).toHaveLength(0);
  });
  it.each(['EDGE_VISITOR_LIMIT', 'EDGE_TOTAL_LIMIT'] as const)('sheds denied traffic at %s before body reads and upstream work', async binding => {
    const { worker, env, store, mock } = setup({ [binding]: { limit: async () => ({ success: false }) } });
    const request = interpretRequest();
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('60');
    expect(response.headers.get('Access-Control-Expose-Headers')).toBe('Retry-After');
    expect(request.bodyUsed).toBe(false);
    expect(store.calls).toHaveLength(0);
    expect(mock.calls).toHaveLength(0);
  });
  it.each(['missing', 'error'] as const)('fails closed when admission is %s', async mode => {
    const { worker, env, store, mock } = setup({ EDGE_TOTAL_LIMIT: mode === 'missing' ? undefined : { limit: async () => { throw new Error('unavailable'); } } });
    expect((await worker.fetch(interpretRequest(), env)).status).toBe(503);
    expect(store.calls).toHaveLength(0);
    expect(mock.calls).toHaveLength(0);
  });
  it.each<Record<string, string>>([{}, { 'Content-Length': '1' }])('bounds streamed bodies with an absent or lying length: %j', async headers => {
    const { worker, env, store, mock } = setup();
    const response = await worker.fetch(streamRequest([new Uint8Array(10_000), new Uint8Array(10_000)], headers), env);
    expect(response.status).toBe(413);
    expect(mock.calls).toHaveLength(0);
    expect(store.calls).toHaveLength(0);
  });
  it('rejects an oversized declared length before consuming the stream', async () => {
    const { worker, env, mock } = setup();
    const request = streamRequest([], { 'Content-Length': String(MAX_BODY_BYTES + 1) });
    expect((await worker.fetch(request, env)).status).toBe(413);
    expect(request.bodyUsed).toBe(false);
    expect(mock.calls).toHaveLength(0);
  });
  it.each<Record<string, string>>([{ 'Content-Type': 'text/plain' }, { 'Content-Encoding': 'gzip' }])('rejects unsupported body format %j', async headers => {
    const { worker, env, mock } = setup();
    expect((await worker.fetch(interpretRequest(undefined, {}, headers), env)).status).toBe(415);
    expect(mock.calls).toHaveLength(0);
  });
  it('expires a stalled stream and cancels it without upstream work', async () => {
    vi.useFakeTimers();
    const { worker, env, mock } = setup();
    const cancel = vi.fn();
    const request = new Request('https://api.test/interpret', {
      method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: new ReadableStream({ cancel }), ...{ duplex: 'half' },
    });
    const response = worker.fetch(request, env);
    // Hashing uses native crypto; allow admission to complete before advancing.
    await vi.waitFor(() => expect(request.bodyUsed).toBe(true));
    await vi.advanceTimersByTimeAsync(BODY_TIMEOUT_MS + 1);
    expect((await response).status).toBe(408);
    expect(cancel).toHaveBeenCalledOnce();
    expect(mock.calls).toHaveLength(0);
  });
});

describe('cache and accounting under concurrency', () => {
  it('serves 500 warm edge hits without ledger reads, reservations, model calls or alerts', async () => {
    const { cache, rows } = memoryCache();
    const { worker, env, store, mock } = setup({}, cache);
    const first = await worker.fetch(interpretRequest(), env);
    const payload = await first.json();
    store.calls.length = 0; mock.calls.length = 0;
    const responses = await Promise.all(Array.from({ length: 500 }, () => worker.fetch(interpretRequest(), env)));
    expect(responses.every(response => response.status === 200 && response.headers.get('Cache-Control') === 'no-store')).toBe(true);
    expect(await responses[0]!.json()).toEqual(payload);
    expect(store.calls).toHaveLength(0);
    expect(mock.calls).toHaveLength(500);
    expect(mock.calls.every(call => call.url.includes('siteverify'))).toBe(true);
    expect(JSON.stringify([...rows.keys()])).not.toContain('Mira');
    expect(rows.size).toBe(1);
  });
  it('authenticates edge entries and still requires Turnstile', async () => {
    const { cache, rows } = memoryCache();
    const { worker, env, store, mock } = setup({}, cache);
    await worker.fetch(interpretRequest(), env);
    const [url, response] = [...rows.entries()][0]!;
    const bad = await response.json() as Record<string, unknown>;
    bad.issuedAt = 0;
    rows.set(url, Response.json(bad));
    store.calls.length = 0; mock.calls.length = 0;
    expect(await (await worker.fetch(interpretRequest(), env)).json()).toEqual({ reason: 'ledger' });
    expect(store.calls.filter(c => c.method !== 'usage')).toHaveLength(0);
    expect(mock.calls).toHaveLength(1);
    const blocked = createWorker({ cache, fetch: async () => Response.json({ success: false }) });
    expect(await (await blocked.fetch(interpretRequest(), env)).json()).toEqual({ reason: 'turnstile' });
  });
  it('isolates edge entries by cast version and survives cache errors', async () => {
    const { cache, rows } = memoryCache();
    const { worker, env, store } = setup({}, cache);
    await worker.fetch(interpretRequest(), env);
    const other = await worker.fetch(interpretRequest(undefined, { castVersion: 'v3' }), env);
    expect(await other.json()).toMatchObject({ castVersion: 'v3' });
    expect(rows.size).toBe(2);
    const failedCache: EdgeCache = { match: async () => { throw new Error(); }, put: async () => { throw new Error(); } };
    const fallback = createWorker({ cache: failedCache, fetch: mockFetch().fetcher });
    expect((await fallback.fetch(interpretRequest(), env)).status).toBe(200);
    expect(store.calls.filter(call => call.method === 'reserve')).toHaveLength(1);
  });
  it('never exceeds the money cap across 1000 concurrent reservation attempts', async () => {
    const { store } = setup({ DAILY_ALLOWANCE_USD: '.019', PER_VISITOR_PER_HOUR: '2000', GLOBAL_PER_MINUTE: '2000' });
    const attempts = await Promise.all(Array.from({ length: 1000 }, () => store.rpc('reserve', { visitorKey: visitor, now, worstCaseUsd: .001 })));
    expect(attempts.filter(value => value.ok)).toHaveLength(19);
    expect(attempts.filter(value => value.reason === 'budget')).toHaveLength(981);
    expect(store.db.prepare('SELECT reserved + spent AS total FROM days').all()).toEqual([{ total: 19_000_000_000 }]);
  });
  it('prunes transient history without refunding spent money or unresolved holds', async () => {
    const { store } = setup({ DAILY_ALLOWANCE_USD: '.1', LIFETIME_ALLOWANCE_USD: '.03' });
    const reserve = (time: number, amount: number) => store.rpc('reserve', { visitorKey: visitor, now: time, worstCaseUsd: amount });
    const settled = await reserve(now, .01);
    const held = await reserve(now, .02);
    await store.rpc('settle', { reservationId: settled.reservationId, actualUsd: .01 });
    expect(await reserve(now + 40 * 86_400_000, .001)).toEqual({ ok: false, reason: 'budget' });
    expect(store.db.prepare('SELECT * FROM visitors').all()).toHaveLength(0);
    expect(store.db.prepare('SELECT * FROM minutes').all()).toHaveLength(0);
    expect(store.db.prepare('SELECT id, status FROM reservations').all()).toEqual([{ id: held.reservationId, status: 'reserved' }]);
    expect(await store.rpc('release', { reservationId: settled.reservationId })).toEqual({ reason: 'ledger' });
    expect(store.db.prepare('SELECT reserved, spent FROM days').all()).toEqual([{ reserved: 20_000_000_000, spent: 10_000_000_000 }]);
    expect(await store.rpc('settle', { reservationId: held.reservationId, actualUsd: .02 })).toEqual({ ok: true });
    expect(await reserve(now + 41 * 86_400_000, .001)).toEqual({ ok: false, reason: 'budget' });
  });
  it('bounds durable cache growth to 2048 entries', async () => {
    const { store } = setup();
    for (let i = 0; i < 2100; i++) await store.rpc('cachePut', { hash: i.toString(16).padStart(64, '0'), payload: { sig: 'test' } });
    expect(store.db.prepare('SELECT COUNT(*) AS count FROM cache').all()).toEqual([{ count: 2048 }]);
    expect(await store.rpc('cacheGet', { hash: '0'.repeat(64) })).toEqual({ payload: null });
  });
});
