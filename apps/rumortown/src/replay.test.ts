import { describe, expect, it } from 'vitest';
import { cast, claims } from './content/cast/index.js';
import { villageMap } from './content/map/index.js';
import { createSimulation } from './sim/engine.js';
import { createFakeSimulation } from './sim/fake.js';
import { createRegisteredClaim, createWrittenClaim, readRegisteredClaim } from './sim/registered-claim.js';
import { createTalk } from './sim/talk/index.js';
import { createMover, createWorld } from './sim/world/index.js';
import type { Intervention } from './sim/types.js';
import { decodeShare, encodeShare } from './ui/share-link.js';
import { evaluateDare, reflectionParagraphs, runReflection } from './ui/debrief.js';

const make = (interventions: Intervention[] = []) => createSimulation({
  seed: 731, cast, claims, world: { ...createWorld(villageMap), createMover },
  talk: createTalk(cast), interventions,
});
const runTo = (sim: ReturnType<typeof make>, tick: number): void => {
  while (sim.tick < tick) sim.step();
};

// Several cases run two complete 36-person days. Shared CI runners can exceed
// Vitest's five-second default; exact event assertions remain the acceptance test.
describe('integrated village replay', { timeout: 20_000 }, () => {
  it('keeps NPC events identical when the player follows a different walking path', () => {
    const idle = make(), walking = make();
    for (let t = 0; t < 1440; t++) {
      if (t % 3 === 0) {
        const mira = walking.snapshot().villagers.find(v => v.id === 'mira')!;
        walking.movePlayer({ x: Math.floor(mira.pos.x), y: Math.floor(mira.pos.y) });
      }
      idle.step(); walking.step();
    }
    expect(walking.snapshot().player.pos).not.toEqual(idle.snapshot().player.pos);
    expect(walking.events(0)).toEqual(idle.events(0));
  });
  it('stops outside every private home while public buildings remain reachable', () => {
    for (const home of villageMap.places.filter(p => p.kind === 'home')) {
      const sim = make();
      sim.movePlayer(home.spots[0]!);
      for (let i = 0; i < 200; i++) sim.step();
      const pos = sim.snapshot().player.pos;
      expect(pos.x, home.id).toBeCloseTo(home.door.x + 0.5);
      expect(pos.y, home.id).toBeCloseTo(home.door.y + 0.5);
    }
    const sim = make(), inn = villageMap.places.find(p => p.id === 'inn')!;
    sim.movePlayer(inn.spots[0]!);
    for (let i = 0; i < 100; i++) sim.step();
    expect(sim.snapshot().player.pos).toEqual({ x: inn.spots[0]!.x + 0.5, y: inn.spots[0]!.y + 0.5 });
  });

  it('lets a replay that starts beside an awake resident leave their home', () => {
    const sim = make([{ tick: 0, listener: 'mira', claimId: 'tom-stole-bread' }]);
    const world = createWorld(villageMap), start = sim.snapshot().player.pos;
    expect(world.placeAt(start)?.kind).toBe('home');
    const square = world.place('square'); sim.movePlayer(square.door);
    for (let i = 0; i < 200; i++) sim.step();
    expect(sim.snapshot().player.pos.x).toBeCloseTo(square.door.x + .5);
    expect(sim.snapshot().player.pos.y).toBeCloseTo(square.door.y + .5);
  });

  it('pins seed 731 with one whisper at tick 60 after 1440 ticks', async () => {
    const state = decodeShare(encodeShare({ v: 1, seed: 731, cast: 'v4',
      interventions: [{ tick: 60, listener: 'mira', claimId: 'tom-stole-bread' }] }))!;
    const sim = make(state.interventions);
    runTo(sim, 59);
    expect(sim.events(0).some((e) => e.kind === 'whisper')).toBe(false);
    sim.step();
    expect(sim.interventions()).toEqual(state.interventions);
    expect(sim.events(60).find((e) => e.kind === 'whisper')?.tick).toBe(60);
    runTo(sim, 1440);
    expect(sim.snapshot().villagers.map((v) => v.id)).toEqual(cast.map((d) => d.id));
    expect(sim.events(0).some((e) => e.kind === 'line' && ['gossip', 'defend', 'accuse'].includes(e.act))).toBe(true);
    expect(sim.events(0).filter((e) => e.kind === 'day-end')).toHaveLength(1);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(sim.events(0))));
    const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    console.log(`Replay SHA-256: ${hash}`);
    expect(hash).toBe('6137d96970f7a28e05e2fb37b57b9495274d1c256208d084818a336332994184');
    const replay = make(state.interventions);
    runTo(replay, 1440);
    expect(replay.events(0)).toEqual(sim.events(0));
  });

  it('registers verified taxonomy claims in both the registry and decision list without rewriting cast data', () => {
    const sim = make();
    const original = JSON.stringify(claims);
    const claim = createRegisteredClaim({ kind: 'theft', about: 'tom', object: 'bread', severity: 2, valence: -1 }, sim.cast);
    sim.registerClaim(claim);
    expect(sim.claims.get(claim.id)?.contradicts).toEqual(['tom-brought-bread-to-ada']);
    expect(sim.claims.get('tom-brought-bread-to-ada')?.contradicts).toContain(claim.id);
    sim.registerClaim({ ...claim, text: 'Overwrite' });
    expect(sim.claims.get(claim.id)?.text).toBe(claim.text);
    expect(() => sim.registerClaim({ ...claim, id: 'unknown', about: 'nobody' })).toThrow();
    const unrelated = { ...claim, id: 'unrelated', about: 'cass', contradicts: ['tom-brought-bread-to-ada'] };
    sim.registerClaim(unrelated);
    expect(sim.claims.get(unrelated.id)?.contradicts).toEqual([]);
    expect(JSON.stringify(claims)).toBe(original);
    const different = createRegisteredClaim({ kind: 'theft', about: 'tom', target: 'jonah', object: 'coins', severity: 2, valence: -1 }, sim.cast);
    sim.registerClaim(different);
    expect(sim.claims.get(different.id)?.contradicts).toEqual([]);
  });

  it('restores typed claims only at their whisper tick and retains them through a share link', () => {
    const sim = make();
    const claim = createRegisteredClaim({ kind: 'theft', about: 'tom', object: 'bread', severity: 2, valence: -1 }, sim.cast);
    const state = decodeShare(encodeShare({ v: 1, seed: 731, cast: 'v4',
      interventions: [{ tick: 60, listener: 'mira', claimId: claim.id }] }))!;
    const replay = make(state.interventions);
    runTo(replay, 59);
    expect(replay.claims.has(claim.id)).toBe(false);
    replay.step();
    expect(replay.claims.get(claim.id)?.text).toBe(claim.text);
    expect(replay.interventions()).toEqual(state.interventions);
    expect(readRegisteredClaim('typed_theft_nobody_none_bread_2', sim.cast)).toBeNull();
    expect(readRegisteredClaim('typed_theft_tom_none_unreviewed_2', sim.cast)).toBeNull();
    // A tick-zero anchor puts the live player beside Mira, as the engine does for a replay.
    const anchor: Intervention = { tick: 0, listener: 'mira', claimId: 'tom-stole-bread' };
    const live = make([anchor]);
    live.registerClaim(claim);
    expect(live.whisper('mira', claim.id)).toBe(true);
    runTo(live, 1440);
    const fromLink = make([anchor, { tick: 0, listener: 'mira', claimId: claim.id }]);
    runTo(fromLink, 1440);
    expect(fromLink.events(0)).toEqual(live.events(0));
  });

  it('replays a live walk to Mira and whisper using only the shared interventions', () => {
    const live = make();
    runTo(live, 130);
    let reached = false;
    for (let tries = 0; tries < 200; tries++) {
      const snapshot = live.snapshot();
      const mira = snapshot.villagers.find((v) => v.id === 'mira')!;
      if (Math.hypot(mira.pos.x - snapshot.player.pos.x, mira.pos.y - snapshot.player.pos.y) <= 1.5) {
        reached = true;
        break;
      }
      if (tries % 3 === 0) live.movePlayer(mira.pos);
      live.step();
    }
    expect(reached).toBe(true);
    expect(live.whisper('mira', 'tom-stole-bread')).toBe(true);
    const replay = make(live.interventions());
    runTo(live, 1440);
    runTo(replay, 1440);
    expect(replay.events(0)).toEqual(live.events(0));
  });

  it('replays player-written prose through a shared link with the same exact events', () => {
    const anchor: Intervention = { tick: 0, listener: 'mira', claimId: 'tom-stole-bread' };
    const live = make([anchor]);
    const claim = createWrittenClaim('Tom keeps a secret stash of honey behind the mill.', 'tom', 'hoarding', 2, live.cast);
    live.registerClaim(claim);
    expect(live.whisper('mira', claim.id)).toBe(true);
    const shared = decodeShare(encodeShare({ v: 1, seed: 731, cast: 'v4', interventions: live.interventions() }))!;
    const replay = make(shared.interventions);
    runTo(live, 1440); runTo(replay, 1440);
    expect(replay.claims.get(claim.id)?.text).toBe(claim.text);
    expect(replay.events(0)).toEqual(live.events(0));
    expect(replay.events(0).some(e => e.kind === 'line' && e.claimId === claim.id)).toBe(true);
    expect(replay.claims.get(claim.id)?.contradicts).toEqual([]);
  });

  it('keeps the stand-in replay and evening card available', () => {
    const sim = createFakeSimulation(731, [{ tick: 60, listener: 'mira', claimId: 'stole' }]);
    runTo(sim, 1440);
    expect(sim.interventions()).toEqual([{ tick: 60, listener: 'mira', claimId: 'stole' }]);
    expect(sim.events(1440).some((e) => e.kind === 'day-end')).toBe(true);
  });

  it('makes all twelve new residents active participants with ties across the river', () => {
    const sim = make();
    const added = new Set(['suri', 'oren', 'leela', 'tavi', 'edda', 'arun', 'bram', 'nia', 'vesa', 'cora', 'dara', 'silas']);
    const start = new Map(sim.snapshot().villagers.map(v => [v.id, v.pos]));
    runTo(sim, 600);
    for (const v of sim.snapshot().villagers.filter(v => added.has(v.id))) expect(v.pos, v.id).not.toEqual(start.get(v.id));
    runTo(sim, 1440);
    const lines = sim.events(0).filter(e => e.kind === 'line');
    expect(new Set(lines.filter(e => added.has(e.speaker)).map(e => e.speaker))).toEqual(added);
    expect(lines.filter(e => e.listeners.some(id => added.has(id) !== added.has(e.speaker))).length).toBeGreaterThan(100);
  });

  it('rejects a whisper about its listener without recording an intervention', () => {
    const sim = make();
    const before = sim.events(0);
    expect(sim.whisper('tom', 'tom-stole-bread')).toBe(false);
    expect(sim.interventions()).toEqual([]);
    expect(sim.events(0)).toEqual(before);
    const replay = make([{ tick: 0, listener: 'tom', claimId: 'tom-stole-bread' }]);
    expect(replay.interventions()).toEqual([]);
    expect(replay.events(0).some(e => e.kind === 'whisper')).toBe(false);
  });

  it('lets an ordinary opening rumor travel across a fixed seed sample without endless fresh-news repeats', () => {
    let firstDaySpread = 0, drama = 0, transmissions = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const sim = createSimulation({ seed, cast, claims, world: { ...createWorld(villageMap), createMover },
        talk: createTalk(cast), interventions: [{ tick: 130, listener: 'mira', claimId: 'tom-stole-bread' }] });
      runTo(sim, 4320);
      const lines = sim.events(0).filter(e => e.kind === 'line');
      const passing = lines.filter(e => e.claimId === 'tom-stole-bread' && ['gossip', 'warn', 'confide', 'agree'].includes(e.act));
      if (passing.some(e => e.tick <= 1440)) firstDaySpread++;
      if (lines.some(e => ['accuse', 'defend'].includes(e.act) &&
        (e.claimId === 'tom-stole-bread' || claims.find(c => c.id === e.claimId)?.contradicts?.includes('tom-stole-bread')))) drama++;
      transmissions += passing.length;
    }
    expect(firstDaySpread).toBeGreaterThanOrEqual(12);
    expect(drama).toBeGreaterThanOrEqual(4);
    expect(transmissions).toBeLessThan(10000);
  }, 180000);

  it('reaches the third dawn with authored reflection and a dare result', () => {
    const sim = make([{ tick: 60, listener: 'mira', claimId: 'tom-stole-bread' }]);
    const reflection = runReflection(731);
    runTo(sim, 4320);
    const endings = sim.events(0).filter((e) => e.kind === 'day-end');
    expect(endings).toHaveLength(3);
    const final = endings[2]!;
    expect(final.dayIndex).toBe(2);
    expect(reflectionParagraphs(sim, final).length).toBeGreaterThanOrEqual(3);
    expect(reflectionParagraphs(sim, final).length).toBeLessThanOrEqual(5);
    expect(evaluateDare(sim, reflection.dare, final)).toMatch(/^Dare (met|missed this run)\.$/);
    sim.step();
    expect(sim.tick).toBe(4320);
  });
});
