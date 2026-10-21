import { describe, expect, it } from 'vitest';
import { cast, claims } from '../content/cast/index.js';
import { createWrittenClaim, matchesAuthoredFact, readRegisteredClaim } from './registered-claim.js';

const people = new Map(cast.map(d => [d.id, d]));
describe('player-written stories', () => {
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
