import { describe, expect, it } from 'vitest';
import { cast } from '../cast/index.js';
import { matchesAuthoredFact, readRegisteredClaim } from '../../sim/registered-claim.js';
import { rumorLibrary } from './index.js';
import { readRumorLibrary, readRumorPack } from './registry.js';

const people = new Map(cast.map(person => [person.id, person]));
const example = () => ({ schema: 1, id: 'test-pack', version: 1, title: 'Garden stories', stories: [
  { id: 'kindness', text: 'Nia left seeds by the gate for anyone who needed them', about: 'nia', kind: 'kindness', severity: 1 },
] });
describe('published rumor add-ons', () => {
  it('validates every shipped pack and preserves each full sentence in offline replay', () => {
    expect(rumorLibrary.length).toBeGreaterThanOrEqual(3);
    const stories = rumorLibrary.flatMap(pack => pack.stories);
    expect(stories.length).toBeGreaterThanOrEqual(24);
    expect(new Set(stories.map(story => story.claim.id)).size).toBe(stories.length);
    for (const { claim } of stories) {
      expect(readRegisteredClaim(claim.id, people)).toEqual(claim);
      expect(matchesAuthoredFact(claim, claim)).toBe(false);
      expect(claim.contradicts).toEqual([]);
    }
  });
  it.each([
    { schema: 2 }, { version: 0 }, { version: 1.1 }, { id: '../escape' }, { title: '<script>code</script>' },
    { stories: [] }, { stories: Array(49).fill(example().stories[0]) }, { code: 'execute me' },
  ])('rejects unsupported or malformed pack fields %j', change => {
    expect(() => readRumorPack({ ...example(), ...change }, people)).toThrow();
  });
  it.each([
    { about: 'outsider' }, { text: 'Mira secretly did it' }, { text: 'Nia <script>code</script>' },
    { text: 'Nia ' + 'x'.repeat(100) }, { text: 'Nia did\nsomething' }, { kind: 'teleport' },
    { severity: 4 }, { valence: -1 }, { id: 'bad id' },
  ])('rejects unsafe or inconsistent story fields %j', change => {
    const data = example(); Object.assign(data.stories[0]!, change);
    expect(() => readRumorPack(data, people)).toThrow();
  });
  it('rejects duplicate story and pack ids and loads file paths in stable order', () => {
    const data = example(); data.stories.push({ ...data.stories[0]! });
    expect(() => readRumorPack(data, people)).toThrow();
    expect(() => readRumorLibrary({ b: example(), a: example() }, people)).toThrow();
    expect(readRumorLibrary({ z: { ...example(), id: 'last' }, a: example() }, people).map(pack => pack.id))
      .toEqual(['test-pack', 'last']);
  });
});
