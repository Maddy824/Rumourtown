import type { ShareState } from './types';
import { TUNING } from './tuning';

export function encodeState(state: ShareState): string {
  return `#${encodeURIComponent(JSON.stringify(state))}`;
}
export function decodeState(hash: string): ShareState | null {
  try {
    const value: unknown = JSON.parse(decodeURIComponent(hash.replace(/^#/, '')));
    if (!value || typeof value !== 'object') return null;
    const s = value as Record<string, unknown>;
    if (s.v !== 1 || !Number.isInteger(s.seed) || (s.seed as number) < 0 || (s.seed as number) > 0xffffffff
        || typeof s.witness !== 'boolean' || !Array.isArray(s.interventions) || s.interventions.length > 1000) return null;
    const interventions = [];
    for (const item of s.interventions) {
      if (!item || typeof item !== 'object') return null;
      const i = item as Record<string, unknown>;
      if (!Number.isInteger(i.t) || (i.t as number) < 0 || (i.t as number) > TUNING.ticks
          || !['mira', 'tom', 'ben'].includes(i.to as string) || !['stole', 'gaveTo'].includes(i.claim as string)) return null;
      interventions.push({ t: i.t as number, to: i.to as 'mira' | 'tom' | 'ben', claim: i.claim as 'stole' | 'gaveTo' });
    }
    return { v: 1, seed: s.seed as number, witness: s.witness, interventions };
  } catch { return null; }
}
