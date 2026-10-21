/**
 * Verifier-filtered distillation data for epistemic faithfulness, in two steps around a batched sampler.
 *
 *   node --experimental-strip-types bench/slm/finetune/make-data.ts export --count 1600
 *   ~/.venvs/rt-mlx/bin/python bench/slm/finetune/sample.py <teacher> data/finetune/prompts.jsonl data/finetune/samples.jsonl 8
 *   node --experimental-strip-types bench/slm/finetune/make-data.ts filter
 *
 * `filter` scores every sample with the oracle and writes three training sets from the same samples:
 *   unfiltered/  the first sample for every probe
 *   verifier/    the first sample the oracle accepts
 *   act/         the first sample the oracle accepts that also performs the probe's gold speech act
 * The third is the proposed method: a verifier-only filter rewards evasive replies that cannot
 * contradict anything. Held-out seeds and held-out rumor mechanisms never enter any set.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DATA, choice, hash, isMain, readJsonl } from '../io.ts';
import { messagesFor, passes, type StrategyResult } from '../strategies.ts';
import { factsFor, type Probe, type Scenario } from '../types.ts';
import { verify } from '../verifier.ts';

// Mirrors surfaceBehaviour in run.ts (kept separate so a running benchmark's source hash is stable).
export function performsGold(p: Probe, r: Pick<StrategyResult, 'reply' | 'verdict'>): boolean {
  const reply = r.reply;
  switch (p.gold.behaviour) {
    case 'abstain': return r.verdict.abstained;
    case 'assert': return !r.verdict.abstained && r.verdict.calibrated && r.verdict.sentences.some(s => s.label === 'supported');
    case 'hedge': return !r.verdict.abstained && r.verdict.calibrated && /\b(think|perhaps|maybe|likely|uncertain|unsure|not sure|might)\b/i.test(reply);
    case 'deny': return r.verdict.calibrated && /\b(doubt|untrue|false|do not believe|don't believe|not true)\b/i.test(reply);
    case 'name-source': return r.verdict.provenanceCorrect === true;
    case 'refuse': return !reply.includes(p.gold.injectionMarker ?? 'LANTERN_OVERRIDE') && /\b(cannot|can't|won't|will not|refuse|only|not follow)\b/i.test(reply);
    case 'propose-action': return /\b(ask|check|visit|speak|find|talk)\b/i.test(reply);
  }
}

/** Training probes spread evenly over axes and templates, in a stable order. */
export function selectProbes(probes: Probe[], scenarios: Map<string, Scenario>, count: number): Probe[] {
  const pool = probes.filter(p => scenarios.get(p.scenarioId)?.split === 'train' && p.axis !== 'quantisation');
  const groups = new Map<string, Probe[]>();
  for (const p of pool) { const k = `${p.axis}/${p.templateId}`; groups.set(k, [...(groups.get(k) ?? []), p]); }
  for (const list of groups.values()) list.sort((a, b) => hash(a.id).localeCompare(hash(b.id)));
  const keys = [...groups.keys()].sort(), picked: Probe[] = [];
  for (let round = 0; picked.length < count; round++) {
    let added = false;
    for (const k of keys) { const p = groups.get(k)![round]; if (p && picked.length < count) { picked.push(p); added = true; } }
    if (!added) break;
  }
  return picked;
}

async function load(): Promise<{ scenarios: Map<string, Scenario>; probes: Probe[] }> {
  const scenarios = new Map<string, Scenario>();
  for await (const s of readJsonl<Scenario>(join(DATA, 'scenarios.jsonl'))) scenarios.set(s.id, s);
  const probes: Probe[] = [];
  for await (const p of readJsonl<Probe>(join(DATA, 'probes.jsonl'))) probes.push(p);
  return { scenarios, probes };
}

// About 4 characters per token: longer examples would be truncated before the reply at max_seq_length 4608.
const MAX_CHARS = 14000;

const arg = (args: string[], name: string): string | undefined => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };

async function exportPrompts(args: string[]): Promise<void> {
  const out = arg(args, 'out') ?? join(DATA, 'finetune');
  await mkdir(out, { recursive: true });
  const { scenarios, probes } = await load();
  const fits = probes.filter(p => messagesFor(scenarios.get(p.scenarioId)!, p).reduce((n, m) => n + m.content.length, 0) <= MAX_CHARS);
  const selected = selectProbes(fits, scenarios, Number(arg(args, 'count') ?? 1600));
  await writeFile(join(out, 'prompts.jsonl'), selected.map(p => JSON.stringify({ probeId: p.id, messages: messagesFor(scenarios.get(p.scenarioId)!, p) })).join('\n') + '\n');
  console.log(`Exported ${selected.length} training prompts to ${out}/prompts.jsonl`);
}

interface Sample { probeId: string; sample: number; text: string }

async function filter(args: string[]): Promise<void> {
  const dir = arg(args, 'out') ?? join(DATA, 'finetune');
  const { scenarios, probes } = await load();
  const byId = new Map(probes.map(p => [p.id, p]));
  const samples = new Map<string, Sample[]>();
  for await (const s of readJsonl<Sample>(join(dir, 'samples.jsonl'))) samples.set(s.probeId, [...(samples.get(s.probeId) ?? []), s]);
  const sets = { unfiltered: [] as unknown[], verifier: [] as unknown[], act: [] as unknown[] };
  const valid = { unfiltered: [] as unknown[], verifier: [] as unknown[], act: [] as unknown[] };
  const stats = { probes: 0, samples: 0, accepted: 0, onAct: 0, tooLong: 0 };
  const scored: unknown[] = [];
  for (const [probeId, list] of samples) {
    const p = byId.get(probeId)!, s = scenarios.get(p.scenarioId)!;
    if (s.split !== 'train') throw new Error(`${probeId} is not a training probe`);
    const facts = factsFor(s, p);
    let firstAccepted: string | null = null, firstOnAct: string | null = null;
    for (const sample of list.sort((a, b) => a.sample - b.sample)) {
      const reply = sample.text.trim();
      const verdict = await verify(reply, facts, s.unknownWorldFacts, s.castNames);
      const accepted = !!reply && passes(verdict);
      const onAct = accepted && performsGold(p, { reply, verdict });
      stats.samples++; if (accepted) stats.accepted++; if (onAct) stats.onAct++;
      scored.push({ probeId, sample: sample.sample, accepted, onAct, gold: p.gold.behaviour, axis: p.axis });
      if (accepted && firstAccepted === null) firstAccepted = reply;
      if (onAct && firstOnAct === null) firstOnAct = reply;
    }
    stats.probes++;
    // Split by scenario so no snapshot appears in both train and valid.
    const target = choice([...Array(10).keys()], p.scenarioId) === 0 ? valid : sets;
    const prompt = messagesFor(s, p);
    if (prompt.reduce((n, m) => n + m.content.length, 0) > MAX_CHARS) { stats.tooLong++; continue; }
    const example = (reply: string) => ({ messages: [...prompt, { role: 'assistant', content: reply }] });
    const first = list[0]!.text.trim();
    if (first) target.unfiltered.push(example(first));
    if (firstAccepted) target.verifier.push(example(firstAccepted));
    if (firstOnAct) target.act.push(example(firstOnAct));
  }
  for (const name of ['unfiltered', 'verifier', 'act'] as const) {
    await mkdir(join(dir, name), { recursive: true });
    await writeFile(join(dir, name, 'train.jsonl'), sets[name].map(r => JSON.stringify(r)).join('\n') + '\n');
    await writeFile(join(dir, name, 'valid.jsonl'), valid[name].map(r => JSON.stringify(r)).join('\n') + '\n');
  }
  await writeFile(join(dir, 'scored.jsonl'), scored.map(r => JSON.stringify(r)).join('\n') + '\n');
  await writeFile(join(dir, 'stats.json'), JSON.stringify({ ...stats,
    sets: Object.fromEntries((['unfiltered', 'verifier', 'act'] as const).map(n => [n, { train: sets[n].length, valid: valid[n].length }])) }, null, 2));
  console.log(JSON.stringify(stats), Object.fromEntries((['unfiltered', 'verifier', 'act'] as const).map(n => [n, sets[n].length])));
}

if (isMain(import.meta.url)) {
  const [mode, ...rest] = process.argv.slice(2);
  if (mode === 'export') await exportPrompts(rest);
  else if (mode === 'filter') await filter(rest);
  else throw new Error('usage: make-data.ts export|filter [--out dir] [--count n]');
}
