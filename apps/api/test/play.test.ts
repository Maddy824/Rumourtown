import { describe, expect, it, vi } from 'vitest';
import { createWorker } from '../src/index';
import { playPrompt, readPlayContext, validatePlay, type PlayContext } from '../src/play';
import { keys, makeEnv, memoryLedger, mockFetch, origin, provider } from './helpers';
const context: PlayContext = { speaker: 'mira', nearby: [{ id: 'mira', activity: 'work', mood: -.2 }],
  places: [{ id: 'square', name: 'Village square' }], voice: 'Mira counts her trays and worries about the bakery.', history: [] };
const reply = { reply: 'What do you mean? Tell me what happened before you frighten the whole bakery.', action: 'none', target: '' };
const request = (text = 'kill', extra: Record<string, unknown> = {}) => new Request('https://api.test/play', {
  method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1', 'User-Agent': 'test' },
  body: JSON.stringify({ text, context, turnstileToken: 'test-token', ...extra }),
});
async function setup(output: unknown = reply, limits = {}) {
  const pair = await keys(), mock = mockFetch(provider(output)), store = memoryLedger(limits, mock.fetcher);
  const run = vi.fn().mockResolvedValue({ response: output });
  const env = makeEnv(store.namespace, pair.secret, { AI: { run }, ...limits });
  return { worker: createWorker({ fetch: mock.fetcher }), env, store, mock, run };
}
describe('creative conversation and bounded action proposals', () => {
  it('sends the actual ambiguous words and context to AI without a rumor matcher or prose cache', async () => {
    const { worker, env, store, run, mock } = await setup();
    const response = await worker.fetch(request(), env);
    expect(response.status).toBe(200); expect(await response.json()).toEqual(reply);
    const sent = run.mock.calls[0]![1];
    expect(sent).toMatchObject({ temperature: .7, max_tokens: 120 });
    expect(JSON.parse(sent.messages[1].content)).toEqual({ text: 'kill', context });
    expect(store.calls.map(c => c.method)).toEqual(['reserve', 'settle', 'usage']);
    expect(JSON.stringify(store.calls)).not.toContain('bakery');
    expect(mock.calls.some(c => c.url.includes('completions'))).toBe(false);
    expect(playPrompt).toContain('Ambiguous commands need a question');
  });
  it('accepts a listed movement proposal without claiming the action executed', async () => {
    const answer = { reply: 'The square is a good place to hear the news.', action: 'move', target: 'square' };
    const { worker, env } = await setup(answer);
    expect(await (await worker.fetch(request('Take me to the square'), env)).json()).toEqual(answer);
  });
  it.each([
    { ...reply, action: 'kill', target: 'tom' }, { ...reply, action: 'move', target: 'moon' },
    { ...reply, action: 'approach', target: 'outsider' }, { ...reply, action: 'none', target: 'tom' },
    { ...reply, reply: 'x'.repeat(241) }, { ...reply, extra: 'execute' },
  ])('rejects an unknown action, invalid target or malformed response (%#)', async output => {
    const { worker, env, store } = await setup(output);
    expect(await (await worker.fetch(request(), env)).json()).toEqual({ reason: 'invalid' });
    expect(store.calls.filter(c => c.method === 'settle')).toHaveLength(1);
  });
  it('never pays a fallback when the lifetime allowance is exhausted', async () => {
    const { worker, env, run, mock, store } = await setup(reply, { LIFETIME_ALLOWANCE_USD: '0' });
    run.mockResolvedValue({ error: 'quota' });
    expect(await (await worker.fetch(request(), env)).json()).toEqual({ reason: 'budget' });
    expect(mock.calls.some(c => c.url.includes('completions'))).toBe(false);
    expect(store.db.prepare('SELECT reserved, spent FROM days').all()).toEqual([{ reserved: 0, spent: 0 }]);
  });
  it('counts conversation and interpretation against the same visitor quota', async () => {
    const { worker, env, run } = await setup(reply, { PER_VISITOR_PER_HOUR: '1' });
    expect((await worker.fetch(request(), env)).status).toBe(200);
    expect((await worker.fetch(request('Why are you worried?'), env)).status).toBe(429);
    expect(run).toHaveBeenCalledTimes(1);
  });
  it('rejects forged speakers, oversized history and malformed context before inference', async () => {
    const { worker, env, run } = await setup();
    for (const changed of [{ speaker: 'tom' }, { history: Array(4).fill({ you: 'hi', reply: 'hello' }) }, { voice: 'x'.repeat(701) }, { nearby: [{ id: 'mira', mood: 99, activity: 'work' }] }]) {
      expect((await worker.fetch(request('hello', { context: { ...context, ...changed } }), env)).status).toBe(400);
    }
    expect(run).not.toHaveBeenCalled();
  });
  it('validates only documented action shapes', () => {
    expect(validatePlay(reply, context)).toEqual(reply);
    expect(validatePlay({ ...reply, action: 'none', target: 'mira' }, context)).toBeNull();
    expect(readPlayContext(context)).toEqual(context);
  });
});
