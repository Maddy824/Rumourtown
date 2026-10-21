import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createWorker } from '../src/index';
import { systemPrompt } from '../src/prompt';
import { verify } from '../src/sign';
import type { Env, SignedPayload } from '../src/types';
import { schema } from '../src/validate';
import { DEFAULT_WORKERS_AI_MODEL } from '../src/workers-ai';
import { good, interpretRequest, keys, makeEnv, memoryLedger, mockFetch, now } from './helpers';

let key: Awaited<ReturnType<typeof keys>>;
beforeAll(async () => { key = await keys(); });
const stores: ReturnType<typeof memoryLedger>[] = [];
function setup(output: unknown = { response: good }, config: Partial<Env> = {}) {
  const s = memoryLedger(config); stores.push(s);
  const run = vi.fn(async (_model: string, _inputs: Record<string, unknown>, _options?: { signal?: AbortSignal }) => output);
  const env = makeEnv(s.namespace, key.secret, { AI: { run }, ...config });
  const mock = mockFetch();
  const worker = createWorker({ fetch: mock.fetcher, now: () => now });
  const pending: Promise<unknown>[] = [];
  const ctx = { waitUntil: (task: Promise<unknown>) => { pending.push(task); } };
  async function drain() { while (pending.length) await Promise.all(pending.splice(0)); await s.drain(); }
  return { s, run, env, mock, worker, ctx, drain };
}
afterEach(async () => {
  vi.useRealTimers();
  for (const s of stores.splice(0)) { await s.drain(); s.db.close(); }
});

describe('Workers AI first remote tier', () => {
  it.each([good, JSON.stringify(good)])('signs and caches valid output, holds zero dollars and skips OpenRouter (%#)', async output => {
    const { worker, env, mock, s, run, ctx, drain } = setup({ response: output });
    const response = await worker.fetch(interpretRequest(), env, ctx);
    expect(response.status).toBe(200);
    const payload = await response.json() as SignedPayload;
    expect(payload.claim).toEqual(good);
    expect(await verify(payload, payload.sig, key.publicJwk)).toBe(true);
    await drain();
    expect(run).toHaveBeenCalledExactlyOnceWith(DEFAULT_WORKERS_AI_MODEL, {
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: JSON.stringify({ whisper: 'Mira stole bread from Tom.' }) }],
      response_format: { type: 'json_schema', json_schema: schema }, temperature: 0, max_tokens: 120,
    }, { signal: expect.any(AbortSignal) });
    expect(mock.calls.filter(c => c.url.includes('completions'))).toHaveLength(0);
    expect(s.calls.find(c => c.method === 'reserve')?.body.worstCaseUsd).toBe(0);
    expect(s.calls.find(c => c.method === 'settle')?.body.actualUsd).toBe(0);
    expect(s.db.prepare('SELECT reserved, spent FROM days').all()).toEqual([{ reserved: 0, spent: 0 }]);
    expect(s.db.prepare('SELECT provider, requests, failures FROM provider_counts').all()).toEqual([{ provider: 'workers-ai', requests: 1, failures: 0 }]);
    expect(await (await worker.fetch(interpretRequest(), env, ctx)).json()).toEqual(payload);
    await drain();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('accepts the configured 70B alternative without an OpenRouter key or model configuration', async () => {
    const model = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
    const { worker, env, run } = setup(undefined, { WORKERS_AI_MODEL: model, OPENROUTER_API_KEY: '', MODELS: 'unpriced' });
    expect((await worker.fetch(interpretRequest(), env)).status).toBe(200);
    expect(run.mock.calls[0]?.[0]).toBe(model);
  });

  it.each([
    { response: 'not json' }, { response: { ...good, about: 'outsider' } },
    { response: { ...good, extra: 'narrative' } }, { response: { unsupported: 'arbitrary' } },
    { response: null }, { error: 'quota exceeded' }, { success: false, response: good },
    { status: 429, response: good }, { errors: [{ code: 429 }], response: good },
  ])('falls through invalid/error output to the existing OpenRouter chain (%#)', async output => {
    const { worker, env, s, mock } = setup(output, { PER_VISITOR_PER_HOUR: '1', GLOBAL_PER_MINUTE: '1' });
    const response = await worker.fetch(interpretRequest(), env);
    expect(response.status).toBe(200);
    expect((await response.json() as SignedPayload).claim).toEqual(good);
    expect(s.calls.filter(c => c.method === 'reserve')).toHaveLength(1);
    expect(s.calls.map(c => c.method)).toEqual(['cacheGet', 'reserve', 'fund', 'settle', 'cachePut', 'usage']);
    expect(s.calls.find(c => c.method === 'reserve')?.body.worstCaseUsd).toBe(0);
    expect(Number(s.calls.find(c => c.method === 'fund')?.body.worstCaseUsd)).toBeGreaterThan(0);
    const body = JSON.parse(String(mock.calls.find(c => c.url.includes('completions'))?.init?.body));
    expect(body.models).toEqual(['meta-llama/llama-3.3-70b-instruct:free', 'google/gemini-2.5-flash-lite']);
    expect(body.response_format.json_schema.schema).toEqual(schema);
    expect(body).toMatchObject({ temperature: 0, max_tokens: 120, provider: { require_parameters: true, max_price: { prompt: .1, completion: .4, request: 0 } } });
    expect(s.db.prepare('SELECT count FROM usage_days').all()).toEqual([{ count: 1 }]);
    expect(s.db.prepare('SELECT provider, requests, failures FROM provider_counts ORDER BY provider').all()).toEqual([
      { provider: 'openrouter', requests: 1, failures: 0 }, { provider: 'workers-ai', requests: 1, failures: 1 },
    ]);
  });

  it('falls through a thrown free-allocation quota error without retries', async () => {
    const { worker, env, run, mock } = setup();
    run.mockRejectedValue(new Error('quota exceeded'));
    expect((await worker.fetch(interpretRequest(), env)).status).toBe(200);
    expect(run).toHaveBeenCalledTimes(1);
    expect(mock.calls.filter(c => c.url.includes('completions'))).toHaveLength(1);
  });

  it('allows a valid free result when both paid allowances are zero', async () => {
    const { worker, env, mock } = setup(undefined, { DAILY_ALLOWANCE_USD: '0', LIFETIME_ALLOWANCE_USD: '0' });
    expect((await worker.fetch(interpretRequest(), env)).status).toBe(200);
    expect(mock.calls.some(c => c.url.includes('completions'))).toBe(false);
  });

  it('retains a funded hold if its acknowledgement is lost and never dispatches OpenRouter', async () => {
    const { worker, env, s, mock } = setup({ error: 'quota' });
    const original = env.LEDGER;
    env.LEDGER = {
      idFromName: (name: string) => original.idFromName(name),
      get: (id: DurableObjectId) => ({ fetch: async (url: string, init: RequestInit) => {
        const response = await original.get(id).fetch(url, init);
        if (url.endsWith('/fund')) throw Error('lost acknowledgement');
        return response;
      } }),
    } as unknown as DurableObjectNamespace;
    expect(await (await worker.fetch(interpretRequest(), env)).json()).toEqual({ reason: 'ledger' });
    expect(mock.calls.some(c => c.url.includes('completions'))).toBe(false);
    expect(Number(s.db.prepare('SELECT reserved FROM days').all()[0]?.reserved)).toBeGreaterThan(0);
    expect(s.calls.some(c => c.method === 'release')).toBe(false);
  });

  it('falls through at six seconds even when the binding ignores cancellation', async () => {
    const { worker, env, run, mock, s } = setup();
    vi.useFakeTimers();
    let started!: () => void;
    const running = new Promise<void>(resolve => { started = resolve; });
    let complete!: (output: unknown) => void;
    run.mockImplementation(() => { started(); return new Promise(resolve => { complete = resolve; }); });
    const pending = worker.fetch(interpretRequest(), env);
    await running;
    await vi.advanceTimersByTimeAsync(5_999);
    expect(mock.calls.filter(c => c.url.includes('completions'))).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect((await pending).status).toBe(200);
    expect(run.mock.calls[0]?.[2]?.signal?.aborted).toBe(true);
    complete({ response: good });
    await Promise.resolve();
    expect(mock.calls.filter(c => c.url.includes('completions'))).toHaveLength(1);
    expect(s.calls.filter(c => c.method === 'settle')).toHaveLength(1);
  });

  it.each(['unclear', 'not-about-cast'])('returns a valid refusal without paid fallback: %s', async unsupported => {
    const { worker, env, mock, s } = setup({ response: { unsupported } });
    expect(await (await worker.fetch(interpretRequest(), env)).json()).toEqual({ unsupported, castVersion: 'v1', issuedAt: now });
    expect(mock.calls.filter(c => c.url.includes('completions'))).toHaveLength(0);
    expect(s.calls.some(c => c.method === 'cachePut')).toBe(false);
    expect(s.db.prepare('SELECT failures FROM provider_counts').all()).toEqual([{ failures: 0 }]);
  });

  it.each([{ AI_ENABLED: 'false' }, { PER_VISITOR_PER_HOUR: '0' }, { GLOBAL_PER_MINUTE: '0' }, { DAILY_ALLOWANCE_USD: 'NaN' }])(
    'retains admission and ledger gates before Workers AI (%#)', async config => {
      const { worker, env, run, mock } = setup(undefined, config);
      expect((await worker.fetch(interpretRequest(), env)).status).not.toBe(200);
      expect(run).not.toHaveBeenCalled();
      expect(mock.calls.some(c => c.url.includes('completions'))).toBe(false);
    });

  it('fails closed on unavailable ledger before Workers AI dispatch', async () => {
    const { worker, env, run } = setup();
    env.LEDGER = { idFromName: () => { throw Error('storage'); } } as unknown as DurableObjectNamespace;
    expect(await (await worker.fetch(interpretRequest(), env)).json()).toEqual({ reason: 'ledger' });
    expect(run).not.toHaveBeenCalled();
  });

  it.each(['DAILY_ALLOWANCE_USD', 'LIFETIME_ALLOWANCE_USD'])('does not spend beyond %s when falling back', async limit => {
    const { worker, env, mock, s } = setup({ error: 'quota' }, { [limit]: '0' });
    expect(await (await worker.fetch(interpretRequest(), env)).json()).toEqual({ reason: 'budget' });
    expect(mock.calls.filter(c => c.url.includes('completions'))).toHaveLength(0);
    expect(s.db.prepare('SELECT reserved, spent FROM days').all()).toEqual([{ reserved: 0, spent: 0 }]);
  });

  it.each([false, true])('answers before stalled settlement finishes (fallback: %s)', async fallback => {
    const { worker, env, s, ctx, drain } = setup(fallback ? { error: 'quota' } : undefined);
    const original = env.LEDGER;
    let resume!: () => void;
    const gate = new Promise<void>(resolve => { resume = resolve; });
    env.LEDGER = {
      idFromName: (name: string) => original.idFromName(name),
      get: (id: DurableObjectId) => ({ fetch: async (url: string, init: RequestInit) => {
        if (url.endsWith('/settle')) await gate;
        return original.get(id).fetch(url, init);
      } }),
    } as unknown as DurableObjectNamespace;
    try {
      const response = await worker.fetch(interpretRequest(), env, ctx);
      expect(response.status).toBe(200);
      expect(s.db.prepare('SELECT status FROM reservations').all()).toEqual([{ status: 'reserved' }]);
      expect(s.calls.some(c => c.method === 'usage')).toBe(false);
    } finally { resume(); await drain(); }
    expect(s.db.prepare('SELECT status FROM reservations').all()).toEqual([{ status: 'settled' }]);
    expect(s.calls.some(c => c.method === 'usage')).toBe(true);
  });

  it('leaves a paid hold intact after background settlement fails', async () => {
    const { worker, env, s, ctx, drain } = setup({ error: 'quota' });
    const original = env.LEDGER;
    env.LEDGER = {
      idFromName: (name: string) => original.idFromName(name),
      get: (id: DurableObjectId) => ({ fetch: async (url: string, init: RequestInit) => {
        if (url.endsWith('/settle')) throw Error('storage');
        return original.get(id).fetch(url, init);
      } }),
    } as unknown as DurableObjectNamespace;
    expect((await worker.fetch(interpretRequest(), env, ctx)).status).toBe(200);
    await drain();
    const held = Number(s.db.prepare('SELECT reserved FROM days').all()[0]?.reserved);
    expect(held).toBeGreaterThan(0);
    expect(s.db.prepare('SELECT status FROM reservations').all()).toEqual([{ status: 'reserved' }]);
    expect(s.calls.some(c => c.method === 'release')).toBe(false);
  });

  it('records stubbed request latency for both remote paths', async () => {
    for (const fallback of [false, true]) {
      const { worker, env, ctx, drain } = setup(fallback ? { error: 'quota' } : undefined, { PER_VISITOR_PER_HOUR: '100', GLOBAL_PER_MINUTE: '100' });
      const samples: number[] = [];
      for (let i = 0; i < 30; i++) {
        const start = performance.now();
        const response = await worker.fetch(interpretRequest(`Mira stole bread from Tom ${i}`), env, ctx);
        await response.json();
        samples.push(performance.now() - start);
        expect(response.status).toBe(200);
        await drain();
      }
      samples.sort((a, b) => a - b);
      console.log(`19b ${fallback ? 'OpenRouter fallback' : 'Workers AI'} stubbed Worker response, n=30: p50=${samples[14]!.toFixed(2)} ms, p95=${samples[28]!.toFixed(2)} ms`);
    }
  });
});
