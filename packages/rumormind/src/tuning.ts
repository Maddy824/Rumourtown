/**
 * Default parameters.
 * "measured" = anchored on a published finding (see README "Evidence").
 * "tuned"    = a designer starting point with no direct measurement.
 */
export interface Tuning {
  /** tuned so one telling at trust 0.6 moves belief 0.5 -> ~0.65 (people move ~39% toward advice; Bailey et al. 2023, 346 effects). */
  hearsayWeight: number;
  /** measured direction: first-hand observation weighs 2-4x hearsay. */
  firsthandWeight: number;
  /** tuned: evidence credit when the listener remembers that a new teller got it from an origin they already heard. */
  nonIndependentFactor: number;
  /** measured: illusory truth effect g≈.37 (Ye et al. 2026 meta-analysis), roughly logarithmic, flattens near 9 exposures. */
  familiarityCap: number;
  familiarityScale: number;
  /** tuned: ±30% for claims about people the listener likes/dislikes (bias on acceptance, not on judgement). */
  motivatedBias: number;
  /** tuned: fraction of positive log-odds a fully credible correction removes when it offers an alternative explanation. */
  correctionRemoval: number;
  /** tuned: same, for a bare denial (alternatives beat bare fact-checks: r=.25 vs .14, Walter & Murphy 2018). */
  correctionRemovalBare: number;
  /** measured direction: continued influence effect; a correction never fully erases a belief. */
  residualFraction: number;
  /** tuned: chance a teller passes on where they heard it (source chains shorten in retelling). */
  attributionPassRate: number;
  /** tuned: half-life, in ticks, of remembering who told you (source memory fades faster than content). */
  sourceMemoryHalfLifeTicks: number;
  /** measured direction: trust lost through integrity failures weighs 2-3x trust gained. */
  trustLossMultiplier: number;
  /** measured: negative content is shared at ~1.8-1.9x the odds of neutral content (Acerbi 2022, preregistered). */
  negativitySharingOdds: number;
}

export const DEFAULT_TUNING: Tuning = {
  hearsayWeight: 1.0,
  firsthandWeight: 2.5,
  nonIndependentFactor: 0.25,
  familiarityCap: 0.4,
  familiarityScale: 0.15,
  motivatedBias: 0.3,
  correctionRemoval: 0.4,
  correctionRemovalBare: 0.25,
  residualFraction: 0.2,
  attributionPassRate: 0.5,
  sourceMemoryHalfLifeTicks: 240,
  trustLossMultiplier: 2.5,
  negativitySharingOdds: 1.85,
};
