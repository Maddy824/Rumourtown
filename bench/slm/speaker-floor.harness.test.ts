import { expect, test } from 'vitest';
import { appendFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { select, scores } from './finetune/speaker-floor-eval.ts';
import { parseArgs, runBenchmark, type Row } from './run.ts';
import type { Scenario, Probe } from './types.ts';
import { writeJsonl } from './io.ts';

const exec = promisify(execFile);
const s: Scenario = { id: 's', seed: 201, tick: 0, split: 'confirm', mechanisms: [], villager: 'mira',
  persona: { name: 'Mira', role: 'baker', voice: 'plain' }, facts: [], unknownWorldFacts: ['Tom stole bread'],
  others: [], castNames: ['Mira', 'Tom'], witnessEvents: 0 };
const p: Probe = { id: 'p', scenarioId: 's', axis: 'pressure', level: 1, templateId: 'p', history: [],
  utterance: 'Did Tom steal bread?', gold: { behaviour: 'abstain' } };

test('speaker floor selects exactly the confirmation root-balanced probes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'speaker-floor-selection-'));
  try {
    const ss = [7, 2, 9].map(seed => ({ ...s, seed, id: `s${seed}` }));
    const ps = ss.flatMap(s => ['pressure', 'facts', 'provenance'].flatMap(axis => [0, 1, 2].map(i => ({ ...p, scenarioId: s.id, axis, id: `${s.id}-${axis}-${i}` })))) as Probe[];
    await writeJsonl(join(dir, 'scenarios.jsonl'), ss); await writeJsonl(join(dir, 'probes.jsonl'), ps);
    const options = parseArgs(['--models', 'mock:fixture', '--strategies', 'template', '--split', 'confirm', '--root-balanced', 'true', '--limit', '11',
      '--scenarios', join(dir, 'scenarios.jsonl'), '--probes', join(dir, 'probes.jsonl'), '--out', join(dir, 'raw')]);
    const rows = await runBenchmark(options);
    expect(select(ps, new Map(ss.map(s => [s.id, s])), 'confirm', 11).map(p => p.id).sort()).toEqual(rows.map(r => r.probeId).sort());
    expect(() => select(ps, new Map(ss.map(s => [s.id, s])), 'confirm', 2)).toThrow('every root');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('speaker-floor CLI fails at first transport error, resumes once, and rejects changed settings', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'speaker-floor-resume-'));
  let fail = true, requests = 0;
  const bodies: any[] = [];
  const server = createServer(async (req, res) => {
    requests++; let raw = ''; for await (const chunk of req) raw += chunk;
    bodies.push(JSON.parse(raw));
    res.writeHead(fail ? 503 : 200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content: 'I have not heard about that.' } }], usage: { prompt_tokens: 10, completion_tokens: 8 } }));
  });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const address = server.address() as { port: number };
  try {
    await writeJsonl(join(dir, 'scenarios.jsonl'), [s]);
    await writeJsonl(join(dir, 'probes.jsonl'), [p, { ...p, id: 'p2' }]);
    const config = { label: 'fixture', model: 'fake-local-model', split: 'confirm', limit: 2,
      scenarios: join(dir, 'scenarios.jsonl'), probes: join(dir, 'probes.jsonl'), directory: join(dir, 'raw'), template: false };
    const configPath = join(dir, 'config.json'); await writeFile(configPath, JSON.stringify(config));
    const run = () => exec(process.execPath, ['--experimental-strip-types', 'bench/slm/finetune/speaker-floor-eval.ts', 'evaluate', configPath],
      { env: { ...process.env, MLX_BASE_URL: `http://127.0.0.1:${address.port}` }, timeout: 10000 });
    await expect(run()).rejects.toThrow(); expect(requests).toBe(1);
    fail = false; await run(); expect(requests).toBe(3);
    expect(bodies.every(b => b.seed === 201 && b.temperature === .7 && b.max_tokens === 192 && b.chat_template_kwargs.speaker_floor_key)).toBe(true);
    await appendFile(join(dir, 'raw/outputs.jsonl'), '{"torn":');
    await run(); expect(requests).toBe(3);
    const rows = (await readFile(join(dir, 'raw/outputs.jsonl'), 'utf8')).trim().split('\n').map(l => JSON.parse(l));
    expect(rows.map(r => r.status)).toEqual(['error', 'ok', 'ok']);
    await writeFile(configPath, JSON.stringify({ ...config, limit: 1 }));
    await expect(run()).rejects.toThrow(); expect(requests).toBe(3);
  } finally { await new Promise<void>(r => server.close(() => r())); await rm(dir, { recursive: true, force: true }); }
});

test('score denominators retain errors and distinguish pooled from act-macro rates', () => {
  const good = { probeId: 'p', scenarioId: 's', status: 'ok', gold: { behaviour: 'abstain' }, behaviourMatched: true,
    result: { accepted: true, verdict: { epistemicFaithful: true, sentences: [] } } } as unknown as Row;
  const bad = { ...good, status: 'error', gold: { behaviour: 'assert' }, result: undefined } as Row;
  const result = scores([good, good, bad], new Map([['p', { ...p, utterance: 'Tom stole bread' }]]), new Map([['s', s]]));
  expect(result.Q).toBe(2 / 3); expect(result.macroQ).toBe(.5);
  expect(result.F).toBe(2 / 3); expect(result.leakageDenominator).toBe(3);
  expect(result.errors).toBe(1);
});

test('CPU controller tests cover offline operation, caching, guarded selection and failure isolation', async () => {
  const result = await exec('python3', ['-B', 'bench/slm/finetune/speaker-floor.test.py'], { timeout: 15000 });
  expect(result.stderr).toContain('OK');
});
