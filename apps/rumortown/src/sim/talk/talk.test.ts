import { describe, expect, it } from 'vitest';
import { createRng } from 'rumormind';
import type { Dossier, GameClaim, LineKey } from '../types.js';
import { adaptClause, conjugate, type NameRule } from './grammar.js';
import { createTalkEngine } from './index.js';

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
  catchphrase: 'I\'m up at four. I notice things.',
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
  voice: 'Quiet and kind; few words, trails off.',
  catchphrase: 'Measure twice.',
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

function key(over: Partial<LineKey> & Pick<LineKey, 'act'>): LineKey {
  return { speaker: mira, listener: ben, mood: 0, tick: 100, ...over };
}

/* ---------------- Grammar ---------------- */

describe('grammar', () => {
  const she = { subject: 'she', object: 'her', possessive: 'her' };
  const they = { subject: 'they', object: 'them', possessive: 'their' };
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
    expect(adaptClause('Ben took Ivo\'s tools without asking', rules({ name: 'Ben', form: { kind: 'name' } }, { name: 'Ivo', form: { kind: 'second' } }))).toBe('Ben took your tools without asking');
    expect(adaptClause('Ben took Ivo\'s tools', rules({ name: 'Ivo', form: { kind: 'first' } }))).toBe('Ben took my tools');
    expect(adaptClause('Tom\'s been stealing', rules({ name: 'Tom', form: { kind: 'second' } }))).toBe('you\'ve been stealing');
    expect(adaptClause('tom stole bread', rules({ name: 'Tom', form: { kind: 'name' } }))).toBe('Tom stole bread');
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
});

describe('smoke', () => {
  it('says something for a plain gossip key', () => {
    const talk = createTalkEngine(cast);
    const rng = createRng(1);
    const line = talk.say(key({ act: 'gossip', claim: stole, confidence: 0.9 }), rng);
    expect(line.text.length).toBeGreaterThan(0);
    const toTom = talk.say(key({ act: 'accuse', listener: tom, claim: stole, confidence: 0.9 }), rng);
    expect(toTom.text).toMatch(/\byou/i);
    void brought;
  });
});
