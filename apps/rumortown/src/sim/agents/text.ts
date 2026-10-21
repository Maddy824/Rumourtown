/** Clock, names and small phrase helpers shared by the legible parts of the engine. */
import { DAY_START_MINUTE, MINUTES_PER_DAY, type Activity, type Dossier, type Need, type Tick } from '../types.js';

export const minuteOfDay = (tick: Tick): number => ((tick % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
export const dayOf = (tick: Tick): number => Math.floor(tick / MINUTES_PER_DAY);

/** HH:MM on the village clock for an absolute tick. */
export function clock(tick: Tick): string {
  const m = DAY_START_MINUTE + minuteOfDay(tick);
  const hh = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export const percent = (p: number): string => `${Math.round(p * 100)}%`;
export const capitalise = (s: string): string => (s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export const STRANGER_ID = 'stranger';

/** A display name for a villager id, the stranger or 'self'. */
export function displayName(cast: ReadonlyMap<string, Dossier>, id: string, capital = false): string {
  if (id === 'village') return capital ? 'The village' : 'the village';
  if (id === STRANGER_ID) return capital ? 'The stranger' : 'the stranger';
  if (id === 'self') return capital ? 'Themselves' : 'themselves';
  return cast.get(id)?.name ?? capitalise(id);
}

export function reflexive(d: Dossier | undefined): string {
  switch (d?.pronouns.object) {
    case 'her':
      return 'herself';
    case 'him':
      return 'himself';
    default:
      return 'themselves';
  }
}

export function activityWord(a: Activity): string {
  switch (a) {
    case 'work':
      return 'working';
    case 'eat':
      return 'eating';
    case 'rest':
      return 'resting';
    case 'errand':
      return 'running an errand';
    case 'worship':
      return 'prayers';
    case 'visit':
      return 'visiting';
    case 'sleep':
      return 'sleeping';
    case 'secret':
      return 'private business';
    case 'talk':
      return 'talking';
    default:
      return 'idling';
  }
}

export function needWord(n: Need): string {
  switch (n) {
    case 'hunger':
      return 'hungry';
    case 'rest':
      return 'tired';
    case 'social':
      return 'lonely';
    default:
      return 'behind on work';
  }
}
