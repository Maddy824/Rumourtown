import { clamp } from './claims.js';

export interface MoodModifier {
  label: string;
  delta: number;
  /** Exclusive expiry: the modifier is no longer live at this tick. */
  untilTick: number;
}

/** Named causes of mood. Adding the same label replaces its magnitude and expiry. */
export class Mood {
  private readonly modifiers = new Map<string, MoodModifier>();

  add(label: string, delta: number, untilTick: number): void {
    if (!Number.isFinite(delta) || !Number.isFinite(untilTick)) {
      throw new RangeError('Mood delta and untilTick must be finite');
    }
    this.modifiers.set(label, { label, delta, untilTick });
  }

  value(tick: number): number {
    let total = 0;
    for (const modifier of this.modifiers.values()) {
      if (tick < modifier.untilTick) total += modifier.delta;
    }
    return clamp(total, -1, 1);
  }

  /** Live causes in insertion order; returned objects can be edited without changing mood. */
  list(tick: number): MoodModifier[] {
    return [...this.modifiers.values()]
      .filter((modifier) => tick < modifier.untilTick)
      .map((modifier) => ({ ...modifier }));
  }

  expire(tick: number): void {
    for (const [label, modifier] of this.modifiers) {
      if (tick >= modifier.untilTick) this.modifiers.delete(label);
    }
  }
}

export interface AppraisalInput {
  /** -1 harmful, 0 irrelevant, +1 helpful to the character's goals. */
  goalImpact: number;
  /** -1 self, 0 nobody, +1 another person; positive events use this as credit. */
  blame: number;
  certainty: number;
  control: number;
}

export interface Appraisal {
  anger: number;
  fear: number;
  shame: number;
  gratitude: number;
}

/** A tuned appraisal model, with certainty and control in 0..1. */
export function appraise(input: AppraisalInput): Appraisal {
  const impact = clamp(input.goalImpact, -1, 1);
  const blame = clamp(input.blame, -1, 1);
  const certainty = clamp(input.certainty, 0, 1);
  const control = clamp(input.control, 0, 1);
  const harm = Math.max(0, -impact);
  const other = Math.max(0, blame);
  return {
    anger: harm * other * certainty * control,
    fear: harm * (1 - certainty * control),
    shame: harm * Math.max(0, -blame) * certainty,
    gratitude: Math.max(0, impact) * other * certainty,
  };
}
