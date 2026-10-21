/** Small authored utility modifiers. Context matters; no motive makes a story true. */
import type { SocialCharacter, SpeechAct } from '../types.js';
import type { Term } from './tellings.js';

export const MOTIVE_WEIGHTS = { protect: .12, bond: .08, status: .1, verify: .12 } as const;

export function motivationTerms(m: SocialCharacter['motives'] | undefined, c: {
  act: SpeechAct; confidence: number; closeness: number; rival: boolean; firsthand: boolean;
}): Term[] {
  if (!m) return [];
  const terms: Term[] = [];
  if (c.act === 'warn' || c.act === 'defend') terms.push({ text: 'wants to protect someone from harm', value: MOTIVE_WEIGHTS.protect * m.protect });
  if (c.closeness >= .6) terms.push({ text: 'sharing news keeps a friendship close', value: MOTIVE_WEIGHTS.bond * m.bond });
  if (c.rival && ['gossip', 'confide', 'warn'].includes(c.act)) terms.push({ text: 'a rival’s mistake would improve their own standing', value: MOTIVE_WEIGHTS.status * m.status });
  if (!c.firsthand) terms.push({ text: 'hesitates to repeat something not seen first-hand', value: -MOTIVE_WEIGHTS.verify * m.verify * (1 - c.confidence) });
  return terms;
}
