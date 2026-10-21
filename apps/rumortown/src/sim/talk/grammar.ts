/**
 * Plain-English helpers for filling lines: capitalised names, sentence starts, and turning a claim
 * sentence ("Tom stole bread from the bakery") into the right person for the moment ("you stole…",
 * "I stole…", "he stole…") with verbs that agree. Pure and deterministic.
 */
import type { Pronouns } from '../types.js';

/** "mira" → "Mira", "old tom" → "Old Tom". */
export function capitaliseName(name: string): string {
  return name.trim().replace(/(^|[\s-])(\p{Ll})/gu, (_m, lead: string, ch: string) => lead + ch.toUpperCase());
}

/** Upper-cases the first letter of the text and of every sentence after . ? or !. An ellipsis is not a sentence end. */
export function capitaliseSentences(text: string): string {
  return text
    .replace(/^([\s"“‘(]*)(\p{Ll})/u, (_m, lead: string, ch: string) => lead + ch.toUpperCase())
    .replace(/((?:^|[^.])[.?!]["”’)]?\s+["“‘(]?)(\p{Ll})/gu, (_m, lead: string, ch: string) => lead + ch.toUpperCase());
}

/** How a named person reads inside a claim: kept as a name, or as I, you, or a third-person pronoun. */
export type NameForm = { kind: 'name' } | { kind: 'first' } | { kind: 'second' } | { kind: 'third'; pronouns: Pronouns };

export interface NameRule {
  name: string;
  form: NameForm;
}

export interface AdaptOptions {
  /** A noun phrase such as "Ivo's tools" rather than a sentence, so a leading name is not a subject. */
  nounPhrase?: boolean;
}

type Role = 'subject' | 'object' | 'possessive' | 'has' | 'is' | 'standalone';

const ADVERBS = new Set([
  'always', 'never', 'often', 'sometimes', 'still', 'also', 'just', 'even', 'once', 'twice', 'again', 'already', 'not',
]);

const AUXILIARIES = new Set([
  'is', 'was', 'are', 'were', 'has', 'had', 'have', 'will', 'would', 'can', 'could', 'did', 'does', 'do', 'must',
  'might', 'should', 'may', 'shall', "didn't", "doesn't", "isn't", "wasn't", "hasn't", "hadn't", "won't", "wouldn't",
  "can't", "couldn't", "aren't", "weren't",
]);

const IRREGULAR_PAST = new Set([
  'stole', 'took', 'gave', 'told', 'said', 'saw', 'went', 'kept', 'hid', 'broke', 'ate', 'made', 'paid', 'sold', 'bought',
  'brought', 'caught', 'left', 'met', 'sent', 'spent', 'lost', 'found', 'ran', 'sat', 'stood', 'wrote', 'spoke', 'swore',
  'struck', 'threw', 'wore', 'won', 'drank', 'sang', 'slept', 'fought', 'forgot', 'forgave', 'knew', 'lay', 'shook', 'hit',
  'cut', 'let', 'put', 'set', 'shut', 'led', 'fed', 'fled', 'bent', 'lent', 'dealt', 'felt', 'meant', 'heard', 'held',
  'sought', 'taught', 'thought', 'bit', 'chose', 'rode', 'drove', 'flew', 'grew', 'blew', 'drew', 'began', 'came',
  'became', 'got', 'swam', 'stuck', 'snuck', 'crept', 'wept', 'swept', 'built', 'burnt', 'learnt', 'slipped',
]);

/** Past participles that follow a contracted "has" ("Tom's taken"). */
const PARTICIPLES = new Set([
  'been', 'got', 'gone', 'had', 'done', 'taken', 'stolen', 'eaten', 'hidden', 'broken', 'given', 'forgotten', 'written',
  'spoken', 'beaten', 'chosen', 'fallen', 'driven', 'ridden', 'seen', 'shaken', 'sworn', 'torn', 'worn', 'known', 'grown',
  'thrown', 'shown', 'flown', 'drawn', 'kept', 'left', 'lost', 'made', 'paid', 'sold', 'told', 'found', 'never',
]);

/** Words after a contracted "is" ("Tom's hoarding", "Tom's not"). */
const IS_FOLLOWERS = new Set(['not', 'a', 'an', 'the', 'up', 'out', 'off', 'in', 'on', 'at', 'so', 'too', 'very', 'always', 'still', 'back', 'away']);

/** Words ending in s that are never a third-person verb. */
const NOT_S_VERBS = new Set(['always', 'sometimes', 'this', 'his', 'its', 'us', 'yes', 'less', 'unless', 'across', 'perhaps', 'besides', 'towards', 'afterwards', 'was', 'is', 'has', 'does', 'as']);

const FIRST_PERSON: Readonly<Record<string, string>> = {
  is: 'am',
  "isn't": 'am not',
  was: 'was',
  "wasn't": "wasn't",
  has: 'have',
  "hasn't": "haven't",
  does: 'do',
  "doesn't": "don't",
};

const PLURAL: Readonly<Record<string, string>> = {
  is: 'are',
  "isn't": "aren't",
  was: 'were',
  "wasn't": "weren't",
  has: 'have',
  "hasn't": "haven't",
  does: 'do',
  "doesn't": "don't",
};

/** Sentence openers that should be lower case when a claim sits mid-line. */
const COMMON_OPENERS = new Set(['someone', 'somebody', 'the', 'a', 'an', 'there', 'everyone', 'everybody', 'nobody', 'people', 'it', 'this', 'that', 'some']);

function isAdverb(word: string): boolean {
  const w = word.toLowerCase();
  return ADVERBS.has(w) || (w.length >= 5 && w.endsWith('ly'));
}

function isFiniteVerb(word: string): boolean {
  const w = word.toLowerCase();
  if (AUXILIARIES.has(w) || IRREGULAR_PAST.has(w)) return true;
  return w.length > 4 && w.endsWith('ed') && !w.endsWith('eed');
}

/** "steals" → "steal", "carries" → "carry", "watches" → "watch"; null when the word is not a third-person verb. */
function baseForm(word: string): string | null {
  const w = word.toLowerCase();
  if (NOT_S_VERBS.has(w) || !w.endsWith('s') || w.endsWith('ss') || w.endsWith('us') || w.endsWith('is') || w.includes("'")) return null;
  if (w.endsWith('ies')) return w.length > 4 ? `${w.slice(0, -3)}y` : w.slice(0, -1);
  if (/(?:sh|ch|x|z|o|ss)es$/.test(w)) return w.slice(0, -2);
  return w.slice(0, -1);
}

function matchCase(word: string, like: string): string {
  const first = like.charAt(0);
  return first !== first.toLowerCase() ? word.charAt(0).toUpperCase() + word.slice(1) : word;
}

/** Makes a verb agree with I (first) or with you and they (plural). */
export function conjugate(word: string, person: 'first' | 'plural'): string {
  const w = word.toLowerCase();
  const table = person === 'first' ? FIRST_PERSON : PLURAL;
  const fixed = table[w];
  if (fixed) return matchCase(fixed, word);
  const base = baseForm(w);
  return base ? matchCase(base, word) : word;
}

function independentPossessive(form: NameForm): string {
  if (form.kind === 'first') return 'mine';
  if (form.kind === 'second') return 'yours';
  if (form.kind === 'third') {
    const p = form.pronouns.possessive.toLowerCase();
    if (p === 'his' || p.endsWith('s')) return p;
    if (p === 'her') return 'hers';
    return `${p}s`;
  }
  return '';
}

function render(form: NameForm, role: Role, name: string): string {
  if (form.kind === 'name') {
    if (role === 'possessive' || role === 'has' || role === 'is' || role === 'standalone') return `${name}'s`;
    return name;
  }
  if (role === 'standalone') return independentPossessive(form);
  if (form.kind === 'first') {
    return { subject: 'I', object: 'me', possessive: 'my', has: "I've", is: "I'm" }[role];
  }
  if (form.kind === 'second') {
    return { subject: 'you', object: 'you', possessive: 'your', has: "you've", is: "you're" }[role];
  }
  const p = form.pronouns;
  const subj = p.subject.toLowerCase();
  const plural = subj === 'they';
  if (role === 'subject') return subj;
  if (role === 'object') return p.object.toLowerCase();
  if (role === 'possessive') return p.possessive.toLowerCase();
  if (role === 'has') return plural ? `${subj}'ve` : `${subj}'s`;
  return plural ? `${subj}'re` : `${subj}'s`;
}

function needsAgreement(form: NameForm): 'first' | 'plural' | null {
  if (form.kind === 'first') return 'first';
  if (form.kind === 'second') return 'plural';
  if (form.kind === 'third' && form.pronouns.subject.toLowerCase() === 'they') return 'plural';
  return null;
}

const TOKEN = /\p{L}+(?:['’]\p{L}+)*|[^\p{L}]+/gu;
const isWord = (t: string): boolean => /^\p{L}/u.test(t);

/**
 * Rewrites a claim sentence or noun phrase for the speaker and listener of a line. Names with a rule
 * become I, you or a pronoun by their place in the sentence; verbs after a new I, you or they agree.
 * Trailing punctuation is dropped so the line can supply its own.
 */
export function adaptClause(text: string, rules: readonly NameRule[], options: AdaptOptions = {}): string {
  const source = text.trim().replace(/’/g, "'").replace(/[.!?]+$/, '');
  const tokens = source.match(TOKEN) ?? [];
  const wordIdx: number[] = [];
  tokens.forEach((t, i) => {
    if (isWord(t)) wordIdx.push(i);
  });
  const lowerRules = rules.map((r) => ({ ...r, lower: r.name.toLowerCase() }));

  for (let w = 0; w < wordIdx.length; w++) {
    const i = wordIdx[w] as number;
    const token = tokens[i] as string;
    const possessive = /'s$/i.test(token);
    const bare = possessive ? token.slice(0, -2) : token;
    const rule = lowerRules.find((r) => r.lower === bare.toLowerCase());
    if (!rule) continue;

    const nextWord = w + 1 < wordIdx.length ? (tokens[wordIdx[w + 1] as number] as string) : undefined;
    const prevWord = w > 0 ? (tokens[wordIdx[w - 1] as number] as string) : undefined;
    let role: Role;
    if (possessive) {
      const n = nextWord?.toLowerCase();
      if (!n) role = 'standalone';
      else if (PARTICIPLES.has(n) || (n.length > 4 && n.endsWith('ed') && !n.endsWith('eed'))) role = 'has';
      else if (n.endsWith('ing') || IS_FOLLOWERS.has(n)) role = 'is';
      else role = 'possessive';
    } else {
      let k = w + 1;
      while (k < wordIdx.length && isAdverb(tokens[wordIdx[k] as number] as string)) k++;
      const verbAfter = k < wordIdx.length && isFiniteVerb(tokens[wordIdx[k] as number] as string);
      const leading = w === 0 && !options.nounPhrase;
      const inLeadingCompound = w === 2 && prevWord?.toLowerCase() === 'and' && !options.nounPhrase;
      role = leading || inLeadingCompound || verbAfter ? 'subject' : 'object';
    }

    const name = rule.form.kind === 'name' ? rule.name : bare;
    tokens[i] = render(rule.form, role, name);

    const compound = nextWord?.toLowerCase() === 'and' || prevWord?.toLowerCase() === 'and';
    const agreement = needsAgreement(rule.form);
    if (role === 'subject' && agreement && !compound) {
      let k = w + 1;
      while (k < wordIdx.length && isAdverb(tokens[wordIdx[k] as number] as string) && (tokens[wordIdx[k] as number] as string).toLowerCase() !== 'not') k++;
      if (k < wordIdx.length) {
        const vi = wordIdx[k] as number;
        tokens[vi] = conjugate(tokens[vi] as string, agreement);
      }
    }
  }

  let out = tokens.join('');
  // Courtesy order: "Rosa and I", "you and I", "with Rosa and me".
  out = out.replace(/\bI and (you|\p{Lu}\p{L}*)\b/gu, '$1 and I').replace(/\bme and (you|\p{Lu}\p{L}*)\b/gu, '$1 and me');
  const firstWord = out.match(/^\p{L}+/u)?.[0];
  if (firstWord && COMMON_OPENERS.has(firstWord.toLowerCase())) out = firstWord.toLowerCase() + out.slice(firstWord.length);
  return out;
}

/**
 * True when `name` appears as a whole word in `text`. Case-sensitive by default, so "a wren on the
 * sill" does not count as Wren.
 */
export function mentions(text: string, name: string, ignoreCase = false): boolean {
  if (!name) return false;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}])${escaped}(?![\\p{L}])`, ignoreCase ? 'iu' : 'u').test(text);
}
