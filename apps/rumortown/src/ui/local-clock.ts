import { DAY_START_MINUTE, MINUTES_PER_DAY } from '../sim/types.js';
/** Presentation chooses the arrival; the simulation still starts deterministically at tick zero. */
export function localStartTick(date = new Date()): number {
  return (date.getHours() * 60 + date.getMinutes() - DAY_START_MINUTE + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}
