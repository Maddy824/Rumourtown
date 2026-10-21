import { describe, expect, it, vi, afterEach } from 'vitest';
import type { ShareState } from '../sim/types.js';
import { decodeShare, encodeShare, shareUrl, writeShareToLocation } from './share-link.js';

const rawEncode = (state: ShareState): string => btoa(JSON.stringify(state)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const state = (count: number): ShareState => ({
  v: 1, seed: 42, cast: 'v1',
  interventions: Array.from({ length: count }, (_, tick) => ({ tick, listener: 'mira', claimId: 'theft-tom' })),
});

afterEach(() => vi.unstubAllGlobals());

describe('share link size agreement', () => {
  it('round-trips an ordinary state', () => {
    const original = state(3);
    expect(decodeShare(encodeShare(original))).toEqual(original);
  });

  it('round-trips exactly at the 16,000-character boundary', () => {
    const boundary = state(200);
    // ASCII JSON of 12,000 bytes encodes to exactly 16,000 base64url characters.
    let missing = 12_000 - JSON.stringify(boundary).length;
    for (const intervention of boundary.interventions) {
      const extra = Math.min(missing, 64 - intervention.listener.length);
      intervention.listener += 'a'.repeat(extra);
      missing -= extra;
    }
    expect(missing).toBe(0);
    const encoded = encodeShare(boundary);
    expect(encoded.length).toBe(16_000);
    expect(decodeShare(encoded)).toEqual(boundary);
    expect(decodeShare(`${encoded}A`)).toBeNull();
    boundary.interventions.unshift({ tick: 0, listener: 'ben', claimId: 'theft-tom' });
    expect(decodeShare(encodeShare(boundary))).toEqual({ ...boundary, interventions: boundary.interventions.slice(1) });
  });

  it('keeps the largest recent suffix that fits, without mutating the run', () => {
    const original = state(450);
    const before = structuredClone(original);
    const encoded = encodeShare(original);
    const decoded = decodeShare(encoded)!;
    expect(encoded.length).toBeLessThanOrEqual(16_000);
    expect(decoded.interventions.length).toBeLessThan(400);
    expect(decoded.interventions).toEqual(original.interventions.slice(-decoded.interventions.length));
    expect(rawEncode({ ...original, interventions: original.interventions.slice(-decoded.interventions.length - 1) }).length).toBeGreaterThan(16_000);
    expect(original).toEqual(before);
  });

  it('also respects the intervention count cap when very short whispers fit', () => {
    const original = state(500);
    original.interventions = original.interventions.map((i) => ({ ...i, listener: 'a', claimId: 'b' }));
    const decoded = decodeShare(encodeShare(original))!;
    expect(decoded.interventions.length).toBeLessThanOrEqual(400);
    expect(decoded.interventions).toEqual(original.interventions.slice(-decoded.interventions.length));
  });

  it('rejects an unsupported state before it becomes a share URL or replaces the hash', () => {
    const replaceState = vi.fn();
    vi.stubGlobal('window', {
      location: { href: 'https://example.test/#old', hash: '#old' },
      history: { state: null, replaceState },
    });
    const invalid = { ...state(1), cast: 'x'.repeat(33) };
    expect(() => shareUrl(invalid)).toThrow();
    expect(writeShareToLocation(invalid)).toBe('old');
    expect(replaceState).not.toHaveBeenCalled();
  });
});
