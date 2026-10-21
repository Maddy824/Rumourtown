import { describe, expect, it } from 'vitest';
import type { ThreadLink } from '../sim/types.js';
import { createTrailHistory } from './rumor-trail.js';

const link = (tick: number, from = 'mira', to = 'ben'): ThreadLink => ({ tick, from, to, claimId: 'story' });
describe('rumor transmission history', () => {
  it('retains the origin after the snapshot window rolls forward', () => {
    const history = createTrailHistory();
    const all = [link(0, 'stranger', 'mira'), ...Array.from({ length: 100 }, (_, n) => link(n + 1))];
    for (let n = 0; n < all.length; n++) history.record(all.slice(Math.max(0, n - 59), n + 1));
    expect(history.links).toEqual(all);
  });
  it('does not duplicate render frames, but retains repeated whispers at one paused tick', () => {
    const history = createTrailHistory();
    const first = link(130, 'stranger', 'mira');
    history.record([first]); history.record([first]);
    history.record([first, first]); history.record([first, first]);
    history.record([first, first, link(131)]);
    expect(history.links).toEqual([first, first, link(131)]);
  });
  it('rebuilds a rewind without retaining tellings from the future', () => {
    let history = createTrailHistory();
    history.record([link(0), link(90)]);
    history = createTrailHistory();
    history.record([link(0)]);
    expect(history.links).toEqual([link(0)]);
  });
});
