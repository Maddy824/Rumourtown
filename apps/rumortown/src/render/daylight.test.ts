import { describe, expect, it } from 'vitest';
import { daylight, drawDaylight, type Daylight } from './daylight.js';

const at = (h: number, m = 0): Daylight => daylight(h * 60 + m);
const warmth = (d: Daylight): number => (d.softLight.r - d.softLight.b) * d.softLightAlpha;

describe('daylight', () => {
  it('is cool and pale at 07:00, neutral at noon, golden at 18:00 and dark at 21:30', () => {
    expect(warmth(at(7))).toBeLessThan(0);
    expect(at(12).softLightAlpha).toBeLessThan(0.06);
    expect(at(12).multiplyAlpha).toBe(0);
    expect(warmth(at(18))).toBeGreaterThan(20);
    expect(at(21, 30).multiplyAlpha).toBeGreaterThan(0.4);
    expect(at(21, 30).vignette).toBeGreaterThan(at(12).vignette);
  });

  it('lights windows only toward evening and never at noon', () => {
    expect(at(12).windows).toBe(0);
    expect(at(14).windows).toBe(0);
    expect(at(18).windows).toBeGreaterThan(0.4);
    expect(at(21).windows).toBe(1);
  });

  it('lengthens shadows toward evening and interpolates smoothly', () => {
    expect(at(18).shadow.dx).toBeGreaterThan(at(12).shadow.dx);
    const a = at(17, 59), b = at(18, 1);
    expect(Math.abs(a.multiplyAlpha - b.multiplyAlpha)).toBeLessThan(0.01);
  });

  it('holds the nearest keyframe outside the day and tolerates bad input', () => {
    expect(at(3)).toEqual(at(7));
    expect(at(23, 30)).toEqual(at(22));
    expect(daylight(Number.NaN)).toEqual(at(7));
  });

  it('draws two tint passes and a vignette with blend modes, restoring the context', () => {
    const ops: string[] = [];
    const ctx = {
      globalCompositeOperation: 'source-over',
      fillStyle: '' as string | CanvasGradient,
      fillRect() { ops.push(`fill:${this.globalCompositeOperation}`); },
      createRadialGradient() { return { addColorStop() { /* recorder */ } } as unknown as CanvasGradient; },
      save() { ops.push('save'); },
      restore() { ops.push('restore'); },
    };
    drawDaylight(ctx, 800, 600, at(20));
    expect(ops).toEqual(['save', 'fill:multiply', 'fill:soft-light', 'fill:multiply', 'restore']);
    const noon: string[] = [];
    drawDaylight({ ...ctx, fillRect() { noon.push(this.globalCompositeOperation); }, save() {}, restore() {} }, 800, 600, at(16));
    expect(noon).toEqual(['multiply']);
  });
});
