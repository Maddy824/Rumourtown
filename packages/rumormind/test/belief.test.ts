import { describe, expect, it } from 'vitest';
import { BeliefLedger, createRng, Relationships, tell, tellScore, type Claim } from '../src/index.js';

const stole: Claim = { id: 'stole', kind: 'stole', about: 'tom', valence: -1, contradicts: ['gaveTo'] };
const gaveTo: Claim = { id: 'gaveTo', kind: 'gaveTo', about: 'tom', valence: 1, contradicts: ['stole'] };
const claims = new Map<string, Claim>([[stole.id, stole], [gaveTo.id, gaveTo]]);

const fresh = (seed = 1) => new BeliefLedger('mira', createRng(seed));

describe('BeliefLedger', () => {
  it('one telling from a moderately trusted source moves belief from 0.5 to about 0.65', () => {
    const mira = fresh();
    const r = mira.hear(stole, claims, { source: 'player', strength: 1, trust: 0.6, tick: 1 });
    expect(r.before).toBeCloseTo(0.5, 5);
    expect(r.after).toBeGreaterThan(0.62);
    expect(r.after).toBeLessThan(0.72);
  });

  it('three independent tellings reach roughly 0.9', () => {
    const mira = fresh();
    mira.hear(stole, claims, { source: 'a', strength: 1, trust: 0.6, tick: 1 });
    mira.hear(stole, claims, { source: 'b', strength: 1, trust: 0.6, tick: 2 });
    const r = mira.hear(stole, claims, { source: 'c', strength: 1, trust: 0.6, tick: 3 });
    expect(r.after).toBeGreaterThan(0.85);
    expect(r.after).toBeLessThan(0.95);
  });

  it('remembered shared origin discounts corroboration; forgotten origin creates false independence', () => {
    const remembers = fresh();
    remembers.hear(stole, claims, { source: 'a', strength: 1, trust: 0.6, tick: 1, attributedOrigin: 'player' });
    remembers.hear(stole, claims, { source: 'b', strength: 1, trust: 0.6, tick: 2, attributedOrigin: 'player' });
    const r1 = remembers.hear(stole, claims, { source: 'c', strength: 1, trust: 0.6, tick: 3, attributedOrigin: 'player' });

    const forgets = fresh();
    forgets.hear(stole, claims, { source: 'a', strength: 1, trust: 0.6, tick: 1 });
    forgets.hear(stole, claims, { source: 'b', strength: 1, trust: 0.6, tick: 2 });
    const r2 = forgets.hear(stole, claims, { source: 'c', strength: 1, trust: 0.6, tick: 3 });

    expect(r1.independent).toBe(false);
    expect(r2.independent).toBe(true);
    expect(r1.after).toBeLessThan(r2.after);
  });

  it('seeing it yourself outweighs hearing it', () => {
    const heard = fresh().hear(stole, claims, { source: 'a', strength: 1, trust: 1, tick: 1 });
    const seen = fresh().see(stole, claims, 1);
    expect(seen.after).toBeGreaterThan(heard.after);
    expect(seen.after).toBeGreaterThan(0.88);
  });

  it('a correction lowers belief, leaves a residual, and never raises it', () => {
    const mira = fresh();
    for (const s of ['a', 'b', 'c']) mira.hear(stole, claims, { source: s, strength: 1, trust: 0.6, tick: 1 });
    const peak = mira.confidence('stole');
    let last = peak;
    for (let i = 0; i < 6; i++) {
      mira.hear(gaveTo, claims, { source: 'ben', strength: 1, trust: 0.8, tick: 10 + i });
      const now = mira.confidence('stole');
      expect(now).toBeLessThanOrEqual(last);
      last = now;
    }
    expect(last).toBeLessThan(peak);
    expect(last).toBeGreaterThan(0.5);
    expect(mira.confidence('gaveTo')).toBeGreaterThan(0.8);
  });

  it('a direct correction lowers belief, keeps a residual, and reports whether it changed anything', () => {
    const mira = fresh();
    for (const s of ['a', 'b', 'c']) mira.hear(stole, claims, { source: s, strength: 1, trust: 0.6, tick: 1 });
    const peak = mira.confidence('stole');
    expect(mira.correct('stole', { credibility: 0.8, alternative: false, source: 'tom', tick: 5 })).toBe(true);
    const after = mira.confidence('stole');
    expect(after).toBeLessThan(peak);
    expect(after).toBeGreaterThan(0.5);
    expect(mira.correct('unknown', { credibility: 1, alternative: true, source: 'tom', tick: 6 })).toBe(false);
  });

  it('liking the accused dampens a harmful claim; disliking amplifies it', () => {
    const likes = fresh().hear(stole, claims, { source: 'a', strength: 1, trust: 0.6, tick: 1, affinityToTarget: 1 });
    const dislikes = fresh().hear(stole, claims, { source: 'a', strength: 1, trust: 0.6, tick: 1, affinityToTarget: -1 });
    expect(likes.after).toBeLessThan(dislikes.after);
    expect(likes.after).toBeGreaterThanOrEqual(0.5);
    expect(dislikes.after).toBeGreaterThan(0.7);
  });

  it('is deterministic for the same seed and operations', () => {
    const run = () => {
      const rng = createRng(42);
      const rel = new Relationships();
      const a = new BeliefLedger('a', rng);
      const b = new BeliefLedger('b', rng);
      const c = new BeliefLedger('c', rng);
      a.hear(stole, claims, { source: 'player', strength: 1, trust: 0.6, tick: 1 });
      tell(a, b, stole, claims, rel, rng, 2);
      tell(b, c, stole, claims, rel, rng, 3);
      for (let t = 4; t < 400; t++) c.forget(t);
      return JSON.stringify([a, b, c]);
    };
    expect(run()).toBe(run());
  });
});

describe('Relationships', () => {
  it('loses trust faster than it gains it', () => {
    const rel = new Relationships();
    rel.adjustTrust('mira', 'tom', -0.1);
    rel.adjustTrust('mira', 'tom', 0.1);
    expect(rel.trust('mira', 'tom')).toBeLessThan(0.5);
  });

  it('a trust ceiling holds permanently', () => {
    const rel = new Relationships();
    rel.setTrustCeiling('mira', 'stranger', 0.75);
    rel.setTrust('mira', 'stranger', 1);
    expect(rel.trust('mira', 'stranger')).toBe(0.75);
    rel.adjustTrust('mira', 'stranger', 0.5);
    expect(rel.trust('mira', 'stranger')).toBe(0.75);
  });
});

describe('tellScore', () => {
  it('prefers telling a close ally negative news about a distant target, and stops when they already know', () => {
    const base = { confidence: 0.8, valence: -1 as const, closenessToListener: 0.9, listenerClosenessToTarget: 0.1, listenerAlreadyKnows: false };
    expect(tellScore(base)).toBeGreaterThan(tellScore({ ...base, listenerClosenessToTarget: 0.9 }));
    expect(tellScore(base)).toBeGreaterThan(tellScore({ ...base, listenerAlreadyKnows: true }));
    expect(tellScore({ ...base, valence: 0 })).toBeLessThan(tellScore(base));
  });
});
