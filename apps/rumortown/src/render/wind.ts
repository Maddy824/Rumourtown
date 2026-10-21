/** Slow seeded wind. Tick time keeps pausing and replaying still life repeatable. */
import { hash } from './grain.js';

export function windOffset(seed: number, tick: number, alpha: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  const h = hash(seed, 4, 2001);
  const period = 15 + h * 10; // 6–10 seconds at the default 400 ms tick.
  return Math.sin((tick + Math.max(0, Math.min(1, alpha))) / period * Math.PI * 2 + h * Math.PI * 2) * (1.2 + h);
}
