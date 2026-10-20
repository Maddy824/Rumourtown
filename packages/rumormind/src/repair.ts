import { clamp } from './claims.js';

/** Each input is 0..1; perceivedIntent is perceived intent to cause harm. */
export interface ForgivenessInput {
  apology: number;
  empathy: number;
  perceivedIntent: number;
  anger: number;
  relationshipValue: number;
  exploitationRisk: number;
}

/** Correlate-weighted, tuned utility, not a calibrated probability of forgiveness. */
export function forgivenessScore(input: ForgivenessInput): number {
  return clamp(
    0.5 +
    0.42 * clamp(input.apology, 0, 1) +
    0.51 * clamp(input.empathy, 0, 1) -
    0.49 * clamp(input.perceivedIntent, 0, 1) -
    0.41 * clamp(input.anger, 0, 1) +
    0.2 * clamp(input.relationshipValue, 0, 1) -
    0.2 * clamp(input.exploitationRisk, 0, 1),
    0, 1,
  );
}

export interface TrustRepairInput {
  kind: 'integrity' | 'competence';
  response: 'apology' | 'denial' | 'denial-with-evidence';
}

/** Tuned multiplier for a positive trust-repair increment, not for total existing trust. */
export function trustRepair(input: TrustRepairInput): number {
  const multipliers = {
    integrity: { apology: 0.6, denial: 0.8, 'denial-with-evidence': 1.2 },
    competence: { apology: 1.2, denial: 0.6, 'denial-with-evidence': 1.0 },
  };
  return multipliers[input.kind][input.response];
}
