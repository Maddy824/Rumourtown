/**
 * The shape of the line bank. Lines are authored once, offline, and picked by rules in `sim/talk`.
 *
 * Placeholders a line may use: {subject} {subjectObj} {subjectPoss} {listener} {source} {claim}
 * {object} {place} {topic}. Write lines with straight apostrophes; they are set as ’ when spoken.
 */
import type { SpeechAct, VillagerId } from '../../sim/types.js';

export type VoiceArchetype = 'blunt' | 'gentle' | 'sharp' | 'dreamy' | 'pious' | 'jolly' | 'weary';

export const VOICE_ARCHETYPES: readonly VoiceArchetype[] = ['blunt', 'gentle', 'sharp', 'dreamy', 'pious', 'jolly', 'weary'];

export type ListenerRelation = 'close' | 'rival' | 'any';

/** How a villager takes the stranger's whisper: by trust, sceptical below 0.4, receptive above 0.6. */
export type WhisperStance = 'sceptical' | 'neutral' | 'receptive';

/** Mood at or below -0.35 is low, at or above 0.5 is high. */
export type MoodBand = 'low' | 'high';

/** Part of the day: morning until 11:00, midday until 16:30, then evening. */
export type Daypart = 'morning' | 'midday' | 'evening';

export const SPEECH_ACTS: readonly SpeechAct[] = [
  'greet',
  'smalltalk',
  'news',
  'gossip',
  'warn',
  'confide',
  'accuse',
  'deny',
  'explain',
  'defend',
  'doubt',
  'agree',
  'apologize',
  'forgive',
  'refuse',
  'farewell',
  'reactToWhisper',
];

/** Acts that carry a claim about someone. */
export const CLAIM_ACTS: readonly SpeechAct[] = [
  'gossip',
  'warn',
  'confide',
  'accuse',
  'deny',
  'explain',
  'defend',
  'doubt',
  'agree',
  'apologize',
  'forgive',
  'refuse',
  'reactToWhisper',
];

/**
 * One group of interchangeable lines. Every field except `act` and `lines` narrows when the set may
 * be used; a field left out matches anything. Among the sets that may be used, the most specific wins:
 * speaker, then voice, then valence, then hedged, then listener relation, then the finer fields.
 */
export interface LineSet {
  act: SpeechAct;
  speaker?: VillagerId;
  voice?: VoiceArchetype;
  /** The claim's valence: -1 harmful, 0 neutral, 1 favourable. */
  valence?: -1 | 0 | 1;
  /** True for lines that hedge ("I heard, maybe, that…"), chosen when confidence is below 0.6. */
  hedged?: boolean;
  listenerRelation?: ListenerRelation;
  /**
   * Who the claim is about decides the grammar. A set with none of the three flags is written about
   * someone else ("{subject} took it"). `toSubject` sets speak to the subject as "you", `selfSubject`
   * sets are the subject speaking ("I never"), and `anySubject` sets never refer to the subject at all.
   */
  toSubject?: boolean;
  selfSubject?: boolean;
  anySubject?: boolean;
  /** Small-talk topic id, from `content/lines/topics.ts`. */
  topic?: string;
  /** reactToWhisper only. */
  stance?: WhisperStance;
  mood?: MoodBand;
  /** For lines that only suit one part of the day ("Morning.", "Good night."). */
  daypart?: Daypart;
  /** True when the speaker saw it themselves (the key's source is the speaker). */
  firsthand?: boolean;
  lines: string[];
}
