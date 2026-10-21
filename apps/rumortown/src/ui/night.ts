/** Clock-derived copy and colours shared by the arrival, banner and Now bar. */
import { daylight } from '../render/daylight.js';
import { isNight } from '../render/night.js';
import type { SimEvent, WorldSnapshot } from '../sim/types.js';
export function clockLook(el: HTMLElement, minute: number): void {
  if (el.dataset.clockMinute === String(minute)) return;
  el.dataset.clockMinute = String(minute);
  const light = daylight(minute), night = isNight(minute);
  el.dataset.night = String(night);
  const color = night ? light.multiply : light.softLight;
  el.style.setProperty('--clock-sky', `rgb(${color.r},${color.g},${color.b})`);
}
export function nightNow(snapshot: WorldSnapshot, latest?: SimEvent): { quiet: boolean; awake: string[] } {
  const night = isNight(snapshot.minuteOfDay);
  return { quiet: night && (!latest || snapshot.tick - latest.tick > 6), awake: night ? snapshot.villagers.filter(v => v.activity !== 'sleep').map(v => v.name) : [] };
}
