import { describe, expect, it } from 'vitest';
import { cast, castVersion, claims } from '../content/cast/index.js';
import { villageMap } from '../content/map/index.js';
import { createRegisteredClaim, createWrittenClaim } from '../sim/registered-claim.js';
import { createSimulation } from '../sim/engine.js';
import { createTalk } from '../sim/talk/index.js';
import { createMover, createWorld } from '../sim/world/index.js';
import { eventsCsv, exportRun, pairedExperiment, type Factory } from './model.js';

const make: Factory = (seed, interventions, tuning) => createSimulation({ seed, interventions, tuning, cast, claims,
  world: { ...createWorld(villageMap), createMover }, talk: createTalk(cast) });

describe('research observations', () => {
  it.each(['tom-stole-bread', createRegisteredClaim({ kind: 'theft', about: 'ben', object: 'bread', severity: 2, valence: -1 }, new Map(cast.map(d => [d.id, d]))).id, createWrittenClaim('Tom keeps honey hidden by the mill', 'tom', 'hoarding', 2, new Map(cast.map(d => [d.id, d]))).id])('reconstructs exported inputs, including runtime claims: %s', claimId => {
    const sim = make(731, [{ tick: 60, listener: 'mira', claimId }]);
    while (sim.tick < 240) sim.step();
    const before = JSON.stringify(sim.snapshot());
    const saved = JSON.parse(JSON.stringify(exportRun(sim, 731, castVersion, villageMap)));
    const replay = createSimulation({ seed: saved.seed, cast: saved.cast, claims: saved.replayInputs.initialClaims, interventions: saved.interventions,
      tuning: saved.tuning, world: { ...createWorld(saved.map), createMover }, talk: createTalk(saved.cast) });
    while (replay.tick < saved.tick) replay.step();
    expect(replay.events(0)).toEqual(saved.events);
    expect(JSON.stringify(sim.snapshot())).toBe(before);
    const lines = saved.events.filter((e: { kind: string }) => e.kind === 'line');
    expect(lines.length).toBeGreaterThan(10);
    for (const line of lines) {
      expect(createWorld(villageMap).isWalkable(line.at.x, line.at.y)).toBe(true);
      if (line.placeId) {
        const place = villageMap.places.find(p => p.id === line.placeId)!;
        expect(line.at.x).toBeGreaterThanOrEqual(place.rect.x);
        expect(line.at.x).toBeLessThan(place.rect.x + place.rect.w);
        expect(line.at.y).toBeGreaterThanOrEqual(place.rect.y);
        expect(line.at.y).toBeLessThan(place.rect.y + place.rect.h);
      }
    }
    expect(eventsCsv(sim)).toContain('"placeId","x","y"');
    expect(eventsCsv(sim).split('\r\n').length).toBe(sim.events(0).length + 1);
  });

  it('has identical paired outcomes when removing whispers from a run with none, and respects cancellation', async () => {
    const result = await pairedExperiment(make, 731, [], 'no-whispers', 1, () => undefined);
    expect(result?.runs).toHaveLength(1);
    const row = result!.runs[0]!;
    expect(row.baseline).toEqual(row.comparison);
    expect(row.series).toHaveLength(31);
    for (const point of row.series) expect(point.baseline).toEqual(point.comparison);
    expect(row.baseline.tick).toBe(4320);
    expect(await pairedExperiment(make, 731, [], 'no-familiarity', 1, () => undefined, () => true)).toBeNull();
  }, 15000);
});
