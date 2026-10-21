/** Voice families chosen from the current dossiers; core villagers keep their own authored banks. */
import type { Dossier, VillagerId } from '../../sim/types.js';
import type { VoiceArchetype } from './types.js';

export const VOICES: Readonly<Record<VillagerId, VoiceArchetype>> = {
  mira: 'sharp',
  tom: 'gentle',
  ben: 'blunt',
  ada: 'sharp',
  rosa: 'jolly',
  jonah: 'blunt',
  elin: 'sharp',
  pim: 'sharp',
  sol: 'blunt',
  greta: 'sharp',
  ivo: 'blunt',
  nell: 'gentle',
  otto: 'pious',
  wren: 'dreamy',
  hal: 'jolly',
  dag: 'weary',
  una: 'sharp',
  cass: 'dreamy',
  fen: 'blunt',
  lio: 'jolly',
  mab: 'sharp',
  rook: 'weary',
  tess: 'sharp',
  yan: 'jolly',
  suri: 'gentle', oren: 'blunt', leela: 'gentle', tavi: 'dreamy', edda: 'weary', arun: 'jolly',
  bram: 'blunt', nia: 'sharp', vesa: 'jolly', cora: 'dreamy', dara: 'gentle', silas: 'sharp',
};

/** The archetype for a villager: from the map above, or guessed from traits for anyone not in it. */
export function voiceOf(d: Dossier, voices: Readonly<Record<VillagerId, VoiceArchetype>> = VOICES): VoiceArchetype {
  const known = voices[d.id];
  if (known) return known;
  const t = d.traits;
  if (t.extraversion >= 0.65 && t.agreeableness >= 0.5) return 'jolly';
  if (t.agreeableness < 0.4) return t.extraversion >= 0.5 ? 'sharp' : 'blunt';
  if (t.emotionality >= 0.65 && t.extraversion < 0.4) return 'weary';
  if (t.openness >= 0.7) return 'dreamy';
  if (t.honesty >= 0.75 && t.conscientiousness >= 0.6) return 'pious';
  return 'gentle';
}
