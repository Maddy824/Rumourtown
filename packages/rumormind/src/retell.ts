import { clamp } from './claims.js';
import type { Rng } from './rng.js';

export interface Retelling {
  details: string[];
  qualifiers: string[];
  core: string;
}

export type DetailTag = 'social' | 'negative';

export interface RetellTuning {
  /** Per-detail probability, clamped to 0.1..0.25. */
  detailDropRate: number;
  /** Per-qualifier probability, clamped to 0.05..0.15. */
  qualifierDropRate: number;
  /** Chance of adding one detail per retelling, clamped to 0..0.05. */
  inventionRate: number;
  inventionPool: readonly string[];
  /** Tags keyed by the exact detail string; either tag halves its drop rate, once. */
  detailTags?: ReadonlyMap<string, readonly DetailTag[]>;
}

export const DEFAULT_RETELL_TUNING: RetellTuning = {
  detailDropRate: 0.2,
  qualifierDropRate: 0.1,
  inventionRate: 0.025,
  inventionPool: [],
};

/** Independent loss trials, not a fixed count: a short retelling can lose none or all of its details. */
export function retell(
  claim: Retelling,
  rng: Rng,
  tuning: Partial<RetellTuning> = DEFAULT_RETELL_TUNING,
): Retelling {
  const t = { ...DEFAULT_RETELL_TUNING, ...tuning };
  const detailDropRate = clamp(t.detailDropRate, 0.1, 0.25);
  const qualifierDropRate = clamp(t.qualifierDropRate, 0.05, 0.15);
  const details = claim.details.filter((detail) => {
    const tags = t.detailTags?.get(detail);
    const preferred = tags?.includes('social') || tags?.includes('negative');
    return rng() >= detailDropRate * (preferred ? 0.5 : 1);
  });
  const qualifiers = claim.qualifiers.filter(() => rng() >= qualifierDropRate);
  const pool = t.inventionPool.filter((detail) => !claim.details.includes(detail));
  if (pool.length > 0 && rng() < clamp(t.inventionRate, 0, 0.05)) {
    const invented = pool[Math.floor(rng() * pool.length)];
    if (invented !== undefined) details.push(invented);
  }
  return { core: claim.core, details, qualifiers };
}
