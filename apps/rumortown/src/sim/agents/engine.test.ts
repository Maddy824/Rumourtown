import { describe, expect, it } from 'vitest';
import { createSimulation } from '../engine.js';
import { createFakeCast, createFakeMap } from '../fake.js';
import type { Dossier, GameClaim, Simulation, TalkApi, WorldApi } from '../types.js';
import { createMover, createWorld } from '../world/index.js';

const CLAIMS: GameClaim[] = [
  { id: 'stole', kind: 'theft', about: 'tom', valence: -1, text: 'Tom stole bread from the bakery', severity: 2, target: 'mira', contradicts: ['gaveTo'] },
  { id: 'gaveTo', kind: 'kindness', about: 'tom', valence: 1, text: 'Tom took bread to Ada, who is ill', severity: 1, contradicts: ['stole'], alternativeOf: 'stole' },
];

/** A talk stub: the act name is the line. */
const talk: TalkApi = {
  say: (key) => ({ lineId: `${key.act}:${key.speaker.id}`, text: key.act }),
  pickTopic: () => 'weather',
};

function world(): WorldApi {
  // The world module's mover is offered the way the engine looks for it.
  return { ...createWorld(createFakeMap()), createMover } as WorldApi;
}

function make(seed: number, cast: Dossier[] = createFakeCast(seed), claims: GameClaim[] = CLAIMS): Simulation {
  return createSimulation({ seed, cast, claims, world: world(), talk });
}

function distanceTo(sim: Simulation, id: string): number {
  const snap = sim.snapshot();
  const v = snap.villagers.find((x) => x.id === id);
  if (!v) throw new Error(`no villager ${id}`);
  return Math.hypot(v.pos.x - snap.player.pos.x, v.pos.y - snap.player.pos.y);
}

/** Walk the player up to a villager, re-aiming as they move. */
function walkTo(sim: Simulation, id: string, maxTicks = 200): boolean {
  for (let i = 0; i < maxTicks; i++) {
    if (distanceTo(sim, id) <= 1.5) return true;
    if (i % 3 === 0) {
      const v = sim.snapshot().villagers.find((x) => x.id === id)!;
      sim.movePlayer({ x: Math.floor(v.pos.x), y: Math.floor(v.pos.y) });
    }
    sim.step();
  }
  return distanceTo(sim, id) <= 2;
}

function run(sim: Simulation, ticks: number): void {
  for (let i = 0; i < ticks; i++) sim.step();
}

function belief(sim: Simulation, id: string, claimId: string): number {
  return sim.inspect(id).beliefs.find((b) => b.claimId === claimId)?.confidence ?? 0;
}

describe('createSimulation', () => {
  it('is deterministic: two runs with the same seed and inputs produce the same events and snapshots', () => {
    const play = (): Simulation => {
      const sim = make(7);
      expect(walkTo(sim, 'mira')).toBe(true);
      expect(sim.whisper('mira', 'stole')).toBe(true);
      run(sim, 400);
      return sim;
    };
    const a = play();
    const b = play();
    expect(a.tick).toBe(b.tick);
    expect(a.events(0).length).toBeGreaterThan(50);
    expect(a.events(0)).toEqual(b.events(0));
    expect(a.snapshot()).toEqual(b.snapshot());
    expect(a.inspect('mira')).toEqual(b.inspect('mira'));
  });

  it('whispers only within two tiles', () => {
    const sim = make(3);
    const snap = sim.snapshot();
    const far = [...snap.villagers].sort((x, y) => Math.hypot(y.pos.x - snap.player.pos.x, y.pos.y - snap.player.pos.y) - Math.hypot(x.pos.x - snap.player.pos.x, x.pos.y - snap.player.pos.y))[0]!;
    expect(distanceTo(sim, far.id)).toBeGreaterThan(2);
    expect(sim.whisper(far.id, 'stole')).toBe(false);
    expect(sim.interventions()).toHaveLength(0);
    expect(walkTo(sim, 'rosa')).toBe(true);
    expect(sim.whisper('rosa', 'stole')).toBe(true);
    expect(sim.interventions()).toEqual([{ tick: sim.tick, listener: 'rosa', claimId: 'stole' }]);
    const events = sim.events(sim.tick);
    expect(events.some((e) => e.kind === 'whisper' && e.listener === 'rosa')).toBe(true);
    expect(events.some((e) => e.kind === 'line' && e.act === 'reactToWhisper' && e.speaker === 'rosa')).toBe(true);
    const rosa = sim.inspect('rosa');
    const b = rosa.beliefs.find((x) => x.claimId === 'stole')!;
    expect(b.confidence).toBeGreaterThan(0.5);
    expect(b.chain[0]).toMatch(/^The stranger told Rosa at \d\d:\d\d$/);
    expect(b.independentSources).toBe(1);
  });

  it('a harmful whisper to a close friend of the subject leads to a confrontation within 300 ticks', () => {
    const cast = createFakeCast(11);
    const mira = cast.find((d) => d.id === 'mira')!;
    mira.closeTo = ['tom'];
    const sim = make(11, cast);
    // One telling lands near 0.65 by design; the stranger keeps at it until Mira is sure enough to act.
    let tries = 0;
    while (belief(sim, 'mira', 'stole') <= 0.75 && tries < 8) {
      expect(walkTo(sim, 'mira')).toBe(true);
      expect(sim.whisper('mira', 'stole')).toBe(true);
      sim.step();
      tries++;
    }
    expect(belief(sim, 'mira', 'stole')).toBeGreaterThan(0.75);
    const from = sim.tick;
    run(sim, 300);
    const events = sim.events(from);
    const decided = events.find((e) => e.kind === 'action' && e.villager === 'mira' && e.action === 'confront Tom');
    expect(decided).toBeDefined();
    // Mira is both the one wronged and Tom's friend; the victim reason ranks first.
    if (decided && decided.kind === 'action') expect(decided.why).toMatch(/^\d+% sure Tom stole bread from the bakery; (it happened to her|Tom is a friend)/);
    const accusation = events.find((e) => e.kind === 'line' && e.act === 'accuse' && e.speaker === 'mira' && e.listeners.includes('tom'));
    expect(accusation).toBeDefined();
    // Tom answers in the next line and feels it.
    const answer = events.find((e) => e.kind === 'line' && e.speaker === 'tom' && (e.act === 'deny' || e.act === 'explain' || e.act === 'refuse') && e.tick > accusation!.tick);
    expect(answer).toBeDefined();
    expect(sim.inspect('tom').relations.find((r) => r.to === 'mira')!.why).toMatch(/accused him/);
    expect(events.some((e) => e.kind === 'mood' && e.villager === 'tom' && /accused/.test(e.label))).toBe(true);
  });

  it('a witnessed contradiction lowers the main believer\u2019s belief and the stranger\u2019s trust', () => {
    const cast = createFakeCast(5);
    const tom = cast.find((d) => d.id === 'tom')!;
    const mira = cast.find((d) => d.id === 'mira')!;
    tom.schedule = [{ start: 0, place: 'bakery', activity: 'work' }];
    mira.schedule = [{ start: 0, place: 'bakery', activity: 'work' }];
    tom.secrets = [{ id: 'tom-delivery', kind: 'delivery', description: 'took bread to Ada', place: 'bakery', window: [40, 90], with: 'ada', confirms: ['kindness'], contradicts: ['theft'] }];
    const sim = make(5, cast);
    expect(walkTo(sim, 'mira')).toBe(true);
    expect(sim.tick).toBeLessThan(40);
    expect(sim.whisper('mira', 'stole')).toBe(true);
    const before = belief(sim, 'mira', 'stole');
    expect(before).toBeGreaterThan(0.55);
    expect(sim.inspect('mira').trustInStranger).toBe(0.5);
    while (sim.tick < 95) sim.step();
    const events = sim.events(40);
    expect(events.some((e) => e.kind === 'witness' && e.villager === 'mira' && e.secretId === 'tom-delivery')).toBe(true);
    expect(belief(sim, 'mira', 'stole')).toBeLessThan(before);
    expect(belief(sim, 'mira', 'gaveTo')).toBeGreaterThan(0.8);
    const mira2 = sim.inspect('mira');
    expect(mira2.trustInStranger).toBeLessThan(0.5);
    expect(mira2.trustInStranger).toBeCloseTo(0.2, 5);
    expect(events.some((e) => e.kind === 'relationship' && e.from === 'mira' && e.to === 'stranger' && /did not hold up/.test(e.why))).toBe(true);
    const chain = mira2.beliefs.find((b) => b.claimId === 'stole')!.chain;
    expect(chain).toEqual([expect.stringMatching(/^The stranger told Mira at \d\d:\d\d$/)]);
    const seen = mira2.beliefs.find((b) => b.claimId === 'gaveTo')!.chain;
    expect(seen).toEqual([expect.stringMatching(/^Mira saw it at \d\d:\d\d$/)]);
    // Tom's activity never gives the secret away.
    expect(sim.snapshot().villagers.every((v) => v.activity !== 'secret')).toBe(true);
  });

  it('replays interventions at their ticks, after the step that reaches them, as the UI records them', () => {
    const live = make(9);
    expect(walkTo(live, 'mira')).toBe(true);
    live.step();
    const at = live.tick;
    expect(live.whisper('mira', 'stole')).toBe(true);
    run(live, 150);
    const replay = createSimulation({ seed: 9, cast: createFakeCast(9), claims: CLAIMS, world: world(), talk, interventions: live.interventions() });
    run(replay, at + 150);
    expect(replay.interventions()).toEqual(live.interventions());
    expect(replay.events(at).filter((e) => e.kind !== 'line' || e.act !== 'reactToWhisper').map((e) => e.kind + e.tick)).toEqual(
      live.events(at).filter((e) => e.kind !== 'line' || e.act !== 'reactToWhisper').map((e) => e.kind + e.tick),
    );
    expect(replay.inspect('mira').beliefs).toEqual(live.inspect('mira').beliefs);
  });

  it('runs 900 ticks with 24 villagers in under 1.5 seconds and ends the day with a verdict', () => {
    const sim = make(1);
    const t0 = performance.now();
    run(sim, 900);
    const elapsed = performance.now() - t0;
    expect(elapsed).toBeLessThan(1500);
    const dayEnd = sim.events(899).find((e) => e.kind === 'day-end');
    expect(dayEnd).toBeDefined();
    if (dayEnd && dayEnd.kind === 'day-end') {
      expect(dayEnd.dayIndex).toBe(0);
      expect(dayEnd.ending).toBe('quiet');
      expect(dayEnd.summary.length).toBeGreaterThan(20);
    }
    const lines = sim.events(0).filter((e) => e.kind === 'line');
    expect(lines.length).toBeGreaterThan(100);
    expect(lines.some((e) => e.kind === 'line' && e.act === 'greet')).toBe(true);
    expect(lines.some((e) => e.kind === 'line' && e.act === 'farewell')).toBe(true);
    const snap = sim.snapshot();
    expect(snap.villagers).toHaveLength(24);
    expect(snap.minuteOfDay).toBe(7 * 60);
    expect(snap.threads.length).toBeLessThanOrEqual(60);
    const mira = sim.inspect('mira');
    expect(mira.decisions.length).toBeGreaterThan(0);
    expect(mira.decisions.length).toBeLessThanOrEqual(5);
    expect(mira.relations).toHaveLength(23);
    // eslint-disable-next-line no-console
    console.log(`900 ticks, 24 villagers: ${elapsed.toFixed(0)} ms, ${sim.events(0).length} events`);
  });
});
