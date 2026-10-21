import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWorker } from '../src/index';
import { rumorPrompt, validateRumor } from '../src/rumor';
import { keys, makeEnv, memoryLedger, mockFetch, origin, provider } from './helpers';
const meaning = { actor: null, affected: 'tom', valence: 0, severity: 3, question: 'Who saw what happened to Tom?' };
const request = (text = 'someone killed tom', extra = {}) => new Request('https://api.test/rumor', {
  method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1', 'User-Agent': 'test' },
  body: JSON.stringify({ text, turnstileToken: 'test-token', ...extra }),
});
const stores: ReturnType<typeof memoryLedger>[] = [];
afterEach(() => { for (const store of stores.splice(0)) store.db.close(); });
async function setup(output: unknown = meaning, limits = {}) {
  const pair = await keys(), mock = mockFetch(provider(output)), store = memoryLedger(limits, mock.fetcher); stores.push(store);
  const run = vi.fn().mockResolvedValue({ response: output });
  return { worker: createWorker({ fetch: mock.fetcher }), env: makeEnv(store.namespace, pair.secret, { AI: { run }, ...limits }), store, mock, run };
}
describe('open rumor inference', () => {
  it('understands an event outside the old taxonomy under the existing ledger without caching prose', async () => {
    const { worker, env, store, run, mock } = await setup();
    expect(await (await worker.fetch(request(), env)).json()).toEqual(meaning);
    expect(run.mock.calls[0]![1]).toMatchObject({ temperature: .3, max_tokens: 120 });
    expect(JSON.parse(run.mock.calls[0]![1].messages[1].content)).toEqual({ story: 'someone killed tom' });
    expect(store.calls.map(c => c.method)).toEqual(['reserve', 'settle', 'usage']);
    expect(JSON.stringify(store.calls)).not.toContain('killed');
    expect(mock.calls.some(c => c.url.includes('completions'))).toBe(false);
    expect(rumorPrompt).toContain('OPEN ENDED');
  });
  it.each([
    ['The moon is made of cheese', { actor: null, affected: null, valence: 0, severity: 2, question: 'How would anyone check that?' }],
    ['Tom invented a machine that predicts rain', { actor: 'tom', affected: null, valence: 1, severity: 2, question: 'Has anyone tested it?' }],
    ['Tom was killed', meaning],
    ['Nobody knows whether the bridge is haunted', { actor: null, affected: null, valence: 0, severity: 2, question: 'What did people actually see?' }],
  ])('allows open topics without a category: %s', async (text, answer) => {
    const { worker, env } = await setup(answer);
    expect(await (await worker.fetch(request(text), env)).json()).toEqual(answer);
  });
  it.each([
    { ...meaning, actor: 'rosa', affected: 'ada', valence: 1 },
    { ...meaning, actor: 'tom', valence: -1 }, { ...meaning, valence: -1 },
    { ...meaning, question: 'Did Rosa see Ada do it?' }, { ...meaning, question: 'x'.repeat(73) },
    { ...meaning, severity: 99 }, { ...meaning, execute: 'kill' },
  ])('rejects invented people, victim blame or malformed output %#', output => {
    expect(validateRumor(output, 'someone killed tom')).toBeNull();
  });
  it('cannot pay a fallback beyond the shared budget', async () => {
    const { worker, env, run, mock, store } = await setup(meaning, { LIFETIME_ALLOWANCE_USD: '0' });
    run.mockResolvedValue({ error: 'quota' });
    expect(await (await worker.fetch(request(), env)).json()).toEqual({ reason: 'budget' });
    expect(mock.calls.some(c => c.url.includes('completions'))).toBe(false);
    expect(store.db.prepare('SELECT reserved, spent FROM days').all()).toEqual([{ reserved: 0, spent: 0 }]);
  });
  it('shares the same visitor quota with other inference routes', async () => {
    const { worker, env, run } = await setup(meaning, { PER_VISITOR_PER_HOUR: '1' });
    expect((await worker.fetch(request(), env)).status).toBe(200);
    expect((await worker.fetch(request('Tom was killed'), env)).status).toBe(429);
    expect(run).toHaveBeenCalledTimes(1);
  });
  it('rejects malformed input before model work and supports preflight', async () => {
    const { worker, env, run } = await setup();
    for (const text of ['', 'x'.repeat(101), 'hidden\ncommand']) expect((await worker.fetch(request(text), env)).status).toBe(400);
    expect(run).not.toHaveBeenCalled();
    expect((await worker.fetch(new Request('https://api.test/rumor', { method: 'OPTIONS', headers: { Origin: origin } }), env)).status).toBe(204);
  });
  it.each(['porn,Tom', 'Tom,sex', 'Tom said f.u.c.k', 'Tom said f\u200bu\u200bc\u200bk'])(
    'rejects blocked story prose before Turnstile, ledger or model: %s', async text => {
      const { worker, env, run, mock, store } = await setup();
      expect((await worker.fetch(request(text), env)).status).toBe(400);
      expect(run).not.toHaveBeenCalled();
      expect(mock.calls).toHaveLength(0);
      expect(store.calls).toHaveLength(0);
    });
  it('rejects blocked generated questions from both inference tiers and settles the paid attempt', async () => {
    const output = { ...meaning, question: 'porn,Tom?' };
    const { worker, env, store, run, mock } = await setup(output);
    expect(validateRumor(output, 'someone killed tom')).toBeNull();
    expect(await (await worker.fetch(request(), env)).json()).toEqual({ reason: 'invalid' });
    expect(run).toHaveBeenCalledTimes(1);
    expect(mock.calls.filter(c => c.url.includes('completions'))).toHaveLength(1);
    expect(store.calls.filter(c => c.method === 'settle')).toHaveLength(1);
    expect(store.calls.some(c => c.method === 'cachePut')).toBe(false);
  });
});
