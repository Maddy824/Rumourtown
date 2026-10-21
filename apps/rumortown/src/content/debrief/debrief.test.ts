import { describe, expect, it } from 'vitest';
import type { Ending, Intervention } from '../../sim/types.js';
import {
  buildDebrief,
  checks,
  dares,
  debriefAgeNotice,
  pickCheckItems,
  type DebriefSummary,
} from './index.js';

// Independent roster from the binding constraints: VillagerId itself is a string alias.
const fixedVillagers = [
  'mira', 'tom', 'ben', 'ada', 'rosa', 'jonah', 'elin', 'pim', 'sol', 'greta', 'ivo', 'nell',
  'otto', 'wren', 'hal', 'dag', 'una', 'cass', 'fen', 'lio', 'mab', 'rook', 'tess', 'yan',
];
const endings: Ending[] = ['reconciled', 'exposed', 'split', 'grudge', 'died', 'quiet'];
const flags = ['repetition', 'falseIndependence', 'allies', 'exposed'] as const;
const interventions: Intervention[] = [
  { tick: 10, listener: 'mira', claimId: 'claim-one' },
  { tick: 20, listener: 'rosa', claimId: 'claim-one' },
  { tick: 30, listener: 'ben', claimId: 'claim-two' },
];

function summary(mask = 0, history: Ending[] = ['grudge'], actions = interventions): DebriefSummary {
  return {
    interventions: actions,
    endings: history,
    exploits: {
      repetition: (mask & 1) !== 0,
      falseIndependence: (mask & 2) !== 0,
      allies: (mask & 4) !== 0,
      exposed: (mask & 8) !== 0,
    },
  };
}

function seededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

describe('check bank', () => {
  it('has 20 unique items, ten true and ten false, with distinct statements and explanations', () => {
    expect(checks).toHaveLength(20);
    expect(new Set(checks.map((item) => item.id)).size).toBe(20);
    expect(new Set(checks.map((item) => item.statement)).size).toBe(20);
    expect(checks.filter((item) => item.answer)).toHaveLength(10);
    expect(checks.filter((item) => !item.answer)).toHaveLength(10);
    for (const item of checks) {
      expect(item.id.trim()).not.toBe('');
      expect(item.statement.trim()).not.toBe('');
      expect(item.explanation.trim()).not.toBe('');
      expect(item.explanation).not.toBe(item.statement);
    }
  });
});

describe('dares', () => {
  it('has twelve distinct dares with fixed villager targets and evaluable conditions', () => {
    expect(dares).toHaveLength(12);
    expect(new Set(dares.map((dare) => dare.id)).size).toBe(12);
    expect(new Set(dares.map((dare) => dare.text)).size).toBe(12);
    for (const dare of dares) {
      expect(dare.id.trim()).not.toBe('');
      expect(dare.text.trim()).not.toBe('');
      expect(fixedVillagers, dare.id).toContain(dare.condition.target);
      expect(endings, dare.id).toContain(dare.condition.ending);
      expect(Object.keys(dare.condition).every((key) =>
        ['ending', 'notCaught', 'byDay', 'target', 'minBelievers'].includes(key))).toBe(true);
      if (dare.condition.byDay !== undefined) {
        expect([1, 2, 3]).toContain(dare.condition.byDay);
      }
      if (dare.condition.notCaught !== undefined) {
        expect(typeof dare.condition.notCaught).toBe('boolean');
      }
      if (dare.condition.minBelievers !== undefined) {
        expect(Number.isInteger(dare.condition.minBelievers)).toBe(true);
        expect(dare.condition.minBelievers).toBeGreaterThan(0);
        expect(dare.condition.minBelievers).toBeLessThanOrEqual(fixedVillagers.length - 1);
      }
      // A run cannot both expose the stranger and leave them uncaught.
      expect(dare.condition.ending === 'exposed' && dare.condition.notCaught === true).toBe(false);
    }
  });

  it('includes the authored Jonah challenge verbatim', () => {
    expect(dares).toContainEqual({
      id: 'jonah-unblamed',
      text: 'Turn the village on Jonah without anyone blaming you.',
      condition: { ending: 'grudge', notCaught: true, target: 'jonah', minBelievers: 8 },
    });
  });
});

describe('buildDebrief', () => {
  it('keeps every flag combination, ending and whisper count within three to five paragraphs of fewer than 60 words', () => {
    const histories: Ending[][] = [[], ...endings.map((ending) => [ending]), ['exposed', 'reconciled']];
    const actionCounts = [[], interventions.slice(0, 1), interventions];
    for (let mask = 0; mask < 16; mask += 1) {
      for (const history of histories) {
        for (const actions of actionCounts) {
          const paragraphs = buildDebrief(summary(mask, history, actions));
          expect(paragraphs.length).toBeGreaterThanOrEqual(3);
          expect(paragraphs.length).toBeLessThanOrEqual(5);
          for (const paragraph of paragraphs) {
            expect(paragraph.trim()).not.toBe('');
            expect(paragraph.trim().split(/\s+/).length, paragraph).toBeLessThan(60);
            expect(paragraph).not.toMatch(/[\n·→]|\{[^}]+\}/);
          }
        }
      }
    }
  });

  it.each(flags)('changes the copy when %s changes, even when the other flags are active', (flag) => {
    for (let mask = 0; mask < 16; mask += 1) {
      for (const ending of endings) {
        const before = summary(mask, [ending]);
        const after = {
          ...before,
          exploits: { ...before.exploits, [flag]: !before.exploits[flag] },
        };
        expect(buildDebrief(after)).not.toEqual(buildDebrief(before));
      }
    }
  });

  it('reports the recorded whisper count without pretending to know the claim text', () => {
    expect(buildDebrief(summary(0, [], []))[0]).toContain('You made no whispers.');
    expect(buildDebrief(summary(0, [], interventions.slice(0, 1)))[0]).toContain('You whispered once.');
    expect(buildDebrief(summary())[0]).toContain('You whispered 3 times.');
    expect(buildDebrief(summary()).join(' ')).not.toContain('claim-one');
  });

  it.each([
    ['reconciled', 'private reconciliation'],
    ['exposed', 'lie exposed'],
    ['split', 'village split'],
    ['grudge', 'unchallenged grudge'],
    ['died', 'rumor dying out'],
    ['quiet', 'ended quietly'],
  ] as const)('describes the %s ending', (ending, phrase) => {
    expect(buildDebrief(summary(0, [ending])).join(' ')).toContain(phrase);
  });

  it('uses the latest day ending without erasing an earlier exposure', () => {
    const paragraphs = buildDebrief(summary(8, ['exposed', 'reconciled']));
    expect(paragraphs.at(-1)).toContain('private reconciliation');
    expect(paragraphs.at(-1)).toContain('Your part in a lie was exposed.');
    expect(paragraphs.join(' ')).not.toContain('No exposure was recorded.');
    // An ending also records exposure when the caller has not set the exploit flag.
    expect(buildDebrief(summary(0, ['exposed', 'quiet'])).join(' ')).toContain('That exposure costs you trust');
  });

  it('leaves an unfinished run open and does not invent an exposure', () => {
    expect(buildDebrief(summary(0, [], [])).at(-1)).toContain('No day ending has been recorded yet.');
    expect(buildDebrief(summary()).at(-1)).toContain('No exposure was recorded.');
  });

  it('is deterministic and leaves its input untouched', () => {
    const input = summary(15, ['split', 'reconciled']);
    const before = structuredClone(input);
    Object.freeze(input.interventions);
    Object.freeze(input.endings);
    Object.freeze(input.exploits);
    Object.freeze(input);
    expect(buildDebrief(input)).toEqual(buildDebrief(input));
    expect(input).toEqual(before);
  });

  it('provides the age notice for the reflection screen', () => {
    expect(debriefAgeNotice).toContain('13+');
  });
});

describe('pickCheckItems', () => {
  it('defaults to two distinct items from the bank', () => {
    const picked = pickCheckItems(seededRng(13));
    expect(picked).toHaveLength(2);
    expect(new Set(picked.map((item) => item.id)).size).toBe(2);
    for (const item of picked) expect(checks).toContain(item);
  });

  it('returns identical picks in identical order for the same seeded rng', () => {
    for (const n of [0, 1, 2, 12, 20]) {
      expect(pickCheckItems(seededRng(13), n)).toEqual(pickCheckItems(seededRng(13), n));
    }
    expect(pickCheckItems(seededRng(13), 20)).not.toEqual(pickCheckItems(seededRng(14), 20));
  });

  it('can pick the entire bank without replacement or changing its order', () => {
    const before = structuredClone(checks);
    const picked = pickCheckItems(seededRng(91), checks.length);
    expect(new Set(picked.map((item) => item.id)).size).toBe(checks.length);
    expect(picked.map((item) => item.id).sort()).toEqual(checks.map((item) => item.id).sort());
    expect(checks).toEqual(before);
    picked.reverse();
    expect(checks).toEqual(before);
  });

  it('handles both ends of the rng range without missing or repeating items', () => {
    expect(pickCheckItems(() => 0, 20)).toEqual(checks);
    expect(pickCheckItems(() => 1 - Number.EPSILON, 20)).toEqual([...checks].reverse());
  });

  it('does not consume rng when no items are requested', () => {
    expect(pickCheckItems(() => { throw new Error('unexpected draw'); }, 0)).toEqual([]);
  });

  it.each([-1, 1.5, 21, NaN, Infinity])('rejects an invalid sample size: %s', (n) => {
    expect(() => pickCheckItems(() => 0.5, n)).toThrow(RangeError);
  });

  it.each([-0.1, 1, NaN, Infinity])('rejects an rng value outside [0, 1): %s', (roll) => {
    expect(() => pickCheckItems(() => roll)).toThrow(RangeError);
  });
});
