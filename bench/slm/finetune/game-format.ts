/**
 * Convert existing teacher sets into the live /play protocol. No inference or training is run.
 *   node --experimental-strip-types bench/slm/finetune/game-format.ts --set act
 *   node --experimental-strip-types bench/slm/finetune/game-format.ts --set smoke --data bench/slm/data
 */
import { build } from 'vite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DATA, ROOT, hash, isMain, readJsonl } from '../io.ts';
import { directSources } from '../scenarios.ts';
import { messagesFor } from '../strategies.ts';
import { factsFor, type Probe, type Scenario } from '../types.ts';
import type { PlayContext } from '../../../apps/api/src/play.ts';
import type { Dossier, Inspection } from '../../../apps/rumortown/src/sim/types.ts';

export interface TrainingExample { probeId?: string; messages: { role: string; content: string }[] }
type Runtime = typeof import('./game-format-runtime.ts');
interface State { inspection: Inspection; minuteOfDay: number; dossier: Dossier }

export async function loadGameRuntime(): Promise<Runtime> {
  const output = await build({ root: ROOT, configFile: false, logLevel: 'silent',
    resolve: { alias: { rumormind: join(ROOT, 'packages/rumormind/src/index.ts') } },
    build: { ssr: 'bench/slm/finetune/game-format-runtime.ts', write: false, minify: false },
    ssr: { noExternal: ['rumormind'] } });
  if (Array.isArray(output) || !('output' in output)) throw new Error('Expected one game-format bundle');
  const chunk = output.output.find(item => item.type === 'chunk');
  if (!chunk || chunk.type !== 'chunk') throw new Error('Missing game-format bundle');
  return import(`data:text/javascript;base64,${Buffer.from(chunk.code).toString('base64')}`);
}

/** Recover missing live fields from the same seeded world used by scenarios.ts. */
export function replayStates(game: Runtime, scenarios: Scenario[]): Map<string, State> {
  const states = new Map<string, State>();
  let sim: ReturnType<Runtime['createSimulation']> | undefined, seed: number | undefined;
  for (const s of [...scenarios].sort((a, b) => a.seed - b.seed || a.tick - b.tick || a.id.localeCompare(b.id))) {
    if (!Number.isInteger(s.seed) || s.seed < 1 || s.seed > 150 || s.split !== 'train' ||
        !Number.isInteger(s.tick) || s.tick < 0 || s.tick > 1440) throw new Error(`Not a training snapshot: ${s.id}`);
    if (!sim || seed !== s.seed) {
      seed = s.seed;
      sim = game.createSimulation({ seed, cast: game.cast, claims: game.claims,
        world: { ...game.createWorld(game.villageMap), createMover: game.createMover }, talk: game.createTalk(game.cast), days: 1,
        interventions: [
          { tick: 30, listener: 'mira', claimId: 'tom-stole-bread' },
          { tick: 90, listener: 'ben', claimId: 'jonah-affair-rosa' },
          { tick: 150, listener: 'rosa', claimId: 'ben-stole-tools' },
        ] });
    }
    while (sim.tick < s.tick) sim.step();
    const dossier = sim.cast.get(s.villager);
    if (!dossier || dossier.name !== s.persona.name || dossier.role !== s.persona.role || dossier.voice !== s.persona.voice) {
      throw new Error(`Scenario cast differs from the game: ${s.id}`);
    }
    states.set(s.id, { inspection: sim.inspect(s.villager), minuteOfDay: sim.snapshot().minuteOfDay, dossier });
  }
  return states;
}

/** A probe the live /play endpoint would refuse; it is skipped and counted, not converted. */
export class OutOfBounds extends Error {}

export function gameContext(game: Runtime, scenario: Scenario, probe: Probe, state: State): PlayContext {
  const { inspection, minuteOfDay, dossier } = state;
  const history: PlayContext['history'] = [];
  for (let i = 0; i < probe.history.length; i += 2) {
    const you = probe.history[i], reply = probe.history[i + 1];
    if (you?.role !== 'user' || reply?.role !== 'assistant') throw new Error(`Unpaired history: ${probe.id}`);
    history.push({ you: you.content, reply: reply.content });
  }
  // Retain the dataset's split and controlled belief interventions, never the oracle's world truth.
  const beliefs = factsFor(scenario, probe).map(f => ({ claimId: f.id, text: f.text, confidence: f.confidence,
    chain: directSources(f.chain, inspection.name), independentSources: f.chain.length }));
  const context: PlayContext = {
    speaker: inspection.id,
    nearby: [{ id: inspection.id, mood: inspection.mood, activity: inspection.activity }],
    places: game.villageMap.places.map(p => ({ id: p.id, name: p.name })),
    voice: [dossier.voice, dossier.character?.aspiration, dossier.character?.worry, dossier.character?.habit].filter(Boolean).join(' ').slice(0, 700),
    history: history.slice(-3),
    facts: game.villagerFacts({ ...inspection, beliefs }, minuteOfDay),
  };
  if (!game.readPlayContext(context)) throw new OutOfBounds(`Context exceeds /play bounds: ${probe.id}`);
  if (!probe.utterance.trim() || probe.utterance.length > 280 || /[\u0000-\u001f\u007f]/u.test(probe.utterance)) {
    throw new OutOfBounds(`Utterance exceeds /play bounds: ${probe.id}`);
  }
  return context;
}

export function convertExample(game: Runtime, example: TrainingExample, scenario: Scenario, probe: Probe, state: State): TrainingExample {
  const assistant = example.messages.at(-1);
  if (assistant?.role !== 'assistant' || typeof assistant.content !== 'string' || !assistant.content.trim()) {
    throw new Error(`Missing teacher reply: ${probe.id}`);
  }
  return { messages: [...game.playMessages(probe.utterance, gameContext(game, scenario, probe, state)),
    { role: 'assistant', content: JSON.stringify({ reply: assistant.content, action: 'none', target: '' }) }] };
}

export async function convertSet(set: string, data = DATA): Promise<{ train: number; valid: number; skipped: number; out: string }> {
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(set) || set.endsWith('-game')) throw new Error('Choose a source set name, for example act');
  const scenarios = new Map<string, Scenario>(), probes = new Map<string, Probe>();
  for await (const s of readJsonl<Scenario>(join(data, 'scenarios.jsonl'))) scenarios.set(s.id, s);
  for await (const p of readJsonl<Probe>(join(data, 'probes.jsonl'))) probes.set(p.id, p);
  const input = join(data, 'finetune', set), out = `${input}-game`;
  const rows: { split: 'train' | 'valid'; example: TrainingExample; probe: Probe; scenario: Scenario }[] = [];
  let legacy: Map<string, Probe[]> | undefined;
  for (const split of ['train', 'valid'] as const) {
    // Read both files before writing either output; do not disturb the source sets.
    const content = await readFile(join(input, `${split}.jsonl`), 'utf8');
    for (const line of content.split(/\r?\n/).filter(line => line.trim())) {
      const example = JSON.parse(line) as TrainingExample;
      if (!Array.isArray(example.messages) || example.messages.length < 2) throw new Error(`Missing chat messages in ${split}`);
      if (!example.probeId && !legacy) {
        // Older sets lack ids. Match the full original prompt, rather than guessing from the last question.
        legacy = new Map();
        for (const p of probes.values()) {
          const s = scenarios.get(p.scenarioId);
          if (s?.split === 'train') {
            const key = hash(messagesFor(s, p));
            legacy.set(key, [...(legacy.get(key) ?? []), p]);
          }
        }
      }
      const matches = example.probeId ? undefined : legacy?.get(hash(example.messages.slice(0, -1)));
      if (matches && new Set(matches.map(p => p.scenarioId)).size > 1) {
        throw new Error(`Ambiguous legacy prompt in ${split}; re-run make-data.ts filter to add probeId`);
      }
      // Several sweep levels can share the same prompt within one snapshot; their game input is identical.
      const probe = example.probeId ? probes.get(example.probeId) : matches?.[0];
      const scenario = probe && scenarios.get(probe.scenarioId);
      if (!probe || !scenario) throw new Error(`Cannot recover probe in ${split}; re-run make-data.ts filter to add probeId`);
      if (scenario.split !== 'train') throw new Error(`Held-out scenario in ${split}: ${scenario.id}`);
      rows.push({ split, example, probe, scenario });
    }
  }
  const trainIds = new Set(rows.filter(r => r.split === 'train').map(r => r.scenario.id));
  if (rows.some(r => r.split === 'valid' && trainIds.has(r.scenario.id))) throw new Error('Scenario appears in both train and valid');
  const game = await loadGameRuntime();
  const states = replayStates(game, [...new Map(rows.map(r => [r.scenario.id, r.scenario])).values()]);
  const converted = { train: [] as TrainingExample[], valid: [] as TrainingExample[] };
  let skipped = 0;
  for (const row of rows) {
    try { converted[row.split].push(convertExample(game, row.example, row.scenario, row.probe, states.get(row.scenario.id)!)); }
    catch (error) { if (!(error instanceof OutOfBounds)) throw error; skipped++; }
  }
  await mkdir(out, { recursive: true });
  for (const split of ['train', 'valid'] as const) {
    await writeFile(join(out, `${split}.jsonl`), converted[split].map(row => JSON.stringify(row)).join('\n') + (converted[split].length ? '\n' : ''));
  }
  return { train: converted.train.length, valid: converted.valid.length, skipped, out };
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const arg = (name: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
  const set = arg('set');
  if (!set) throw new Error('usage: game-format.ts --set unfiltered|verifier|act [--data bench/slm/data]');
  console.log(JSON.stringify(await convertSet(set, arg('data') ?? DATA)));
}
