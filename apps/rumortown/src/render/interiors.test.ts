import { describe, expect, it } from 'vitest';
import { drawInterior, hasInterior, type RoomContext } from './interiors.js';
import type { PlaceKind } from '../sim/types.js';

function recorder() {
  const counts = { fill: 0, stroke: 0, glow: 0 };
  let alpha = 1;
  const ctx: RoomContext = {
    fillStyle: '', strokeStyle: '', lineWidth: 1,
    get globalAlpha() { return alpha; },
    set globalAlpha(v: number) { alpha = v; },
    setLineDash() {}, beginPath() {}, rect() {}, ellipse() {}, moveTo() {}, lineTo() {},
    fill() { counts.fill += 1; if (alpha < 1) counts.glow += 1; },
    stroke() { counts.stroke += 1; },
    save() {}, restore() { alpha = 1; },
  };
  return { ctx, counts };
}

const kinds: PlaceKind[] = ['home', 'bakery', 'inn', 'mill', 'chapel', 'school', 'shop', 'smithy', 'square', 'field', 'well', 'bridge', 'orchard', 'riverside'];

describe('interiors', () => {
  it('draws at most twelve stitched shapes for every room kind and nothing for open places', () => {
    for (const kind of kinds) {
      const { ctx, counts } = recorder();
      drawInterior(ctx, kind, { x: 0, y: 0, w: 160, h: 96 }, { tile: 32, glow: 0, occupied: true });
      if (hasInterior(kind)) {
        expect(counts.fill, kind).toBeGreaterThan(0);
        expect(counts.stroke, kind).toBeLessThanOrEqual(12);
      } else {
        expect(counts.fill, kind).toBe(0);
      }
    }
  });

  it('lights hearths and ovens only when the daylight glow is up and someone is home', () => {
    const lit = recorder();
    drawInterior(lit.ctx, 'bakery', { x: 0, y: 0, w: 160, h: 96 }, { tile: 32, glow: 1, occupied: true });
    const dark = recorder();
    drawInterior(dark.ctx, 'bakery', { x: 0, y: 0, w: 160, h: 96 }, { tile: 32, glow: 0, occupied: true });
    expect(lit.counts.glow).toBe(1);
    expect(dark.counts.glow).toBe(0);
  });
});
