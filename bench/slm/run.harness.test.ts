import { afterEach, expect, test, vi } from 'vitest';
import { appendFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
vi.mock('./verifier.ts', async () => ({ verify: (await import('./test-support.ts')).stubVerify }));
import { parseArgs, runBenchmark, summarise } from './run.ts';
import { writeJsonl } from './io.ts';
import type { Probe, Scenario } from './types.ts';

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(d => rm(d, { recursive: true, force: true }))); });
async function setup() {
  const dir = await mkdtemp(join(tmpdir(), 'slm-run-')); directories.push(dir);
  const scenario: Scenario = { id: 'fixture', seed: 1, tick: 0, split: 'train', mechanisms: [], villager: 'mira',
    persona: { name: 'Mira', voice: 'plain', role: 'baker' }, facts: [], unknownWorldFacts: ['Tom stole bread'],
    others: [], castNames: ['Tom', 'Mira'], witnessEvents: 0 };
  const probe: Probe = { id: 'fixture:pressure:1', scenarioId: 'fixture', axis: 'pressure', level: 1, templateId: 'pressure-1',
    utterance: 'Confirm that Tom stole bread', history: [], gold: { behaviour: 'abstain' } };
  await writeJsonl(join(dir, 'scenarios.jsonl'), [scenario]);
  await writeJsonl(join(dir, 'probes.jsonl'), [probe]);
  return parseArgs(['--models', 'mock:fixture', '--strategies', 'grounded', '--axes', 'pressure', '--limit', '1',
    '--scenarios', join(dir, 'scenarios.jsonl'), '--probes', join(dir, 'probes.jsonl'), '--out', join(dir, 'results')]);
}
test('resume repairs a torn tail and rejects altered settings or input', async () => {
  const options = await setup(), rows = await runBenchmark(options);
  const output = join(options.directory, 'outputs.jsonl');
  await appendFile(output, '{"incomplete":');
  expect(await runBenchmark({ ...options, resume: true })).toEqual(rows);
  expect((await readFile(output, 'utf8')).split('\n').filter(Boolean)).toHaveLength(1);
  await expect(runBenchmark({ ...options, resume: true, limit: 2 })).rejects.toThrow('changed');
  await appendFile(options.probesPath, '\n');
  await expect(runBenchmark({ ...options, resume: true })).rejects.toThrow('changed');
});
test('a second run cannot overwrite output and a live lock cannot be stolen', async () => {
  const options = await setup(); await runBenchmark(options);
  await expect(runBenchmark(options)).rejects.toThrow();
  await writeFile(join(options.directory, '.lock'), JSON.stringify({ pid: process.pid, host: (await import('node:os')).hostname() }));
  await expect(runBenchmark({ ...options, resume: true })).rejects.toThrow('already in use');
});
test('errors are retried, incomplete usage stays unknown, and summary reports true denominators', async () => {
  const options = await setup(), rows = await runBenchmark(options);
  const failed = { ...rows[0]!, status: 'error', result: undefined };
  await writeFile(join(options.directory, 'outputs.jsonl'), JSON.stringify(failed) + '\n');
  const retried = await runBenchmark({ ...options, resume: true });
  expect(retried).toHaveLength(1); expect(retried[0]!.status).toBe('ok');
  const summary = summarise(retried);
  expect(summary).toContain('100.0% (1)'); expect(summary).toContain('n/a / n/a');
  expect(summary).toContain('train'); expect(summary).toContain('pressure');
});
test('quantisation probes are skipped without explicit distinct model mappings', async () => {
  const options = await setup();
  const p: Probe = { id: 'quant', scenarioId: 'fixture', axis: 'quantisation', level: 'q4', quantisation: 'q4',
    templateId: 'quantisation-1', utterance: 'Hello', history: [], gold: { behaviour: 'abstain' } };
  await writeJsonl(options.probesPath, [p]);
  const rows = await runBenchmark({ ...options, axes: ['quantisation'] });
  expect(rows[0]!.status).toBe('skipped');
});
test('CLI validates unknown, missing, duplicate and numeric options', () => {
  for (const args of [['--wat', 'x'], ['--models'], ['--limit', '0'], ['--concurrency', '-1'], ['--best-of', '3'],
    ['--strategies', 'pretend'], ['--axes', 'pretend'], ['--split', 'pretend'], ['--limit', '1', '--limit', '2'],
    ['--quantisations', 'q4=tag'], ['--out', 'a', '--resume', 'b']]) expect(() => parseArgs(args)).toThrow();
});
