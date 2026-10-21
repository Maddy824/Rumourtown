/**
 * Talk: turns a structured speech act into the words a villager says.
 *
 * Selection: the sets for the act are filtered to those that may be used (speaker, voice, valence,
 * hedging, listener relation, who the claim is about, topic, whisper stance, mood, first-hand), then the
 * most specific wins: speaker > voice > valence > hedged > listener relation > the finer fields. Within
 * the winning group a line is picked with rng among those this speaker has not said in the last day;
 * when the whole group has been used, the next most specific group is tried, and when everything has
 * been used the least recently said line of the winning group comes back.
 *
 * Every `say` and `pickTopic` call draws exactly one rng value, so editing the line bank never shifts
 * the simulation's random stream.
 */
import { lineBank } from '../../content/lines/index.js';
import { EVENING_STARTS, MIDDAY_STARTS, ROLE_TOPICS, TOPICS_BY_BAND, type TopicBand } from '../../content/lines/topics.js';
import type { LineSet, VoiceArchetype } from '../../content/lines/types.js';
import { VOICES, voiceOf } from '../../content/lines/voices.js';
import { DAY_START_MINUTE, MINUTES_PER_DAY, type Dossier, type SpeechAct, type SpokenLine, type TalkApi, type VillagerId } from '../types.js';
import { compileBank, type CompiledLine, type CompiledSet } from './compile.js';
import { deriveContext, type LineContext, type TalkKey } from './context.js';
import { canFill, fillLine } from './fill.js';
import { capitaliseName } from './grammar.js';

export type { TalkKey, LineContext } from './context.js';

/** A line said by a speaker rests for one game day before they say it again. */
export const LINE_COOLDOWN_TICKS = MINUTES_PER_DAY;
/** Bubbles hold at most this many characters. */
export const MAX_LINE_LENGTH = 140;

export interface TalkOptions {
  /** Replace the authored bank, for tests and tools. */
  bank?: readonly LineSet[];
  voices?: Readonly<Record<VillagerId, VoiceArchetype>>;
}

export interface Candidate {
  set: CompiledSet;
  score: number;
  lines: CompiledLine[];
}

/** A TalkApi with read-only views for tests and tools. */
export interface TalkEngine extends TalkApi {
  say(key: TalkKey, rng: () => number): SpokenLine;
  /** The usable sets for a key, grouped by specificity, most specific first. */
  candidates(key: TalkKey): Candidate[][];
  /** Fills a template for a key without picking or touching cooldowns. */
  render(template: string, key: TalkKey): string;
  context(key: TalkKey): LineContext;
}

const FALLBACK_TEXT: Readonly<Record<SpeechAct, string>> = {
  greet: 'Hello.',
  smalltalk: 'Quiet day.',
  news: 'Nothing new.',
  gossip: 'Have you heard the talk?',
  warn: 'Mind how you go.',
  confide: 'Can I tell you something?',
  accuse: 'I know what you did.',
  deny: 'No.',
  explain: 'It is not what it looks like.',
  defend: 'Leave it be.',
  doubt: 'I am not so sure.',
  agree: 'Aye.',
  apologize: 'I am sorry.',
  forgive: 'It is forgotten.',
  refuse: 'No.',
  farewell: 'Goodbye.',
  reactToWhisper: 'Is that so?',
};

export function eligible(set: LineSet, c: LineContext): boolean {
  if (set.act !== c.act) return false;
  if (set.speaker !== undefined && set.speaker !== c.speaker.id) return false;
  if (set.voice !== undefined && set.voice !== c.voice) return false;
  if (set.valence !== undefined && set.valence !== c.valence) return false;
  if (set.hedged !== undefined && set.hedged !== c.hedged) return false;
  if (set.listenerRelation !== undefined && set.listenerRelation !== 'any' && set.listenerRelation !== c.relation) return false;
  if (set.topic !== undefined && set.topic !== c.topic) return false;
  if (set.stance !== undefined && set.stance !== c.stance) return false;
  if (set.mood !== undefined && set.mood !== c.moodBand) return false;
  if (set.daypart !== undefined && set.daypart !== c.daypart) return false;
  if (set.firsthand !== undefined && set.firsthand !== c.firsthand) return false;
  if (set.anySubject) return true;
  if (set.toSubject) return c.person === 'listener';
  if (set.selfSubject) return c.person === 'self';
  return c.person === 'other' || c.person === 'none';
}

/** Higher is more specific. Each field outranks everything below it. */
export function specificity(set: LineSet): number {
  let s = 0;
  if (set.speaker !== undefined) s += 100_000;
  if (set.voice !== undefined) s += 10_000;
  if (set.valence !== undefined) s += 1_000;
  if (set.hedged !== undefined) s += 100;
  if (set.listenerRelation !== undefined && set.listenerRelation !== 'any') s += 10;
  if (set.topic !== undefined) s += 1;
  if (set.stance !== undefined) s += 1;
  if (set.mood !== undefined) s += 1;
  if (set.daypart !== undefined) s += 1;
  if (set.firsthand !== undefined) s += 1;
  if (set.toSubject || set.selfSubject) s += 1;
  return s;
}

/** True when a line names, outright, the speaker, the person spoken to, or the person spoken about. */
function namesSomeoneHere(line: CompiledLine, c: LineContext): boolean {
  if (line.mentions.length === 0) return false;
  if (line.mentions.includes(c.speaker.id)) return true;
  if (!c.toStranger && line.mentions.includes(c.listener.id)) return true;
  return c.subject !== undefined && line.mentions.includes(c.subject.id);
}

export function createTalkEngine(cast: Dossier[], options: TalkOptions = {}): TalkEngine {
  const castById = new Map(cast.map((d) => [d.id, d] as const));
  const voices = options.voices ?? VOICES;
  const voice = (d: Dossier): VoiceArchetype => voiceOf(d, voices);
  const names = cast.map((d) => ({ id: d.id, name: capitaliseName(d.name) }));
  const byAct = compileBank(options.bank ?? lineBank, names);
  /** speaker → lineId → tick last said. */
  const said = new Map<VillagerId, Map<string, number>>();
  let latestTick = Number.NEGATIVE_INFINITY;

  const context = (key: TalkKey): LineContext => deriveContext(key, castById, voice);

  function groupsFor(c: LineContext): Candidate[][] {
    const found: Candidate[] = [];
    for (const cs of byAct.get(c.act) ?? []) {
      if (!eligible(cs.set, c)) continue;
      const lines = cs.lines.filter((l) => canFill(l.needs, c) && !namesSomeoneHere(l, c));
      if (lines.length > 0) found.push({ set: cs, score: specificity(cs.set), lines });
    }
    found.sort((a, b) => b.score - a.score);
    const groups: Candidate[][] = [];
    for (const cand of found) {
      const last = groups[groups.length - 1];
      if (last && (last[0] as Candidate).score === cand.score) last.push(cand);
      else groups.push([cand]);
    }
    return groups;
  }

  /** Starts at the rng's choice and walks on until a line fits a bubble; the shortest if none does. */
  function pickFitting(pool: CompiledLine[], r: number, c: LineContext): { line: CompiledLine; text: string } {
    const n = pool.length;
    const start = Math.min(n - 1, Math.floor(r * n));
    let best: { line: CompiledLine; text: string } | undefined;
    for (let j = 0; j < n; j++) {
      const line = pool[(start + j) % n] as CompiledLine;
      const text = fillLine(line.template, c, castById);
      if (text.length <= MAX_LINE_LENGTH) return { line, text };
      if (!best || text.length < best.text.length) best = { line, text };
    }
    return best as { line: CompiledLine; text: string };
  }

  function say(key: TalkKey, rng: () => number): SpokenLine {
    const r = rng();
    const c = context(key);
    // Time ran backwards: a new run is using this instance. Start its memory afresh.
    if (c.tick < latestTick) said.clear();
    latestTick = c.tick;

    let memory = said.get(c.speaker.id);
    if (!memory) {
      memory = new Map();
      said.set(c.speaker.id, memory);
    }
    const lastSaid = memory;
    const isFresh = (l: CompiledLine): boolean => {
      const t = lastSaid.get(l.id);
      return t === undefined || c.tick - t >= LINE_COOLDOWN_TICKS;
    };

    const groups = groupsFor(c);
    for (const group of groups) {
      const pool = group.flatMap((g) => g.lines).filter(isFresh);
      if (pool.length > 0) {
        const pick = pickFitting(pool, r, c);
        lastSaid.set(pick.line.id, c.tick);
        return { lineId: pick.line.id, text: pick.text };
      }
    }
    const top = groups[0];
    if (top) {
      const pool = top.flatMap((g) => g.lines);
      const when = (l: CompiledLine): number => lastSaid.get(l.id) ?? Number.NEGATIVE_INFINITY;
      const oldest = Math.min(...pool.map(when));
      const pick = pickFitting(pool.filter((l) => when(l) === oldest), r, c);
      lastSaid.set(pick.line.id, c.tick);
      return { lineId: pick.line.id, text: pick.text };
    }
    return { lineId: `fallback/${c.act}`, text: FALLBACK_TEXT[c.act] };
  }

  function pickTopic(speaker: Dossier, listener: Dossier, minuteOfDay: number, rng: () => number): string {
    const r = rng();
    // Minutes since midnight, as in WorldSnapshot.minuteOfDay. Values before 07:00 are read as minutes since day start.
    let minute = ((Math.floor(minuteOfDay) % 1440) + 1440) % 1440;
    if (minute < DAY_START_MINUTE) minute += DAY_START_MINUTE;
    const band: TopicBand = minute < MIDDAY_STARTS ? 'morning' : minute < EVENING_STARTS ? 'midday' : 'evening';
    const topics = TOPICS_BY_BAND[band];
    const lean = (d: Dossier, topic: string): number => {
      const role = d.role.toLowerCase();
      return ROLE_TOPICS.some((rt) => role.includes(rt.role) && rt.topics.includes(topic)) ? 1 : 0;
    };
    const weights = topics.map((t) => 1 + lean(speaker, t) + 0.5 * lean(listener, t));
    const total = weights.reduce((a, b) => a + b, 0);
    let x = r * total;
    for (let i = 0; i < topics.length; i++) {
      x -= weights[i] as number;
      if (x < 0) return topics[i] as string;
    }
    return topics[topics.length - 1] as string;
  }

  return {
    say,
    pickTopic,
    candidates: (key) => groupsFor(context(key)),
    render: (template, key) => fillLine(template, context(key), castById),
    context,
  };
}

/** The game's talk module. `cast` supplies names, pronouns, ties and roles at runtime. */
export function createTalk(cast: Dossier[], options: TalkOptions = {}): TalkApi {
  return createTalkEngine(cast, options);
}
