/**
 * Which voice archetype each villager speaks in when they have no line of their own for the moment.
 * Core villagers have their own banks and fall back to these; regulars and background villagers speak
 * only through them. Chosen from role and age:
 *
 * - sharp: quick, exact, a little cutting. Mira (baker), Pim (shopkeeper), Mab (seamstress), Tess (barmaid).
 * - gentle: soft, kind, slow to judge. Tom (carpenter), Nell (herbalist and midwife), Fen (young shepherd).
 * - blunt: few words, no softening. Ben (fisher), Sol (farmer), Ivo (blacksmith), Yan (tinker).
 * - dreamy: wandering, notices small things. Elin (teacher), Wren (apprentice), Cass (beekeeper).
 * - pious: chapel words and mercy. Otto (chaplain), Rook (gravedigger), Ada (old weaver, chapel circle).
 * - jolly: warm, laughing, loves a story. Rosa (innkeeper), Greta (farmer), Hal (carter), Lio (fiddler).
 * - weary: sighs, aches, has seen it all. Jonah (miller), Dag (old bridge keeper), Una (laundress).
 */
import type { Dossier, VillagerId } from '../../sim/types.js';
import type { VoiceArchetype } from './types.js';

export const VOICES: Readonly<Record<VillagerId, VoiceArchetype>> = {
  mira: 'sharp',
  tom: 'gentle',
  ben: 'blunt',
  ada: 'pious',
  rosa: 'jolly',
  jonah: 'weary',
  elin: 'dreamy',
  pim: 'sharp',
  sol: 'blunt',
  greta: 'jolly',
  ivo: 'blunt',
  nell: 'gentle',
  otto: 'pious',
  wren: 'dreamy',
  hal: 'jolly',
  dag: 'weary',
  una: 'weary',
  cass: 'dreamy',
  fen: 'gentle',
  lio: 'jolly',
  mab: 'sharp',
  rook: 'pious',
  tess: 'sharp',
  yan: 'blunt',
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
