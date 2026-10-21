/**
 * Authoring shorthand. Each key is an act followed by tags, for example `'gossip harm hedged'` or
 * `'smalltalk topic:bread'`. Unknown acts or tags throw at load, so a typo fails the tests.
 *
 * Tags: harm | fav | neutral (valence -1, 1, 0); hedged; close | rival; to-subject | self | any-subject;
 * topic:<id>; stance:sceptical | stance:neutral | stance:receptive; mood:low | mood:high;
 * daypart:morning | daypart:midday | daypart:evening; firsthand.
 */
import type { SpeechAct, VillagerId } from '../../sim/types.js';
import { SPEECH_ACTS, type LineSet, type VoiceArchetype } from './types.js';

export interface SetOwner {
  speaker?: VillagerId;
  voice?: VoiceArchetype;
}

export function parseSetKey(key: string): Omit<LineSet, 'lines'> {
  const [act, ...tags] = key.trim().split(/\s+/);
  if (!act || !(SPEECH_ACTS as readonly string[]).includes(act)) throw new Error(`Unknown act in line set key "${key}"`);
  const set: Omit<LineSet, 'lines'> = { act: act as SpeechAct };
  for (const tag of tags) {
    if (tag === 'harm') set.valence = -1;
    else if (tag === 'fav') set.valence = 1;
    else if (tag === 'neutral') set.valence = 0;
    else if (tag === 'hedged') set.hedged = true;
    else if (tag === 'close' || tag === 'rival') set.listenerRelation = tag;
    else if (tag === 'to-subject') set.toSubject = true;
    else if (tag === 'self') set.selfSubject = true;
    else if (tag === 'any-subject') set.anySubject = true;
    else if (tag === 'firsthand') set.firsthand = true;
    else if (tag.startsWith('topic:')) set.topic = tag.slice('topic:'.length);
    else if (tag === 'stance:sceptical' || tag === 'stance:neutral' || tag === 'stance:receptive') set.stance = tag.slice('stance:'.length) as LineSet['stance'];
    else if (tag === 'mood:low' || tag === 'mood:high') set.mood = tag.slice('mood:'.length) as LineSet['mood'];
    else if (tag === 'daypart:morning' || tag === 'daypart:midday' || tag === 'daypart:evening') set.daypart = tag.slice('daypart:'.length) as LineSet['daypart'];
    else throw new Error(`Unknown tag "${tag}" in line set key "${key}"`);
  }
  const persons = [set.toSubject, set.selfSubject, set.anySubject].filter(Boolean).length;
  if (persons > 1) throw new Error(`Line set key "${key}" names more than one of to-subject, self, any-subject`);
  return set;
}

/** Builds line sets for one speaker, one voice archetype, or (with an empty owner) everyone. */
export function defineSets(owner: SetOwner, entries: Record<string, string[]>): LineSet[] {
  return Object.entries(entries).map(([key, lines]) => ({ ...owner, ...parseSetKey(key), lines }));
}
