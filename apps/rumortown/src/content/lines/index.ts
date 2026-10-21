/**
 * The line bank: every authored line, in a fixed order (line ids depend on it).
 * Core villagers speak their own lines first, then their voice archetype's, then the generic ones.
 */
import { withAddressing } from './addressing.js';
import { coreNuanceSets } from './core/nuance.js';
import { nuanceSets } from './archetypes/nuance.js';
import { bluntSets } from './archetypes/blunt.js';
import { gentleSets } from './archetypes/gentle.js';
import { sharpSets } from './archetypes/sharp.js';
import { dreamySets } from './archetypes/dreamy.js';
import { piousSets } from './archetypes/pious.js';
import { jollySets } from './archetypes/jolly.js';
import { wearySets } from './archetypes/weary.js';
import { genericSets } from './generic.js';
import { miraSets } from './core/mira.js';
import { tomSets } from './core/tom.js';
import { benSets } from './core/ben.js';
import { adaSets } from './core/ada.js';
import { rosaSets } from './core/rosa.js';
import { jonahSets } from './core/jonah.js';
import type { LineSet } from './types.js';

export type { LineSet, VoiceArchetype, ListenerRelation, WhisperStance, MoodBand, Daypart } from './types.js';
export { VOICES, voiceOf } from './voices.js';
export { TOPICS_BY_BAND, TOPIC_PHRASES, ALL_TOPICS } from './topics.js';

/** The six villagers of the opening dispute, who each have a bank of their own. */
export const CORE_SPEAKERS = ['mira', 'tom', 'ben', 'ada', 'rosa', 'jonah'] as const;

export const coreSets: readonly LineSet[] = withAddressing([...miraSets, ...tomSets, ...benSets, ...adaSets, ...rosaSets, ...jonahSets, ...coreNuanceSets]);

export const archetypeSets: readonly LineSet[] = withAddressing([...bluntSets, ...gentleSets, ...sharpSets, ...dreamySets, ...piousSets, ...jollySets, ...wearySets, ...nuanceSets]);

export const lineBank: readonly LineSet[] = [...coreSets, ...archetypeSets, ...genericSets];
