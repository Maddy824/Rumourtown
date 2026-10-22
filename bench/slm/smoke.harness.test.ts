import { afterEach, expect, test, vi } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// Stub the import only in this test. Production always uses the controller's oracle.
vi.mock('./verifier.ts', async () => ({ verify: (await import('./test-support.ts')).stubVerify }));
import { generateScenarios } from './scenarios.ts';
import { generateProbes } from './probes.ts';
import { runBenchmark, parseArgs } from './run.ts';
import { writeJsonl } from './io.ts';
import { AXES } from './types.ts';
import { STRATEGIES } from './strategies.ts';

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(d => rm(d, { recursive: true, force: true }))); });

test('30 real-state probes, two mock model labels, eleven methods, offline and resumable', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'slm-smoke-')); directories.push(directory);
  const scenarios = await generateScenarios({ seeds: [1, 151], ticks: [180] });
  const scenariosPath = join(directory, 'scenarios.jsonl'), probesPath = join(directory, 'probes.jsonl');
  await writeJsonl(scenariosPath, scenarios); await writeJsonl(probesPath, generateProbes(scenarios));
  const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Smoke must stay offline'));
  try {
    const options = parseArgs(['--models', 'mock:qwen3:0.6b,mock:llama3.2:1b', '--strategies', STRATEGIES.join(','),
      '--axes', AXES.join(','), '--limit', '30', '--scenarios', scenariosPath, '--probes', probesPath, '--out', join(directory, 'results'),
      '--quantisations', 'mock:qwen3:0.6b:q4=mock:qwen3:0.6b-q4,mock:qwen3:0.6b:q8=mock:qwen3:0.6b-q8,mock:llama3.2:1b:q4=mock:llama3.2:1b-q4,mock:llama3.2:1b:q8=mock:llama3.2:1b-q8']);
    const rows = await runBenchmark(options);
    expect(new Set(rows.map(r => r.probeId)).size).toBe(30);
    expect(new Set(rows.map(r => r.axis))).toEqual(new Set(AXES));
    expect(new Set(rows.map(r => r.split))).toEqual(new Set(['train', 'test-seed', 'test-mechanism']));
    expect(rows).toHaveLength(30 * 2 * STRATEGIES.length);
    expect(rows.every(r => r.status === 'ok')).toBe(true);
    expect(rows.every(r => typeof r.result?.accepted === 'boolean')).toBe(true);
    expect(new Set(rows.map(r => r.strategy))).toEqual(new Set(STRATEGIES));
    expect(network).not.toHaveBeenCalled();
    const outputPath = join(options.directory, 'outputs.jsonl');
    const before = await readFile(outputPath, 'utf8');
    expect(await runBenchmark({ ...options, resume: true })).toEqual(rows);
    expect(await readFile(outputPath, 'utf8')).toBe(before);
    const summary = await readFile(join(options.directory, 'summary.md'), 'utf8');
    expect(summary).toContain('Break points'); expect(summary).toContain('mock:qwen3:0.6b');
    expect(summary).toContain('mock:llama3.2:1b'); expect(summary).toContain('unmeasured');
    console.log('SLM smoke: 30 probes × 2 mock model labels × 11 strategies = 660 offline records; resume adds no duplicates.');
  } finally { network.mockRestore(); }
}, 30_000);
