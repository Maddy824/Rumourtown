/**
 * Mood with causes, on top of rumormind's Mood. The engine also needs to know when a named
 * modifier has run out (reconciliation waits for "falsely accused" to expire), which the
 * library does not remember once it has expired, so this wrapper keeps the last expiry per label.
 */
import { Mood } from 'rumormind';
import type { MoodView, Tick } from '../types.js';

export class MoodState {
  private readonly mood = new Mood();
  private readonly lastUntil = new Map<string, Tick>();

  add(label: string, delta: number, untilTick: Tick): void {
    this.mood.add(label, delta, untilTick);
    this.lastUntil.set(label, untilTick);
  }

  /** Clamped sum of live modifiers, -1..1. */
  value(tick: Tick): number {
    return this.mood.value(tick);
  }

  list(tick: Tick): MoodView[] {
    return this.mood.list(tick).map((m) => ({ label: m.label, delta: m.delta, untilTick: m.untilTick }));
  }

  expire(tick: Tick): void {
    this.mood.expire(tick);
  }

  active(label: string, tick: Tick): boolean {
    const until = this.lastUntil.get(label);
    return until !== undefined && tick < until;
  }

  /** True once the label was added and has since run out. */
  expired(label: string, tick: Tick): boolean {
    const until = this.lastUntil.get(label);
    return until !== undefined && tick >= until;
  }

  /** Forget that a label ever applied, so it can trigger again later. */
  clear(label: string): void {
    this.lastUntil.delete(label);
  }
}
