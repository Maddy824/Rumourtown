import { expect, test, vi } from 'vitest';
vi.mock('./verifier.ts', async () => ({ verify: (await import('./test-support.ts')).stubVerify }));
import { mock, type Request } from './providers.ts';
import { execute, messagesFor } from './strategies.ts';
import type { Probe, Scenario } from './types.ts';

const scenario: Scenario = { id: 'fixture', seed: 12, tick: 20, split: 'train', mechanisms: ['general'], villager: 'mira',
  persona: { name: 'Mira', voice: 'plain', role: 'baker' },
  facts: [{ id: 'bread', text: 'Tom stole bread', confidence: .95, band: 'sure', chain: ['Ben told Mira at 09:00'], trueInWorld: false },
    { id: 'coins', text: 'Ben found coins', confidence: .5, band: 'half', chain: [], trueInWorld: true }],
  unknownWorldFacts: ['Rosa paid Ada'], others: [], castNames: ['Tom', 'Mira', 'Ben', 'Rosa', 'Ada'], witnessEvents: 0 };
const probe: Probe = { id: 'test', scenarioId: 'fixture', axis: 'facts', level: 2, templateId: 'facts-1',
  utterance: 'What do you know?', history: [], gold: { behaviour: 'assert', factId: 'bread' } };

test('persona baseline excludes facts; grounded prompt excludes oracle truth and unknown world facts', () => {
  expect(messagesFor(scenario, probe, false)[0]!.content).not.toContain('Tom stole bread');
  const grounded = JSON.stringify(messagesFor(scenario, probe));
  expect(grounded).toContain('Tom stole bread'); expect(grounded).not.toContain('trueInWorld');
  expect(grounded).not.toContain('Rosa paid Ada');
});
test('false beliefs can pass the epistemic gate despite world unfaithfulness', async () => {
  const result = await execute('grounded', scenario, probe, { provider: mock(['Tom stole bread']), model: 'test' });
  expect(result.accepted).toBe(true); expect(result.verdict.worldFaithful).toBe(false);
});
test.each(['cite', 'grammar'] as const)('%s rejects malformed JSON, unknown IDs and uncited supported claims', async strategy => {
  for (const reply of ['not JSON', '{"uses":["invented"],"reply":"hello"}', '{"uses":[],"reply":"Tom stole bread"}']) {
    const result = await execute(strategy, scenario, probe, { provider: mock([reply]), model: 'test' });
    expect(result.accepted).toBe(false); expect(result.attempts[0]!.protocolValid).toBe(false);
  }
  const seen: Request[] = [];
  await execute(strategy, scenario, probe, { provider: mock(r => { seen.push(r); return '{"uses":["bread"],"reply":"Tom stole bread"}'; }), model: 'test' });
  expect(!!seen[0]!.format).toBe(strategy === 'grammar');
});
test('plan selects valid facts then realises with only those facts', async () => {
  const seen: Request[] = [];
  const result = await execute('plan', scenario, probe, { model: 'test', provider: mock((r, i) => {
    seen.push(r); return i === 0 ? '{"uses":["bread"],"act":"assert"}' : 'Tom stole bread';
  }) });
  expect(result.accepted).toBe(true); expect(result.attempts[0]!.generations).toHaveLength(2);
  expect(JSON.stringify(seen[1])).not.toContain('Ben found coins');
  const invalid = await execute('plan', scenario, probe, { model: 'test', provider: mock(['{"uses":["not-a-fact"],"act":"assert"}']) });
  expect(invalid.accepted).toBe(false); expect(invalid.attempts[0]!.generations).toHaveLength(1);
});
test('best-of stops at first pass, uses temperature .7 and distinct reproducible seeds', async () => {
  const seen: Request[] = [];
  const result = await execute('best-of', scenario, probe, { model: 'test', bestOf: 4,
    provider: mock((r, i) => { seen.push(r); return i ? 'Tom stole bread' : 'UNSUPPORTED'; }) });
  expect(result.attempts).toHaveLength(2); expect(result.accepted).toBe(true);
  expect(seen.map(r => r.seed)).toEqual([12, 13]); expect(seen.every(r => r.temperature === .7)).toBe(true);
  const failed = await execute('best-of', scenario, probe, { model: 'test', bestOf: 2, provider: mock(['UNSUPPORTED', 'UNSUPPORTED']) });
  expect(failed.accepted).toBe(false); expect(failed.attempts).toHaveLength(2);
});
test('cascade calls reference only after a failed gate and preserves both calls', async () => {
  const reference = vi.fn(() => 'Tom stole bread');
  const result = await execute('cascade', scenario, probe, { model: 'small', provider: mock(['UNSUPPORTED']),
    cascade: { model: '70b', provider: mock(reference) } });
  expect(result.escalated).toBe(true); expect(result.accepted).toBe(true); expect(result.attempts).toHaveLength(2);
  await execute('cascade', scenario, probe, { model: 'small', provider: mock(['Tom stole bread']), cascade: { model: '70b', provider: mock(reference) } });
  expect(reference).toHaveBeenCalledTimes(1);
});
