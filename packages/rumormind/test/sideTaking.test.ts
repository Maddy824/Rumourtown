import { describe, expect, it } from 'vitest';
import { chooseSide, sideScore } from '../src/index.js';

const neutral = {
  loyaltyToAccuser: 0.5, loyaltyToAccused: 0.5, perceivedWrongness: 0,
  expectedReciprocity: 0, conflictCost: 0,
};

describe('sideScore', () => {
  it('lets loyalty favour either party and balances equal loyalty', () => {
    expect(chooseSide(sideScore(neutral))).toBe('neutral');
    expect(chooseSide(sideScore({ ...neutral, loyaltyToAccuser: 1 }))).toBe('accuser');
    expect(chooseSide(sideScore({ ...neutral, loyaltyToAccused: 1 }))).toBe('accused');
  });

  it('combines wrongness, reciprocity and the cost of backing the accuser', () => {
    const input = { ...neutral, perceivedWrongness: 0.5, expectedReciprocity: 0.2 };
    expect(sideScore(input)).toBeCloseTo(0.7);
    expect(chooseSide(sideScore({ ...input, conflictCost: 0.4 }))).toBe('neutral');
    expect(chooseSide(sideScore({ ...neutral, perceivedWrongness: -0.5 }))).toBe('accused');
    expect(chooseSide(sideScore({ ...neutral, expectedReciprocity: -0.5 }))).toBe('accused');
  });

  it('clamps input factors to their documented ranges', () => {
    expect(sideScore({ ...neutral, loyaltyToAccuser: 3, loyaltyToAccused: -1 }))
      .toBe(sideScore({ ...neutral, loyaltyToAccuser: 1, loyaltyToAccused: 0 }));
    expect(sideScore({ ...neutral, perceivedWrongness: -5, expectedReciprocity: 5, conflictCost: 5 }))
      .toBe(sideScore({ ...neutral, perceivedWrongness: -1, expectedReciprocity: 1, conflictCost: 1 }));
  });
});

describe('chooseSide', () => {
  it('uses a symmetric neutral band with inclusive default boundaries', () => {
    expect(chooseSide(0.4)).toBe('accuser');
    expect(chooseSide(-0.4)).toBe('accused');
    for (const score of [-0.399, 0, 0.399]) expect(chooseSide(score)).toBe('neutral');
  });

  it('supports custom and zero thresholds and rejects invalid thresholds', () => {
    expect(chooseSide(0.5, 0.6)).toBe('neutral');
    expect(chooseSide(-0.6, 0.6)).toBe('accused');
    expect(chooseSide(0, 0)).toBe('neutral');
    expect(chooseSide(0.01, 0)).toBe('accuser');
    expect(chooseSide(-0.01, 0)).toBe('accused');
    for (const threshold of [-1, NaN, Infinity]) {
      expect(() => chooseSide(1, threshold)).toThrow(RangeError);
    }
  });
});
