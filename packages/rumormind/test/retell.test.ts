import { describe, expect, it } from 'vitest';
import { createRng, retell, type Retelling } from '../src/index.js';

const story: Retelling = {
  core: 'Tom carried bread.',
  details: ['at dawn', 'for Ada', 'without paying', 'in a basket'],
  qualifiers: ['I think', 'perhaps'],
};

describe('retell', () => {
  it('replays a chain exactly given the same seed and preserves the core', () => {
    const run = (seed: number) => {
      const rng = createRng(seed);
      let next = story;
      const chain: Retelling[] = [];
      for (let hop = 0; hop < 20; hop++) {
        next = retell(next, rng, { inventionPool: ['he was running', 'the basket was covered'] });
        expect(next.core).toBe(story.core);
        chain.push(next);
      }
      return chain;
    };
    expect(run(42)).toEqual(run(42));
    expect(run(42)).not.toEqual(run(43));
  });

  it('returns fresh arrays and leaves input and tuning pools untouched', () => {
    const input = { ...story, details: [...story.details], qualifiers: [...story.qualifiers] };
    Object.freeze(input.details);
    Object.freeze(input.qualifiers);
    Object.freeze(input);
    const pool = Object.freeze(['he was running']);
    const next = retell(input, () => 0, { inventionPool: pool });
    expect(next).toEqual({ core: story.core, details: ['he was running'], qualifiers: [] });
    expect(next).not.toBe(input);
    expect(next.details).not.toBe(input.details);
    expect(next.qualifiers).not.toBe(input.qualifiers);
    expect(input).toEqual(story);
    expect(pool).toEqual(['he was running']);
  });

  it('halves the loss rate for either preferred tag without stacking both tags', () => {
    const claim = { core: '', details: ['plain', 'social', 'negative', 'both'], qualifiers: [] };
    const detailTags = new Map([
      ['social', ['social'] as const],
      ['negative', ['negative'] as const],
      ['both', ['social', 'negative'] as const],
    ]);
    expect(retell(claim, () => 0.15, { detailDropRate: 0.2, detailTags }).details)
      .toEqual(['social', 'negative', 'both']);
    expect(retell(claim, () => 0.075, { detailDropRate: 0.2, detailTags }).details).toEqual([]);
  });

  it('uses the specified loss and invention ranges even for tuning outside their bounds', () => {
    const input = { core: '', details: ['d'], qualifiers: ['q'] };
    expect(retell(input, () => 0.09, { detailDropRate: -1, qualifierDropRate: -1 }))
      .toEqual({ core: '', details: [], qualifiers: ['q'] });
    expect(retell(input, () => 0.2, { detailDropRate: 1, qualifierDropRate: 1 }))
      .toEqual({ core: '', details: [], qualifiers: ['q'] });
    const empty = { core: '', details: [], qualifiers: [] };
    expect(retell(empty, () => 0, { inventionRate: -1, inventionPool: ['new'] }).details).toEqual([]);
    expect(retell(empty, () => 0.05, { inventionRate: 1, inventionPool: ['new'] }).details).toEqual([]);
    expect(retell(empty, () => 0.049, { inventionRate: 1, inventionPool: ['new'] }).details).toEqual(['new']);
  });

  it('samples losses and inventions at the configured rates over a seeded population', () => {
    const rng = createRng(7);
    const count = 20000;
    let lostDetails = 0;
    let lostQualifiers = 0;
    let inventions = 0;
    for (let i = 0; i < count; i++) {
      const next = retell({ core: 'core', details: ['detail'], qualifiers: ['qualifier'] }, rng, {
        inventionPool: ['invented'],
      });
      if (!next.details.includes('detail')) lostDetails++;
      if (next.qualifiers.length === 0) lostQualifiers++;
      if (next.details.includes('invented')) inventions++;
    }
    expect(lostDetails / count).toBeGreaterThan(0.19);
    expect(lostDetails / count).toBeLessThan(0.21);
    expect(lostQualifiers / count).toBeGreaterThan(0.09);
    expect(lostQualifiers / count).toBeLessThan(0.11);
    expect(inventions / count).toBeGreaterThan(0.02);
    expect(inventions / count).toBeLessThan(0.03);
  });

  it('adds at most one new pool detail, avoids existing details, and handles empty pools', () => {
    const draws = [0.99, 0, 0.99];
    const next = retell({ core: 'core', details: ['known'], qualifiers: [] }, () => draws.shift()!, {
      inventionPool: ['known', 'first', 'last'],
    });
    expect(next.details).toEqual(['known', 'last']);
    expect(retell(story, () => 0.99)).toEqual(story);
    expect(retell({ core: '', details: [], qualifiers: [] }, createRng(1)))
      .toEqual({ core: '', details: [], qualifiers: [] });
    expect(retell({ core: '', details: ['known'], qualifiers: [] }, () => 0, {
      inventionPool: ['known'],
    }).details).toEqual([]);
  });
});
