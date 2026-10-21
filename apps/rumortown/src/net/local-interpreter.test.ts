import { describe, expect, it, vi } from 'vitest';
import { cast, castVersion } from '../content/cast/index.js';
import { interpretLocally } from './local-interpreter.js';
import { createWhisperFlow } from './whisperFlow.js';

const { readFileSync } = await vi.importActual<{ readFileSync(path: string, encoding: 'utf8'): string }>('node:fs');
const { gzipSync } = await vi.importActual<{ gzipSync(data: string): Uint8Array }>('node:zlib');

const interpret = (text: string) => interpretLocally(text, cast);
describe('local interpretation', () => {
  it.each(['someone killed tom', 'Someone killed Tom', 'Tom murdered Ada', 'Tom helped kill Ada', 'Tom is dead'])('does not force death into a reputation category: %s', text => {
    expect(interpret(text)).toEqual({ unsupported: 'unsupported-story', confidence: 1 });
  });
  it.each([
    ['MIRA stole Pim’s coins.', 'theft', 'mira', 'pim'],
    ['Mria stole bread.', 'theft', 'mira', undefined],
    ['Jona stole flour.', 'theft', 'jonah', undefined],
    ["mria stole jona's coins.", 'theft', 'mira', 'jonah'],
    ['the apprentice baker stole flour from the baker.', 'theft', 'wren', 'mira'],
    ["Sol's wife paid her debt to Pim in full.", 'paid-debt', 'greta', 'pim'],
    ["The farmer's wife stole coins.", undefined, undefined, undefined],
    ["the miller's wife stole Pim's coins.", undefined, undefined, undefined],
    ['the farmer stole bread.', undefined, undefined, undefined],
    ['Tom never stole bread.', undefined, undefined, undefined],
    ['Tom never broke his promise to Ada.', undefined, undefined, undefined],
    ["Tom didn't break his promise to Ada.", undefined, undefined, undefined],
    ['Tom is avoiding Ada.', undefined, undefined, undefined],
    ['Ben skips dinner.', undefined, undefined, undefined],
    ['Mira or Tom stole bread.', undefined, undefined, undefined],
    ['Tom broke his promise to Ada.', 'broken-promise', 'tom', 'ada'],
    ['Mira gave back stolen bread as a gift to Ada.', 'kindness', 'mira', 'ada'],
  ])('%s', (text, kind, about, target) => {
    const result = interpret(text);
    if (!kind) expect(result).not.toHaveProperty('claim');
    else {
      expect(result).toMatchObject({ claim: { kind, about }, confidence: .9 });
      expect('claim' in result ? result.claim.target : undefined).toBe(target);
    }
  });
  it('supports nicknames and explicit spouse links without changing the cast', () => {
    const people = [{ id: 'jo', name: 'Joseph', nicknames: ['Jojo'], role: 'baker', spouse: 'may' },
      { id: 'may', name: 'May', role: 'miller' }];
    expect(interpretLocally("Jojo's wife stole bread.", people)).toMatchObject({ claim: { about: 'may' } });
    expect(interpretLocally("the baker's wife stole bread.", people)).toMatchObject({ claim: { about: 'may' } });
  });
  it('marks weak and conflicting matches below the local acceptance threshold', () => {
    expect(interpret('Tom took bread.')).toMatchObject({ claim: { kind: 'theft' }, confidence: .7 });
    expect(interpret('Tom stole bread and lied to Ada.')).toMatchObject({ confidence: .5 });
  });
  it('sets intensity, valence and reviewed objects only, with stable evidence', () => {
    expect(interpret('Tom stole a little flour.')).toMatchObject({ claim: { severity: 1, object: 'flour', valence: -1 } });
    expect(interpret('Tom always nursed Ada.')).toMatchObject({ claim: { severity: 3, valence: 1 } });
    expect(interpret('Tom stole candlesticks.')).not.toHaveProperty('claim.object');
    expect(interpret('Tom stole bread.')).toEqual(interpret('Tom stole bread.'));
  });
  it.each(['Alice stole coins from Pim.', 'Taylor Swift lied to Jonah.', 'Mira stole coins from Alice.', 'Alice is happy.'])('rejects unknown named people: %s', text => {
    expect(interpret(text)).toMatchObject({ unsupported: 'not-about-cast' });
  });
  it.each(['Mira steals because of her ethnicity.', 'Mira is dishonest because she is a woman.', 'Tom masturbating.', 'Ben having sex.', 'Wren is inferior because of their gender identity.'])('blocks sensitive terms before classification: %s', text => {
    expect(interpret(text)).toHaveProperty('unsupported');
  });
});

describe('local whisper flow', () => {
  const setup = () => {
    const getToken = vi.fn(async () => 'token');
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ unsupported: 'unclear', castVersion, issuedAt: 1 }));
    const states: string[] = [];
    const flow = createWhisperFlow({ baseUrl: 'https://local-19.invalid', castVersion, turnstile: { getToken }, fetch: fetcher,
      onStateChange: state => states.push(state.status) });
    return { flow, getToken, fetcher, states };
  };
  it('confirms clear claims with no human check, signature metadata, or network', async () => {
    const { flow, getToken, fetcher, states } = setup();
    const result = await flow.start('Tom stole bread.');
    expect(result).toMatchObject({ ok: true, source: 'local', claim: { about: 'tom', kind: 'theft' } });
    expect(result).not.toHaveProperty('sig');
    expect(states).toEqual(['done']);
    expect(getToken).not.toHaveBeenCalled(); expect(fetcher).not.toHaveBeenCalled();
  });
  it('blocks local refusals without any remote request', async () => {
    const { flow, getToken, fetcher } = setup();
    expect(await flow.start('Mira having sex.')).toEqual({ ok: true, unsupported: 'sexual' });
    expect(getToken).not.toHaveBeenCalled(); expect(fetcher).not.toHaveBeenCalled();
  });
  it('sends weak matches and abstentions through the existing remote path', async () => {
    const { flow, getToken, fetcher, states } = setup();
    await flow.start('Tom took bread.'); await flow.start('I do not know.');
    expect(getToken).toHaveBeenCalledTimes(2); expect(fetcher).toHaveBeenCalledTimes(2);
    expect(states).toEqual(['checking', 'asking', 'resting', 'checking', 'asking', 'resting']);
  });
  it('keeps the full first human deadline after a local result', async () => {
    vi.useFakeTimers();
    try {
      const flow = createWhisperFlow({ baseUrl: 'https://local-19.invalid', castVersion,
        turnstile: { getToken: () => new Promise(() => undefined) } });
      await flow.start('Tom stole bread.');
      const pending = flow.start('Tom took bread.');
      await vi.advanceTimersByTimeAsync(11_999); expect(flow.state.status).toBe('checking');
      await vi.advanceTimersByTimeAsync(1); expect(await pending).toEqual({ ok: false, reason: 'turnstile' });
    } finally { vi.useRealTimers(); }
  });
});

it('evaluates all 200 offline whispers and prints the real routing and accuracy figures', () => {
  const items = JSON.parse(readFileSync('apps/api/evals/lies.json', 'utf8')) as {
    text: string; expect: { kind?: string; about?: string; unsupported?: string };
  }[];
  expect(items).toHaveLength(200);
  let scope = 0, answered = 0, correct = 0, accepted = 0, acceptedCorrect = 0, out = 0, abstained = 0, worker = 0;
  const durations: number[] = [];
  const inScopeFallbacks: string[] = [];
  for (const item of items) {
    const start = performance.now();
    const result = interpret(item.text);
    durations.push(performance.now() - start);
    if ('unsure' in result || 'claim' in result && result.confidence < .75) worker++;
    if (item.expect.unsupported) {
      out++; if (!('claim' in result)) abstained++;
      expect(result, item.text).not.toHaveProperty('claim');
    } else {
      scope++;
      if (!('claim' in result) || result.confidence < .75) inScopeFallbacks.push(item.text);
      if ('claim' in result) {
        answered++;
        const right = result.claim.kind === item.expect.kind && result.claim.about === item.expect.about;
        if (right) correct++;
        if (result.confidence >= .75) { accepted++; if (right) acceptedCorrect++; }
      }
    }
  }
  console.table([
    { metric: 'In-scope kind + about on all claims', count: `${correct}/${answered}`, percent: 100 * correct / answered },
    { metric: 'In-scope kind + about accepted locally', count: `${acceptedCorrect}/${accepted}`, percent: 100 * acceptedCorrect / accepted },
    { metric: 'In-scope coverage accepted locally', count: `${accepted}/${scope}`, percent: 100 * accepted / scope },
    { metric: 'Out-of-scope abstention (no claim)', count: `${abstained}/${out}`, percent: 100 * abstained / out },
    { metric: 'Needs Worker (unsure or confidence < .75)', count: `${worker}/${items.length}`, percent: 100 * worker / items.length },
  ]);
  console.log('In-scope Worker fallbacks:', inScopeFallbacks);
  durations.sort((a, b) => a - b);
  console.log(`Local timing (Node, 200-item pass): p50=${durations[99]!.toFixed(3)} ms, p95=${durations[189]!.toFixed(3)} ms, max=${durations[199]!.toFixed(3)} ms`);
  expect(correct / answered).toBeGreaterThanOrEqual(.75);
  expect(acceptedCorrect / accepted).toBeGreaterThanOrEqual(.75);
  expect(abstained).toBe(out);
  const lexiconBytes = gzipSync(readFileSync('apps/rumortown/src/net/local-lexicons.ts', 'utf8')).byteLength +
    gzipSync(readFileSync('apps/rumortown/src/net/blocklist.ts', 'utf8')).byteLength +
    gzipSync(readFileSync('apps/shared/moderation.ts', 'utf8')).byteLength;
  console.log(`Lexicons and blocklists: ${lexiconBytes} bytes gzip (source files summed)`);
  expect(lexiconBytes).toBeLessThan(12_000);
});
