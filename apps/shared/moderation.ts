/** Shared text guard. Only the comparison form changes; accepted story wording stays exact. */
export const slurs = ['nigger', 'nigga', 'faggot', 'kike', 'tranny'] as const;
export const sexual = ['rape', 'raped', 'porn', 'pornography', 'sex', 'sexual', 'fuck', 'fucking', 'blowjob', 'nude', 'nudes', 'penis', 'vagina'] as const;
const patterns = [...slurs, ...sexual].map(word => ({ word,
  pattern: new RegExp(`(?<![\\p{L}\\p{N}])${[...word].join("[\\s']*")}(?![\\p{L}\\p{N}])`, 'gu'),
}));

/** Worker normalization, also joining spaced letters in blocked words without joining whole sentences. */
export function normaliseSharedText(text: string): string {
  let lower = text.normalize('NFKC').toLowerCase().replace(/\p{Default_Ignorable_Code_Point}/gu, '')
    .replace(/[^\p{L}\p{N}\s']/gu, ' ').replace(/\s+/gu, ' ').trim();
  for (const { word, pattern } of patterns) lower = lower.replace(pattern, word);
  return lower;
}
export function blockedSharedText(text: string): boolean {
  const words = normaliseSharedText(text).split(/[^\p{L}\p{N}]+/u);
  return words.some(word => (slurs as readonly string[]).includes(word) || (sexual as readonly string[]).includes(word));
}
