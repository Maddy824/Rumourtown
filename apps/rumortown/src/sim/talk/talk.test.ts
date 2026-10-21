import { describe, expect, it } from 'vitest';
import { createRng } from 'rumormind';
import { archetypeSets, CORE_SPEAKERS, coreSets, lineBank } from '../../content/lines/index.js';
import { genericSets } from '../../content/lines/generic.js';
import { ALL_TOPICS, TOPICS_BY_BAND } from '../../content/lines/topics.js';
import { CLAIM_ACTS, SPEECH_ACTS, VOICE_ARCHETYPES, type LineSet, type VoiceArchetype } from '../../content/lines/types.js';
import { VOICES } from '../../content/lines/voices.js';
import { cast as village, claims as realClaims } from '../../content/cast/index.js';
import type { Dossier, GameClaim, LineKey, Pronouns, SpeechAct, VillagerId } from '../types.js';
import { compileBank, PLACEHOLDER } from './compile.js';
import { adaptClause, conjugate, mentions, type NameRule } from './grammar.js';
import { createTalk, createTalkEngine, LINE_COOLDOWN_TICKS, MAX_LINE_LENGTH, type TalkKey } from './index.js';

/* ---------------- Sample cast: every field in the contract ---------------- */

function dossier(over: Partial<Dossier> & Pick<Dossier, 'id' | 'name' | 'pronouns' | 'age' | 'role'>): Dossier {
  return {
    tier: 'core',
    communities: ['market', 'inn'],
    home: `home-${over.id}`,
    workplace: 'square',
    traits: { honesty: 0.6, emotionality: 0.5, extraversion: 0.5, agreeableness: 0.6, conscientiousness: 0.6, openness: 0.5 },
    closeTo: [],
    secrets: [],
    schedule: [{ start: 0, place: `home-${over.id}`, activity: 'sleep' }],
    look: { body: 'round', skin: '#D9A077', hair: { style: 'short', color: '#6B3F21' }, hat: 'none', top: '#A3323B', bottom: '#3F5E8A', prop: 'none' },
    voice: 'Plain.',
    ...over,
  };
}

const mira = dossier({
  id: 'mira',
  name: 'Mira',
  pronouns: { subject: 'she', object: 'her', possessive: 'her' },
  age: 44,
  role: 'baker',
  workplace: 'bakery',
  closeTo: ['wren'],
  rival: 'jonah',
  secrets: [{ id: 'mira-debt', kind: 'debt', description: 'Mira pays Pim what she owes.', place: 'shop', window: [300, 320], with: 'pim', confirms: ['paid-debt'], contradicts: [] }],
  schedule: [
    { start: 0, place: 'home-mira', activity: 'sleep' },
    { start: 30, place: 'bakery', activity: 'work' },
  ],
  look: { body: 'stout', skin: '#F1C9A5', hair: { style: 'bun', color: '#6B3F21' }, hat: 'headscarf', top: '#D9A531', bottom: '#2E2A22', apron: '#F6F0E4', prop: 'loaf' },
  voice: 'Quick and exact; judges fast and says so.',
  catchphrase: "I'm up at four. I notice things.",
  knows: [],
});

const tom = dossier({
  id: 'tom',
  name: 'Tom',
  pronouns: { subject: 'he', object: 'him', possessive: 'his' },
  age: 29,
  role: 'odd-jobs carpenter',
  closeTo: ['ben', 'ada'],
  traits: { honesty: 0.85, emotionality: 0.6, extraversion: 0.2, agreeableness: 0.8, conscientiousness: 0.7, openness: 0.5 },
  secrets: [{ id: 'tom-bread', kind: 'delivery', description: 'Tom takes bread to Ada.', place: 'home-ada', window: [80, 100], with: 'ada', confirms: ['kindness'], contradicts: ['theft'] }],
  voice: 'Quiet and kind; few words, trails off.',
  catchphrase: 'Measure twice.',
  knows: [{ claimId: 'tom-brought-bread-to-ada', confidence: 1 }],
});

const ben = dossier({
  id: 'ben',
  name: 'Ben',
  pronouns: { subject: 'he', object: 'him', possessive: 'his' },
  age: 31,
  role: 'fisher',
  workplace: 'riverside',
  closeTo: ['tom'],
  traits: { honesty: 0.6, emotionality: 0.3, extraversion: 0.5, agreeableness: 0.4, conscientiousness: 0.5, openness: 0.3 },
  voice: 'Blunt and loyal; short sentences.',
  catchphrase: 'Says who?',
});

const cast = [mira, tom, ben];

const stole: GameClaim = { id: 'tom-stole-bread', kind: 'theft', about: 'tom', valence: -1, text: 'Tom stole bread from the bakery', severity: 2, object: 'bread', contradicts: ['tom-brought-bread-to-ada'] };
const brought: GameClaim = { id: 'tom-brought-bread-to-ada', kind: 'kindness', about: 'tom', valence: 1, text: 'Tom took bread to Ada, who is ill', severity: 1, object: 'bread', contradicts: ['tom-stole-bread'], alternativeOf: 'tom-stole-bread' };

function key(over: Partial<TalkKey> & Pick<LineKey, 'act'>): TalkKey {
  return { speaker: mira, listener: ben, mood: 0, tick: 100, ...over };
}

/* ---------------- The whole village, for sweeps (fixed ids, roles, pronouns, ties) ---------------- */

const PRONOUNS: Record<'he' | 'she' | 'they', Pronouns> = {
  he: { subject: 'he', object: 'him', possessive: 'his' },
  she: { subject: 'she', object: 'her', possessive: 'her' },
  they: { subject: 'they', object: 'them', possessive: 'their' },
};
const villager = (id: VillagerId): Dossier => {
  const d = village.find((v) => v.id === id);
  if (!d) throw new Error(id);
  return d;
};
const representativeOf = (voice: VoiceArchetype): Dossier => villager(Object.keys(VOICES).find((id) => VOICES[id] === voice && !(CORE_SPEAKERS as readonly string[]).includes(id)) ?? 'yan');

function claimAbout(subject: Dossier, valence: -1 | 0 | 1): GameClaim {
  const n = subject.name;
  const text = valence < 0 ? `${n} stole a sack of flour from the mill at night` : valence > 0 ? `${n} mended the chapel roof and asked for nothing` : `${n} has been planning the autumn fair all week`;
  return { id: `${subject.id}-${valence}`, kind: valence < 0 ? 'theft' : 'kindness', about: subject.id, valence, text, severity: 2, object: 'a sack of flour' };
}

const ownerOf = (s: LineSet): string => s.speaker ?? s.voice ?? 'all';
const allLines = (sets: readonly LineSet[]): string[] => sets.flatMap((s) => s.lines);
const keyLabel = (s: LineSet): string => `${ownerOf(s)} ${s.act} ${JSON.stringify({ ...s, lines: undefined })}`;

/* ---------------- Grammar ---------------- */

describe('grammar', () => {
  const she = PRONOUNS.she;
  const they = PRONOUNS.they;
  const rules = (...r: NameRule[]): NameRule[] => r;

  it('turns the subject into you, I or a pronoun with agreeing verbs', () => {
    expect(adaptClause('Tom stole bread from the bakery.', rules({ name: 'Tom', form: { kind: 'second' } }))).toBe('you stole bread from the bakery');
    expect(adaptClause('Jonah is having an affair with Rosa', rules({ name: 'Jonah', form: { kind: 'second' } }))).toBe('you are having an affair with Rosa');
    expect(adaptClause('Jonah is having an affair with Rosa', rules({ name: 'Jonah', form: { kind: 'first' } }))).toBe('I am having an affair with Rosa');
    expect(adaptClause('Wren has been hoarding flour', rules({ name: 'Wren', form: { kind: 'third', pronouns: they } }))).toBe('they have been hoarding flour');
    expect(adaptClause('Mira owes Pim money', rules({ name: 'Mira', form: { kind: 'second' } }))).toBe('you owe Pim money');
    expect(adaptClause('Mira always lies', rules({ name: 'Mira', form: { kind: 'first' } }))).toBe('I always lie');
    expect(adaptClause('Ada was seen at the well', rules({ name: 'Ada', form: { kind: 'third', pronouns: she } }))).toBe('she was seen at the well');
  });

  it('maps the speaker and listener inside the claim, in courtesy order', () => {
    expect(adaptClause('Jonah is having an affair with Rosa', rules({ name: 'Jonah', form: { kind: 'name' } }, { name: 'Rosa', form: { kind: 'first' } }))).toBe('Jonah is having an affair with me');
    expect(adaptClause('Jonah and Rosa are planning the fair', rules({ name: 'Jonah', form: { kind: 'first' } }))).toBe('Rosa and I are planning the fair');
    expect(adaptClause("Ben took Ivo's tools without asking", rules({ name: 'Ben', form: { kind: 'name' } }, { name: 'Ivo', form: { kind: 'second' } }))).toBe('Ben took your tools without asking');
    expect(adaptClause("Ben took Ivo's tools", rules({ name: 'Ivo', form: { kind: 'first' } }))).toBe('Ben took my tools');
    expect(adaptClause("Tom's been stealing", rules({ name: 'Tom', form: { kind: 'second' } }))).toBe("you've been stealing");
    expect(adaptClause('tom stole bread', rules({ name: 'Tom', form: { kind: 'name' } }))).toBe('Tom stole bread');
    expect(adaptClause('Someone saw Tom at the well', rules({ name: 'Tom', form: { kind: 'second' } }))).toBe('someone saw you at the well');
  });

  it('conjugates common verbs', () => {
    expect(conjugate('carries', 'plural')).toBe('carry');
    expect(conjugate('watches', 'first')).toBe('watch');
    expect(conjugate('goes', 'plural')).toBe('go');
    expect(conjugate('stole', 'plural')).toBe('stole');
    expect(conjugate("doesn't", 'plural')).toBe("don't");
    expect(conjugate('was', 'plural')).toBe('were');
    expect(conjugate('was', 'first')).toBe('was');
  });

  it('finds names as whole words, case-sensitively', () => {
    expect(mentions('Ask Rosa, she knows', 'Rosa')).toBe(true);
    expect(mentions('a wren on the sill', 'Wren')).toBe(false);
    expect(mentions('Bench by the well', 'Ben')).toBe(false);
  });
});

/* ---------------- The bank, as content ---------------- */

const SLANG = /\b(okay|ok|cool|awesome|guys|dude|yeah|yep|nope|gonna|wanna|gotta|kinda|sorta|totally|literally|basically|vibes?|lol|chill|bro|hey|hi|seriously|crazy|super|hang out|freak out)\b/i;
const GENDERED = /\b(he|she|him|her|his|hers|himself|herself|man|woman|lad|lass)\b/i;
const KNOWN = new Set(['subject', 'subjectObj', 'subjectPoss', 'listener', 'source', 'claim', 'object', 'place', 'topic']);
const CAST_NAMES = village.map((d) => d.name);

describe('line bank content', () => {
  /** Runs a check over every line and reports all failures at once. */
  const audit = (sets: readonly LineSet[], check: (line: string, set: LineSet) => string | undefined): string[] =>
    sets.flatMap((set) => set.lines.map((line) => check(line, set)).filter((v): v is string => v !== undefined).map((v) => `${keyLabel(set)} :: ${v}`));

  it('loads, and every line is short, plain and has only known placeholders', () => {
    expect(lineBank.length).toBeGreaterThan(0);
    expect(lineBank.filter((s) => s.lines.length === 0).map(keyLabel)).toEqual([]);
    const bad = audit(lineBank, (line) => {
      if (line.trim() !== line) return `untrimmed: ${line}`;
      if (line.length > MAX_LINE_LENGTH) return `too long: ${line}`;
      if (SLANG.test(line)) return `slang: ${line}`;
      if ((line.match(/!/g) ?? []).length > 1) return `exclamations: ${line}`;
      const unknown = [...line.matchAll(PLACEHOLDER)].map((m) => m[1] as string).filter((n) => !KNOWN.has(n));
      if (unknown.length) return `unknown placeholder ${unknown.join()}: ${line}`;
      if (/[{}]/.test(line.replace(PLACEHOLDER, ''))) return `stray brace: ${line}`;
      return undefined;
    });
    expect(bad).toEqual([]);
  });

  it('keeps exclamation marks rare', () => {
    const lines = allLines(lineBank);
    const loud = lines.filter((l) => l.includes('!')).length;
    expect(loud / lines.length).toBeLessThanOrEqual(0.02);
  });

  it('has no duplicate lines within a set and has unique line ids', () => {
    const dupes: string[] = [];
    for (const set of lineBank) {
      const seen = new Map<string, string>();
      for (const line of set.lines) {
        const prior = seen.get(line);
        if (prior) dupes.push(`"${line}" in ${prior} and ${keyLabel(set)}`);
        seen.set(line, keyLabel(set));
      }
    }
    expect(dupes).toEqual([]);
    const compiled = compileBank(lineBank, village.map((d) => ({ id: d.id, name: d.name })));
    const ids = [...compiled.values()].flat().flatMap((s) => s.lines.map((l) => l.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('never has a villager name themselves, and keeps shared claim lines free of names', () => {
    const bad = audit(lineBank, (line, set) => {
      if (set.speaker) {
        const own = village.find((d) => d.id === set.speaker)?.name ?? '';
        return mentions(line, own) ? `names self: ${line}` : undefined;
      }
      if (CLAIM_ACTS.includes(set.act)) {
        const named = CAST_NAMES.filter((n) => mentions(line, n));
        return named.length ? `names ${named.join()}: ${line}` : undefined;
      }
      return undefined;
    });
    expect(bad).toEqual([]);
  });

  it('writes claim lines that suit any subject: no he or she, the name before {claim}, pronouns after it', () => {
    const bad = audit(lineBank.filter((s) => CLAIM_ACTS.includes(s.act)), (line) => {
      if (GENDERED.test(line.replace(PLACEHOLDER, ''))) return `gendered: ${line}`;
      if ((line.match(/\{subject\}/g) ?? []).length > 1) return `{subject} twice: ${line}`;
      const at = line.indexOf('{claim}');
      if (at >= 0 && line.indexOf('{subject}', at) >= 0) return `{subject} after {claim}: ${line}`;
      if (at >= 0 && /\{subject(Obj|Poss)\}/.test(line.slice(0, at))) return `pronoun before {claim}: ${line}`;
      return undefined;
    });
    expect(bad).toEqual([]);
  });

  it('speaks to the subject as "you" in every line that may be said to them', () => {
    const bad = audit(lineBank.filter((s) => s.toSubject), (line) =>
      /\byou/i.test(line) || line.includes('{claim}') ? undefined : `no "you": ${line}`,
    );
    expect(bad).toEqual([]);
  });

  it('never names the listener or a source in a reaction to the stranger', () => {
    const bad = audit(lineBank.filter((s) => s.act === 'reactToWhisper'), (line) => (/\{(listener|source)\}/.test(line) ? line : undefined));
    expect(bad).toEqual([]);
  });

  it('gives each core villager the brief\'s line counts', () => {
    const count = (speaker: string, act: SpeechAct, valence: -1 | 1, hedged: boolean): string[] =>
      allLines(coreSets.filter((s) => s.speaker === speaker && s.act === act && s.valence === valence && !!s.hedged === hedged));
    const base = (speaker: string, act: SpeechAct, topic?: string): number =>
      allLines(coreSets.filter((s) => s.speaker === speaker && s.act === act && s.topic === topic && !s.listenerRelation && !s.mood && !s.daypart && s.valence === undefined)).length;
    for (const speaker of CORE_SPEAKERS) {
      for (const act of CLAIM_ACTS) {
        expect(count(speaker, act, -1, false).length, `${speaker} ${act} harmful`).toBeGreaterThanOrEqual(6);
        // Positive caution banks are counted too; runtime voices good news as gossip (spec §9).
        expect(count(speaker, act, 1, false).length, `${speaker} ${act} favourable`).toBeGreaterThanOrEqual(4);
      }
      for (const act of ['gossip', 'warn', 'doubt'] as const) expect(count(speaker, act, -1, true).length, `${speaker} ${act} hedged`).toBeGreaterThanOrEqual(4);
      for (const act of ['gossip', 'doubt'] as const) expect(count(speaker, act, 1, true).length, `${speaker} ${act} hedged favourable`).toBeGreaterThanOrEqual(3);
      for (const act of ['greet', 'news', 'farewell'] as const) expect(base(speaker, act), `${speaker} ${act}`).toBeGreaterThanOrEqual(8);
      for (const topic of ALL_TOPICS) expect(base(speaker, 'smalltalk', topic), `${speaker} smalltalk ${topic}`).toBeGreaterThanOrEqual(8);
    }
  });

  it('gives each voice archetype at least four lines per act and valence', () => {
    const count = (voice: VoiceArchetype, act: SpeechAct, valence?: -1 | 0 | 1, topic?: string): number =>
      allLines(archetypeSets.filter((s) => s.voice === voice && s.act === act && s.valence === valence && s.topic === topic && !s.hedged)).length;
    for (const voice of VOICE_ARCHETYPES) {
      for (const act of CLAIM_ACTS) {
        expect(count(voice, act, -1), `${voice} ${act} harmful`).toBeGreaterThanOrEqual(4);
        expect(count(voice, act, 1), `${voice} ${act} favourable`).toBeGreaterThanOrEqual(4);
      }
      for (const act of [...CLAIM_ACTS, 'news'] as const) {
        expect(count(voice, act, 0), `${voice} ${act} neutral`).toBeGreaterThanOrEqual(4);
      }
      for (const act of ['gossip', 'warn', 'doubt'] as const) {
        expect(allLines(archetypeSets.filter((s) => s.voice === voice && s.act === act && s.valence === -1 && s.hedged)).length, `${voice} ${act} hedged`).toBeGreaterThanOrEqual(3);
      }
      for (const act of ['greet', 'news', 'farewell', 'smalltalk'] as const) expect(count(voice, act), `${voice} ${act}`).toBeGreaterThanOrEqual(act === 'smalltalk' ? 2 : 4);
      for (const topic of ALL_TOPICS) expect(count(voice, 'smalltalk', undefined, topic), `${voice} smalltalk ${topic}`).toBeGreaterThanOrEqual(4);
    }
  });

  it('assigns every villager a voice archetype', () => {
    for (const d of village) expect(VOICE_ARCHETYPES).toContain(VOICES[d.id]);
    expect(Object.keys(VOICES)).toHaveLength(24);
  });
});

/* ---------------- Selection ---------------- */

describe('selection', () => {
  it('prefers speaker > voice > valence > hedged > listener relation', () => {
    const fields: { name: string; set: Partial<LineSet> }[] = [
      { name: 'speaker', set: { speaker: 'mira' } },
      { name: 'voice', set: { voice: 'sharp' } },
      { name: 'valence', set: { valence: -1 } },
      { name: 'hedged', set: { hedged: true } },
      { name: 'relation', set: { listenerRelation: 'close' } },
    ];
    const close = { ...mira, closeTo: ['ben'] };
    const k = key({ act: 'gossip', speaker: close, claim: stole, confidence: 0.5 });
    for (let i = 0; i < fields.length; i++) {
      const winner = fields[i] as (typeof fields)[number];
      // Every field below the winner, all on one set, still loses to the winner alone.
      const rest = Object.assign({}, ...fields.slice(i + 1).map((f) => f.set)) as Partial<LineSet>;
      const bank: LineSet[] = [
        { act: 'gossip', lines: ['generic {claim}.'] },
        { act: 'gossip', ...rest, lines: ['lower {claim}.'] },
        { act: 'gossip', ...winner.set, lines: [`${winner.name} {claim}.`] },
      ];
      const talk = createTalk([close, tom, ben], { bank });
      expect(talk.say(k, createRng(3)).text, winner.name).toMatch(new RegExp(`^${winner.name.charAt(0).toUpperCase()}${winner.name.slice(1)} `));
    }
    // And with all five stacked, the order of removal follows the same ranking.
    const bank: LineSet[] = fields.map((f) => ({ act: 'gossip' as SpeechAct, ...f.set, lines: [`${f.name} said it.`] }));
    for (let i = 0; i < fields.length; i++) {
      const talk = createTalk([close, tom, ben], { bank: bank.slice(i) });
      expect(talk.say(k, createRng(5)).text).toBe(`${(fields[i] as (typeof fields)[number]).name.replace(/^./, (c) => c.toUpperCase())} said it.`);
    }
  });

  it('keeps the winning set when exhausted and releases each line after exactly 900 ticks', () => {
    const bank: LineSet[] = [
      { act: 'greet', speaker: 'mira', lines: ['One.', 'Two.'] },
      { act: 'greet', lines: ['Three.'] },
    ];
    const talk = createTalk(cast, { bank });
    expect(talk.say(key({ act: 'greet', tick: 0 }), () => 0).text).toBe('One.');
    expect(talk.say(key({ act: 'greet', tick: 1 }), () => 0).text).toBe('Two.');
    // Both used: rng can pick either, including the most recent, inside the winning set.
    expect(talk.say(key({ act: 'greet', tick: 2 }), () => 0.9).text).toBe('Two.');
    expect(talk.say(key({ act: 'greet', tick: 899 }), () => 0.9).text).toBe('Two.');
    expect(talk.say(key({ act: 'greet', tick: 900 }), () => 0.9).text).toBe('One.');
    expect(LINE_COOLDOWN_TICKS).toBe(900);
  });

  it('chooses tied sets uniformly before choosing a fresh line, and remembers speakers separately', () => {
    const bank: LineSet[] = [
      { act: 'greet', lines: ['One.'] },
      { act: 'greet', lines: ['Two.', 'Three.', 'Four.'] },
    ];
    const talk = createTalk(cast, { bank });
    expect(talk.say(key({ act: 'greet' }), () => 0.49).text).toBe('One.');
    expect(talk.say(key({ act: 'greet' }), () => 0.5).text).toBe('Two.');
    expect(talk.say(key({ act: 'greet' }), () => 0.5).text).toBe('Three.');
    expect(talk.say(key({ act: 'greet', speaker: ben, listener: mira }), () => 0.5).text).toBe('Two.');
  });

  it('hedges below 0.6 confidence and not above', () => {
    const talk = createTalkEngine(cast);
    for (const act of ['gossip', 'warn', 'doubt'] as const) {
      expect(talk.say(key({ act, claim: stole, confidence: 0.5 }), createRng(1)).lineId, act).toContain('hedged');
      expect(talk.say(key({ act, claim: stole, confidence: 0.9, tick: 200 }), createRng(1)).lineId, act).not.toContain('hedged');
    }
    const regular = createTalkEngine(village);
    expect(regular.say(key({ act: 'gossip', speaker: villager('pim'), listener: villager('mab'), claim: claimAbout(villager('hal'), -1), confidence: 0.3 }), createRng(1)).lineId).toContain('hedged');
  });

  it('hedges at 0.599 but not 0.6, including direct and self addressing', () => {
    const talk = createTalkEngine(village);
    for (const speaker of village) {
      const listener = village.find((d) => d.id !== speaker.id) as Dossier;
      const third = village.find((d) => d.id !== speaker.id && d.id !== listener.id) as Dossier;
      for (const subject of [speaker, listener, third]) {
        for (const act of ['gossip', 'warn', 'doubt'] as const) {
          for (const valence of [-1, 1] as const) {
            const k = key({ act, speaker, listener, subject, claim: claimAbout(subject, valence), confidence: 0.599 });
            expect(talk.say(k, () => 0).lineId, `${speaker.id}/${subject.id}/${act}/${valence}`).toContain('hedged');
            expect(talk.say({ ...k, confidence: 0.6 }, () => 0).lineId).not.toContain('hedged');
          }
        }
      }
    }
  });

  it('only chooses lines that fit after filling a long claim', () => {
    const talk = createTalk(cast, { bank: [
      { act: 'gossip', speaker: mira.id, lines: ['A very long preamble before the claim. {claim}.', 'You should ask about it.'] },
    ] });
    const claim = { ...stole, text: `Tom stole ${'a great many loaves of bread '.repeat(6)}` };
    expect(talk.say(key({ act: 'gossip', claim }), () => 0).text).toBe('You should ask about it.');
  });

  it('voices a favourable "warning" as gossip', () => {
    const talk = createTalkEngine(cast);
    const line = talk.say(key({ act: 'warn', claim: brought, confidence: 0.9 }), createRng(4));
    expect(line.lineId).toMatch(/\/gossip\.fav/);
  });

  it('does not present a claim in the listener dossier as fresh news', () => {
    const talk = createTalk(cast, { bank: [
      { act: 'news', valence: -1, lines: ['New to you: {claim}.'] },
      { act: 'news', lines: ['The fair is on Sunday.'] },
    ] });
    const listener = { ...ben, knows: [{ claimId: stole.id, confidence: 0.8 }] };
    expect(talk.say(key({ act: 'news', listener, claim: stole }), () => 0).text).toBe('The fair is on Sunday.');
    expect(talk.say(key({ act: 'news', listener: ben, claim: stole }), () => 0).text).toBe('New to you: Tom stole bread from the bakery.');
  });

  it('reacts to a whisper by trust: sceptical below 0.4, neutral to 0.6, receptive above', () => {
    const talk = createTalkEngine(cast);
    const whisper = (trust: number | undefined, confidence: number) =>
      talk.say(key({ act: 'reactToWhisper', listener: mira, claim: stole, source: 'stranger', confidence, trust, tick: Math.round(trust ?? 0) }), createRng(7)).lineId;
    expect(whisper(0.2, 0.9)).toContain('stance-sceptical');
    expect(whisper(0.5, 0.9)).toContain('stance-neutral');
    expect(whisper(0.8, 0.1)).toContain('stance-receptive');
    // Without trust on the key, the speaker's belief stands in for it.
    expect(whisper(undefined, 0.3)).toContain('stance-sceptical');
    expect(whisper(undefined, 0.7)).toContain('stance-receptive');
    // A whisper about the listener themselves gets an answer for their own sake.
    const self = talk.say(key({ act: 'reactToWhisper', speaker: tom, listener: tom, claim: stole, source: 'stranger', confidence: 0.4 }), createRng(7));
    expect(self.lineId).toMatch(/reactToWhisper\.harm\.self/);
    expect(self.text).not.toMatch(/\bTom\b/);
  });

  it('is deterministic and draws exactly one rng value per call', () => {
    const run = () => {
      const talk = createTalk(village);
      let draws = 0;
      const base = createRng(42);
      const rng = () => {
        draws++;
        return base();
      };
      const out: string[] = [];
      for (let t = 0; t < 60; t++) {
        const speaker = village[t % village.length] as Dossier;
        const listener = village[(t * 7 + 3) % village.length] as Dossier;
        const act = SPEECH_ACTS[t % SPEECH_ACTS.length] as SpeechAct;
        const subject = village[(t * 5 + 1) % village.length] as Dossier;
        out.push(talk.say({ act, speaker, listener, claim: claimAbout(subject, ((t % 3) - 1) as -1 | 0 | 1), confidence: (t % 10) / 10, mood: 0, topic: ALL_TOPICS[t % ALL_TOPICS.length], tick: t * 3 }, rng).text);
        out.push(talk.pickTopic(speaker, listener, 420 + t * 15, rng));
      }
      return { out, draws };
    };
    const a = run();
    const b = run();
    expect(a.out).toEqual(b.out);
    expect(a.draws).toBe(120);
  });

  it('starts a fresh memory when time runs backwards (a new run on the same instance)', () => {
    const reused = createTalk(cast);
    for (let t = 500; t < 520; t++) reused.say(key({ act: 'greet', tick: t }), createRng(t));
    const fresh = createTalk(cast);
    expect(reused.say(key({ act: 'greet', tick: 0 }), createRng(77))).toEqual(fresh.say(key({ act: 'greet', tick: 0 }), createRng(77)));
  });

  it('always finds a line: every act, valence and person, for every voice', () => {
    const talk = createTalkEngine(village);
    const speakers = [...CORE_SPEAKERS.map(villager), ...VOICE_ARCHETYPES.map(representativeOf)];
    for (const speaker of speakers) {
      const others = village.filter((d) => d.id !== speaker.id);
      const listener = others[0] as Dossier;
      const third = others[1] as Dossier;
      for (const act of SPEECH_ACTS) {
        const keys: TalkKey[] = [key({ act, speaker, listener, topic: 'weather' })];
        for (const valence of [-1, 0, 1] as const) {
          for (const subject of [speaker, listener, third]) {
            keys.push(key({ act, speaker, listener, claim: claimAbout(subject, valence), confidence: 0.9, topic: 'weather' }));
            keys.push(key({ act, speaker, listener, claim: claimAbout(subject, valence), confidence: 0.4, topic: 'weather' }));
          }
        }
        for (const k of keys) expect(talk.say(k, createRng(1)).lineId, `${speaker.id} ${act}`).not.toMatch(/^fallback/);
      }
    }
  });
});

/* ---------------- Filling ---------------- */

describe('filling lines', () => {
  const talk = createTalkEngine(cast);

  it('addresses the subject as "you"', () => {
    expect(talk.render('They say {claim}.', key({ act: 'gossip', listener: tom, claim: stole }))).toBe('They say you stole bread from the bakery.');
    expect(talk.render('{claim}. Well?', key({ act: 'accuse', listener: tom, claim: stole }))).toBe('You stole bread from the bakery. Well?');
    expect(talk.render('{subject} would never. Not {subjectPoss} way.', key({ act: 'defend', listener: tom, claim: stole }))).toBe('You would never. Not your way.');
    // Every line Mira could say to Tom about Tom speaks to him, never about him.
    for (const act of CLAIM_ACTS.filter((a) => a !== 'reactToWhisper')) {
      for (const claim of [stole, brought]) {
        const k = key({ act, listener: tom, claim, confidence: 0.9 });
        for (const group of talk.candidates(k)) {
          for (const cand of group) {
            for (const line of cand.lines) {
              const text = talk.render(line.template, k);
              if (cand.set.set.toSubject) expect(text, `${line.id}: ${text}`).toMatch(/\byou/i);
              expect(text.replace(/(^|[,.?] )Tom(?=[,.?])/g, ''), `${line.id}: ${text}`).not.toMatch(/\bTom\b/);
            }
          }
        }
      }
    }
  });

  it('capitalises names and sentence starts, even from lower-case data', () => {
    const lower = cast.map((d) => ({ ...d, name: d.name.toLowerCase() }));
    const quiet = createTalkEngine(lower);
    const [m, t, b] = lower as [Dossier, Dossier, Dossier];
    const claim = { ...stole, text: 'tom stole bread from the bakery' };
    expect(quiet.render('{listener}, {claim}.', { act: 'gossip', speaker: m, listener: b, claim, mood: 0, tick: 0 })).toBe('Ben, Tom stole bread from the bakery.');
    expect(quiet.render('{claim}. {source} says so.', { act: 'gossip', speaker: m, listener: b, claim, source: 'stranger', mood: 0, tick: 0 })).toBe('Tom stole bread from the bakery. The stranger says so.');
    expect(quiet.render('Is it so? {claim}?', { act: 'accuse', speaker: m, listener: t, claim, mood: 0, tick: 0 })).toBe('Is it so? You stole bread from the bakery?');
    const rng = createRng(8);
    for (let i = 0; i < 40; i++) {
      const text = quiet.say({ act: SPEECH_ACTS[i % SPEECH_ACTS.length] as SpeechAct, speaker: m, listener: b, claim, mood: 0, tick: i, topic: 'bread', confidence: 0.9 }, rng).text;
      expect(text, text).not.toMatch(/\b(mira|tom|ben)\b/);
      expect(text.charAt(0), text).toBe(text.charAt(0).toUpperCase());
    }
  });

  it('uses a pronoun when the subject was just named, and "I" or "me" for the speaker', () => {
    expect(talk.render('{subject}? {claim}.', key({ act: 'gossip', claim: stole }))).toBe('Tom? He stole bread from the bakery.');
    expect(talk.render('{claim}?', key({ act: 'deny', speaker: tom, listener: mira, claim: stole }))).toBe('I stole bread from the bakery?');
    expect(talk.render('You know {subject} would keep {subjectPoss} word. Ask {subjectObj}.', key({ act: 'defend', speaker: tom, listener: mira, claim: stole })))
      .toBe('You know I would keep my word. Ask me.');
    const fromMira = { ...stole, text: 'Tom stole bread from Mira' };
    expect(talk.render('Word is {claim}.', key({ act: 'gossip', claim: fromMira }))).toBe('Word is Tom stole bread from me.');
    const v = createTalkEngine(village);
    const affair: GameClaim = { id: 'jonah-affair-rosa', kind: 'romance', about: 'jonah', valence: -1, text: 'Jonah is having an affair with Rosa', severity: 2, target: 'rosa' };
    expect(v.render('They say {claim}.', { act: 'gossip', speaker: villager('mira'), listener: villager('rosa'), claim: affair, mood: 0, tick: 0 })).toBe('They say Jonah is having an affair with you.');
    expect(v.render('They say {claim}.', { act: 'gossip', speaker: villager('rosa'), listener: villager('mira'), claim: affair, mood: 0, tick: 0 })).toBe('They say Jonah is having an affair with me.');
    expect(v.render('Back to {place}.', { act: 'farewell', speaker: villager('ada'), listener: villager('tom'), mood: 0, tick: 0 })).toBe('Back to the house.');
    expect(v.render('{source} told me.', { act: 'gossip', speaker: villager('ada'), listener: villager('tom'), source: villager('rosa'), mood: 0, tick: 0 })).toBe('Rosa told me.');
  });

  it('carries I and you into later pronouns in the real claims', () => {
    const talk = createTalkEngine(village);
    const claim = (id: string) => realClaims.find((c) => c.id === id) as GameClaim;
    const render = (id: string, speaker: string, listener: string) => talk.render('{claim}.', key({
      act: 'explain', claim: claim(id), speaker: villager(speaker), listener: villager(listener),
    }));
    expect(render('tom-boasts-of-his-work', 'tom', 'ben')).toBe('I brag that I am the best carpenter in three villages.');
    expect(render('tom-boasts-of-his-work', 'mira', 'tom')).toBe('You brag that you are the best carpenter in three villages.');
    expect(render('mira-paid-pim', 'mira', 'pim')).toBe('I paid you every penny I owed you.');
    expect(render('tom-brought-bread-to-ada', 'tom', 'ada')).toBe('I took bread to you because you are too ill to fetch it.');
    expect(render('dag-skims-tolls', 'dag', 'ben')).toBe('I keep a cut of the bridge tolls for myself.');
    expect(render('dag-skims-tolls', 'ben', 'dag')).toBe('You keep a cut of the bridge tolls for yourself.');
    expect(render('hal-lied-about-wheel', 'hal', 'ivo')).toBe('I lied about your iron to get out of paying for my wheel.');
    expect(render('ivo-sold-bad-iron', 'ivo', 'hal')).toBe('I put cracked iron on your cart wheel and charged you full price.');
    expect(render('ivo-sold-bad-iron', 'hal', 'ivo')).toBe('You put cracked iron on my cart wheel and charged me full price.');
    expect(render('sol-secret-sweetheart', 'greta', 'sol')).toBe('You meet a sweetheart behind the haystacks while I work the south field.');
    expect(render('sol-secret-sweetheart', 'mira', 'greta')).toBe('Sol meets a sweetheart behind the haystacks while you work the south field.');
    expect(render('mira-wont-pay-pim', 'mira', 'pim')).toBe('I owe you money and have no intention of paying.');
    expect(render('rosa-shirks-the-inn', 'rosa', 'tess')).toBe('I sneak off every afternoon and leave you to run the inn.');
    expect(render('wren-skips-work', 'wren', 'mira')).toBe('I skip off from the bakery whenever your back is turned.');
  });

  it('resolves all nine placeholder forms and capitalises every cast name inside a claim', () => {
    const talk = createTalkEngine(village);
    const subject = villager('wren');
    const k = key({ act: 'gossip', speaker: villager('mira'), listener: villager('ben'), subject,
      source: villager('rosa'), claim: { ...stole, about: 'wren', text: 'wren has borrowed tools from ivo', object: 'tools' }, topic: 'the-fair' });
    expect(talk.render('{subject}? {claim}. Give {subjectObj} {subjectPoss} {object}. {listener}, {source}, {place}, {topic}.', k))
      .toBe('Wren? They have borrowed tools from Ivo. Give them their tools. Ben, Rosa, the bakery, the fair.');
    expect(talk.render('{claim}.', { ...k, subject: tom, claim: { ...stole, text: 'Tom said Tom had lost Tom’s bread' } }))
      .toBe('Tom said he had lost his bread.');
  });

  it('keeps every real claim short and in the right person through say', () => {
    const talk = createTalk(village);
    const rng = createRng(41);
    for (const claim of realClaims) {
      const subject = villager(claim.about);
      const other = village.find((d) => d.id !== subject.id) as Dossier;
      for (const act of CLAIM_ACTS) {
        for (const [speaker, listener] of [[subject, other], [other, subject]] as const) {
          const line = talk.say(key({ act, speaker, listener, claim, confidence: 0.4 }), rng);
          expect(line.lineId).not.toMatch(/^fallback/);
          expect(line.text.length, line.text).toBeLessThan(140);
          expect(line.text).not.toMatch(/[{}]|\b(?:you|they) (?:is|was|has)\b|\bI (?:is|has)\b/);
          expect(mentions(line.text, speaker.name), line.text).toBe(false);
          if (act !== 'reactToWhisper') expect(mentions(line.text, listener.name), line.text).toBe(false);
        }
      }
    }
  });

  it('resolves every placeholder in every line, within 140 characters', () => {
    const v = createTalkEngine(village);
    const pool = ['tom', 'ada', 'hal', 'nell', 'elin', 'greta'].map(villager);
    const tickFor = (s: LineSet): number => (s.daypart === 'morning' ? 60 : s.daypart === 'midday' ? 300 : s.daypart === 'evening' ? 700 : 120);
    for (const set of lineBank) {
      const speaker = set.speaker ? villager(set.speaker) : set.voice ? representativeOf(set.voice) : villager('yan');
      const others = pool.filter((d) => d.id !== speaker.id);
      const [a, b, c] = others as [Dossier, Dossier, Dossier];
      const subject = set.selfSubject ? speaker : set.toSubject ? a : b;
      const listener = set.act === 'reactToWhisper' ? speaker : a;
      const k: TalkKey = {
        act: set.act,
        speaker,
        listener,
        subject,
        claim: claimAbout(subject, set.valence ?? -1),
        source: c,
        confidence: set.hedged ? 0.5 : 0.9,
        mood: set.mood === 'low' ? -0.6 : set.mood === 'high' ? 0.7 : 0,
        topic: set.topic ?? 'weather',
        tick: tickFor(set),
      };
      for (const template of set.lines) {
        const text = v.render(template, k);
        expect(text, `${keyLabel(set)}: ${template}`).not.toMatch(/[{}]|undefined|null|\s{2}/);
        expect(text.length, text).toBeLessThanOrEqual(MAX_LINE_LENGTH);
        expect(text.charAt(0), text).toBe(text.charAt(0).toUpperCase());
      }
    }
  });

  it('never has anyone name themselves in the third person, across the whole village', () => {
    const v = createTalkEngine(village);
    for (const speaker of village) {
      const others = village.filter((d) => d.id !== speaker.id);
      const listener = others[(speaker.age * 7) % others.length] as Dossier;
      const third = others.find((d) => d.id !== listener.id) as Dossier;
      const keys: TalkKey[] = [];
      for (const act of SPEECH_ACTS) {
        keys.push({ act, speaker, listener, mood: 0, tick: 0, topic: ALL_TOPICS[speaker.age % ALL_TOPICS.length] });
        for (const subject of [speaker, listener, third]) {
          for (const valence of [-1, 0, 1] as const) {
            keys.push({ act, speaker, listener, claim: claimAbout(subject, valence), source: third, confidence: 0.9, mood: 0, tick: 0 });
          }
        }
      }
      for (const k of keys) {
        for (const group of v.candidates(k)) {
          for (const cand of group) {
            for (const line of cand.lines) {
              const text = v.render(line.template, k);
              expect(mentions(text, speaker.name), `${line.id} by ${speaker.id}: ${text}`).toBe(false);
              expect(text.length, text).toBeLessThanOrEqual(MAX_LINE_LENGTH);
            }
          }
        }
      }
    }
  });

  it('keeps smalltalk on the topic it was given', () => {
    const t = createTalkEngine(cast);
    for (const topic of ALL_TOPICS) {
      const line = t.say(key({ act: 'smalltalk', topic }), createRng(1));
      expect(line.lineId, topic).toContain(`topic-${topic}`);
    }
    expect(t.say(key({ act: 'smalltalk', topic: 'weather-rain' }), createRng(1)).lineId).toContain('topic-weather');
  });

  it('only says "Morning" in the morning', () => {
    const t = createTalkEngine(village);
    for (let tick = 600; tick < 900; tick += 7) {
      const text = t.say({ act: 'greet', speaker: villager('hal'), listener: villager('ivo'), mood: 0, tick }, createRng(tick)).text;
      expect(text, text).not.toMatch(/^Morning/);
    }
  });
});

/* ---------------- Topics ---------------- */

describe('pickTopic', () => {
  const talk = createTalk(village);
  const at = (h: number, m = 0) => h * 60 + m;

  it('picks morning, midday and evening topics by the clock', () => {
    const rng = createRng(3);
    for (let i = 0; i < 50; i++) {
      expect(TOPICS_BY_BAND.morning).toContain(talk.pickTopic(villager('sol'), villager('hal'), at(8, i), rng));
      expect(TOPICS_BY_BAND.midday).toContain(talk.pickTopic(villager('sol'), villager('hal'), at(13, i), rng));
      expect(TOPICS_BY_BAND.evening).toContain(talk.pickTopic(villager('sol'), villager('hal'), at(19, i), rng));
    }
  });

  it('is deterministic and leans toward the speaker\'s trade', () => {
    const a = createRng(5);
    const b = createRng(5);
    const seqA = Array.from({ length: 30 }, (_, i) => talk.pickTopic(villager('mira'), villager('tom'), at(8) + i, a));
    const seqB = Array.from({ length: 30 }, (_, i) => talk.pickTopic(villager('mira'), villager('tom'), at(8) + i, b));
    expect(seqA).toEqual(seqB);
    const rng = createRng(6);
    const picks = Array.from({ length: 1000 }, () => talk.pickTopic(villager('mira'), villager('hal'), at(8), rng));
    expect(picks.filter((p) => p === 'bread').length / picks.length).toBeGreaterThan(0.4);
  });

  it('keeps minutes before 07:00 in the morning rather than adding another seven hours', () => {
    expect(TOPICS_BY_BAND.morning).toContain(talk.pickTopic(villager('sol'), villager('hal'), 30, createRng(1)));
    expect(TOPICS_BY_BAND.morning).toContain(talk.pickTopic(villager('sol'), villager('hal'), 390, () => 0));
  });
});

describe('generic sets', () => {
  it('cover every act', () => {
    for (const act of SPEECH_ACTS) expect(genericSets.some((s) => s.act === act), act).toBe(true);
  });
});
