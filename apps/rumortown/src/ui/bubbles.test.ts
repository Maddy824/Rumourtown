import { describe, expect, it } from 'vitest';
import { placeBubble, type BubbleRect } from './bubbles.js';

const clock = { x: 12, y: 10, w: 126, h: 48 };
const pins = { x: 185, y: 10, w: 163, h: 118 };
const bounds = { width: 360, top: 64, bottom: 525 };
const intersects = (a: BubbleRect, b: BubbleRect): boolean =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

describe('bubble control exclusions', () => {
  it('places phone dialogue below the real pin stack even below the old 64px limit', () => {
    const result = placeBubble({ x: 270, y: 123, foot: 145 }, { w: 150, h: 40 }, bounds, [clock, pins]);
    expect(result).not.toBeNull();
    expect(result!.flip).toBe(true);
    expect(intersects(result!, pins)).toBe(false);
    expect(intersects(result!, clock)).toBe(false);
  });

  it('uses actual taller control rectangles rather than a fixed phone height', () => {
    const tallPins = { ...pins, h: 190 };
    const result = placeBubble({ x: 270, y: 150, foot: 170 }, { w: 150, h: 40 }, bounds, [clock, tallPins]);
    expect(result!.y).toBeGreaterThanOrEqual(tallPins.y + tallPins.h + 6);
  });

  it('keeps space beside the pins available', () => {
    const result = placeBubble({ x: 65, y: 120, foot: 155 }, { w: 100, h: 35 }, bounds, [clock, pins]);
    expect(result!.flip).toBe(false);
    expect(result!.y).toBe(78);
  });

  it('hides a bubble when neither side has room clear of the controls', () => {
    expect(placeBubble({ x: 270, y: 123, foot: 145 }, { w: 150, h: 40 },
      { ...bounds, bottom: 160 }, [clock, pins])).toBeNull();
  });

  it('clears every obstacle when more than four overlap vertically', () => {
    const obstacles = Array.from({ length: 6 }, (_, i) => ({ x: 185, y: 120 + i * 48, w: 163, h: 44 }));
    const result = placeBubble({ x: 270, y: 100, foot: 120 }, { w: 150, h: 40 }, bounds, [clock, pins, ...obstacles]);
    expect(result).not.toBeNull();
    for (const obstacle of [clock, pins, ...obstacles]) expect(intersects(result!, obstacle)).toBe(false);
  });
});
