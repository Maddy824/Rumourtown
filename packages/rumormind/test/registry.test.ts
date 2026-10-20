import { describe, expect, it } from 'vitest';
import { BeliefLedger, ClaimRegistry, createRng, type RegisteredClaim } from '../src/index.js';

const stole: RegisteredClaim = {
  id: 'stole', kind: 'stole', about: 'tom', valence: -1, contradicts: ['gaveTo'],
};
const gaveTo: RegisteredClaim = {
  id: 'gaveTo', kind: 'gaveTo', about: 'tom', valence: 1, contradicts: ['stole'], alternativeOf: 'stole',
};

describe('ClaimRegistry', () => {
  it('resolves mutual contradictions and finds the innocent explanation by reverse lookup', () => {
    const registry = new ClaimRegistry([stole, gaveTo]);
    expect(() => registry.validate()).not.toThrow();
    expect(registry.get('stole')).toBe(stole);
    expect(registry.contradictionsOf('stole')).toEqual([gaveTo]);
    expect(registry.contradictionsOf('gaveTo')).toEqual([stole]);
    expect(registry.alternativeOf('stole')).toBe(gaveTo);
    expect(registry.alternativeOf('gaveTo')).toBeUndefined();
  });

  it('returns empty lookups for unknown ids and claims without links', () => {
    const registry = new ClaimRegistry([{ ...stole, contradicts: undefined }]);
    expect(registry.get('unknown')).toBeUndefined();
    expect(registry.contradictionsOf('unknown')).toEqual([]);
    expect(registry.contradictionsOf('stole')).toEqual([]);
    expect(registry.alternativeOf('unknown')).toBeUndefined();
    expect(registry.alternativeOf('stole')).toBeUndefined();
    expect(() => new ClaimRegistry().validate()).not.toThrow();
  });

  it('allows forward references while building, then rejects missing or one-way contradictions', () => {
    const registry = new ClaimRegistry([stole]);
    expect(() => registry.validate()).toThrow(/missing claim gaveTo/);
    registry.add({ ...gaveTo, contradicts: [] });
    expect(() => registry.validate()).toThrow(/not mutual.*stole.*gaveTo/);
  });

  it('rejects duplicate ids, self contradictions and dangling alternative links', () => {
    expect(() => new ClaimRegistry([stole, stole])).toThrow(/Duplicate claim/);
    expect(() => new ClaimRegistry([{ ...stole, contradicts: ['stole'] }]).validate()).toThrow(/itself/);
    expect(() => new ClaimRegistry([{ ...gaveTo, contradicts: [] }]).validate()).toThrow(/alternative to missing/);
  });

  it('preserves authored contradiction order and chooses the first registered alternative', () => {
    const second = { ...gaveTo, id: 'borrowed', kind: 'borrowed' };
    const registry = new ClaimRegistry([{ ...stole, contradicts: ['borrowed', 'gaveTo'] }, gaveTo, second]);
    registry.validate();
    expect(registry.contradictionsOf('stole')).toEqual([second, gaveTo]);
    expect(registry.alternativeOf('stole')).toBe(gaveTo);
  });

  it('preserves extended claim types and supplies the map used by the existing ledger', () => {
    const registry = new ClaimRegistry([{ ...stole, text: 'Tom stole bread.' }, { ...gaveTo, text: 'Tom gave Ada bread.' }]);
    const explanation = registry.alternativeOf('stole');
    expect(explanation?.text).toBe('Tom gave Ada bread.');
    const ledger = new BeliefLedger('mira', createRng(1));
    ledger.see(stole, registry.claims, 1);
    const before = ledger.confidence('stole');
    const result = ledger.see(gaveTo, registry.claims, 2);
    expect(result.corrected).toEqual(['stole']);
    expect(ledger.confidence('stole')).toBeLessThan(before);
  });
});
