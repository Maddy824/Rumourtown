import { clamp } from './claims.js';

export interface SideScoreInput {
  /** Loyalties are 0..1. */
  loyaltyToAccuser: number;
  loyaltyToAccused: number;
  /** -1 the accusation is wrong, +1 the accused's conduct is wrong. */
  perceivedWrongness: number;
  /** -1 favours backing the accused, +1 favours backing the accuser. */
  expectedReciprocity: number;
  /** 0..1 cost of backing the accusation. */
  conflictCost: number;
}

export type Side = 'accuser' | 'accused' | 'neutral';

/** Signed utility: loyalty difference + wrongness + reciprocity - conflict cost. */
export function sideScore(input: SideScoreInput): number {
  return (
    clamp(input.loyaltyToAccuser, 0, 1) -
    clamp(input.loyaltyToAccused, 0, 1) +
    clamp(input.perceivedWrongness, -1, 1) +
    clamp(input.expectedReciprocity, -1, 1) -
    clamp(input.conflictCost, 0, 1)
  );
}

/** Threshold boundaries take a side; an exactly zero score is always neutral. */
export function chooseSide(score: number, threshold = 0.4): Side {
  if (!Number.isFinite(threshold) || threshold < 0) {
    throw new RangeError('Side threshold must be finite and non-negative');
  }
  if (score > 0 && score >= threshold) return 'accuser';
  if (score < 0 && score <= -threshold) return 'accused';
  return 'neutral';
}
