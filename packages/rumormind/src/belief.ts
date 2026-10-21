import { type Claim, type ClaimId, type CharacterId, logit, sigmoid, clamp } from './claims.js';
import { DEFAULT_TUNING, type Tuning } from './tuning.js';
import type { Rng } from './rng.js';

export type EvidenceKind = 'heard' | 'saw' | 'corrected';

/** One piece of remembered evidence: who, when, and how much it moved the belief. */
export interface Provenance {
  kind: EvidenceKind;
  /** Who told me, or 'self' for things I saw. */
  source: CharacterId | 'self';
  /** Where I remember the source got it. Fades with time; when it fades, `source` stands in for it. */
  origin: string;
  tick: number;
  delta: number;
}

export interface Belief {
  claimId: ClaimId;
  logOdds: number;
  peakLogOdds: number;
  exposures: number;
  provenance: Provenance[];
}

export interface HearOptions {
  source: CharacterId;
  /** The teller's expressed confidence, 0..1. */
  strength: number;
  /** The listener's trust in the teller, 0..1. */
  trust: number;
  tick: number;
  /** What the teller said about where they heard it, if anything. */
  attributedOrigin?: string;
  /** The listener's affinity for the person the claim is about, -1..1. */
  affinityToTarget?: number;
  /** Whether this claim offers an alternative explanation for contradicted claims. Default true. */
  alternativeExplanation?: boolean;
}

/** How strongly a correction counts: the listener's trust in its source times its clarity, and whether it explains the facts another way. */
export interface Correction {
  credibility: number;
  alternative: boolean;
  source: CharacterId | 'self';
  tick: number;
}

export interface HearResult {
  before: number;
  after: number;
  independent: boolean;
  corrected: ClaimId[];
}

/** Everything one character believes, with the remembered trail of who told them. */
export class BeliefLedger {
  readonly beliefs = new Map<ClaimId, Belief>();

  constructor(
    readonly owner: CharacterId,
    private readonly rng: Rng,
    private readonly tuning: Tuning = DEFAULT_TUNING,
  ) {}

  confidence(claimId: ClaimId): number {
    const b = this.beliefs.get(claimId);
    return b ? sigmoid(b.logOdds) : 0;
  }

  knows(claimId: ClaimId): boolean {
    return this.beliefs.has(claimId);
  }

  /** The origin this character would cite if asked "where did you hear that?" */
  rememberedOrigin(claimId: ClaimId): string | undefined {
    const b = this.beliefs.get(claimId);
    if (!b) return undefined;
    const last = b.provenance[b.provenance.length - 1];
    return last?.origin;
  }

  hear(claim: Claim, claims: ReadonlyMap<ClaimId, Claim>, opts: HearOptions): HearResult {
    const t = this.tuning;
    const b = this.getOrCreate(claim, opts.affinityToTarget ?? 0);
    const before = sigmoid(b.logOdds);
    const originKey = opts.attributedOrigin ?? opts.source;

    // False independence is the bias the player can exploit: a second teller only counts as
    // corroboration if the listener does not remember the same origin behind it.
    const independent = !b.provenance.some((p) => p.origin === originKey || p.source === opts.source);
    const independence = independent ? 1 : t.nonIndependentFactor;

    const evidence =
      t.hearsayWeight * clamp(opts.trust, 0, 1) * clamp(opts.strength, 0, 1) * independence;

    const familiarityBefore = this.familiarity(b.exposures);
    b.exposures += 1;
    const familiarityDelta = this.familiarity(b.exposures) - familiarityBefore;

    const delta = evidence + familiarityDelta;
    b.logOdds += delta;
    b.peakLogOdds = Math.max(b.peakLogOdds, b.logOdds);
    b.provenance.push({ kind: 'heard', source: opts.source, origin: originKey, tick: opts.tick, delta });

    const corrected = this.applyContradictions(claim, claims, {
      credibility: clamp(opts.trust, 0, 1) * clamp(opts.strength, 0, 1),
      alternative: opts.alternativeExplanation ?? true,
      source: opts.source,
      tick: opts.tick,
    });

    return { before, after: sigmoid(b.logOdds), independent, corrected };
  }

  /** Seeing it yourself. `clarity` 0..1 covers distance, darkness and ambiguity. */
  see(claim: Claim, claims: ReadonlyMap<ClaimId, Claim>, tick: number, clarity = 1): HearResult {
    const b = this.getOrCreate(claim, 0);
    const before = sigmoid(b.logOdds);
    const delta = this.tuning.firsthandWeight * clamp(clarity, 0, 1);
    b.logOdds += delta;
    b.peakLogOdds = Math.max(b.peakLogOdds, b.logOdds);
    b.exposures += 1;
    b.provenance.push({ kind: 'saw', source: 'self', origin: 'self', tick, delta });
    const corrected = this.applyContradictions(claim, claims, {
      credibility: clamp(clarity, 0, 1),
      alternative: true,
      source: 'self',
      tick,
    });
    return { before, after: sigmoid(b.logOdds), independent: true, corrected };
  }

  /** Call once per tick. Who-told-me fades: an attributed origin collapses to the immediate source. */
  forget(tick: number): void {
    const perTick = Math.LN2 / this.tuning.sourceMemoryHalfLifeTicks;
    for (const b of this.beliefs.values()) {
      for (const p of b.provenance) {
        if (p.origin !== p.source && tick > p.tick && this.rng() < perTick) p.origin = p.source;
      }
    }
  }

  toJSON(): unknown {
    return { owner: this.owner, beliefs: [...this.beliefs.values()] };
  }

  /**
   * First contact with a claim sets its prior. Liking the person it is about shifts a harmful claim's
   * prior down and a favourable one up: motivated reasoning as a prior offset, never a flipped sign.
   */
  private getOrCreate(claim: Claim, affinityToTarget: number): Belief {
    let b = this.beliefs.get(claim.id);
    if (!b) {
      const prior = clamp(claim.basePrior ?? 0.5, 0.01, 0.99);
      const offset = claim.valence * this.tuning.motivatedBias * clamp(affinityToTarget, -1, 1);
      const logOdds = logit(prior) + offset;
      b = { claimId: claim.id, logOdds, peakLogOdds: logOdds, exposures: 0, provenance: [] };
      this.beliefs.set(claim.id, b);
    }
    return b;
  }

  /** Illusory-truth bonus: nothing on the first hearing, then a slow power-law climb to the cap. */
  private familiarity(exposures: number): number {
    if (exposures <= 1) return 0;
    return Math.min(this.tuning.familiarityCap, this.tuning.familiarityScale * Math.pow(exposures - 1, 0.25));
  }

  /**
   * A direct correction of one claim, for example a bare denial heard from the accused.
   * Reduces belief by the tuned fraction (less without an alternative explanation), leaves the
   * continued-influence residual, and never raises belief. Returns true when anything changed.
   */
  correct(claimId: ClaimId, c: Correction): boolean {
    const b = this.beliefs.get(claimId);
    if (!b) return false;
    return this.correctOne(b, c);
  }

  private correctOne(other: Belief, c: Correction): boolean {
    if (other.logOdds <= 0) return false;
    const removal =
      (c.alternative ? this.tuning.correctionRemoval : this.tuning.correctionRemovalBare) * clamp(c.credibility, 0, 1);
    const floor = this.tuning.residualFraction * Math.max(other.peakLogOdds, 0);
    const next = Math.max(other.logOdds * (1 - removal), floor);
    const delta = Math.min(0, next - other.logOdds);
    if (delta === 0) return false;
    other.logOdds += delta;
    other.provenance.push({ kind: 'corrected', source: c.source, origin: c.source, tick: c.tick, delta });
    return true;
  }

  /** Evidence for a claim is a correction of every claim it contradicts. */
  private applyContradictions(claim: Claim, claims: ReadonlyMap<ClaimId, Claim>, c: Correction): ClaimId[] {
    const corrected: ClaimId[] = [];
    for (const otherId of claim.contradicts ?? []) {
      if (!claims.has(otherId)) continue;
      const other = this.beliefs.get(otherId);
      if (other && this.correctOne(other, c)) corrected.push(otherId);
    }
    return corrected;
  }
}
