import { mentionedPeople, type WhisperPerson } from './whisper-grounding';

export const MAX_RUMOR_TEXT = 100;
export interface RumorMeaning {
  actor: string | null;
  affected: string | null;
  valence: -1 | 0 | 1;
  severity: 1 | 2 | 3;
  question: string;
}
export function rumorText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim().normalize('NFC');
  return text && text.length <= MAX_RUMOR_TEXT && !/[\u0000-\u001f\u007f]/u.test(text) ? text : null;
}
const keys = ['actor', 'affected', 'valence', 'severity', 'question'];
export function readRumorMeaning(value: unknown, text: string, cast: readonly WhisperPerson[]): RumorMeaning | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).length !== keys.length || !keys.every(key => Object.hasOwn(v, key)) ||
      ![-1, 0, 1].includes(v.valence as number) || ![1, 2, 3].includes(v.severity as number) ||
      typeof v.question !== 'string' || v.question.length > 72 || /[\u0000-\u001f\u007f<>]/u.test(v.question)) return null;
  const mentions = mentionedPeople(text, cast);
  for (const person of [v.actor, v.affected]) {
    if (person !== null && (typeof person !== 'string' ||
        !mentions.has(person))) return null;
  }
  for (const person of mentionedPeople(v.question, cast)) if (!mentions.has(person)) return null;
  // An unnamed actor must never be replaced by the named recipient/victim.
  if (/^(?:(?:i heard|apparently|they say) (?:that )?)?(someone|somebody|an? stranger|an? unknown person)\b/iu.test(text) && v.actor !== null) return null;
  if (v.actor === null && v.valence !== 0) return null;
  return { actor: v.actor as string | null, affected: v.affected as string | null,
    valence: v.valence as RumorMeaning['valence'], severity: v.severity as RumorMeaning['severity'], question: v.question.trim() };
}
/** Full story remains playable with no model, named culprit or invented event. */
export const neutralMeaning = (): RumorMeaning => ({ actor: null, affected: null, valence: 0, severity: 2, question: '' });
