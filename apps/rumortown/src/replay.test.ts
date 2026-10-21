import { describe, expect, it } from 'vitest';
import { cast, claims } from './content/cast/index.js';
import { villageMap } from './content/map/index.js';
import { createSimulation } from './sim/engine.js';
import { createFakeSimulation } from './sim/fake.js';
import { createRegisteredClaim, readRegisteredClaim } from './sim/registered-claim.js';
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

describe('integrated village replay', () => {
  it('pins seed 731 with one whisper at tick 60 after 900 ticks', async () => {
    const state = decodeShare(encodeShare({ v: 1, seed: 731, cast: 'v1',
      interventions: [{ tick: 60, listener: 'mira', claimId: 'tom-stole-bread' }] }))!;
    const sim = make(state.interventions);
    runTo(sim, 59);
    expect(sim.events(0).some((e) => e.kind === 'whisper')).toBe(false);
    sim.step();
    expect(sim.interventions()).toEqual(state.interventions);
    expect(sim.events(60).find((e) => e.kind === 'whisper')?.tick).toBe(60);
    runTo(sim, 900);
    expect(sim.snapshot().villagers.map((v) => v.id)).toEqual(cast.map((d) => d.id));
    expect(sim.events(0).some((e) => e.kind === 'line' && ['gossip', 'defend', 'accuse'].includes(e.act))).toBe(true);
    expect(sim.events(0).filter((e) => e.kind === 'day-end')).toHaveLength(1);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(sim.events(0))));
    const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    console.log(`Replay SHA-256: ${hash}`);
    expect(hash).toBe('37969fab5d382e233387147d50a03731979d309b36bb98086651fe89b2cc1b6b');
    const replay = make(state.interventions);
    runTo(replay, 900);
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
  });

  it('restores typed claims only at their whisper tick and retains them through a share link', () => {
    const sim = make();
    const claim = createRegisteredClaim({ kind: 'theft', about: 'tom', object: 'bread', severity: 2, valence: -1 }, sim.cast);
    const state = decodeShare(encodeShare({ v: 1, seed: 731, cast: 'v1',
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
    runTo(live, 900);
    const fromLink = make([anchor, { tick: 0, listener: 'mira', claimId: claim.id }]);
    runTo(fromLink, 900);
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
    runTo(live, 900);
    runTo(replay, 900);
    expect(replay.events(0)).toEqual(live.events(0));
  });

  it('keeps the stand-in replay and evening card available', () => {
    const sim = createFakeSimulation(731, [{ tick: 60, listener: 'mira', claimId: 'stole' }]);
    runTo(sim, 900);
    expect(sim.interventions()).toEqual([{ tick: 60, listener: 'mira', claimId: 'stole' }]);
    expect(sim.events(900).some((e) => e.kind === 'day-end')).toBe(true);
  });

  it('reaches the third evening with authored reflection and a dare result', () => {
    const sim = make([{ tick: 60, listener: 'mira', claimId: 'tom-stole-bread' }]);
    const reflection = runReflection(731);
    runTo(sim, 2700);
    const endings = sim.events(0).filter((e) => e.kind === 'day-end');
    expect(endings).toHaveLength(3);
    const final = endings[2]!;
    expect(final.dayIndex).toBe(2);
    expect(reflectionParagraphs(sim, final).length).toBeGreaterThanOrEqual(3);
    expect(reflectionParagraphs(sim, final).length).toBeLessThanOrEqual(5);
    expect(evaluateDare(sim, reflection.dare, final)).toMatch(/^Dare (met|missed this run)\.$/);
    sim.step();
    expect(sim.tick).toBe(2700);
  });
});
