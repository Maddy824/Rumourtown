import { describe, expect, it } from 'vitest';
import { hear } from './beliefs';
import { createWorld, DEFAULT_STATE, replay } from './engine';
import { decodeState, encodeState } from './share';
import { TUNING as T } from './tuning';
import type { ShareState } from './types';

const scenario = (witness: boolean): ShareState => ({
  ...DEFAULT_STATE, witness, interventions: [{ t: 2, to: 'mira', claim: 'stole' }],
});
describe('one loaf, three villagers', () => {
  it('replays the same seed and ordered interventions exactly', () => {
    const config = scenario(true);
    expect(replay(config).events).toEqual(replay(config).events);
    expect(replay(config, 32).events).toEqual(replay(config).events.filter(e => e.tick <= 32));
    expect(config).toEqual(scenario(true));
  });
  it('produces a confrontation, then a stronger correction with a witness', () => {
    const without = replay(scenario(false));
    const withWitness = replay(scenario(true));
    expect(without.events.some(e => e.actor === 'mira' && e.act === 'confront')).toBe(true);
    expect(without.events.find(e => e.actor === 'mira' && e.act === 'confront')!.tick).toBeGreaterThanOrEqual(T.returnTick);
    expect(withWitness.events.some(e => e.actor === 'ben' && e.act === 'defend')).toBe(true);
    expect(withWitness.characters.mira.beliefs.stole.confidence)
      .toBeLessThan(without.characters.mira.beliefs.stole.confidence);
  });
  it('only lets people at the cottage witness the delivery', () => {
    expect(replay(scenario(false)).characters.ben.beliefs.gaveTo.provenance.some(p => p.kind === 'firsthand')).toBe(false);
    expect(replay(scenario(true)).characters.ben.beliefs.gaveTo.provenance.some(p => p.kind === 'firsthand')).toBe(true);
    expect(replay(DEFAULT_STATE).characters.mira.beliefs.stole.confidence).toBe(0.5);
    expect(replay(DEFAULT_STATE).events.some(e => e.text.includes('notices a loaf is missing'))).toBe(true);
  });
  it('calibrates neutral advice and bounds repetition without inventing corroboration', () => {
    const mira = createWorld(DEFAULT_STATE).characters.mira;
    mira.affinity.tom = 0;
    hear(mira, 'stole', 'ben', 0);
    expect(mira.beliefs.stole.confidence).toBeCloseTo(0.65, 2);
    const first = mira.beliefs.stole.logOdds;
    for (let t = 1; t < 100; t++) hear(mira, 'stole', 'ben', t);
    expect(mira.beliefs.stole.logOdds - first).toBeLessThanOrEqual(T.familiarityCap + 1e-10);
    expect(mira.beliefs.stole.provenance.filter(p => p.independent)).toHaveLength(1);
    hear(mira, 'stole', 'tom', 101, [{ source: 'ben', tick: 0 }, { source: 'tom', tick: 101 }]);
    expect(mira.beliefs.stole.provenance.at(-1)?.independent).toBe(false);
  });
  it('corrects suspicion downwards while leaving residual belief', () => {
    const mira = createWorld(DEFAULT_STATE).characters.mira;
    hear(mira, 'stole', 'stranger', 0);
    const before = mira.beliefs.stole.logOdds;
    hear(mira, 'gaveTo', 'tom', 1);
    expect(mira.beliefs.stole.logOdds).toBeLessThan(before);
    expect(mira.beliefs.stole.logOdds).toBeGreaterThan(0);
    expect(mira.beliefs.stole.provenance.at(-1)?.delta).toBeLessThan(0);
  });
  it('weights direct evidence three times neutral advice and remembers a relayed witness', () => {
    const world = createWorld(DEFAULT_STATE);
    const first = world.characters.mira;
    const second = world.characters.ben;
    first.affinity.tom = 0;
    second.affinity.tom = 0;
    hear(first, 'gaveTo', 'ben', 0);
    hear(second, 'gaveTo', 'saw', 0, [{ source: 'saw', tick: 0 }, { source: 'ben', tick: 0 }], true);
    expect(second.beliefs.gaveTo.logOdds).toBeCloseTo(first.beliefs.gaveTo.logOdds * 3);
    hear(first, 'gaveTo', 'tom', 2, [{ source: 'ben', tick: 0 }, { source: 'tom', tick: 2 }]);
    expect(first.beliefs.gaveTo.provenance.at(-1)?.independent).toBe(false);
  });
  it('only defends accusations the character has actually heard', () => {
    for (const witness of [false, true]) {
      const world = replay(scenario(witness));
      for (const event of world.events.filter(e => e.act === 'defend')) {
        expect(world.characters[event.actor!].accusations[event.to!]).toBeDefined();
        expect(world.characters[event.actor!].accusations[event.to!]!).toBeLessThanOrEqual(event.tick);
      }
    }
  });
  it('keeps beliefs and relationships bounded through conflicting interventions', () => {
    const config = scenario(true);
    config.interventions = Array.from({ length: 121 }, (_, t) => ({ t, to: 'mira', claim: t % 2 ? 'stole' : 'gaveTo' }));
    const world = replay(config);
    for (const person of Object.values(world.characters)) {
      for (const b of Object.values(person.beliefs)) {
        expect(b.confidence).toBeGreaterThanOrEqual(0);
        expect(b.confidence).toBeLessThanOrEqual(1);
      }
      for (const affinity of Object.values(person.affinity)) expect(Math.abs(affinity)).toBeLessThanOrEqual(1);
    }
    expect(world.tick).toBe(120);
    expect(world.outcome).not.toBe('');
  });
});
describe('share URLs', () => {
  it('round trips the full scenario and reproduces its log', () => {
    const state = scenario(true);
    const decoded = decodeState(encodeState(state));
    expect(decoded).toEqual(state);
    expect(replay(decoded!).events).toEqual(replay(state).events);
  });
  it('rejects malformed and unsupported input', () => {
    for (const hash of ['#%', '#null', '#{}', '#<script>', encodeState({ ...scenario(false), v: 2 } as unknown as ShareState),
      encodeState({ ...scenario(false), interventions: [{ t: 121, to: 'mira', claim: 'stole' }] })]) {
      expect(decodeState(hash)).toBeNull();
    }
  });
});
