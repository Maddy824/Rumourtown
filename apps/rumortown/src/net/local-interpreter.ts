import { unsupportedStory } from '../../../shared/whisper-grounding.js';
import { slurs, sexual } from './blocklist.js';
import { favourable, lexicons, objects, roleAliases, spouses, takesTarget } from './local-lexicons.js';
import type { Claim, UnsupportedReason } from './types.js';

export interface LocalPerson {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly nicknames?: readonly string[];
  readonly spouse?: string;
}
export type LocalResult =
  | { claim: Omit<Claim, 'confidence'>; confidence: number; evidence: string[] }
  | { unsupported: UnsupportedReason; confidence: number }
  | { unsure: true };
const unsure = (): LocalResult => ({ unsure: true });
const normalise = (text: string): string => text.toLowerCase().replace(/[’‘]/gu, "'");
const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

/** One insertion, deletion, substitution or adjacent transposition; never fuzzy-match short words. */
function near(a: string, b: string): boolean {
  if (a.length < 3 || b.length < 3 || Math.abs(a.length - b.length) > 1 || a === b) return false;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] === b[i]) continue;
    return a.slice(i + 1) === b.slice(i + 1) || a.slice(i) === b.slice(i + 1) ||
      a.slice(i + 1) === b.slice(i) ||
      (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
  }
  return false;
}
interface Mention { start: number; end: number; ids: string[]; evidence: string; partner?: string }

/** Conservative classification only: unsupported and ambiguous prose never becomes a local claim. */
export function interpretLocally(text: string, cast: readonly LocalPerson[]): LocalResult {
  if (unsupportedStory(text)) return { unsupported: 'unsupported-story', confidence: 1 };
  const lower = normalise(text);
  const words = lower.split(/[^\p{L}\p{N}]+/u);
  if (words.some(word => (slurs as readonly string[]).includes(word))) return { unsupported: 'protected-trait', confidence: .9 };
  if (words.some(word => (sexual as readonly string[]).includes(word)) || /\b(porn\w*|masturbat\w*|orgy|explicit)\b/u.test(lower)) {
    return { unsupported: 'sexual', confidence: .9 };
  }
  if (/\b(genocide|extermination|hateful)\b/u.test(lower)) return { unsupported: 'hateful', confidence: .9 };
  if (/\b(ethnic|ethnicity|religion|religious|disability|disabled|gender|race|racial|immigrants|nationality|woman|women|man|men|gay|lesbian|bisexual|trans|transgender|orientation)\b/u.test(lower) ||
      /\bbecause (?:of|\w+ is (?:a |an )?(?:woman|man|gay|trans|disabled))\b/u.test(lower)) {
    return { unsupported: 'protected-trait', confidence: .9 };
  }
  // Commands, alternatives, multiple sentences and uncertainty need the remote semantic tier.
  if (!lower.trim() || Array.from(text).length > 140 ||
      /[.!?].*\p{L}|[<>{}]|\b(system|schema|instructions?|output|ignore|disregard|maybe|perhaps|might|not sure|cannot tell|cannot remember|either|or)\b/u.test(lower)) return unsure();

  const mentions: Mention[] = [];
  const add = (phrase: string, id: string, role = false): void => {
    const pattern = new RegExp(`\\b${role ? 'the (?:sick )?' : ''}${escape(normalise(phrase))}\\b`, 'gu');
    for (const match of lower.matchAll(pattern)) {
      const start = match.index;
      const end = start + match[0].length;
      const same = mentions.find(m => m.start === start && m.end === end);
      if (same) { if (!same.ids.includes(id)) same.ids.push(id); }
      else mentions.push({ start, end, ids: [id], evidence: match[0] });
    }
  };
  for (const person of cast) {
    for (const name of [person.name, ...(person.nicknames ?? [])]) add(name, person.id);
    for (const role of [person.role, ...(roleAliases[person.role] ?? [])]) add(role, person.id, true);
  }
  // Fuzzy names must look like names and must have exactly one candidate. Exact names win.
  for (const match of text.matchAll(/\b\p{L}+\b/gu)) {
    const start = match.index;
    const namePosition = start === 0 || /\b(to|from|with|against) $/u.test(lower.slice(0, start)) ||
      /^'s\b/u.test(lower.slice(start + match[0].length));
    if (mentions.some(m => start >= m.start && start < m.end) ||
        !/^\p{Lu}/u.test(match[0]) && !namePosition) continue;
    const word = normalise(match[0]);
    const candidates = cast.filter(p => [p.name, ...(p.nicknames ?? [])].some(name => near(word, normalise(name))));
    if (candidates.length) mentions.push({ start, end: start + word.length, ids: candidates.map(p => p.id), evidence: `name: ${word}` });
  }
  // Prefer the full role over embedded names/roles (e.g. the apprentice baker).
  mentions.sort((a, b) => a.start - b.start || b.end - a.end);
  const resolved: Mention[] = [];
  for (const mention of mentions) {
    if (resolved.some(m => mention.start < m.end)) continue;
    const relation = /^'s (wife|husband|spouse)\b/u.exec(lower.slice(mention.end));
    if (relation) {
      if (mention.ids.length !== 1) return unsure();
      const partner = mention.ids[0]!;
      const id = cast.find(p => p.id === partner)?.spouse ?? spouses[partner];
      if (!id || !cast.some(p => p.id === id)) return unsure();
      resolved.push({ ...mention, ids: [id], end: mention.end + relation[0].length, partner });
    } else resolved.push(mention);
  }
  if (resolved.some(m => m.ids.length !== 1)) return unsure();
  if (!resolved.length && !lexicons.some(l => l.strong.test(lower) || l.weak.test(lower))) {
    if (/^\p{Lu}\p{L}+(?: \p{Lu}\p{L}+)* (?:is|was|has|said|went)\b/u.test(text.trim()) &&
        !/^(The|Someone|She|He|It)\b/u.test(text.trim())) return { unsupported: 'not-about-cast', confidence: .9 };
    return unsure();
  }
  // Never mistake a known recipient for the subject of a claim about an unknown person.
  for (const match of text.matchAll(/\b\p{Lu}\p{L}*\b/gu)) {
    if (resolved.some(m => match.index >= m.start && match.index < m.end)) continue;
    if (!['the', 'a', 'an', 'i', 'my', 'our', 'your', 'apparently', 'heard', 'that'].includes(normalise(match[0]))) {
      return { unsupported: 'not-about-cast', confidence: .9 };
    }
  }
  if (!resolved.length) return unsure();
  const first = resolved[0]!;
  if (!/^(?:\s*|i heard (?:that )?|apparently )$/u.test(lower.slice(0, first.start))) return unsure();

  const strong = lexicons.filter(lexicon => lexicon.strong.test(lower));
  const matches = strong.length ? strong : lexicons.filter(lexicon => lexicon.weak.test(lower));
  if (!matches.length) return unsure();
  const positive = matches.find(m => (favourable as readonly string[]).includes(m.kind));
  const chosen = positive ?? matches[0]!;
  if (chosen.kind === 'broken-promise' &&
      /\b(never|not|didn't|hasn't|did not|has not) (?:ever )?(broke|break|broken|went back)\b/u.test(lower)) return unsure();
  // Avoiding a person or skipping a meal does not imply shirking assigned work.
  if (chosen.kind === 'shirking' &&
      !/\b(work|duties|duty|shift|watch|deliver\w*|shirk\w*|washing)\b/u.test(lower)) return unsure();
  // Broken promises use negation as evidence ("never came"); other denials must abstain.
  if (chosen.kind !== 'broken-promise' && /\b(never|not|no|cannot|can't|didn't|doesn't|isn't|wasn't|hasn't|hadn't|don't)\b/u.test(lower)) return unsure();
  // A role/name after the predicate may describe a recipient; require the kind after the subject.
  if (!chosen.strong.test(lower.slice(first.end)) && !chosen.weak.test(lower.slice(first.end))) return unsure();
  const confidence = matches.length > 1 && !positive ? .5 : strong.length ? .9 : .7;
  const about = first.ids[0]!;
  const second = resolved.find(m => m.ids[0] !== about);
  const target = takesTarget.includes(chosen.kind) ? second?.ids[0] ??
    (chosen.kind === 'nursed' && /\b(him|her|them)\b/u.test(lower) ? first.partner : undefined) : undefined;
  const object = objects.find(item => new RegExp(`\\b${item}\\b`, 'u').test(lower));
  const severity = /\b(a little|slightly|a bit)\b/u.test(lower) ? 1 : /\b(every|always|all|constantly)\b/u.test(lower) ? 3 : 2;
  return { claim: { kind: chosen.kind, about, ...(target ? { target } : {}), ...(object ? { object } : {}),
    severity, valence: positive ? 1 : -1 }, confidence,
    evidence: [`subject: ${first.evidence}`, `kind: ${chosen.kind} (${strong.length ? 'strong' : 'weak'})`] };
}
