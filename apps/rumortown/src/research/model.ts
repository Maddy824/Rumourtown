/** Reproducible observations and paired sensitivity runs of the actual game engine. */
import { DEFAULT_TUNING, type Tuning } from 'rumormind';
import { MOTIVE_WEIGHTS } from '../sim/agents/motivation.js';
import { readRegisteredClaim } from '../sim/registered-claim.js';
import * as decisionParameters from '../sim/agents/params.js';
import { MINUTES_PER_DAY, type Intervention, type Simulation, type VillageMap } from '../sim/types.js';

export const MODEL_VERSION = 'v4-open-stories-1';
export const GAME_TUNING: Tuning = { ...DEFAULT_TUNING, sourceMemoryHalfLifeTicks: 2 };
export const SOURCES = [
  { title: 'Source monitoring (1993)', url: 'https://pubmed.ncbi.nlm.nih.gov/8346328/', use: 'Separates source attribution from content. Open stories remain hearsay, never generated eyewitness evidence.' },
  { title: 'Emotion shapes diffusion (2017)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5514704/', use: 'Political social-network evidence motivates attention to importance and social ties; our open-story attention bonus is gameplay tuning, not a fitted effect.' },
  { title: 'Gossip and reputation in everyday life (2021)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8487731/', use: 'Relationships between sender, receiver and target shape information sharing. Field observations, not a calibration of this village.' },
  { title: 'Gossip promotes cooperation only when it is pro-socially motivated (2022)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8938477/', use: 'An agent-based model separating gossip motives; its findings are conditional model results, not measured universal effects.' },
  { title: 'A mechanistic model of gossip, reputations, and cooperation (2024)', url: 'https://doi.org/10.1073/pnas.2400689121', use: 'Formal model of reputation agreement; it motivates examining agreement separately from accuracy.' },
  { title: 'The effects of repetition frequency on the illusory truth effect (2021)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8116821/', use: 'Experiments support diminishing gains in perceived truth with repeated exposure. Our log-odds scale and cap are modelling choices.' },
  { title: 'From Storytelling to Facebook (2022)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9250454/', use: 'Preregistered transmission and sharing experiments support a negative-content advantage; sharing is distinct from believing.' },
  { title: 'The illusion of consensus (2019)', url: 'https://doi.org/10.1177/0956797619856844', use: 'Experiments motivate tracking common origins rather than simply counting tellers. Dependence detection varies by task and cues.' },
  { title: 'ODD protocol for agent-based models (2020)', url: 'https://www.jasss.org/23/2/7.html', use: 'A structure for documenting assumptions, update order and evaluation.' },
];

export type Condition = 'no-whispers' | 'no-familiarity' | 'neutral-sharing' | 'no-affinity-bias';
export const CONDITIONS: Record<Condition, { label: string; tuning: Partial<Tuning> }> = {
  'no-whispers': { label: 'Without your whispers', tuning: {} },
  'no-familiarity': { label: 'Without the repetition bonus', tuning: { familiarityCap: 0, familiarityScale: 0 } },
  'neutral-sharing': { label: 'Without the negative sharing bonus', tuning: { negativitySharingOdds: 1 } },
  'no-affinity-bias': { label: 'Without affinity bias in belief', tuning: { motivatedBias: 0 } },
};

export function observe(sim: Simulation) {
  const people = [...sim.cast.keys()].map(id => sim.inspect(id));
  const beliefs = people.flatMap(p => p.beliefs.map(b => ({ villager: p.id, ...b })));
  const harmful = beliefs.filter(b => (sim.claims.get(b.claimId)?.valence ?? 0) < 0 && b.confidence > .5);
  const lines = sim.events(0).filter(e => e.kind === 'line');
  return {
    tick: sim.tick,
    harmfulBelievers: new Set(harmful.map(b => b.villager)).size,
    harmfulBeliefs: harmful.length,
    claimTellings: lines.filter(e => e.claimId !== undefined).length,
    meanTrustInStranger: people.reduce((sum, p) => sum + p.trustInStranger, 0) / Math.max(1, people.length),
    meanMood: people.reduce((sum, p) => sum + p.mood, 0) / Math.max(1, people.length),
  };
}

export function exportRun(sim: Simulation, seed: number, castVersion: string, map: VillageMap) {
  // Runtime taxonomy claims must re-enter at their whisper tick, not at dawn.
  // Registration also adds reverse contradiction links to authored alternatives.
  const runtimeIds = new Set([...sim.claims.keys()].filter(id => readRegisteredClaim(id, sim.cast) !== null));
  const initialClaims = [...sim.claims.values()].filter(c => !runtimeIds.has(c.id)).map(c => ({ ...c,
    ...(c.contradicts ? { contradicts: c.contradicts.filter(id => !runtimeIds.has(id)) } : {}),
  }));
  return {
    schema: 'rumortown-observation/1', modelVersion: MODEL_VERSION,
    purpose: 'Exploratory synthetic social simulation; not a validated predictor of people.',
    seed, castVersion, tick: sim.tick, tickUnit: 'one game minute; 1440 minutes per simulated day',
    tuning: GAME_TUNING, decisionParameters, motiveWeights: MOTIVE_WEIGHTS,
    spatialRules: { neighbours: 4, terrainCosts: { path: 1, floor: 1, door: 1, bridge: 1, grass: 4, field: 3 }, blocked: ['water', 'wall', 'tree', 'well'] },
    replayInputs: { initialClaims, days: 3 },
    interventions: sim.interventions(), cast: [...sim.cast.values()], claims: [...sim.claims.values()], map,
    snapshot: sim.snapshot(), inspections: [...sim.cast.keys()].map(id => sim.inspect(id)),
    metrics: observe(sim), events: sim.events(0), sources: SOURCES,
    limitations: [
      'Characters, traits, motives, schedules and numeric coefficients are authored, not fitted to participant data.',
      'Harmful content is not necessarily false. This metric counts negative claims, not misinformation accuracy.',
      'The player route is omitted from shared replays; NPC outcomes depend on the seed and whispers.',
      'Dialogue is templated. Model variants are sensitivity checks, not human treatment-effect estimates.',
      'A shared seed does not align random draws after branches diverge; use multiple seeds.',
    ],
  };
}

export type Factory = (seed: number, interventions: Intervention[], tuning?: Partial<Tuning>) => Simulation;

export async function pairedExperiment(make: Factory, seed: number, interventions: Intervention[], condition: Condition,
  count: number, progress: (done: number, total: number) => void, cancelled: () => boolean = () => false) {
  const runs = [];
  const total = Math.max(1, Math.min(5, Math.floor(count)));
  for (let i = 0; i < total; i++) {
    const runSeed = (seed + i) >>> 0;
    const baseline = make(runSeed, interventions.slice());
    const comparison = make(runSeed, condition === 'no-whispers' ? [] : interventions.slice(), CONDITIONS[condition].tuning);
    const series = [];
    for (let tick = 0; tick <= (3 * MINUTES_PER_DAY); tick++) {
      if (cancelled()) return null;
      if (tick % (MINUTES_PER_DAY / 10) === 0) series.push({ tick, baseline: observe(baseline), comparison: observe(comparison) });
      if (tick === (3 * MINUTES_PER_DAY)) break;
      baseline.step(); comparison.step();
      if (tick % 60 === 0) {
        progress(i * (3 * MINUTES_PER_DAY) + tick, total * (3 * MINUTES_PER_DAY));
        await new Promise<void>(resolve => setTimeout(resolve, 0));
      }
    }
    runs.push({ seed: runSeed, baseline: observe(baseline), comparison: observe(comparison), series,
      baselineEndings: baseline.events(0).filter(e => e.kind === 'day-end'),
      comparisonEndings: comparison.events(0).filter(e => e.kind === 'day-end') });
  }
  progress(total * (3 * MINUTES_PER_DAY), total * (3 * MINUTES_PER_DAY));
  return { schema: 'rumortown-paired-experiment/1', modelVersion: MODEL_VERSION, condition, interventions,
    baselineTuning: GAME_TUNING, comparisonTuning: { ...GAME_TUNING, ...CONDITIONS[condition].tuning },
    note: 'Synthetic sensitivity results, not estimates of human behaviour. Seed pairing does not preserve draw alignment after divergence.', runs };
}

export function eventsCsv(sim: Simulation): string {
  const cell = (value: unknown): string => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const columns = ['tick', 'kind', 'speaker', 'listeners', 'act', 'claimId', 'villager', 'source', 'before', 'after', 'placeId', 'x', 'y', 'text'];
  return [columns.map(cell).join(','), ...sim.events(0).map(event => {
    const row = event as unknown as Record<string, unknown>;
    return columns.map(key => cell(key === 'x' || key === 'y' ? (row.at as Record<string, number> | undefined)?.[key] : Array.isArray(row[key]) ? (row[key] as string[]).join('|') : row[key])).join(',');
  })].join('\r\n');
}
