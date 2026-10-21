import { afterEach, describe, expect, it, vi } from 'vitest';
import { DailyDigests } from '../src/digests';
import { createWorker } from '../src/index';
import type { Env, Fetcher } from '../src/types';
import { interpretRequest, keys, makeEnv, memoryLedger, mockFetch, now, visitor } from './helpers';

const url = 'https://ntfy.sh/private-test-topic-12345678901234567890';
const stores: ReturnType<typeof memoryLedger>[] = [];
function setup(fetcher: Fetcher = mockFetch().fetcher, config: Partial<Env> = { USAGE_ALERT_URL: url }) {
  const s = memoryLedger(config, fetcher); stores.push(s);
  const digest = new DailyDigests(s.ctx, config as Env, fetcher);
  return { s, digest };
}
afterEach(async () => { vi.useRealTimers(); for (const s of stores.splice(0)) { await s.drain(); s.db.close(); } });
const day = '2026-10-21';
const midnight = Date.UTC(2026, 9, 22);
async function spend(s: ReturnType<typeof memoryLedger>, time = now, actual = .00007) {
  const reserved = await s.rpc('reserve', { now: time, visitorKey: visitor, worstCaseUsd: .001 });
  expect(reserved.ok).toBe(true);
  await s.rpc('settle', { reservationId: reserved.reservationId, actualUsd: actual });
}

describe('daily usage digests', () => {
  it('counts Workers AI attempts and failures separately from OpenRouter and reports free-only days', async () => {
    const mock = mockFetch(); const { s, digest } = setup(mock.fetcher);
    await spend(s, now, 0);
    await s.rpc('usage', { now, dispatched: true, workersAi: true }); await s.drain();
    expect(String(mock.calls[0]?.init?.body)).toContain('Workers AI: 1 requests, 0 failures ($0 ledger cost). OpenRouter: 0 requests.');
    await s.rpc('usage', { now: now + 1, dispatched: true, workersAi: true, workersAiFailed: true, openRouter: true }); await s.drain();
    await digest.flush(midnight);
    expect(mock.calls).toHaveLength(2);
    expect(String(mock.calls[1]?.init?.body)).toContain('2 uncached model requests. Spend $0.000000');
    expect(String(mock.calls[1]?.init?.body)).toContain('Workers AI: 2 requests, 1 failures ($0 ledger cost). OpenRouter: 1 requests.');
    expect(String(mock.calls[1]?.init?.body)).toContain('Remaining daily $0.019000; lifetime $7.000000');
  });
  it('sends one first-request digest, then an end-of-day digest only when there was spend', async () => {
    const mock = mockFetch();
    const { s, digest } = setup(mock.fetcher);
    await spend(s);
    await s.rpc('usage', { now, dispatched: true, reason: 'unclear' }); await s.drain();
    expect(mock.calls).toHaveLength(1);
    expect(String(mock.calls[0]?.init?.body)).toContain(`${day}: 1 uncached model requests. Spend $0.000070`);
    expect(String(mock.calls[0]?.init?.body)).toContain('Remaining daily $0.018930; lifetime $6.999930');
    expect(String(mock.calls[0]?.init?.body)).toContain('unclear (1)');
    await spend(s);
    await s.rpc('usage', { now: now + 1, dispatched: true }); await s.drain();
    expect(mock.calls).toHaveLength(1);
    expect(s.alarms).toContain(midnight);
    await digest.flush(midnight);
    expect(mock.calls).toHaveLength(2);
    expect(String(mock.calls[1]?.init?.body)).toContain('2 uncached model requests. Spend $0.000140');
    await digest.flush(midnight);
    expect(mock.calls).toHaveLength(2);
  });
  it('sends the first digest for free requests but skips the zero-spend end digest', async () => {
    const mock = mockFetch(); const { s, digest } = setup(mock.fetcher);
    await spend(s, now, 0);
    await s.rpc('usage', { now, dispatched: true }); await s.drain();
    await digest.flush(midnight);
    expect(mock.calls).toHaveLength(1);
  });
  it('does not schedule or send when the optional URL is unset', async () => {
    const mock = mockFetch(); const { s, digest } = setup(mock.fetcher, {});
    await spend(s);
    await s.rpc('usage', { now, dispatched: true }); await s.drain();
    await digest.flush(midnight);
    expect(mock.calls).toHaveLength(0);
    expect(s.alarms).toHaveLength(0);
    expect(s.db.prepare('SELECT * FROM digest_jobs').all()).toEqual([]);
  });
  it('records a failed digest outside billing faults and retries it once the next UTC day', async () => {
    const offline = vi.fn(async () => { throw Error('offline'); }) as Fetcher;
    const { s, digest } = setup(offline);
    await s.rpc('usage', { now, dispatched: true }); await s.drain();
    expect(offline).toHaveBeenCalledTimes(1);
    expect(s.db.prepare('SELECT * FROM alert_faults').all()).toEqual([{ day, phase: 'first', attempt: 1 }]);
    expect(s.db.prepare('SELECT * FROM billing_faults').all()).toEqual([]);
    await digest.flush(midnight - 1); expect(offline).toHaveBeenCalledTimes(1);
    await digest.flush(midnight); expect(offline).toHaveBeenCalledTimes(2);
    await digest.flush(midnight + 86_400_000); expect(offline).toHaveBeenCalledTimes(2);
    expect((await s.rpc('reserve', { now: midnight, visitorKey: visitor, worstCaseUsd: 0 })).ok).toBe(true);
  });
  it('does not wait for a stalled digest to answer a successful interpret request', async () => {
    let finish!: (response: Response) => void;
    const delivery = new Promise<Response>(resolve => { finish = resolve; });
    const mock = mockFetch();
    const fetcher = (async (input, init) => String(input).startsWith('https://ntfy.sh/') ? delivery : mock.fetcher(input, init)) as Fetcher;
    const { s } = setup(fetcher);
    const key = await keys();
    const env = makeEnv(s.namespace, key.secret, { USAGE_ALERT_URL: url });
    const worker = createWorker({ now: () => now, fetch: fetcher });
    try {
      const response = await worker.fetch(interpretRequest(), env);
      expect(response.status).toBe(200);
      expect(mock.calls.some(c => c.url.includes('completions'))).toBe(true);
    } finally { finish(Response.json({ id: 'receipt', event: 'message' })); await s.drain(); }
  });
  it('uses a hard four-second deadline even if an ntfy fetch ignores cancellation', async () => {
    vi.useFakeTimers();
    const { s } = setup((async () => new Promise(() => {})) as Fetcher);
    await s.rpc('usage', { now, dispatched: true });
    await vi.advanceTimersByTimeAsync(4001); await s.drain();
    expect(s.db.prepare('SELECT COUNT(*) AS count FROM alert_faults').all()).toEqual([{ count: 1 }]);
  });
});
