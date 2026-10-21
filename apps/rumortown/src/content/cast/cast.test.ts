import { describe, expect, it } from 'vitest';
import { MINUTES_PER_DAY, type ClaimKind, type Dossier, type Secret } from '../../sim/types.js';
import { createWorld } from '../../sim/world/index.js';
import { villageMap } from '../map/index.js';
import { cast, castVersion, claims } from './index.js';

// Copied verbatim from the global constraints on purpose, so the data is checked against the
// contract rather than against itself.
const FIXED_PLACES = [
  'square', 'well', 'bakery', 'mill', 'inn', 'chapel', 'school', 'shop', 'smithy', 'field-north',
  'field-south', 'bridge', 'riverside', 'orchard', 'home-mira', 'home-tom', 'home-ada', 'home-rosa',
  'home-jonah', 'home-ben', 'home-elin', 'home-pim', 'home-sol', 'home-ivo', 'home-nell', 'home-otto',
];
const FIXED_CAST: [id: string, role: string, age: number, pronoun: 'she' | 'he' | 'they', tier: Dossier['tier']][] = [
  ['mira', 'baker', 44, 'she', 'core'],
  ['tom', 'odd-jobs carpenter', 29, 'he', 'core'],
  ['ben', 'fisher', 31, 'he', 'core'],
  ['ada', 'weaver', 67, 'she', 'core'],
  ['rosa', 'innkeeper', 51, 'she', 'core'],
  ['jonah', 'miller', 48, 'he', 'core'],
  ['elin', 'teacher', 35, 'she', 'regular'],
  ['pim', 'shopkeeper', 58, 'he', 'regular'],
  ['sol', 'farmer', 46, 'he', 'regular'],
  ['greta', 'farmer', 43, 'she', 'regular'],
  ['ivo', 'blacksmith', 39, 'he', 'regular'],
  ['nell', 'herbalist and midwife', 61, 'she', 'regular'],
  ['otto', 'chaplain', 55, 'he', 'regular'],
  ['wren', 'apprentice baker', 19, 'they', 'regular'],
  ['hal', 'carter', 50, 'he', 'regular'],
  ['dag', 'bridge keeper', 64, 'he', 'regular'],
  ['una', 'laundress', 38, 'she', 'background'],
  ['cass', 'beekeeper', 27, 'she', 'background'],
  ['fen', 'shepherd', 23, 'he', 'background'],
  ['lio', 'fiddler', 33, 'he', 'background'],
  ['mab', 'seamstress', 41, 'she', 'background'],
  ['rook', 'gravedigger', 59, 'he', 'background'],
  ['tess', 'barmaid', 24, 'she', 'background'],
  ['yan', 'tinker', 36, 'he', 'background'],
];
const PRONOUNS = {
  she: { subject: 'she', object: 'her', possessive: 'her' },
  he: { subject: 'he', object: 'him', possessive: 'his' },
  they: { subject: 'they', object: 'them', possessive: 'their' },
};
const COMMUNITIES = ['market', 'farm', 'inn', 'chapel'];
// From the brief: couples share a home, the inn lodgers live at the inn, the rest lodge as listed.
const LODGINGS: Record<string, string> = {
  greta: 'home-sol',
  wren: 'inn',
  tess: 'inn',
  lio: 'inn',
  rook: 'inn',
  yan: 'inn',
  hal: 'home-pim',
  dag: 'home-otto',
  una: 'home-nell',
  cass: 'home-elin',
  fen: 'home-sol',
  mab: 'home-ivo',
};
const CLAIM_KINDS: ClaimKind[] = [
  'theft', 'cheating', 'romance', 'lying', 'broken-promise', 'insult', 'hoarding', 'shirking',
  'boasting', 'kindness', 'paid-debt', 'nursed',
];
const SECRET_KINDS: Secret['kind'][] = ['delivery', 'gift', 'borrow', 'meeting', 'practice', 'debt', 'nursing'];
const HEX = /^#[0-9A-Fa-f]{6}$/;

const villager = (id: string): Dossier => {
  const d = cast.find((v) => v.id === id);
  if (!d) throw new Error(`no villager ${id}`);
  return d;
};
const claimIds = new Set(claims.map((c) => c.id));
const claim = (id: string) => {
  const c = claims.find((x) => x.id === id);
  if (!c) throw new Error(`no claim ${id}`);
  return c;
};
/** Schedule entries as [start, end) intervals; the last runs to the end of the day. */
const intervals = (d: Dossier) =>
  d.schedule.map((e, i) => ({ ...e, end: d.schedule[i + 1]?.start ?? MINUTES_PER_DAY }));
/** The entry at `place` that covers the whole window, if any. */
const coveringEntry = (d: Dossier, place: string, [from, to]: [number, number]) =>
  intervals(d).find((e) => e.place === place && e.start <= from && to <= e.end);
const allSecrets = cast.flatMap((d) => d.secrets.map((s) => ({ owner: d, secret: s })));

describe('roster', () => {
  it('has the 24 fixed villagers in order with their roles, ages, pronouns and tiers', () => {
    expect(cast).toHaveLength(24);
    expect(cast.map((d) => d.id)).toEqual(FIXED_CAST.map(([id]) => id));
    for (const [id, role, age, pronoun, tier] of FIXED_CAST) {
      const d = villager(id);
      expect(d.role, id).toBe(role);
      expect(d.age, id).toBe(age);
      expect(d.pronouns, id).toEqual(PRONOUNS[pronoun]);
      expect(d.tier, id).toBe(tier);
      expect(d.name, id).toBe(id.charAt(0).toUpperCase() + id.slice(1));
    }
  });

  it('has unique ids and the cast version', () => {
    expect(new Set(cast.map((d) => d.id)).size).toBe(cast.length);
    expect(castVersion).toBe('v1');
  });

  it('puts every villager in two of the four communities', () => {
    for (const d of cast) {
      expect(d.communities, d.id).toHaveLength(2);
      expect(new Set(d.communities).size, d.id).toBe(2);
      for (const c of d.communities) expect(COMMUNITIES, d.id).toContain(c);
    }
  });

  it('keeps every trait between 0 and 1', () => {
    for (const d of cast) {
      for (const [trait, value] of Object.entries(d.traits)) {
        expect(value, `${d.id}.${trait}`).toBeGreaterThanOrEqual(0);
        expect(value, `${d.id}.${trait}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('uses only the fixed place ids', () => {
    for (const d of cast) {
      const places = [d.home, d.workplace, ...d.schedule.map((e) => e.place), ...d.secrets.map((s) => s.place)];
      for (const p of places) expect(FIXED_PLACES, d.id).toContain(p);
    }
  });

  it('houses everyone as the brief says', () => {
    for (const d of cast) {
      const expected = LODGINGS[d.id] ?? `home-${d.id}`;
      expect(d.home, d.id).toBe(expected);
    }
  });
});

describe('ties', () => {
  it('gives everyone two or three close ties, never themselves or their rival', () => {
    for (const d of cast) {
      expect(d.closeTo.length, d.id).toBeGreaterThanOrEqual(2);
      expect(d.closeTo.length, d.id).toBeLessThanOrEqual(3);
      expect(new Set(d.closeTo).size, d.id).toBe(d.closeTo.length);
      expect(d.closeTo, d.id).not.toContain(d.id);
      if (d.rival) expect(d.closeTo, d.id).not.toContain(d.rival);
      for (const id of d.closeTo) villager(id);
    }
  });

  it('forms the clusters the brief names, both ways', () => {
    const pairs = [
      ['tom', 'ben'], ['mira', 'wren'], ['jonah', 'hal'], ['sol', 'greta'], ['sol', 'fen'], ['greta', 'fen'],
      ['otto', 'nell'], ['otto', 'ada'], ['nell', 'ada'], ['elin', 'cass'], ['ivo', 'dag'], ['pim', 'mab'],
    ] as const;
    for (const [a, b] of pairs) {
      expect(villager(a).closeTo, `${a} close to ${b}`).toContain(b);
      expect(villager(b).closeTo, `${b} close to ${a}`).toContain(a);
    }
    expect(villager('rosa').closeTo).toHaveLength(3);
  });

  it('gives at least eight villagers a mutual rival, including the named pairs', () => {
    const withRival = cast.filter((d) => d.rival);
    expect(withRival.length).toBeGreaterThanOrEqual(8);
    for (const d of withRival) {
      expect(d.rival, d.id).not.toBe(d.id);
      expect(villager(d.rival as string).rival, `${d.rival} rival of ${d.id}`).toBe(d.id);
    }
    for (const [a, b] of [['jonah', 'mira'], ['pim', 'rosa'], ['ivo', 'hal'], ['una', 'mab']]) {
      expect(villager(a as string).rival).toBe(b);
    }
  });
});

describe('looks', () => {
  it('never repeats a body, hat, hair style and top colour combination', () => {
    const keys = cast.map((d) => `${d.look.body}|${d.look.hat}|${d.look.hair.style}|${d.look.top.toLowerCase()}`);
    expect(new Set(keys).size).toBe(cast.length);
  });

  it('uses six-digit hex colours throughout', () => {
    for (const d of cast) {
      const colours = [d.look.skin, d.look.hair.color, d.look.top, d.look.bottom, ...(d.look.apron ? [d.look.apron] : [])];
      for (const c of colours) expect(c, d.id).toMatch(HEX);
    }
  });

  it('keeps skin tones varied', () => {
    expect(new Set(cast.map((d) => d.look.skin)).size).toBeGreaterThanOrEqual(8);
  });
});

describe('schedules', () => {
  it('has six to nine sorted entries that start at 0, at home', () => {
    for (const d of cast) {
      expect(d.schedule.length, d.id).toBeGreaterThanOrEqual(6);
      expect(d.schedule.length, d.id).toBeLessThanOrEqual(9);
      expect(d.schedule[0], d.id).toMatchObject({ start: 0, place: d.home });
      d.schedule.forEach((e, i) => {
        expect(Number.isInteger(e.start), d.id).toBe(true);
        expect(e.start, d.id).toBeLessThan(MINUTES_PER_DAY);
        if (i > 0) expect(e.start, `${d.id} entry ${i}`).toBeGreaterThan(d.schedule[i - 1]?.start ?? -1);
      });
    }
  });

  it('ends the day at home by 840', () => {
    for (const d of cast) {
      const last = d.schedule[d.schedule.length - 1];
      expect(last?.place, d.id).toBe(d.home);
      expect(last?.start, d.id).toBeLessThanOrEqual(840);
    }
  });

  it('includes work, a midday meal and an errand or visit', () => {
    for (const d of cast) {
      expect(d.schedule.some((e) => e.activity === 'work' && e.place === d.workplace), `${d.id} works`).toBe(true);
      const meal = d.schedule.some(
        (e) => e.activity === 'eat' && e.start >= 240 && e.start <= 400 && ['bakery', 'inn', d.home].includes(e.place),
      );
      expect(meal, `${d.id} eats at midday`).toBe(true);
      expect(d.schedule.some((e) => e.activity === 'errand' || e.activity === 'visit'), `${d.id} has an errand or visit`).toBe(true);
    }
  });

  it('lets Ada receive Tom at home while she is ill', () => {
    const ada = villager('ada');
    expect(ada.schedule.every((entry) => entry.place === ada.home)).toBe(true);
    expect(coveringEntry(ada, ada.home, [600, 660])?.activity).toBe('visit');
    expect(coveringEntry(villager('tom'), ada.home, [600, 660])?.activity).toBe('visit');
  });

  it('sends sociable villagers to the inn, square or chapel in the evening', () => {
    for (const d of cast.filter((v) => v.traits.extraversion >= 0.5)) {
      const evening = intervals(d).some(
        (e) => ['inn', 'square', 'chapel'].includes(e.place) && e.start < 840 && e.end > 600,
      );
      expect(evening, d.id).toBe(true);
    }
  });
});

describe('secrets', () => {
  it('gives every villager one or two well-formed secrets with unique ids', () => {
    for (const d of cast) {
      expect(d.secrets.length, d.id).toBeGreaterThanOrEqual(1);
      expect(d.secrets.length, d.id).toBeLessThanOrEqual(2);
    }
    expect(new Set(allSecrets.map(({ secret }) => secret.id)).size).toBe(allSecrets.length);
    for (const { owner, secret } of allSecrets) {
      expect(SECRET_KINDS, secret.id).toContain(secret.kind);
      expect(secret.window[0], secret.id).toBeLessThan(secret.window[1]);
      expect(secret.window[0], secret.id).toBeGreaterThanOrEqual(0);
      expect(secret.window[1], secret.id).toBeLessThanOrEqual(MINUTES_PER_DAY);
      expect(secret.description.startsWith(owner.name), secret.id).toBe(true);
      for (const k of [...secret.confirms, ...secret.contradicts]) expect(CLAIM_KINDS, secret.id).toContain(k);
      expect(secret.confirms.filter((k) => secret.contradicts.includes(k)), secret.id).toEqual([]);
      if (secret.with) expect(secret.with, secret.id).not.toBe(owner.id);
    }
  });

  it('places every window inside a schedule entry at the same place', () => {
    for (const { owner, secret } of allSecrets) {
      const entry = coveringEntry(owner, secret.place, secret.window);
      expect(entry, `${secret.id} at ${secret.place} ${secret.window.join('-')}`).toBeDefined();
    }
  });

  it('allows real A* walking time at one tile per minute plus five minutes before every secret', () => {
    const world = createWorld(villageMap);
    for (const { owner, secret } of allSecrets) {
      const entryIndex = intervals(owner).findIndex(
        (entry) => entry.place === secret.place && entry.start <= secret.window[0] && secret.window[1] <= entry.end,
      );
      expect(entryIndex, secret.id).toBeGreaterThanOrEqual(0);
      const entry = owner.schedule[entryIndex]!;
      const previous = owner.schedule[entryIndex - 1];
      let walkingMinutes = 0;
      // An activity change in the same place needs no journey. Otherwise allow the longest
      // route between authored standing spots, since spotFor can choose any of them.
      if (previous && previous.place !== entry.place) {
        const from = world.place(previous.place);
        const to = world.place(entry.place);
        expect(from.spots.length, previous.place).toBeGreaterThan(0);
        expect(to.spots.length, entry.place).toBeGreaterThan(0);
        for (const start of from.spots) {
          for (const end of to.spots) {
            const path = world.findPath(start, end);
            expect(path, `${secret.id}: ${previous.place} to ${entry.place}`).not.toBeNull();
            // findPath excludes the origin and includes the destination: length is steps.
            walkingMinutes = Math.max(walkingMinutes, path!.length);
          }
        }
      }
      expect.soft(
        secret.window[0] - entry.start,
        `${secret.id}: ${previous?.place ?? entry.place} to ${entry.place}, ${walkingMinutes} walking minutes + 5 spare`,
      ).toBeGreaterThanOrEqual(walkingMinutes + 5);
    }
  });

  it('has the companion there for the whole window', () => {
    for (const { secret } of allSecrets.filter(({ secret }) => secret.with)) {
      const other = villager(secret.with as string);
      expect(coveringEntry(other, secret.place, secret.window), `${secret.with} at ${secret.id}`).toBeDefined();
    }
  });

  it('includes the acts the brief requires', () => {
    const find = (owner: string, kind: Secret['kind']) => villager(owner).secrets.find((s) => s.kind === kind);
    expect(find('tom', 'delivery')).toMatchObject({ place: 'home-ada', window: [80, 100], confirms: ['kindness'], contradicts: ['theft'] });
    expect(find('mira', 'debt')).toMatchObject({ place: 'shop', with: 'pim', confirms: ['paid-debt'] });
    expect(find('jonah', 'meeting')).toMatchObject({ place: 'bridge', with: 'rosa', confirms: ['kindness'], contradicts: ['romance'] });
    expect(find('ben', 'borrow')).toMatchObject({ place: 'smithy', confirms: ['theft'], contradicts: [] });
    const nursing = find('rosa', 'nursing');
    expect(nursing).toMatchObject({ place: 'home-ada', with: 'ada' });
    expect(nursing?.window[0]).toBeGreaterThanOrEqual(360); // afternoon: 13:00 or later
    expect(find('wren', 'practice')).toMatchObject({ place: 'chapel' });
  });

  it('corrects only what it confirms: a confirmed claim contradicts each contradicted claim', () => {
    for (const { owner, secret } of allSecrets) {
      const about = claims.filter((c) => c.about === owner.id);
      const confirmed = about.filter((c) => secret.confirms.includes(c.kind));
      const contradicted = about.filter((c) => secret.contradicts.includes(c.kind));
      for (const c of confirmed) {
        for (const h of contradicted) expect(c.contradicts, `${secret.id}: ${c.id} vs ${h.id}`).toContain(h.id);
      }
    }
  });

  it('keeps wheel repair and nervous rehearsal neutral about fraud and boasting', () => {
    // A repaired wheel does not prove it was sold cracked; nerves do not disprove a boast.
    for (const id of ['ivo-mends-hals-wheel', 'otto-rehearses-sermon']) {
      const secret = allSecrets.find(({ secret }) => secret.id === id)?.secret;
      expect(secret, id).toBeDefined();
      expect(secret?.confirms, id).toEqual([]);
      expect(secret?.contradicts, id).toEqual([]);
    }
  });
});

describe('claims', () => {
  it('has at least 18 well-formed claims about core or regular villagers', () => {
    expect(claims.length).toBeGreaterThanOrEqual(18);
    expect(claimIds.size).toBe(claims.length);
    for (const c of claims) {
      expect(c.id).toMatch(/^[a-z]+(-[a-z]+)+$/);
      expect(['core', 'regular'], c.id).toContain(villager(c.about).tier);
      expect(c.id.startsWith(`${c.about}-`), c.id).toBe(true);
      expect(CLAIM_KINDS, c.id).toContain(c.kind);
      expect([-1, 1], c.id).toContain(c.valence);
      expect([1, 2, 3], c.id).toContain(c.severity);
      expect(c.text.startsWith(villager(c.about).name), c.id).toBe(true);
      expect(c.text, c.id).not.toMatch(/[.!?]$/);
      if (c.target) expect(c.target, c.id).not.toBe(c.about);
      if (c.target) villager(c.target);
      if (c.basePrior !== undefined) {
        expect(c.basePrior, c.id).toBeGreaterThan(0);
        expect(c.basePrior, c.id).toBeLessThanOrEqual(0.5);
      }
    }
  });

  it('covers the whole taxonomy', () => {
    expect(new Set(claims.map((c) => c.kind))).toEqual(new Set(CLAIM_KINDS));
  });

  it('wires every contradiction both ways', () => {
    for (const c of claims) {
      for (const other of c.contradicts ?? []) {
        expect(claimIds.has(other), `${c.id} -> ${other}`).toBe(true);
        expect(other, c.id).not.toBe(c.id);
        expect(claim(other).contradicts ?? [], `${other} -> ${c.id}`).toContain(c.id);
      }
    }
  });

  it('marks innocent alternatives with alternativeOf', () => {
    for (const c of claims.filter((x) => x.alternativeOf)) {
      const harmful = claim(c.alternativeOf as string);
      expect(c.valence, c.id).toBe(1);
      expect(harmful.valence, c.id).toBe(-1);
      expect(harmful.about, c.id).toBe(c.about);
      expect(c.contradicts ?? [], c.id).toContain(harmful.id);
    }
    for (const [harmful, innocent] of [
      ['tom-stole-bread', 'tom-brought-bread-to-ada'],
      ['jonah-affair-rosa', 'jonah-rosa-planning-fair'],
      ['ben-stole-tools', 'ben-borrowed-tools'],
    ]) {
      expect(claim(innocent as string).alternativeOf).toBe(harmful);
    }
  });
});

describe('knows', () => {
  it('starts villagers on innocent truths only, with sane confidence', () => {
    for (const d of cast) {
      for (const k of d.knows ?? []) {
        expect(claimIds.has(k.claimId), `${d.id} knows ${k.claimId}`).toBe(true);
        expect(claim(k.claimId).valence, `${d.id} knows ${k.claimId}`).toBe(1);
        expect(k.confidence, d.id).toBeGreaterThan(0.5);
        expect(k.confidence, d.id).toBeLessThan(1);
      }
    }
  });

  it('matches the brief: Ada knows about the bread, Rosa the fair plan, Ben neither yet', () => {
    expect(villager('ada').knows).toContainEqual({ claimId: 'tom-brought-bread-to-ada', confidence: 0.95 });
    expect(villager('rosa').knows?.map((k) => k.claimId)).toContain('jonah-rosa-planning-fair');
    expect(villager('ben').knows?.map((k) => k.claimId) ?? []).not.toContain('tom-brought-bread-to-ada');
  });

  it('lets each accused villager explain: the subject knows every innocent alternative about them', () => {
    for (const c of claims.filter((x) => x.alternativeOf)) {
      expect(villager(c.about).knows?.map((k) => k.claimId), c.id).toContain(c.id);
    }
  });
});

describe('voices', () => {
  it('gives everyone a one- or two-sentence voice, and core and regulars a catchphrase', () => {
    for (const d of cast) {
      // A sentence ends where a stop is followed by a capital or the end, so a quoted
      // question mid-sentence ("asks “how do you know?” as if…") is not counted.
      const sentences = d.voice.match(/[.!?]["”’)]?(?=\s+[A-Z“"]|$)/g) ?? [];
      expect(sentences.length, d.id).toBeGreaterThanOrEqual(1);
      expect(sentences.length, d.id).toBeLessThanOrEqual(2);
      if (d.tier !== 'background') expect(d.catchphrase?.length ?? 0, d.id).toBeGreaterThan(0);
    }
    const phrases = cast.flatMap((d) => (d.catchphrase ? [d.catchphrase] : []));
    expect(new Set(phrases).size).toBe(phrases.length);
  });
});
