/**
 * The line bank: every authored line, in a fixed order (line ids depend on it).
 * Core villagers speak their own lines first, then their voice archetype's, then the generic ones.
 */
import { genericSets } from './generic.js';
import { miraSets } from './core/mira.js';
import type { LineSet } from './types.js';

export type { LineSet, VoiceArchetype, ListenerRelation, WhisperStance, MoodBand, Daypart } from './types.js';
export { VOICES, voiceOf } from './voices.js';
export { TOPICS_BY_BAND, TOPIC_PHRASES, ALL_TOPICS } from './topics.js';

/** The six villagers of the opening dispute, who each have a bank of their own. */
export const CORE_SPEAKERS = ['mira', 'tom', 'ben', 'ada', 'rosa', 'jonah'] as const;

export const coreSets: readonly LineSet[] = [...miraSets];

export const archetypeSets: readonly LineSet[] = [];

export const lineBank: readonly LineSet[] = [...coreSets, ...archetypeSets, ...genericSets];
