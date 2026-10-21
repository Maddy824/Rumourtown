import { afterEach, expect, it, vi } from 'vitest';
import { createRumorFlow } from './rumorFlow.js';
const meaning = { actor: null, affected: 'tom', valence: 0, severity: 3, question: 'Who saw what happened to Tom?' };
const setup = (body: unknown = meaning, status = 200) => {
  const getToken = vi.fn(async () => 'token'), fetcher = vi.fn(async () => Response.json(body, { status }));
  const flow = createRumorFlow({ baseUrl: 'https://test.invalid', turnstile: { getToken }, fetch: fetcher });
  return { flow, getToken, fetcher };
};
afterEach(() => vi.useRealTimers());
it('sends open events to semantic inference without rejecting death or rewriting text', async () => {
  const { flow, fetcher } = setup();
  expect(await flow.start('someone killed tom')).toMatchObject({ source: 'ai', meaning });
  expect(fetcher.mock.calls[0]).toMatchObject(['https://test.invalid/rumor', { body: JSON.stringify({ text: 'someone killed tom', turnstileToken: 'token' }) }]);
});
it.each([503, 429])('uses a neutral free fallback when inference is unavailable (%s)', async status => {
  expect(await setup({}, status).flow.start('The moon turned into cheese')).toMatchObject({ source: 'neutral', meaning: { actor: null, valence: 0 } });
});
it('rejects invented actors and never converts them into a replacement story', async () => {
  expect(await setup({ ...meaning, actor: 'rosa', affected: 'ada', valence: 1 }).flow.start('someone killed tom')).toMatchObject({ source: 'neutral' });
});
it('bounds a silent human check and keeps the story playable', async () => {
  vi.useFakeTimers();
  const flow = createRumorFlow({ baseUrl: 'https://test.invalid', turnstile: { getToken: () => new Promise(() => {}) } });
  const pending = flow.start('The stars fell into the river');
  await vi.advanceTimersByTimeAsync(12000);
  expect(await pending).toMatchObject({ source: 'neutral' });
});
it('shares only same-text in-flight operations and keeps different stories separate', async () => {
  const { flow, fetcher } = setup();
  const a = flow.start('someone killed tom'), b = flow.start('someone killed tom'), c = flow.start('Tom was killed');
  expect(a).toBe(b); expect(c).not.toBe(a);
  await Promise.all([a, b, c]); expect(fetcher).toHaveBeenCalledTimes(2);
});

it.each(['Tom was insulted by Mira', 'Tom was cheated by Mira', 'Tom was nursed by Mira'])('uses semantic inference instead of reversing passive roles: %s', async text => {
  const correct = { actor: 'mira', affected: 'tom', valence: text.includes('nursed') ? 1 : -1, severity: 2, question: '' };
  const { flow, fetcher } = setup(correct);
  expect(await flow.start(text)).toMatchObject({ source: 'ai', meaning: correct });
  expect(fetcher).toHaveBeenCalledTimes(1);
  const offline = createRumorFlow({ baseUrl: '', turnstile: { getToken: vi.fn() } });
  expect(await offline.start(text)).toMatchObject({ source: 'neutral', meaning: { actor: null, affected: null, valence: 0 } });
});
