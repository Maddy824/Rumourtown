/**
 * Talk: turns a structured speech act into the words a villager says.
 *
 * Selection: the sets for the act are filtered to those that may be used (speaker, voice, valence,
 * hedging, listener relation, who the claim is about, topic, whisper stance, mood, first-hand), then the
 * most specific wins: speaker > voice > valence > hedged > listener relation > the finer fields. Within
 * a winning set a line is picked with rng among those this speaker has not said in the last full simulated day.
 * If that set is exhausted, rng picks from all its lines. Tied sets are chosen uniformly first.
 *
 * Every `say` and `pickTopic` call draws exactly one rng value, so editing the line bank never shifts
 * the simulation's random stream.
 */
import { lineBank } from '../../content/lines/index.js';
import { EVENING_STARTS, MIDDAY_STARTS, ROLE_TOPICS, TOPICS_BY_BAND, type TopicBand } from '../../content/lines/topics.js';
import { CLAIM_ACTS, type LineSet, type VoiceArchetype } from '../../content/lines/types.js';
import { VOICES, voiceOf } from '../../content/lines/voices.js';
import { MINUTES_PER_DAY, type Dossier, type SpeechAct, type SpokenLine, type TalkApi, type VillagerId } from '../types.js';
import { compileBank, NEEDS, type CompiledLine, type CompiledSet } from './compile.js';
import { deriveContext, type LineContext, type TalkKey } from './context.js';
import { canFill, fillLine } from './fill.js';
import { capitaliseName } from './grammar.js';

export type { TalkKey, LineContext } from './context.js';

/** A line said by a speaker rests for one game day before they say it again. */
export const LINE_COOLDOWN_TICKS = MINUTES_PER_DAY;
/** Bubbles hold at most this many characters. */
export const MAX_LINE_LENGTH = 139;

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
  // Greetings, small talk, news and goodbyes never speak about the subject, so who it is does not matter.
  if (!CLAIM_ACTS.includes(set.act)) return true;
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
    const knownNews = c.act === 'news' && c.claim !== undefined
      && c.listener.knows?.some((known) => known.claimId === c.claim?.id);
    for (const cs of byAct.get(c.act) ?? []) {
      if (!eligible(cs.set, c)) continue;
      const lines = cs.lines.filter((l) => canFill(l.needs, c) && !namesSomeoneHere(l, c)
        && !(knownNews && l.needs & NEEDS.claim)
        // A claim-backed telling must voice that fact, rather than unrelated village chatter.
        && !(c.act === 'news' && c.claim && !knownNews && !(l.needs & NEEDS.claim))
        && fillLine(l.template, c, castById).length <= MAX_LINE_LENGTH);
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

  /** Candidate lines have already been rendered and checked against the bubble limit. */
  function pickFitting(pool: CompiledLine[], r: number, c: LineContext): { line: CompiledLine; text: string } {
    const line = pool[Math.min(pool.length - 1, Math.floor(r * pool.length))] as CompiledLine;
    return { line, text: fillLine(line.template, c, castById) };
  }

  function say(key: TalkKey, rng: () => number): SpokenLine {
    const r = rng();
    const c = context(key);
    // Time ran backwards: a new run is using this instance. Start its memory afresh.
    if (c.tick < latestTick) said.clear();
    latestTick = c.tick;
    // Free prose may contain first-person accounts or arbitrary grammar. Quote it;
    // never turn the stranger's account into the current speaker's eyewitness claim.
    if (c.claim?.kind === 'story' && (CLAIM_ACTS.includes(c.act) || c.act === 'news')) {
      const story = c.claim;
      // A model can suggest one question; ongoing speech stays local and deterministic.
      if (c.act === 'reactToWhisper' && story.meaning?.question) {
        return { lineId: 'story/question', text: story.meaning.question };
      }
      const prefixes = c.act === 'deny' ? ['I dispute this', 'That is only a claim'] :
        c.act === 'doubt' || c.hedged ? ['Is this really true', 'I am not convinced', 'Have you heard this'] :
        c.act === 'defend' ? ['We should check this', 'Do we know this is true'] :
        c.act === 'reactToWhisper' ? ['Who witnessed this', 'How do you know this', 'Can anyone confirm this'] :
        c.speaker.traits.honesty > .65 ? ['This is still unverified', 'Someone told me this'] :
        ['Word is going around', 'Listen to this story', 'People are saying'];
      const lead = prefixes[Math.min(prefixes.length - 1, Math.floor(r * prefixes.length))]!;
      return { lineId: `story/${c.act}`, text: `${lead}: “${story.text}”` };
    }
    if (c.claim?.id.startsWith('written_') && (CLAIM_ACTS.includes(c.act) || c.act === 'news')) {
      const lead = c.act === 'deny' ? 'I dispute this story' : c.act === 'doubt' ? 'I doubt this story' :
        c.act === 'defend' ? 'Be fair about this story' : c.act === 'reactToWhisper' ? 'You are telling me' : 'The stranger said';
      return { lineId: `written-quote/${c.act}`, text: `${lead}: “${c.claim.text}”` };
    }

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

    const top = groupsFor(c)[0];
    if (top) {
      // One draw chooses a tied set uniformly; its fractional remainder chooses a line.
      const scaled = r * top.length;
      const winner = top[Math.min(top.length - 1, Math.floor(scaled))] as Candidate;
      const fresh = winner.lines.filter(isFresh);
      const pool = fresh.length > 0 ? fresh : winner.lines;
      const pick = pickFitting(pool, scaled - Math.floor(scaled), c);
      lastSaid.set(pick.line.id, c.tick);
      return { lineId: pick.line.id, text: pick.text };
    }
    return { lineId: `fallback/${c.act}`, text: FALLBACK_TEXT[c.act] };
  }

  function pickTopic(speaker: Dossier, listener: Dossier, minuteOfDay: number, rng: () => number): string {
    const r = rng();
    // Minutes since midnight, as in WorldSnapshot.minuteOfDay.
    const minute = ((Math.floor(minuteOfDay) % 1440) + 1440) % 1440;
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
