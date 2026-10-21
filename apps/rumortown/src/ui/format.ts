/**
 * Plain-words formatting shared by the clock, tags, story log and share card.
 */
import {
  DAY_START_MINUTE,
  MINUTES_PER_DAY,
  type Activity,
  type ClaimKind,
  type Ending,
  type SpeechAct,
  type Tick,
} from '../sim/types.js';

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** "09:10" from minutes since midnight. */
export function clockText(minuteOfDay: number): string {
  const m = ((Math.floor(minuteOfDay) % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}

export const minuteOfTick = (tick: Tick): number =>
  (DAY_START_MINUTE + (((Math.floor(tick) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY)) % MINUTES_PER_DAY;
export const dayIndexOfTick = (tick: Tick): number => Math.floor(Math.max(0, tick) / MINUTES_PER_DAY);
export const tickClock = (tick: Tick): string => clockText(minuteOfTick(tick));
/** "Day 1, 09:10" */
export const tickLabel = (tick: Tick): string => `Day ${dayIndexOfTick(tick) + 1}, ${tickClock(tick)}`;

/** When a mood or note lasts until `until`, as seen from `now`. */
export function untilText(until: Tick, now: Tick): string {
  const days = dayIndexOfTick(until) - dayIndexOfTick(now);
  if (days <= 0) return `until ${tickClock(until)}`;
  if (days === 1) return `until tomorrow, ${tickClock(until)}`;
  return `for ${days} more days`;
}

export const percent = (x: number): string => `${Math.round(Math.min(1, Math.max(0, x)) * 100)}%`;

/** "Ben", "Ben and Ada", "Ben, Ada and Tom", "Ben, Ada and 3 others". */
export function listNames(names: readonly string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0] ?? '';
  if (names.length <= 3) return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1] ?? ''}`;
  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} others`;
}

export function moodWord(mood: number): string {
  if (mood <= -0.55) return 'Upset';
  if (mood <= -0.2) return 'Uneasy';
  if (mood < 0.2) return 'Steady';
  if (mood < 0.55) return 'Cheerful';
  return 'Glowing';
}

const ACTIVITY: Record<Activity, string> = {
  work: 'working',
  eat: 'eating',
  rest: 'resting',
  errand: 'on an errand',
  worship: 'at prayer',
  idle: 'taking it easy',
  visit: 'visiting',
  sleep: 'asleep',
  secret: 'about their own business',
  talk: 'talking',
};
export const activityText = (a: Activity): string => ACTIVITY[a] ?? 'about';

/** "Mira chatted with Ben" pieces: the verb that sits between speaker and listeners. */
const ACT_VERB: Record<SpeechAct, string> = {
  greet: 'greeted',
  smalltalk: 'chatted with',
  news: 'told',
  gossip: 'gossiped to',
  warn: 'warned',
  confide: 'confided in',
  accuse: 'accused',
  deny: 'denied it to',
  explain: 'explained to',
  defend: 'spoke up for someone to',
  doubt: 'had doubts, telling',
  agree: 'agreed with',
  apologize: 'apologized to',
  forgive: 'forgave',
  refuse: 'turned away from',
  farewell: 'said goodbye to',
  reactToWhisper: 'answered',
};
export const actVerb = (act: SpeechAct): string => ACT_VERB[act] ?? 'spoke to';

/** Acts that carry the rumor itself rather than small talk. */
export const RUMOR_ACTS: ReadonlySet<SpeechAct> = new Set<SpeechAct>([
  'gossip', 'warn', 'confide', 'accuse', 'deny', 'explain', 'defend', 'doubt', 'agree', 'apologize', 'forgive', 'reactToWhisper',
]);

/** Engine action ids into plain past-tense words; unknown ids are de-slugged. */
const ACTIONS: Record<string, string> = {
  gossip: 'Gossiped',
  warn: 'Warned someone',
  confide: 'Confided in someone',
  confront: 'Confronted someone',
  accuse: 'Made an accusation',
  avoid: 'Walked away',
  apologize: 'Apologized',
  reconcile: 'Made up',
  defend: 'Spoke up for someone',
  explain: 'Explained',
  deny: 'Denied it',
  schedule: 'Kept to my day',
  continue: 'Kept to my day',
  need: 'Saw to my needs',
  talk: 'Stopped for a chat',
  approach: 'Went over to talk',
};
export function actionText(action: string): string {
  const known = ACTIONS[action];
  if (known) return known;
  const words = action.replace(/[-_]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim().toLowerCase();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Did something';
}

export const ENDING_TITLE: Record<Ending, string> = {
  reconciled: 'Quiet reconciliation',
  exposed: 'Exposed',
  split: 'The village split',
  grudge: 'A grudge',
  died: 'It died',
  quiet: 'A quiet day',
};

export const KIND_LABEL: Record<ClaimKind, string> = {
  theft: 'Theft',
  cheating: 'Cheating',
  romance: 'A secret romance',
  lying: 'Lying',
  'broken-promise': 'A broken promise',
  insult: 'An insult',
  hoarding: 'Hoarding',
  shirking: 'Shirking',
  boasting: 'Boasting',
  kindness: 'A kindness',
  'paid-debt': 'A paid debt',
  nursed: 'Nursing the sick',
};

export function sentence(text: string): string {
  const t = text.trim();
  if (!t) return t;
  const first = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?…”"']$/.test(first) ? first : `${first}.`;
}

/* ---------------- Belief chains ---------------- */

export type ChainActor = { kind: 'stranger' } | { kind: 'villager'; id: string; name: string } | { kind: 'unknown'; name: string };
export type ChainLink =
  | { kind: 'told'; from: ChainActor; to: ChainActor; time?: string; text: string }
  | { kind: 'saw'; who: ChainActor; time?: string; text: string }
  | { kind: 'text'; text: string };

/**
 * Reads the engine's plain-English chain lines ("The stranger told Mira at 09:12", "Ben saw it at 08:48")
 * into actors so the tag can draw faces. Anything it cannot read stays as text.
 */
export function parseChainLine(line: string, nameToId: ReadonlyMap<string, string>): ChainLink {
  const text = line.trim();
  const actor = (raw: string): ChainActor => {
    const name = raw.trim();
    if (/^(the\s+)?stranger$/i.test(name) || /^you$/i.test(name)) return { kind: 'stranger' };
    const id = nameToId.get(name.toLowerCase());
    return id ? { kind: 'villager', id, name: name.charAt(0).toUpperCase() + name.slice(1) } : { kind: 'unknown', name };
  };
  const told = /^(.+?)\s+(?:told|whispered to|warned|gossiped to)\s+(.+?)(?:\s+at\s+(\d{1,2}:\d{2}))?\.?$/i.exec(text);
  if (told && told[1] && told[2]) return { kind: 'told', from: actor(told[1]), to: actor(told[2]), time: told[3], text };
  const saw = /^(.+?)\s+(?:saw|witnessed|noticed)\s+(?:it|this|that)(?:\s+(?:himself|herself|themselves|themself))?(?:\s+at\s+(\d{1,2}:\d{2}))?\.?$/i.exec(text);
  if (saw && saw[1]) return { kind: 'saw', who: actor(saw[1]), time: saw[2], text };
  return { kind: 'text', text };
}
