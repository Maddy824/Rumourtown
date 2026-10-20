import { describe, expect, it } from 'vitest';
import { createRng, forgivenessScore, trustRepair, type ForgivenessInput } from '../src/index.js';

const baseline: ForgivenessInput = {
  apology: 0, empathy: 0, perceivedIntent: 0, anger: 0, relationshipValue: 0, exploitationRisk: 0,
};

describe('forgivenessScore', () => {
  it('uses the four specified correlates before saturation', () => {
    const before = forgivenessScore(baseline);
    for (const [factor, coefficient] of [
      ['apology', 0.42], ['empathy', 0.51], ['perceivedIntent', -0.49], ['anger', -0.41],
    ] as const) {
      expect(forgivenessScore({ ...baseline, [factor]: 0.5 }) - before).toBeCloseTo(coefficient * 0.5);
    }
  });

  it('raises forgiveness for valuable relationships and lower exploitation risk', () => {
    expect(forgivenessScore({ ...baseline, relationshipValue: 1 })).toBeGreaterThan(forgivenessScore(baseline));
    expect(forgivenessScore(baseline)).toBeGreaterThan(forgivenessScore({ ...baseline, exploitationRisk: 1 }));
  });

  it('saturates at 0 and 1 and stays bounded over seeded inputs', () => {
    expect(forgivenessScore({ ...baseline, apology: 1, empathy: 1, relationshipValue: 1 })).toBe(1);
    expect(forgivenessScore({ ...baseline, perceivedIntent: 1, anger: 1, exploitationRisk: 1 })).toBe(0);
    const rng = createRng(3);
    for (let i = 0; i < 1000; i++) {
      const score = forgivenessScore({
        apology: rng() * 4 - 1, empathy: rng() * 4 - 1, perceivedIntent: rng() * 4 - 1,
        anger: rng() * 4 - 1, relationshipValue: rng() * 4 - 1, exploitationRisk: rng() * 4 - 1,
      });
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });
});

describe('trustRepair', () => {
  it('favours evidence-backed denial over apology and bare denial for integrity', () => {
    const evidence = trustRepair({ kind: 'integrity', response: 'denial-with-evidence' });
    expect(evidence).toBeGreaterThan(trustRepair({ kind: 'integrity', response: 'apology' }));
    expect(evidence).toBeGreaterThan(trustRepair({ kind: 'integrity', response: 'denial' }));
  });

  it('favours apology over bare denial for competence and gives finite positive multipliers', () => {
    expect(trustRepair({ kind: 'competence', response: 'apology' }))
      .toBeGreaterThan(trustRepair({ kind: 'competence', response: 'denial' }));
    for (const kind of ['integrity', 'competence'] as const) {
      for (const response of ['apology', 'denial', 'denial-with-evidence'] as const) {
        const multiplier = trustRepair({ kind, response });
        expect(Number.isFinite(multiplier)).toBe(true);
        expect(multiplier).toBeGreaterThan(0);
      }
    }
  });
});
