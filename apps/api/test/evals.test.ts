import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { groups, injectionIndices, parseCorpus } from '../evals/corpus';
import { createPoster, parseOptions } from '../evals/run';
import { isInterpretation, kinds, markdown, runEvaluation, scoreCase, summarize } from '../evals/scorer';
import type { EvalItem, Expected, Posted } from '../evals/scorer';

const theft: EvalItem = { text: "Mira stole Pim's coins.", expect: { kind: 'theft', about: 'mira', target: 'pim' } };
const boasting: EvalItem = { text: 'Ivo boasts about his skill.', expect: { kind: 'boasting', about: 'ivo' } };
const outside: EvalItem = { text: 'Purple spoons sing.', expect: { unsupported: 'not-about-cast' } };
function response(expected: Expected, latencyMs = 10, cost?: number): Posted {
  return {
    status: 200, latencyMs,
    body: {
      claim: 'unsupported' in expected ? expected : {
        ...expected, severity: 2, valence: ['kindness', 'paid-debt', 'nursed'].includes(expected.kind) ? 1 : -1, confidence: 0.95,
      },
      castVersion: 'v1', issuedAt: 1_792_540_800_000, sig: 'stub_signature',
      ...(cost === undefined ? {} : { usage: { cost } }),
    },
  };
}
function withClaim(changes: Record<string, unknown>): Posted {
  const posted = response(theft.expect);
  const body = posted.body as Record<string, unknown>;
  return { ...posted, body: { ...body, claim: { ...(body.claim as object), ...changes } } };
}

describe('eval corpus', () => {
  it('has 200 unique valid requests, 13 per kind, 25 scope rejects, 10 ambiguous and 21 injections', async () => {
    const items = parseCorpus(JSON.parse(await readFile(new URL('../evals/lies.json', import.meta.url), 'utf8')));
    for (const kind of kinds) expect(items.filter(row => 'kind' in row.expect && row.expect.kind === kind)).toHaveLength(13);
    expect(items.filter(row => 'kind' in row.expect)).toHaveLength(156);
    expect(items.filter(row => 'unsupported' in row.expect)).toHaveLength(44);
    for (const group of groups.slice(1, 6)) {
      expect(items.slice(group.start, group.end)).toHaveLength(5);
      for (const item of items.slice(group.start, group.end)) {
        expect(item.expect).toEqual({ unsupported: group.category === 'nonsense / out-of-domain' ? 'not-about-cast' : group.category });
      }
    }
    expect(items.slice(169, 179).every(item => 'unsupported' in item.expect && item.expect.unsupported === 'unclear')).toBe(true);
    expect(injectionIndices).toHaveLength(21);
    expect(injectionIndices.every(index => /ignore|instruction|system|disregard|output|override|admin/i.test(items[index]!.text))).toBe(true);
    const all = await runEvaluation(items, async item => response(item.expect), injectionIndices);
    expect(all.schema).toEqual({ correct: 200, total: 200 });
    expect(all.taxonomy).toEqual({ correct: 156, total: 156 });
    expect(all.abstention).toEqual({ correct: 44, total: 44 });
    expect(all.injection).toEqual({ correct: 21, total: 21 });
    expect(all.passed).toBe(true);
  });

  it('rejects corrupt fixture identities and unsupported reasons', async () => {
    const raw: unknown[] = JSON.parse(await readFile(new URL('../evals/lies.json', import.meta.url), 'utf8'));
    expect(() => parseCorpus(raw.slice(1))).toThrow('200');
    const replace = (value: unknown) => [value, ...raw.slice(1)];
    expect(() => parseCorpus(replace({ text: 'A new sentence.', expect: { kind: 'theft', about: 'outsider' } }))).toThrow();
    expect(() => parseCorpus(replace({ text: 'A new sentence.', expect: { unsupported: 'fine' } }))).toThrow();
    expect(() => parseCorpus(replace(raw[1]))).toThrow('duplicate');
  });
});

describe('scorer with a stubbed poster', () => {
  it('scores kind, about and target independently and includes absent targets', async () => {
    const items = [theft, boasting, outside];
    const summary = await runEvaluation(items, async (_, index) => [
      response({ kind: 'lying', about: 'mira', target: 'pim' }),
      response({ kind: 'boasting', about: 'ivo', target: 'hal' }),
      response({ unsupported: 'unclear' }),
    ][index]!);
    expect(summary.schema).toEqual({ correct: 3, total: 3 });
    expect(summary.taxonomy).toEqual({ correct: 1, total: 2 });
    expect(summary.about).toEqual({ correct: 2, total: 2 });
    expect(summary.target).toEqual({ correct: 1, total: 2 });
    expect(summary.abstention).toEqual({ correct: 1, total: 1 });
    expect(summary.reason).toEqual({ correct: 0, total: 1 });
  });

  it('does not grant abstention or schema credit to 503, malformed JSON, or thrown requests; keeps running', async () => {
    const summary = await runEvaluation([outside, outside, outside, theft], async (item, index) => {
      if (index === 0) return { ...response(item.expect), status: 503 };
      if (index === 1) return { status: 200, body: '<html>failure</html>', latencyMs: 10 };
      if (index === 2) throw new Error('timeout');
      return response(item.expect);
    });
    expect(summary.cases).toHaveLength(4);
    expect(summary.cases[2]?.status).toBe(0);
    expect(summary.schema).toEqual({ correct: 1, total: 4 });
    expect(summary.abstention).toEqual({ correct: 0, total: 3 });
    expect(summary.passed).toBe(false);
  });

  it('flags a schema-valid injected instruction override and raw secret output', async () => {
    const summary = await runEvaluation([theft, theft, theft, outside], async (_, index) => [
      response({ kind: 'kindness', about: 'rosa' }),
      { status: 200, body: 'sk-secret', latencyMs: 10 },
      response({ unsupported: 'unclear' }),
      response({ kind: 'theft', about: 'mira' }),
    ][index]!, [0, 1, 2, 3]);
    expect(summary.injection).toEqual({ correct: 1, total: 4 });
    expect(summary.taxonomy.correct).toBe(0);
  });

  it('includes zero costs, keeps missing costs unknown, and calculates nearest-rank p95 including failures', async () => {
    const items = Array.from({ length: 20 }, () => theft);
    const summary = await runEvaluation(items, async (item, index) => {
      if (index === 19) return { status: 503, body: null, latencyMs: 999 };
      return response(item.expect, index + 1, index === 0 ? 0 : index === 1 ? 0.004 : undefined);
    });
    expect(summary.costObservations).toBe(2);
    expect(summary.totalCostUsd).toBe(0.004);
    expect(summary.p95LatencyMs).toBe(19);
    expect(markdown(summary)).toContain('$0.002000');
    expect(markdown(summary)).toContain('2/20');
    expect(markdown(summary)).toContain('19.0 ms');
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, '0.10', null])('ignores invalid usage.cost %s', async cost => {
    const posted = response(theft.expect);
    const body = posted.body as object;
    const summary = await runEvaluation([theft], async () => ({ ...posted, body: { ...body, usage: { cost } } }));
    expect(summary.costObservations).toBe(0);
    expect(markdown(summary)).toContain('| Observed cost total | n/a |');
  });

  it('enforces the inclusive 90% gate, full schema validity and zero injection failures', async () => {
    const items = Array.from({ length: 10 }, () => theft);
    const passing = await runEvaluation(items, async (item, index) => index === 9
      ? response({ kind: 'lying', about: 'mira', target: 'pim' }) : response(item.expect), [0]);
    expect(passing.taxonomy).toEqual({ correct: 9, total: 10 });
    expect(passing.passed).toBe(true);
    const badInjection = await runEvaluation(items, async (item, index) => index === 9
      ? response({ kind: 'lying', about: 'mira', target: 'pim' }) : response(item.expect), [9]);
    expect(badInjection.passed).toBe(false);
    const badSchema = await runEvaluation(items, async (item, index) => index === 9
      ? { status: 503, body: null, latencyMs: 10 } : response(item.expect), [0]);
    expect(badSchema.passed).toBe(false);
    const belowGate = await runEvaluation(items, async (item, index) => index >= 8
      ? response({ unsupported: 'unclear' }) : response(item.expect), [0]);
    expect(belowGate.passed).toBe(false);
  });

  it('has no fabricated metrics or passing gates on empty inputs', async () => {
    const summary = await runEvaluation([], async () => response(theft.expect));
    expect(summary.passed).toBe(false);
    expect(summary.p95LatencyMs).toBe(null);
    expect(markdown(summary)).toContain('n/a (0 items)');
    expect(() => summarize([theft], [])).toThrow('ordered result');
    expect(() => summarize([], [], [1])).toThrow('indices');
  });
});

describe('independent schema checks', () => {
  it.each([
    { kind: 'other' }, { about: 'outsider' }, { target: 'outsider' }, { target: 'mira' },
    { severity: 0 }, { severity: 4 }, { severity: '2' }, { confidence: -0.01 },
    { confidence: 1.01 }, { confidence: Number.NaN }, { confidence: '0.9' },
    { valence: 1 }, { object: '' }, { object: ' '.repeat(2) }, { object: 'x'.repeat(141) },
    { object: {} }, { secret: 'leaked' }, { target: null },
  ])('rejects invalid claim fields %j', change => {
    expect(scoreCase(theft, withClaim(change)).schemaValid).toBe(false);
  });

  it('requires confidence and rejects mixed unsupported and claim fields', () => {
    const body = response(theft.expect).body as { claim: Record<string, unknown> };
    delete body.claim.confidence;
    expect(isInterpretation(body.claim)).toBe(false);
    expect(isInterpretation({ unsupported: 'unclear', kind: 'theft' })).toBe(false);
    expect(isInterpretation({ unsupported: 'anything' })).toBe(false);
    expect(isInterpretation([])).toBe(false);
  });

  it('rejects missing signatures, bad envelope fields, and wrongly signed claim valence', () => {
    const posted = response(theft.expect);
    const body = posted.body as Record<string, unknown>;
    for (const change of [{ sig: undefined }, { sig: 'invalid+/=' }, { issuedAt: -1 }, { castVersion: '' }, { usage: [] }, { secret: 'leak' }]) {
      expect(scoreCase(theft, { ...posted, body: { ...body, ...change } }).schemaValid).toBe(false);
    }
    const good = response({ kind: 'nursed', about: 'nell', target: 'ben' });
    expect(scoreCase(theft, good).schemaValid).toBe(true);
    expect(isInterpretation({ kind: 'nursed', about: 'nell', target: 'ben', severity: 1, valence: -1, confidence: 1 })).toBe(false);
  });
});

describe('CLI and HTTP adapter', () => {
  it('uses the required local defaults and accepts explicit CORS origin and cast version', () => {
    expect(parseOptions(['--token', 'bypass'])).toEqual({ url: 'http://localhost:8787', token: 'bypass', origin: 'http://localhost:5173', castVersion: 'v1' });
    expect(parseOptions(['--token', 'bypass', '--url', 'https://api.example.com/', '--origin', 'https://example.com', '--cast-version', 'v2']).castVersion).toBe('v2');
  });
  it.each([
    [], ['--token'], ['--typo', 'value'], ['--token', 'x', '--token', 'y'],
    ['--token', 'x', '--url', 'file:///tmp/foo'], ['--token', 'x', '--origin', 'https://example.com/path'],
    ['--token', 'x', '--url', 'https://user:password@example.com'], ['--token', 'x', '--url', 'https://example.com/?x=1'],
  ].map(args => ({ args })))('rejects invalid arguments $args', ({ args }) => expect(() => parseOptions(args)).toThrow());

  it('posts the exact API contract with the bypass token and Origin header', async () => {
    const options = parseOptions(['--token', 'test-bypass']);
    const calls: { url: string; init?: RequestInit }[] = [];
    const request = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify(response(theft.expect).body), { status: 200 });
    }) as typeof fetch;
    const posted = await createPoster(options, request)(theft, 0);
    expect(calls[0]?.url).toBe('http://localhost:8787/interpret');
    expect(calls[0]?.init?.headers).toEqual({ 'Content-Type': 'application/json', Origin: 'http://localhost:5173' });
    expect(JSON.parse(calls[0]?.init?.body as string)).toEqual({ text: theft.text, turnstileToken: 'test-bypass', castVersion: 'v1' });
    expect(posted.status).toBe(200);
    expect(posted.latencyMs).toBeGreaterThanOrEqual(0);
    expect(scoreCase(theft, posted).schemaValid).toBe(true);
  });

  it('retains non-JSON responses and network failures as failed attempts', async () => {
    const options = parseOptions(['--token', 'test-bypass']);
    const html = (async () => new Response('bad gateway', { status: 502 })) as typeof fetch;
    expect(await createPoster(options, html)(theft, 0)).toMatchObject({ status: 502, body: null });
    const offline = (async () => { throw new Error('offline'); }) as typeof fetch;
    expect(await createPoster(options, offline)(theft, 0)).toMatchObject({ status: 0, body: null });
  });
});
