export type CharacterId = string;
export type ClaimId = string;

/** A structured claim about a character. The simulation never reasons over free text. */
export interface Claim {
  id: ClaimId;
  /** e.g. 'stole', 'gaveTo', 'cheated'. Opaque to this library. */
  kind: string;
  /** The character the claim is about. */
  about: CharacterId;
  /** -1 harmful to `about`, 0 neutral, 1 favourable. */
  valence: -1 | 0 | 1;
  /** Claims that cannot both be true. Hearing one is evidence against the other. */
  contradicts?: ClaimId[];
  /** Plausibility before any evidence (0..1). Default 0.5. */
  basePrior?: number;
}

export const logit = (p: number): number => Math.log(p / (1 - p));
export const sigmoid = (l: number): number => 1 / (1 + Math.exp(-l));
export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
