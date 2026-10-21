/** Input/output consistency checks shared by the browser and interpretation API.
 * They only abstain; they never invent a replacement claim or retain player prose.
 */
export interface WhisperPerson {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly nicknames?: readonly string[];
}
const normalise = (text: string): string => text.normalize('NFC').toLowerCase().replace(/[’‘]/gu, "'");
const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
const contains = (text: string, phrase: string): boolean =>
  new RegExp(`(?<![\\p{L}\\p{N}])${escape(normalise(phrase))}(?![\\p{L}\\p{N}])`, 'u').test(text);

/** Death is outside the reputation-only taxonomy, including when the actor is unknown. */
export function unsupportedStory(text: string): boolean {
  return /\b(kill(?:s|ed|ing)?|murder(?:s|ed|ing)?|dead|death|die[ds]?|dying|assassinat(?:e[ds]?|ing|ion))\b/u.test(normalise(text));
}

/** This is a grounding floor, not a full semantic equivalence check. */
export function groundedPeople(text: string, claim: { about: string; target?: string; confidence: number }, cast: readonly WhisperPerson[]): boolean {
  if (claim.confidence < .75) return false;
  const lower = normalise(text);
  const named = new Set(cast.filter(person => [person.name, ...(person.nicknames ?? [])]
    .some(name => contains(lower, name))).map(person => person.id));
  // A role may identify somebody without a name, but shared roles cannot pick a person.
  const roles = cast.map(person => ({ id: person.id, role: person.role.split(',')[0]!.trim() }));
  const mentioned = new Set(named);
  for (const person of roles) {
    if (roles.filter(other => other.role === person.role).length === 1 && contains(lower, `the ${person.role}`)) {
      mentioned.add(person.id);
    }
  }
  return mentioned.has(claim.about) && (!claim.target || mentioned.has(claim.target));
}
