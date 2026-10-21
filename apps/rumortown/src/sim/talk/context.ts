/**
 * Everything line selection needs to know about a moment, derived once from a LineKey.
 */
import { ALL_TOPICS, EVENING_STARTS, MIDDAY_STARTS, TOPIC_PHRASES } from '../../content/lines/topics.js';
import type { Daypart, ListenerRelation, MoodBand, VoiceArchetype, WhisperStance } from '../../content/lines/types.js';
import { DAY_START_MINUTE, MINUTES_PER_DAY, type Dossier, type GameClaim, type LineKey, type SpeechAct, type VillagerId } from '../types.js';
import { capitaliseName } from './grammar.js';

/** Who the claim is about, from where the speaker stands. */
export type SubjectPerson = 'self' | 'listener' | 'other' | 'none';

/** Below this confidence a speaker hedges. */
export const HEDGE_BELOW = 0.6;
/** reactToWhisper: trust below this is sceptical, above RECEPTIVE_ABOVE receptive, between neutral. */
export const SCEPTICAL_BELOW = 0.4;
export const RECEPTIVE_ABOVE = 0.6;
export const LOW_MOOD_AT_OR_BELOW = -0.35;
export const HIGH_MOOD_AT_OR_ABOVE = 0.5;

/**
 * The key `say` accepts. `trust` is optional and not part of the shared LineKey: pass the listener's
 * trust in the stranger with reactToWhisper so the reaction follows trust exactly. Without it, the
 * speaker's confidence in the claim stands in for trust.
 */
export type TalkKey = LineKey & { trust?: number };

export interface LineContext {
  /** The act actually voiced; a favourable or neutral `warn` is voiced as `gossip`. */
  act: SpeechAct;
  requestedAct: SpeechAct;
  speaker: Dossier;
  listener: Dossier;
  speakerName: string;
  listenerName: string;
  subject?: Dossier;
  subjectName?: string;
  claim?: GameClaim;
  person: SubjectPerson;
  /** The brief's flag: the listener is the claim's subject (and not the speaker). */
  toSubject: boolean;
  valence?: -1 | 0 | 1;
  hedged: boolean;
  relation: ListenerRelation;
  voice: VoiceArchetype;
  stance?: WhisperStance;
  moodBand?: MoodBand;
  daypart: Daypart;
  topic?: string;
  topicPhrase?: string;
  firsthand: boolean;
  /** How {source} reads, or undefined when it cannot be said (no source, or it is the speaker or listener). */
  sourceText?: string;
  /** The line is said to the stranger, not to `listener`. */
  toStranger: boolean;
  tick: number;
}

/** Maps any topic id onto a known one: exact, then by prefix ("weather-rain"), then by suffix ("bread-prices"). */
export function normaliseTopic(topic: string | undefined): { id?: string; phrase?: string } {
  if (!topic) return {};
  const t = topic.trim().toLowerCase();
  if (ALL_TOPICS.includes(t)) return { id: t, phrase: TOPIC_PHRASES[t] };
  const prefix = ALL_TOPICS.find((k) => t.startsWith(`${k}-`));
  if (prefix) return { id: prefix, phrase: TOPIC_PHRASES[prefix] };
  const suffix = ALL_TOPICS.find((k) => t.endsWith(`-${k}`));
  if (suffix) return { id: suffix, phrase: TOPIC_PHRASES[suffix] };
  return { phrase: t.replace(/-/g, ' ') };
}

export function relationOf(speaker: Dossier, listener: Dossier): ListenerRelation {
  if (speaker.id === listener.id) return 'any';
  if (speaker.rival === listener.id || listener.rival === speaker.id) return 'rival';
  if (speaker.closeTo.includes(listener.id)) return 'close';
  return 'any';
}

/** Minutes since midnight to a part of the day. */
export function daypartOf(minuteOfDay: number): Daypart {
  if (minuteOfDay < MIDDAY_STARTS) return 'morning';
  if (minuteOfDay < EVENING_STARTS) return 'midday';
  return 'evening';
}

/** Tick 0 is 07:00 on day one. */
export function minuteOfDayAt(tick: number): number {
  return DAY_START_MINUTE + (((Math.floor(tick) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY);
}

export function stanceOf(trust: number): WhisperStance {
  if (trust < SCEPTICAL_BELOW) return 'sceptical';
  if (trust > RECEPTIVE_ABOVE) return 'receptive';
  return 'neutral';
}

export function deriveContext(
  key: TalkKey,
  castById: ReadonlyMap<VillagerId, Dossier>,
  voiceOf: (d: Dossier) => VoiceArchetype,
): LineContext {
  const { speaker, listener, claim } = key;
  const subject = key.subject ?? (claim ? castById.get(claim.about) : undefined);
  const toStranger = key.act === 'reactToWhisper';
  const valence = claim?.valence;

  let act = key.act;
  // Spec §9: never a favourable claim in a warning template. Good or neutral news is passed on as gossip.
  if (act === 'warn' && claim && valence !== -1) act = 'gossip';

  let person: SubjectPerson = 'none';
  if (subject) {
    if (subject.id === speaker.id) person = 'self';
    else if (!toStranger && subject.id === listener.id) person = 'listener';
    else person = 'other';
  }
  const toSubject = person === 'listener';

  let sourceText: string | undefined;
  const src = key.source;
  if (src === 'stranger') sourceText = toStranger ? undefined : 'the stranger';
  else if (src && src.id !== speaker.id && src.id !== listener.id && !toStranger) sourceText = capitaliseName(src.name);

  const trust = typeof key.trust === 'number' ? key.trust : (key.confidence ?? 0.5);
  const topic = normaliseTopic(key.topic);
  const mood = key.mood;

  return {
    act,
    requestedAct: key.act,
    speaker,
    listener,
    speakerName: capitaliseName(speaker.name),
    listenerName: capitaliseName(listener.name),
    subject,
    subjectName: subject ? capitaliseName(subject.name) : undefined,
    claim,
    person,
    toSubject,
    valence,
    hedged: claim !== undefined && typeof key.confidence === 'number' && key.confidence < HEDGE_BELOW,
    relation: toStranger ? 'any' : relationOf(speaker, listener),
    voice: voiceOf(speaker),
    stance: toStranger ? stanceOf(trust) : undefined,
    moodBand: mood <= LOW_MOOD_AT_OR_BELOW ? 'low' : mood >= HIGH_MOOD_AT_OR_ABOVE ? 'high' : undefined,
    daypart: daypartOf(minuteOfDayAt(key.tick)),
    topic: topic.id,
    topicPhrase: topic.phrase,
    firsthand: src !== undefined && src !== 'stranger' && src.id === speaker.id,
    sourceText,
    toStranger,
    tick: key.tick,
  };
}
