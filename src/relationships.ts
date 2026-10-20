import type { CharacterId } from './claims.js';
import { clamp } from './claims.js';
import { DEFAULT_TUNING, type Tuning } from './tuning.js';

/** Directed trust (0..1) and affinity (-1..1) between characters. Trust falls faster than it rises. */
export class Relationships {
  private readonly trustMap = new Map<string, number>();
  private readonly affinityMap = new Map<string, number>();

  constructor(private readonly tuning: Tuning = DEFAULT_TUNING, private readonly defaultTrust = 0.5) {}

  trust(from: CharacterId, to: CharacterId): number {
    return this.trustMap.get(key(from, to)) ?? this.defaultTrust;
  }

  affinity(from: CharacterId, to: CharacterId): number {
    return this.affinityMap.get(key(from, to)) ?? 0;
  }

  setTrust(from: CharacterId, to: CharacterId, value: number): void {
    this.trustMap.set(key(from, to), clamp(value, 0, 1));
  }

  setAffinity(from: CharacterId, to: CharacterId, value: number): void {
    this.affinityMap.set(key(from, to), clamp(value, -1, 1));
  }

  /** Negative deltas are integrity losses and weigh `trustLossMultiplier` times more than gains. */
  adjustTrust(from: CharacterId, to: CharacterId, delta: number): number {
    const applied = delta < 0 ? delta * this.tuning.trustLossMultiplier : delta;
    const next = clamp(this.trust(from, to) + applied, 0, 1);
    this.trustMap.set(key(from, to), next);
    return next;
  }

  adjustAffinity(from: CharacterId, to: CharacterId, delta: number): number {
    const next = clamp(this.affinity(from, to) + delta, -1, 1);
    this.affinityMap.set(key(from, to), next);
    return next;
  }

  /** Symmetric closeness used for "who do I confide in": mean of the two affinities, mapped to 0..1. */
  closeness(a: CharacterId, b: CharacterId): number {
    return (this.affinity(a, b) + this.affinity(b, a) + 2) / 4;
  }
}

const key = (from: CharacterId, to: CharacterId): string => `${from}\u0000${to}`;
