/**
 * Fills a line's placeholders for one moment and sets the text: capitalised names and sentence starts,
 * "you" for the listener, "I" for the speaker, a pronoun where a name would repeat, curly apostrophes.
 */
import { PLACE_PHRASES } from '../../content/lines/places.js';
import type { Dossier, VillagerId } from '../types.js';
import { NEEDS, PLACEHOLDER } from './compile.js';
import type { LineContext } from './context.js';
import { adaptClause, capitaliseName, capitaliseSentences, mentions, type NameForm, type NameRule } from './grammar.js';

const FIRST: NameForm = { kind: 'first' };
const SECOND: NameForm = { kind: 'second' };
const AS_NAME: NameForm = { kind: 'name' };

/** True when every placeholder the line needs can be filled in this context. */
export function canFill(needs: number, c: LineContext): boolean {
  if (needs & NEEDS.unknown) return false;
  if (needs & NEEDS.claim && !c.claim) return false;
  if (needs & NEEDS.object && !c.claim?.object) return false;
  if (needs & NEEDS.subject && !c.subject) return false;
  if (needs & NEEDS.listener && (c.toStranger || c.listener.id === c.speaker.id)) return false;
  if (needs & NEEDS.source && !c.sourceText) return false;
  if (needs & NEEDS.topic && !c.topicPhrase) return false;
  return true;
}

function nameRules(c: LineContext, prefix: string, castById: ReadonlyMap<VillagerId, Dossier>): NameRule[] {
  const rules: NameRule[] = [];
  if (c.subject && c.subjectName) {
    let form: NameForm = AS_NAME;
    if (c.person === 'self') form = FIRST;
    else if (c.person === 'listener') form = SECOND;
    else if (mentions(prefix, c.subjectName)) form = { kind: 'third', pronouns: c.subject.pronouns };
    rules.push({ name: c.subjectName, form });
  }
  if (c.person !== 'self') rules.push({ name: c.speakerName, form: FIRST });
  if (!c.toStranger && c.listener.id !== c.speaker.id && c.person !== 'listener') rules.push({ name: c.listenerName, form: SECOND });
  const target = c.claim?.target ? castById.get(c.claim.target) : undefined;
  if (target) {
    const name = capitaliseName(target.name);
    if (!rules.some((r) => r.name === name)) rules.push({ name, form: AS_NAME });
  }
  return rules;
}

function placePhrase(c: LineContext, castById: ReadonlyMap<VillagerId, Dossier>): string {
  const id = c.speaker.workplace || 'square';
  const known = PLACE_PHRASES[id];
  if (known) return known;
  const home = /^home-(.+)$/.exec(id);
  if (home) {
    const owner = home[1] as string;
    if (owner === c.speaker.id) return 'the house';
    if (owner === c.listener.id && !c.toStranger) return 'your house';
    const d = castById.get(owner);
    return d ? `${capitaliseName(d.name)}'s house` : 'the house';
  }
  return `the ${id.replace(/-/g, ' ')}`;
}

function resolve(name: string, c: LineContext, prefix: string, castById: ReadonlyMap<VillagerId, Dossier>): string {
  const atSentenceStart = /(^|[.?!]["”’)]?\s+)$/.test(prefix) || prefix.trim() === '';
  switch (name) {
    case 'subject':
      if (c.person === 'listener') return 'you';
      if (c.person === 'self') return atSentenceStart ? 'I' : 'me';
      return c.subjectName ?? 'someone';
    case 'subjectObj':
      if (c.person === 'listener') return 'you';
      if (c.person === 'self') return 'me';
      return c.subject?.pronouns.object.toLowerCase() ?? 'them';
    case 'subjectPoss':
      if (c.person === 'listener') return 'your';
      if (c.person === 'self') return 'my';
      return c.subject?.pronouns.possessive.toLowerCase() ?? 'their';
    case 'listener':
      return c.listenerName;
    case 'source':
      return c.sourceText ?? 'someone';
    case 'claim':
      return c.claim ? adaptClause(c.claim.text, nameRules(c, prefix, castById)) : '';
    case 'object':
      return c.claim?.object ? adaptClause(c.claim.object, nameRules(c, prefix, castById), { nounPhrase: true }) : '';
    case 'place':
      return placePhrase(c, castById);
    case 'topic':
      return c.topicPhrase ?? 'the day';
    default:
      return '';
  }
}

/** Tidies spacing, capitalises sentence starts, and sets apostrophes as ’. */
export function polish(text: string): string {
  const tidy = text
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:?!])/g, '$1')
    .trim();
  return capitaliseSentences(tidy).replace(/'/g, '’');
}

export function fillLine(template: string, c: LineContext, castById: ReadonlyMap<VillagerId, Dossier>): string {
  let out = '';
  let last = 0;
  for (const m of template.matchAll(PLACEHOLDER)) {
    const at = m.index ?? 0;
    out += template.slice(last, at);
    out += resolve(m[1] as string, c, out, castById);
    last = at + m[0].length;
  }
  out += template.slice(last);
  return polish(out);
}
