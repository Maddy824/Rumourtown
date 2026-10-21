import { afterAll, beforeAll, expect, test } from 'vitest';
import { mkdtemp, readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createWorker } from '../../../apps/api/src/index';
import { keys, makeEnv, memoryLedger, mockFetch, origin } from '../../../apps/api/test/helpers';
import { playPrompt } from '../../../apps/api/src/play';
import { messagesFor } from '../strategies.ts';
import type { Probe, Scenario } from '../types.ts';
import { convertExample, convertSet, gameContext, loadGameRuntime, replayStates } from './game-format.ts';

let game: Awaited<ReturnType<typeof loadGameRuntime>>, scenario: Scenario, probe: Probe;
let states: ReturnType<typeof replayStates>, dir: string;
beforeAll(async () => {
  game = await loadGameRuntime();
  const fixtures = (await readFile(new URL('../fixtures/scenarios.jsonl', import.meta.url), 'utf8')).trim().split('\n').map(line => JSON.parse(line) as Scenario);
  scenario = fixtures.find(s => s.split === 'train')!;
  probe = { id: 'game-format-test', scenarioId: scenario.id, axis: 'confidence', level: 'half', templateId: 'confidence-1',
    utterance: 'How sure are you about the flour?', history: [], gold: { behaviour: 'hedge' },
    facts: [{ id: 'flour', text: 'Pim gave flour for the fair', confidence: .5, band: 'half', trueInWorld: false,
      chain: ['Mira told Ben at 08:00', 'Mira told Pim at 08:12', 'Ben told Rosa at 08:20'] }] };
  states = replayStates(game, [scenario]);
  dir = await mkdtemp(join(tmpdir(), 'rumortown-game-format-'));
}, 30_000);
afterAll(async () => { if (dir) await rm(dir, { recursive: true, force: true }); });

test('converted system/user messages equal a real /play request, using game facts and the teacher reply', async () => {
  const reply = 'I half believe it; Mira told me.';
  const example = { probeId: probe.id, messages: [...messagesFor(scenario, probe), { role: 'assistant', content: reply }] };
  const state = states.get(scenario.id)!;
  const converted = convertExample(game, example, scenario, probe, state);
  const context = gameContext(game, scenario, probe, state);
  expect(context.facts).toEqual(game.villagerFacts({ ...state.inspection, beliefs: [
    { claimId: 'flour', text: 'Pim gave flour for the fair', confidence: .5, chain: ['Mira told Pim at 08:12'], independentSources: 3 },
  ] }, state.minuteOfDay));
  expect(context.facts).toContain('I half believe that Pim gave flour for the fair (Mira told Pim at 08:12).');
  expect(JSON.stringify(context)).not.toContain('Ben told Rosa');
  expect(JSON.stringify(context)).not.toContain('trueInWorld');
  expect(converted.messages[0]).toEqual({ role: 'system', content: playPrompt });
  expect(converted.messages[2]!.content).toBe(JSON.stringify({ reply, action: 'none', target: '' }));
  const pair = await keys(), mock = mockFetch(), store = memoryLedger({}, mock.fetcher);
  let sent: unknown;
  const env = makeEnv(store.namespace, pair.secret, { AI: { run: async (_model, inputs) => {
    sent = inputs.messages;
    return { response: { reply, action: 'none', target: '' } };
  } } });
  try {
    const response = await createWorker({ fetch: mock.fetcher }).fetch(new Request('https://api.test/play', {
      method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: probe.utterance, context, turnstileToken: 'test-token' }),
    }), env);
    expect(response.status).toBe(200);
    expect(sent).toEqual(converted.messages.slice(0, -1));
  } finally { store.db.close(); }
});

test('history uses the last three complete exchanges and belief bands use game thresholds', () => {
  const history = Array.from({ length: 5 }, (_, i) => [{ role: 'user' as const, content: `question ${i}` }, { role: 'assistant' as const, content: `answer ${i}` }]).flat();
  const changed = { ...probe, history, facts: [.9, .7, .45, .35, .34].map((confidence, i) => ({ ...probe.facts![0]!, id: `f${i}`, text: `Story ${i}`, confidence })) };
  const context = gameContext(game, scenario, changed, states.get(scenario.id)!);
  expect(context.history).toEqual([2, 3, 4].map(i => ({ you: `question ${i}`, reply: `answer ${i}` })));
  expect(context.facts!.slice(1, 5).map(f => f.split(' that ')[0])).toEqual(['I am sure', 'I am fairly sure', 'I half believe', 'I doubt']);
  expect(context.facts!.join(' ')).not.toContain('Story 4');
});

test('CLI pipeline accepts ids and legacy examples, preserves splits and source files, and writes mlx chat JSONL', async () => {
  const write = (path: string, rows: unknown[]) => writeFile(path, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
  const other = { ...scenario, id: `${scenario.id}-valid` }, otherProbe = { ...probe, id: `${probe.id}-valid`, scenarioId: other.id };
  await mkdir(join(dir, 'finetune', 'act'), { recursive: true });
  await write(join(dir, 'scenarios.jsonl'), [scenario, other]);
  await write(join(dir, 'probes.jsonl'), [probe, otherProbe]);
  const teacher = 'Mira told me, but I am uncertain.';
  const train = { probeId: probe.id, messages: [...messagesFor(scenario, probe), { role: 'assistant', content: teacher }] };
  const valid = { messages: [...messagesFor(other, otherProbe), { role: 'assistant', content: teacher }] };
  // Give legacy validation a distinct prompt rather than an ambiguous duplicate scenario.
  otherProbe.utterance = 'What did Mira tell you?';
  valid.messages = [...messagesFor(other, otherProbe), { role: 'assistant', content: teacher }];
  await write(join(dir, 'probes.jsonl'), [probe, otherProbe]);
  await write(join(dir, 'finetune', 'act', 'train.jsonl'), [train]);
  await write(join(dir, 'finetune', 'act', 'valid.jsonl'), [valid]);
  const before = await readFile(join(dir, 'finetune', 'act', 'train.jsonl'), 'utf8');
  const cli = await promisify(execFile)(process.execPath, ['--experimental-strip-types',
    'bench/slm/finetune/game-format.ts', '--set', 'act', '--data', dir]);
  const result = JSON.parse(cli.stdout) as { train: number; valid: number; out: string };
  expect(result).toEqual({ train: 1, valid: 1, out: join(dir, 'finetune', 'act-game') });
  expect(await readFile(join(dir, 'finetune', 'act', 'train.jsonl'), 'utf8')).toBe(before);
  for (const split of ['train', 'valid']) {
    const converted = JSON.parse((await readFile(join(result.out, `${split}.jsonl`), 'utf8')).trim());
    expect(Object.keys(converted)).toEqual(['messages']);
    expect(converted.messages.map((m: { role: string }) => m.role)).toEqual(['system', 'user', 'assistant']);
    expect(JSON.parse(converted.messages[2].content)).toEqual({ reply: teacher, action: 'none', target: '' });
  }
  await write(join(dir, 'finetune', 'act', 'valid.jsonl'), [train]);
  await expect(convertSet('act', dir)).rejects.toThrow('Scenario appears in both');
  // Identical prompts from different snapshots must not be guessed without ids.
  const ambiguous = { ...otherProbe, utterance: probe.utterance };
  await write(join(dir, 'probes.jsonl'), [probe, ambiguous]);
  await write(join(dir, 'finetune', 'act', 'train.jsonl'), [{ messages: train.messages }]);
  await expect(convertSet('act', dir)).rejects.toThrow('Ambiguous legacy prompt');
}, 30_000);

test('rejects held-out snapshots, unknown sets and missing teacher replies', async () => {
  expect(() => replayStates(game, [{ ...scenario, split: 'test-seed' }])).toThrow('Not a training snapshot');
  expect(() => convertExample(game, { messages: messagesFor(scenario, probe) }, scenario, probe, states.get(scenario.id)!)).toThrow('Missing teacher reply');
  await expect(convertSet('../act', dir)).rejects.toThrow('source set name');
});
