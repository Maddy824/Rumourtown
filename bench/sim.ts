/** Run with Node 22+: node --experimental-strip-types bench/sim.ts. */
import { writeFileSync } from 'node:fs';
import os from 'node:os';
import { performance } from 'node:perf_hooks';
import { build } from 'vite';
import type { Dossier, Vec2 } from '../apps/rumortown/src/sim/types.js';

// Bundle the real modules once, outside the timings. Node's type stripping does not resolve
// the source tree's .js-to-.ts imports; Vite is already a development dependency of this repo.
const output = await build({ configFile: false, logLevel: 'silent',
  build: { ssr: 'bench/entry.ts', write: false, minify: false }, ssr: { noExternal: ['rumormind'] } });
if (Array.isArray(output) || !('output' in output)) throw new Error('Expected a single benchmark bundle');
const chunk = output.output.find(item => item.type === 'chunk');
if (!chunk || chunk.type !== 'chunk') throw new Error('Missing benchmark bundle');
const api: typeof import('./entry.js') = await import(`data:text/javascript;base64,${Buffer.from(chunk.code).toString('base64')}`);
const { cast, claims, villageMap, createSimulation, createTalk, createWorld, createMover, createRng, BeliefLedger } = api;
const rng = createRng(731);
const world = { ...createWorld(villageMap), createMover };

function percentile(samples: number[], fraction: number): number {
  const sorted = samples.slice().sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))]!;
}
const rows: string[] = [];
const backgrounds = cast.filter(d => d.tier === 'background');
const expanded: Dossier[] = cast.slice();
for (let i = 0; expanded.length < 60; i++) {
  const base = backgrounds[i % backgrounds.length]!;
  expanded.push({ ...base, id: `${base.id}-${i}`, name: `${base.name} ${i + 1}`, knows: [],
    secrets: base.secrets.map(s => ({ ...s, id: `${s.id}-${i}` })),
    schedule: base.schedule.map((s, j) => ({ ...s, start: j === 0 ? 0 : Math.min(899, s.start + (i % 5) * 3) })) });
}
for (const population of [cast, expanded]) {
  const initStart = performance.now();
  const sim = createSimulation({ seed: 731, cast: population, claims, world, talk: createTalk(population),
    interventions: [{ tick: 130, listener: 'mira', claimId: 'tom-stole-bread' }] });
  const setupMs = performance.now() - initStart;
  const samples: number[] = [];
  const start = performance.now();
  for (let tick = 0; tick < 2700; tick++) {
    const before = performance.now(); sim.step(); samples.push(performance.now() - before);
  }
  const wall = performance.now() - start;
  rows.push(`| Simulation, ${population.length} villagers (2,700 ticks) | ${percentile(samples, .5).toFixed(4)} ms | ${percentile(samples, .95).toFixed(4)} ms | ${wall.toFixed(1)} ms | ${(2700 / (wall / 1000)).toFixed(0)} |`);
  console.error(`${population.length} villagers: setup ${setupMs.toFixed(1)} ms, timed run ${wall.toFixed(1)} ms`);
}

const reachable: Vec2[] = [];
for (let y = 0; y < villageMap.height; y++) for (let x = 0; x < villageMap.width; x++) {
  if (world.isWalkable(x, y)) reachable.push({ x, y });
}
const paths: number[] = [];
let pathWall = 0;
for (let attempts = 0; paths.length < 1000 && attempts < 10000; attempts++) {
  const a = reachable[Math.floor(rng() * reachable.length)]!, b = reachable[Math.floor(rng() * reachable.length)]!;
  const before = performance.now(); const path = world.findPath(a, b); const elapsed = performance.now() - before;
  if (path) { paths.push(elapsed); pathWall += elapsed; }
}
if (paths.length !== 1000) throw new Error('Could not sample 1,000 reachable pairs');
rows.push(`| A*, 1,000 reachable pairs | ${percentile(paths, .5).toFixed(4)} ms | ${percentile(paths, .95).toFixed(4)} ms | ${pathWall.toFixed(1)} ms | — |`);

const hearings: number[] = [];
const registry = new Map(claims.map(c => [c.id, c]));
const claim = claims.find(c => c.id === 'tom-stole-bread')!;
let ledger = new BeliefLedger('mira', rng);
let hearWall = 0;
for (let tick = 0; tick < 100000; tick++) {
  // Bound memory growth to 100 hearings, reflecting ordinary ledgers rather than an ever-growing log.
  if (tick % 100 === 0) ledger = new BeliefLedger('mira', rng);
  const before = performance.now();
  ledger.hear(claim, registry, { source: `source-${tick % 24}`, strength: .8, trust: .6, tick });
  const elapsed = performance.now() - before; hearings.push(elapsed); hearWall += elapsed;
}
rows.push(`| BeliefLedger.hear, 100,000 calls | ${percentile(hearings, .5).toFixed(4)} ms | ${percentile(hearings, .95).toFixed(4)} ms | ${hearWall.toFixed(1)} ms | — |`);

const report = `# Benchmarks\n\nMeasured 21 October 2026 on ${os.cpus()[0]?.model ?? os.arch()}, ${os.platform()} ${os.arch()}, Node ${process.version}. Seed 731.\n\n| Workload | Median per operation | p95 per operation | Total measured time | Game-minutes/second |\n|---|---:|---:|---:|---:|\n${rows.join('\n')}\n\nSimulation rows run the real map, authored talk, cast and engine for three full days with one opening whisper. The 60-person cast duplicates background villagers with unique IDs and shifted schedules. Bundle compilation and simulation setup are excluded; setup time is printed to stderr. A* totals include successful pairs only. Hearings reset the ledger every 100 calls; timing overhead is included and tiny measurements should be read as approximate. These are desktop CPU measurements, not phone rendering or Safari results. Run \`npm run bench\` to reproduce.\n`;
writeFileSync(new URL('./results.md', import.meta.url), report);
console.log(report);
