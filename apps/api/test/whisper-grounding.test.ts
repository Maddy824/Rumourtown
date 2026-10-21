import { describe, expect, it } from 'vitest';
import { groundedPeople, unsupportedStory } from '../../shared/whisper-grounding';
import cast from '../src/cast.json';

describe('shared rumor grounding', () => {
  const claim = { about: 'rosa', target: 'ada', confidence: .9 };
  it('requires every named participant to be grounded in the input', () => {
    expect(groundedPeople('someone killed tom', claim, cast)).toBe(false);
    expect(groundedPeople('Rosa helped Ada', claim, cast)).toBe(true);
    expect(groundedPeople('Rosa helped someone', claim, cast)).toBe(false);
    expect(groundedPeople('Rosa helped Ada', { ...claim, confidence: .3 }, cast)).toBe(false);
  });
  it('accepts explicit unique roles and names, with word boundaries', () => {
    expect(groundedPeople('the innkeeper helped the weaver', claim, cast)).toBe(true);
    expect(groundedPeople('Rosalind helped Adam', claim, cast)).toBe(false);
    expect(groundedPeople('the farmer helped Ada', { ...claim, about: 'sol' }, cast)).toBe(false);
  });
  it('does not invent a death from a substring', () => {
    expect(unsupportedStory('Tom has killer dance moves')).toBe(false);
    expect(unsupportedStory('Tom stole deadly nightshade')).toBe(false);
    expect(unsupportedStory('someone KILLED Tom')).toBe(true);
  });
});
