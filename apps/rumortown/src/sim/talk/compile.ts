/**
 * Turns the authored bank into lookup-ready sets: stable ids, the placeholders each line needs, and
 * the villager names each line mentions literally (so nobody is talked about to their own face, and
 * nobody names themselves).
 */
import type { LineSet } from '../../content/lines/types.js';
import type { SpeechAct, VillagerId } from '../types.js';
import { mentions } from './grammar.js';

export const NEEDS = {
  claim: 1,
  object: 2,
  subject: 4,
  listener: 8,
  source: 16,
  place: 32,
  topic: 64,
  unknown: 128,
} as const;

const PLACEHOLDER_NEEDS: Readonly<Record<string, number>> = {
  claim: NEEDS.claim,
  object: NEEDS.object | NEEDS.claim,
  subject: NEEDS.subject,
  subjectObj: NEEDS.subject,
  subjectPoss: NEEDS.subject,
  listener: NEEDS.listener,
  source: NEEDS.source,
  place: NEEDS.place,
  topic: NEEDS.topic,
};

export const PLACEHOLDER = /\{(\w+)\}/g;

export interface CompiledLine {
  /** Stable across runs: `<owner>/<act>.<tags>/<index>`, e.g. `mira/gossip.harm.hedged/3`. */
  id: string;
  template: string;
  needs: number;
  /** Ids of villagers this line names outright. */
  mentions: readonly VillagerId[];
}

export interface CompiledSet {
  id: string;
  set: LineSet;
  lines: CompiledLine[];
}

export function placeholderNeeds(template: string): number {
  let needs = 0;
  for (const m of template.matchAll(PLACEHOLDER)) needs |= PLACEHOLDER_NEEDS[m[1] as string] ?? NEEDS.unknown;
  return needs;
}

/** The set's tags in a fixed order, used for ids. */
export function setTags(set: LineSet): string[] {
  const tags: string[] = [];
  if (set.valence !== undefined) tags.push(set.valence < 0 ? 'harm' : set.valence > 0 ? 'fav' : 'neutral');
  if (set.hedged !== undefined) tags.push(set.hedged ? 'hedged' : 'plain');
  if (set.toSubject) tags.push('to-subject');
  if (set.selfSubject) tags.push('self');
  if (set.anySubject) tags.push('any-subject');
  if (set.listenerRelation && set.listenerRelation !== 'any') tags.push(set.listenerRelation);
  if (set.topic) tags.push(`topic-${set.topic}`);
  if (set.stance) tags.push(`stance-${set.stance}`);
  if (set.mood) tags.push(`mood-${set.mood}`);
  if (set.daypart) tags.push(set.daypart);
  if (set.firsthand !== undefined) tags.push(set.firsthand ? 'firsthand' : 'hearsay');
  return tags;
}

export function compileBank(bank: readonly LineSet[], names: readonly { id: VillagerId; name: string }[]): Map<SpeechAct, CompiledSet[]> {
  const byAct = new Map<SpeechAct, CompiledSet[]>();
  const seen = new Map<string, number>();
  for (const set of bank) {
    const owner = set.speaker ?? set.voice ?? 'all';
    const base = `${owner}/${[set.act, ...setTags(set)].join('.')}`;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    const id = count === 1 ? base : `${base}~${count}`;
    const lines = set.lines.map((template, i) => ({
      id: `${id}/${i}`,
      template,
      needs: placeholderNeeds(template),
      mentions: names.filter((n) => mentions(template, n.name)).map((n) => n.id),
    }));
    const list = byAct.get(set.act) ?? [];
    list.push({ id, set, lines });
    byAct.set(set.act, list);
  }
  return byAct;
}
