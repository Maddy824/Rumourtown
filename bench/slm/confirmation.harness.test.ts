import { expect, test } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mixtureAccept, balance, filter, validationSeed } from './finetune/make-data.ts';
import { bootstrap, holm, macro, marginP, mcnemar, pairMetrics, retention, type Observation } from './analyse.ts';
import { buildPairs } from './pairs.ts';
import { generateProbes, WITHHELD, TEMPLATES } from './probes.ts';
import { AXES, type Scenario, type Probe } from './types.ts';
import { execute } from './strategies.ts';
import { mock, type Request } from './providers.ts';
import { parseArgs, runBenchmark } from './run.ts';
import { writeJsonl } from './io.ts';
const scenario: Scenario = { id: 's', seed: 1, tick: 0, split: 'train', mechanisms: ['general'], villager: 'rosa', persona: { name: 'Rosa', voice: 'plain', role: 'innkeeper' },
  facts: [{ id: 'bread', text: 'Tom stole bread from the bakery', confidence: .95, band: 'sure', chain: ['Mira told Rosa at 09:00'], trueInWorld: false }], unknownWorldFacts: ['Ada found a ring'], others: [], castNames: ['Rosa', 'Mira', 'Tom'], witnessEvents: 0 };
const probe: Probe = { id: 'p', scenarioId: 's', axis: 'facts', level: 1, templateId: 'fact-1', history: [], utterance: 'What do you know about Tom stole bread from the bakery?', gold: { behaviour: 'assert', factId: 'bread' } };
test('Eq. (4) endpoints and deterministic half mixture', () => {
  const retained = [];
  for (let i = 0; i < 1000; i++) {
    expect(mixtureAccept(true, false, 0, i)).toBe(false); expect(mixtureAccept(true, false, 1, i)).toBe(true);
    expect(mixtureAccept(false, true, 1, i)).toBe(false); expect(mixtureAccept(true, true, 0, i)).toBe(true);
    retained.push(mixtureAccept(true, false, .5, i));
  }
  expect(retained.filter(Boolean).length).toBeGreaterThan(450); expect(retained.filter(Boolean).length).toBeLessThan(550);
  expect(retained).toEqual(retained.map((_, i) => mixtureAccept(true, false, .5, i)));
});
test('filter emits byte-identical endpoints, matched counts/prompts and equal frozen pair quota', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'confirmation-filter-'));
  try {
    const ss = Array.from({ length: 60 }, (_, i) => ({ ...scenario, id: `s${i}`, seed: i + 1 }));
    const ps = ss.map(s => ({ ...probe, scenarioId: s.id, id: s.id + ':p' }));
    await writeJsonl(join(dir, 'samples.jsonl'), ps.flatMap(p => [
      { probeId: p.id, sample: 0, text: 'I have not heard about that.' }, { probeId: p.id, sample: 1, text: 'Tom stole bread from the bakery.' }]));
    await filter(['--out', dir, '--match', 'act', '--balance', '--seed', '37', '--boundary-quota', '2'], { scenarios: new Map(ss.map(s => [s.id, s])), probes: ps });
    for (const part of ['train', 'valid']) {
      const content = (arm: string) => readFile(join(dir, arm, part + '.jsonl'), 'utf8');
      expect(await content('act')).toBe(await content('mix-0')); expect(await content('verifier')).toBe(await content('mix-1'));
      const ids = async (arm: string) => (await content(arm)).trim().split('\n').map(l => JSON.parse(l).probeId).sort();
      expect(await ids('act')).toEqual(await ids('verifier')); expect(await ids('act')).toEqual(await ids('mix-0.5'));
    }
    const stats = JSON.parse(await readFile(join(dir, 'stats.json'), 'utf8'));
    expect(stats.boundaryPairs).toBe(2); expect(Object.keys(stats.survival).length).toBe(60);
    const train = (await readFile(join(dir, 'act/train.jsonl'), 'utf8')).trim().split('\n').map(l => JSON.parse(l));
    expect(train.filter(r => r.boundaryPair)).toHaveLength(4); expect(train.every(r => !validationSeed(r.seed))).toBe(true);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('balancing has an exactly uniform target and seeded sampling', () => {
  const rs = Array.from({ length: 100 }, (_, i) => ({ probeId: String(i), seed: i, scenarioId: String(i), act: i < 90 ? 'assert' : 'refuse', messages: [] }));
  expect(balance(rs, 37)).toEqual(balance([...rs].reverse(), 37));
  expect(balance(rs, 37).filter(r => r.act === 'refuse')).toHaveLength(50);
  expect(balance(rs, 37).find(r => r.act === 'refuse')!.weight).toBe(5);
});
test('best-of-1, first best-of-4 candidate and grounded use identical temperature/prompt/seed', async () => {
  const requests: Request[][] = [];
  for (const [strategy, bestOf] of [['grounded', 1], ['best-of', 1], ['best-of', 4]] as const) {
    const rs: Request[] = []; requests.push(rs);
    await execute(strategy, scenario, probe, { provider: mock(r => { rs.push(r); return 'I have not heard about that.'; }), model: 'mock', temperature: .42, bestOf });
  }
  expect(requests[0]![0]).toEqual(requests[1]![0]); expect(requests[0]![0]).toEqual(requests[2]![0]); expect(requests[0]![0]!.temperature).toBe(.42);
  expect(parseArgs(['--models', 'mock:a', '--best-of', '1', '--temperature', '.42']).temperature).toBe(.42);
  expect(() => parseArgs(['--temperature', 'NaN'])).toThrow();
});
test('withheld templates stay outside training and null pairs preserve warranted projection', () => {
  for (const axis of AXES) { expect(WITHHELD[axis]).toHaveLength(2); expect(WITHHELD[axis].some(t => TEMPLATES[axis].includes(t))).toBe(false); }
  const ss = Array.from({ length: 10 }, (_, i) => ({ ...scenario, id: `s${i}`, seed: 201 + i, split: 'confirm' as const }));
  const p = [...generateProbes(ss, { wording: true })];
  expect(p.every(p => p.wording && p.split === 'wording' && p.templateId.startsWith('withheld-'))).toBe(true);
  const pairs = buildPairs(ss, 20, 37, { splits: ['confirm'], nulls: true });
  expect(pairs).toEqual(buildPairs([...ss].reverse(), 20, 37, { splits: ['confirm'], nulls: true }));
  expect(pairs.filter(p => p.nullIntervention)).toHaveLength(20);
  for (const p of pairs.filter(p => p.nullIntervention)) expect(p.projections![0]).toEqual(p.projections![1]);
  for (const p of pairs.filter(p => !p.nullIntervention)) expect(p.projections![0]).not.toEqual(p.projections![1]);
});
function synthetic(): Observation[] {
  const out: Observation[] = [];
  for (const condition of ['A', 'B']) for (const run of ['7', '17', '27']) for (let root = 0; root < 25; root++) for (const act of ['assert', 'refuse']) {
    const Q = Number(root < (condition === 'A' ? 12 : 10));
    out.push({ condition, run, root, probe: `${root}/${act}`, split: 'confirm', act, Q, F: 1, U: Q, R: 1, error: 0, completed: 1 });
  }
  return out;
}
test('paired macro has planted .08 effect; crossed bootstrap preserves cluster/run structure', () => {
  const rs = synthetic(), result = bootstrap(rs, 'A', 'B', 'Q', { seed: 37, replicates: 10000 });
  expect(result.estimate).toBeCloseTo(.08, 12); expect(result.roots).toBe(25); expect(result.runs).toEqual([3, 3]);
  expect(result.replicates).toHaveLength(10000); expect(result.interval[0]).toBeLessThanOrEqual(.08); expect(result.interval[1]).toBeGreaterThan(.08);
  expect(result.replicates.slice(0, 5)).toEqual(bootstrap(rs, 'A', 'B', 'Q', { seed: 37, replicates: 5 }).replicates);
  expect(() => bootstrap(rs.slice(1), 'A', 'B', 'Q', { replicates: 2 })).toThrow(/identical/);
  // Correlated roots and paired run offsets cancel exactly when the design is paired.
  const crossed = rs.map(r => ({ ...r, Q: (r.condition === 'A' ? .08 : 0) + r.root / 100 + Number(r.run) / 100 }));
  const paired = bootstrap(crossed, 'A', 'B', 'Q', { pairedRuns: true, replicates: 50 });
  expect(paired.replicates.every(x => Math.abs(x - .08) < 1e-12)).toBe(true);
  expect(new Set(bootstrap(crossed, 'A', 'B', 'Q', { replicates: 50 }).replicates.map(x => x.toFixed(6))).size).toBeGreaterThan(1);
});
test('known centred margin tails, Holm, exact McNemar and retention', () => {
  const c = { estimate: .08, replicates: [.04, .06, .08, .10, .12] };
  expect(marginP(c, .05)).toBeCloseTo(2 / 6); expect(marginP(c, .08)).toBeCloseTo(4 / 6);
  expect(holm([.01, .03, .04, .2])).toEqual([.04, .09, .09, .2]);
  expect(mcnemar(5, 0)).toBe(.0625); expect(mcnemar(0, 0)).toBe(1); expect(mcnemar(1000, 1000)).toBeCloseTo(1);
  const base = bootstrap(synthetic(), 'A', 'B', 'Q', { replicates: 20 });
  expect(retention(base, base).estimate).toBe(0); expect(retention(base, base).interval).toEqual([0, 0]);
});
test('macro uses pooled act denominators, not per-root rates', () => {
  const row = synthetic()[0]!;
  expect(macro([{ ...row, act: 'assert', Q: 1 }, ...Array.from({ length: 9 }, () => ({ ...row, root: 99, act: 'assert', Q: 0 })), { ...row, act: 'refuse', Q: 1 }], 'Q', ['assert', 'refuse'])).toBe(.55);
});
test('pair conjunction, Frechet bounds and semantic invariance include missing/error sides', () => {
  const pair = buildPairs([{ ...scenario, split: 'confirm' }], 1, 37, { splits: ['confirm'], nulls: true });
  const points = pair.flatMap(p => p.sides.map((side, i) => ({ ...synthetic()[0]!, probe: side.id, Q: 1, projection: p.projections![i] })));
  const scores = pairMetrics(pair, points); expect(scores.balanced).toBe(1); expect(scores.groups.every(g => g.rate === 1)).toBe(true);
  expect(scores.groups[0]!.bounds).toEqual([1, 1]);
  expect(pairMetrics(pair, points.slice(1)).groups[0]!.rate).toBe(0);
  expect(pairMetrics(pair, points.map(r => ({ ...r, completed: 0 }))).balanced).toBe(0);
});
test('root-balanced runner retains every fresh root and records sampling in its manifest', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'confirmation-run-'));
  try {
    const scenarios = Array.from({ length: 5 }, (_, i) => ({ ...scenario, id: `s${i}`, seed: 201 + i, split: 'confirm' as const }));
    await writeJsonl(join(dir, 'scenarios.jsonl'), scenarios);
    await writeJsonl(join(dir, 'probes.jsonl'), scenarios.flatMap(s => Array.from({ length: 5 }, (_, i) => ({ ...probe, id: `${s.id}:p${i}`, scenarioId: s.id }))));
    const options = parseArgs(['--models', 'mock:test', '--strategies', 'abstain', '--split', 'confirm', '--scenarios', join(dir, 'scenarios.jsonl'), '--probes', join(dir, 'probes.jsonl'), '--out', join(dir, 'run'), '--limit', '5', '--root-balanced', 'true', '--temperature', '.7', '--best-of', '1']);
    const result = await runBenchmark(options); expect(new Set(result.map(r => r.seed)).size).toBe(5);
    expect(JSON.parse(await readFile(join(dir, 'run/manifest.json'), 'utf8')).settings.temperature).toBe(.7);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('unattended driver orders screening before confirmation, evaluates every selected seed and resumes without retraining', async () => {
  const { launch, preflight } = await import('./finetune/confirmation.ts');
  const { mkdir, writeFile } = await import('node:fs/promises');
  const { hash } = await import('./io.ts');
  const dir = await mkdtemp(join(tmpdir(), 'confirmation-driver-'));
  try {
    const ss = [{ ...scenario, id: 'v', seed: 2 }, { ...scenario, id: 'fresh', seed: 201, split: 'confirm' as const }];
    const vp = { ...probe, id: 'v:p', scenarioId: 'v', utterance: 'What do you know about Ada found a ring?' };
    const files = ['scenarios.jsonl', 'probes.jsonl', 'pairs.jsonl', 'pairs-probes.jsonl', 'validation-scenarios.jsonl', 'validation-probes.jsonl', 'arms/stats.json', 'arms/boundary-pairs.jsonl',
      ...['verifier', 'act', 'mix-0.5', 'unfiltered'].flatMap(f => [`arms/${f}/train.jsonl`, `arms/${f}/valid.jsonl`])];
    for (const f of files) {
      await mkdir(join(dir, f, '..'), { recursive: true });
      if (f.includes('/train.jsonl') || f.includes('/valid.jsonl')) await writeJsonl(join(dir, f), Array.from({ length: 4 }, (_, i) => ({ seed: f.includes('/train.') ? 1 : 2, probeId: 'p' + i, scenarioId: 's', act: 'assert', messages: [{ role: 'assistant', content: 'ok' }] })));
      else await writeJsonl(join(dir, f), f.includes('scenarios') ? f.startsWith('validation') ? [ss[0]] : [ss[1]] : f.includes('probes') ? [vp] : []);
    }
    await writeFile(join(dir, 'prepared.json'), JSON.stringify({ hashes: Object.fromEntries(await Promise.all(files.map(async f => [f, hash(await readFile(join(dir, f), 'utf8'))]))) }));
    const trainCalls: string[] = [], evalCalls: { model: string; split: string; n: number }[] = [];
    const runtime = {
      command: async (bin: string, args: string[]) => {
        if (bin !== 'bash') return;
        const name = args[2]!; trainCalls.push(name);
        for (const epoch of [1, 2]) await mkdir(join(dir, 'runs', name, `epoch-${epoch}/fused`), { recursive: true });
      },
      withServer: async <T>(_model: string, _out: string, task: () => Promise<T>) => task(),
      evaluate: async (model: string, _directory: string, _scenarios: string, _probes: string, split: string, n: number) => {
        evalCalls.push({ model, split, n });
        const result = await execute('abstain', scenario, probe, { model: 'mock', provider: mock([]) });
        return [{ key: 'k', model: 'mock', actualModel: 'mock', strategy: 'best-of' as const, probeId: vp.id, scenarioId: 'v', split: 'train' as const, axis: 'facts' as const,
          level: 1, gold: vp.gold, status: 'ok' as const, behaviourMatched: true, result }];
      },
    };
    await launch(dir, 60, runtime);
    expect(trainCalls).toHaveLength(13); expect(trainCalls.slice(0, 4).every(c => c.startsWith('qwen06b'))).toBe(true);
    const selection = JSON.parse(await readFile(join(dir, 'llama3b-comparison.json'), 'utf8'));
    expect(selection.chosen).toBe('act'); expect(new Set(selection.scores.map((s: { run: string }) => s.run))).toEqual(new Set(['7', '17', '27']));
    const firstConfirm = evalCalls.findIndex(c => c.split === 'confirm');
    expect(evalCalls.slice(firstConfirm).every(c => c.split !== 'train')).toBe(true);
    expect(new Set(evalCalls.filter(c => c.split === 'wording').map(c => c.n))).toEqual(new Set([1, 4]));
    const before = trainCalls.length; await launch(dir, 60, runtime); expect(trainCalls).toHaveLength(before);
    await writeFile(join(dir, 'arms/act/train.jsonl'), '');
    await expect(preflight(dir)).rejects.toThrow(/changed/);
    await rm(join(dir, 'arms/verifier/valid.jsonl')); await expect(preflight(dir)).rejects.toThrow();
  } finally { await rm(dir, { recursive: true, force: true }); }
}, 30000);

test('analysis Markdown publishes per-act denominators and exactly four primary margin tests', async () => {
  const { report } = await import('./analyse.ts');
  const rows = ['confirm', 'wording', 'test-mechanism'].flatMap(split => synthetic().map(r => ({ ...r, split, condition: r.condition === 'A' ? 'act' : 'verifier-only' })));
  const base = rows.filter(r => r.condition === 'verifier-only' && r.run === '7').map(r => ({ ...r, run: 'base', condition: 'base-best-of-4' }));
  const markdown = report([...rows, ...base], 'act', 'verifier-only', 'base-best-of-4', 37, 100);
  expect(markdown).toContain('plus-one p-value denominator: 101');
  expect(markdown).toContain('| act | confirm | 7 | assert | 12 / 25 | 25 / 25 |');
  expect(markdown).toContain('Holm p'); expect(markdown).toContain('Retention wording'); expect(markdown).toContain('roots=25');
});
