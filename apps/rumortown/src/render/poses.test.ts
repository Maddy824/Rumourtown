import { describe, expect, it } from 'vitest';
import { idlePose, walkFrame } from './poses.js';

describe('replayable felt poses', () => {
  it('produces the same pose for the same villager and tick regardless of call order', () => {
    const first = Array.from({ length: 100 }, (_, tick) => idlePose('mira', tick, false));
    for (let tick = 99; tick >= 0; tick--) expect(idlePose('mira', tick, false)).toEqual(first[tick]);
    expect(first.some(p => p.lean !== 0)).toBe(true);
    expect(first).not.toEqual(Array.from({ length: 100 }, (_, tick) => idlePose('tom', tick, false)));
  });
  it('removes all idle life under reduced motion', () => {
    for (let tick = 0; tick < 100; tick++) expect(idlePose('mira', tick, true)).toEqual({ lean: 0, turn: 0 });
  });
  it('uses three deterministic walk frames', () => {
    expect(new Set(Array.from({ length: 30 }, (_, tick) => walkFrame(tick, .5))).size).toBe(3);
    expect(walkFrame(42, .5, 1)).toBe(walkFrame(42, .5, 1));
  });
});
