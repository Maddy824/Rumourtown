/** Tick-seeded presentation poses; no mutable random stream or wall clock. */
import type { Facing } from '../sim/types.js';
import { hashString } from './grain.js';

export interface IdlePose { lean: number; turn: -1 | 0 | 1 }
const STILL: IdlePose = { lean: 0, turn: 0 };

/** Simulation ticks are 400 ms. Each person gestures once per seeded 4–9 second cycle. */
export function idlePose(id: string, tick: number, reducedMotion: boolean): IdlePose {
  if (reducedMotion) return STILL;
  const seed = hashString(id);
  const period = 10 + Math.floor(seed * 13);
  const phase = ((Math.floor(tick) + Math.floor(seed * 101)) % period + period) % period;
  if (phase > 2) return STILL;
  const direction = seed < .5 ? -1 : 1;
  return { lean: direction * (phase === 1 ? .035 : .018), turn: phase === 1 ? direction : 0 };
}

export function idleFacing(facing: Facing, turn: -1 | 0 | 1): Facing {
  if (!turn) return facing;
  return turn < 0 ? 'w' : 'e';
}

export function walkFrame(tick: number, alpha: number, phase = 0): 0 | 1 | 2 {
  return (Math.floor((tick + Math.max(0, Math.min(1, alpha))) * 400 / 170 + phase) % 3 + 3) % 3 as 0 | 1 | 2;
}
