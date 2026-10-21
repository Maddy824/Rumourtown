// Run from the repository root: node agent-tradeoff/reports/01-smoke.mjs
import { createHash } from 'node:crypto';
import { createServer } from 'vite';

const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
try {
  const [{ cast, claims }, { villageMap }, { createSimulation }, { createTalk }, { createWorld, createMover }] = await Promise.all([
    server.ssrLoadModule('/apps/rumortown/src/content/cast/index.ts'),
    server.ssrLoadModule('/apps/rumortown/src/content/map/index.ts'),
    server.ssrLoadModule('/apps/rumortown/src/sim/engine.ts'),
    server.ssrLoadModule('/apps/rumortown/src/sim/talk/index.ts'),
    server.ssrLoadModule('/apps/rumortown/src/sim/world/index.ts'),
  ]);
  const sim = createSimulation({ seed: 731, cast, claims, talk: createTalk(cast),
    world: { ...createWorld(villageMap), createMover },
    interventions: [{ tick: 60, listener: 'mira', claimId: 'tom-stole-bread' }],
  });
  for (let tick = 0; tick < 900; tick++) sim.step();
  const events = sim.events(0);
  const counts = {};
  const acts = {};
  for (const event of events) {
    counts[event.kind] = (counts[event.kind] ?? 0) + 1;
    if (event.kind === 'line') acts[event.act] = (acts[event.act] ?? 0) + 1;
  }
  console.log('Villagers:', sim.snapshot().villagers.length);
  console.log('Event kinds:', JSON.stringify(counts));
  console.log('Speech acts:', JSON.stringify(acts));
  console.log('Day-end summary:', JSON.stringify(events.find(event => event.kind === 'day-end')));
  console.log('Replay SHA-256:', createHash('sha256').update(JSON.stringify(events)).digest('hex'));
} finally {
  await server.close();
}
