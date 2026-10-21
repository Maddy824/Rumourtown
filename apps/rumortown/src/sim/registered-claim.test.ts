import { describe, expect, it } from 'vitest';
import { cast, claims } from '../content/cast/index.js';
import { createRegisteredClaim, createWrittenClaim, matchesAuthoredFact, readRegisteredClaim } from './registered-claim.js';
import { createTalkEngine } from './talk/index.js';

const people = new Map(cast.map(d => [d.id, d]));
describe('player-written stories', () => {
  it('quotes first-person and complex prose without changing who witnessed it', () => {
    const talk = createTalkEngine(cast);
    for (const text of ['I saw Tom steal a loaf', 'Tom likes to run and dances at the inn', 'x'.repeat(100)]) {
      const claim = createWrittenClaim(text, 'tom', 'theft', 2, people);
      for (const act of ['gossip', 'accuse', 'news', 'defend', 'reactToWhisper'] as const) {
        const line = talk.say({ act, speaker: people.get('mira')!, listener: people.get('tom')!, claim, tick: 60, mood: 0 }, () => .5);
        expect(line.text).toContain(`“${text}”`); expect(line.text.length).toBeLessThanOrEqual(139);
      }
    }
  });
  it('adds articles to countable rumor objects while keeping canonical ids stable', () => {
    const claim = createRegisteredClaim({ about: 'tom', kind: 'theft', severity: 2, valence: -1, object: 'loaf' }, people);
    expect(claim.text).toBe('Tom stole a loaf'); expect(claim.object).toBe('loaf');
    expect(readRegisteredClaim(claim.id, people)).toEqual(claim);
  });
  it('keeps Unicode prose and explicit meaning together without interpreting the words', () => {
    const story = createWrittenClaim('  Tom shared his café earnings with Ada 🌿  ', 'tom', 'kindness', 1, people);
    expect(story.text).toBe('Tom shared his café earnings with Ada 🌿');
    expect(story.valence).toBe(1);
    expect(readRegisteredClaim(story.id, people)).toEqual(story);
    expect(createWrittenClaim('Tom did not steal bread', 'tom', 'kindness', 1, people).kind).toBe('kindness');
  });
  it('does not mistake an arbitrary sentence for a witnessed authored fact', () => {
    const story = createWrittenClaim('Tom stole something entirely different', 'tom', 'theft', 2, people);
    expect(matchesAuthoredFact(story, { ...claims[0]!, about: 'tom', kind: 'theft', object: undefined })).toBe(false);
  });
  it.each(['', 'a'.repeat(101), 'Tom\nstole bread', 'Tom\u0000stole bread'])(
    'rejects blank, long and control-containing prose', text => {
      expect(() => createWrittenClaim(text, 'tom', 'lying', 2, people)).toThrow();
    });
  it('rejects malformed, noncanonical and invalid-cast link payloads', () => {
    const encode = (value: unknown): string => `written_${btoa(JSON.stringify(value)).replace(/=/g, '')}`;
    for (const id of ['written_!', 'written_' + 'a'.repeat(1025), encode(['Tom lied', 'nobody', 'lying', 2]),
      encode(['Tom lied', 'tom', 'unknown', 2]), encode(['Tom lied', 'tom', 'lying', 8]),
      encode([' Tom lied ', 'tom', 'lying', 2]), encode(['Tom lied', 'tom', 'lying', 2, 'extra'])]) {
      expect(readRegisteredClaim(id, people)).toBeNull();
    }
  });
});
