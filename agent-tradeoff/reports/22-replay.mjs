// Inspect before changing the raw replay pin; optionally write the complete event log.
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createServer } from 'vite';
const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
try {
  const [{ cast, claims }, { villageMap }, { createSimulation }, { createTalk }, { createWorld, createMover }] = await Promise.all([
    server.ssrLoadModule('/apps/rumortown/src/content/cast/index.ts'), server.ssrLoadModule('/apps/rumortown/src/content/map/index.ts'),
    server.ssrLoadModule('/apps/rumortown/src/sim/engine.ts'), server.ssrLoadModule('/apps/rumortown/src/sim/talk/index.ts'), server.ssrLoadModule('/apps/rumortown/src/sim/world/index.ts'),
  ]);
  const sim = createSimulation({ seed: 731, cast, claims, talk: createTalk(cast), world: { ...createWorld(villageMap), createMover }, interventions: [{ tick: 60, listener: 'mira', claimId: 'tom-stole-bread' }] });
  while (sim.tick < 1020) sim.step();
  const night = sim.snapshot();
  while (sim.tick < 1440) sim.step();
  const events = sim.events(0), kinds = {}, acts = {};
  for (const e of events) { kinds[e.kind] = (kinds[e.kind] ?? 0) + 1; if (e.kind === 'line') acts[e.act] = (acts[e.act] ?? 0) + 1; }
  const inn = events.filter(e => e.kind === 'line' && e.tick >= 930 && e.tick < 1110 && e.placeId === 'inn');
  console.log(JSON.stringify({ kinds, acts, asleepAt2300: night.villagers.filter(v => v.activity === 'sleep').map(v => v.id), awakeAt2300: night.villagers.filter(v => v.activity !== 'sleep').map(v => v.id), innNightLines: inn.length, innNightActs: [...new Set(inn.map(e => e.act))], nightWitnesses: events.filter(e => e.kind === 'witness' && ['fen-late-flock', 'lio-midnight-meeting'].includes(e.secretId)), dawn: sim.snapshot().minuteOfDay, ending: events.find(e => e.kind === 'day-end'), hash: createHash('sha256').update(JSON.stringify(events)).digest('hex') }, null, 2));
  if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(events));
} finally { await server.close(); }
