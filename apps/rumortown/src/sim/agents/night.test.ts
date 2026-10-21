import { describe, expect, it } from 'vitest';
import { cast, claims } from '../../content/cast/index.js';
import { wakeMinute } from '../../content/cast/night.js';
import { villageMap } from '../../content/map/index.js';
import { createSimulation } from '../engine.js';
import { createTalk } from '../talk/index.js';
import { MINUTES_PER_DAY, type Intervention } from '../types.js';
import { createWorld, createMover } from '../world/index.js';
import { currentEntryIndex } from './schedule.js';

const make = (days = 3, extra: Intervention[] = []) => createSimulation({ seed: 731, cast, claims, days,
  world: { ...createWorld(villageMap), createMover }, talk: createTalk(cast),
  interventions: [{ tick: 60, listener: 'mira', claimId: 'tom-stole-bread' }, ...extra] });

describe('a full village night', () => {
  it('sleeps at home, refuses sleeping whispers, keeps the inn social, and ends at dawn', () => {
    const sim = make();
    while (sim.tick < 1020) sim.step(); // 23:00
    const snap = sim.snapshot();
    const sleeping = snap.villagers.filter(v => v.activity === 'sleep');
    const world = createWorld(villageMap);
    expect(sleeping).toHaveLength(27);
    for (const v of sleeping) {
      const home = world.place(cast.find(d => d.id === v.id)!.home).rect;
      expect(v.pos.x >= home.x && v.pos.x < home.x + home.w && v.pos.y >= home.y && v.pos.y < home.y + home.h, v.id).toBe(true);
    }
    const sleeper = sleeping.find(v => v.id !== 'tom')!;
    const rejected = make(3, [{ tick: 1020, listener: sleeper.id, claimId: 'tom-stole-bread' }]);
    // Replay force also obeys sleep, so links cannot wake a sleeper or move the player.
    while (rejected.tick < 1020) rejected.step();
    expect(rejected.whisper(sleeper.id, 'tom-stole-bread')).toBe(false);
    expect(rejected.interventions()).toHaveLength(1);
    expect(rejected.snapshot().player.pos).toEqual(snap.player.pos);
    expect(snap.villagers.find(v => v.id === 'dag')!.activity).not.toBe('sleep');
    while (sim.tick < 1350) sim.step();
    const baker = sim.snapshot().villagers.find(v => v.id === 'mira')!;
    expect(baker.activity).toBe('work');
    expect(world.placeAt(baker.pos)?.id).toBe('bakery');
    while (sim.tick < MINUTES_PER_DAY) sim.step();
    const nightLines = sim.events(930).filter(e => e.kind === 'line').filter(e => e.tick < 1110);
    const innLines = nightLines.filter(e => e.placeId === 'inn');
    expect(innLines.length).toBeGreaterThan(10);
    expect(innLines.some(e => ['gossip', 'agree', 'warn', 'confide', 'defend', 'doubt', 'news'].includes(e.act))).toBe(true);
    expect(sim.events(0).filter(e => e.kind === 'line' && e.speaker === sleeper.id && e.tick > 1020 && e.tick < 1350)).toEqual([]);
    const bridgeWitnesses = sim.events(1020).filter(e => e.kind === 'witness' && e.secretId === 'lio-midnight-meeting');
    expect(bridgeWitnesses.some(e => e.kind === 'witness' && e.villager === 'dag')).toBe(true);
    expect(sim.snapshot().minuteOfDay).toBe(360);
    expect(sim.events(1440).some(e => e.kind === 'day-end')).toBe(true);
    console.log('Night replay inspection', JSON.stringify({ events: sim.events(0).length, sleepingAt2300: sleeping.map(v => v.id), awakeAt2300: snap.villagers.filter(v => v.activity !== 'sleep').map(v => v.id), innNightLines: innLines.length, innActs: [...new Set(innLines.map(e => e.act))] }));
  });

  it('rotates five inn regulars, sends late errands twice weekly, and wakes by conscientiousness', () => {
    const groups: string[] = [];
    for (let day = 0; day < 7; day++) {
      const inn = cast.filter(d => { const e = d.schedule[currentEntryIndex(d.schedule, 1030, day)]!; return e.place === 'inn' && e.activity === 'talk'; });
      expect(inn).toHaveLength(5);
      groups.push(inn.map(d => d.id).join(','));
      for (const id of ['rook', 'cass']) {
        const d = cast.find(d => d.id === id)!;
        const e = d.schedule[currentEntryIndex(d.schedule, 1000, day)]!;
        expect(e.activity === 'errand', `${id}, weekday ${day}`).toBe([1, 4].includes(day));
      }
    }
    expect(new Set(groups).size).toBeGreaterThan(3);
    for (const d of cast) { expect(wakeMinute(d)).toBeGreaterThanOrEqual(330); expect(wakeMinute(d)).toBeLessThanOrEqual(420); }
  });
});
