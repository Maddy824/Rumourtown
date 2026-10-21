/**
 * Daylight: how the village is lit at a given minute of the day.
 * Pure functions, no DOM. The renderer applies the result as two cheap full-canvas
 * passes (a multiply fill for darkness, a soft-light fill for colour) over the cached
 * layers, plus a radial vignette, so no layer is ever re-rasterised for the tint.
 */

export interface Rgb { r: number; g: number; b: number }

export interface Daylight {
  /** Darkening pass, drawn with 'multiply'. */
  multiply: Rgb;
  multiplyAlpha: number;
  /** Colour pass, drawn with 'soft-light'. */
  softLight: Rgb;
  softLightAlpha: number;
  /** Edge darkening, 0..1. */
  vignette: number;
  /** Paper drop shadow offset in tile units and its ink alpha. */
  shadow: { dx: number; dy: number; alpha: number };
  /** Glow of windows, lanterns and hearths, 0..1. */
  windows: number;
}

interface Key extends Daylight { minute: number }

const hex = (h: string): Rgb => ({ r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16) });
const none: Rgb = { r: 255, g: 255, b: 255 };

/** Keyframes in minutes since midnight; between them everything interpolates linearly. */
const KEYS: readonly Key[] = [
  { minute: 7 * 60, multiply: none, multiplyAlpha: 0, softLight: hex('#BFD3EA'), softLightAlpha: 0.22, vignette: 0.05, shadow: { dx: 0.08, dy: 0.1, alpha: 0.14 }, windows: 0.3 },
  { minute: 9 * 60, multiply: none, multiplyAlpha: 0, softLight: hex('#FFF4D6'), softLightAlpha: 0.08, vignette: 0.04, shadow: { dx: 0.08, dy: 0.1, alpha: 0.16 }, windows: 0 },
  { minute: 16 * 60, multiply: none, multiplyAlpha: 0, softLight: none, softLightAlpha: 0, vignette: 0.04, shadow: { dx: 0.08, dy: 0.1, alpha: 0.18 }, windows: 0 },
  { minute: 18 * 60, multiply: hex('#F7D9A8'), multiplyAlpha: 0.1, softLight: hex('#F2B45A'), softLightAlpha: 0.28, vignette: 0.08, shadow: { dx: 0.12, dy: 0.15, alpha: 0.2 }, windows: 0.5 },
  { minute: 20 * 60, multiply: hex('#3F5E8A'), multiplyAlpha: 0.35, softLight: hex('#8FA6D3'), softLightAlpha: 0.15, vignette: 0.18, shadow: { dx: 0.1, dy: 0.12, alpha: 0.12 }, windows: 1 },
  { minute: 22 * 60, multiply: hex('#2E4066'), multiplyAlpha: 0.5, softLight: hex('#7E93C4'), softLightAlpha: 0.12, vignette: 0.25, shadow: { dx: 0.08, dy: 0.1, alpha: 0.08 }, windows: 1 },
  // Night keys append to the existing daylight score; the endpoints meet at midnight.
  { minute: 23 * 60 + 30, multiply: hex('#1E2A4A'), multiplyAlpha: .62, softLight: hex('#5B6FA6'), softLightAlpha: .14, vignette: .3, shadow: { dx: .05, dy: .07, alpha: .06 }, windows: 1 },
  { minute: 0, multiply: hex('#1E2A4A'), multiplyAlpha: .6333333333333333, softLight: hex('#5B6FA6'), softLightAlpha: .14, vignette: .3, shadow: { dx: .05, dy: .07, alpha: .06 }, windows: 1 },
  { minute: 3 * 60, multiply: hex('#1E2A4A'), multiplyAlpha: .7, softLight: hex('#5B6FA6'), softLightAlpha: .14, vignette: .3, shadow: { dx: .05, dy: .07, alpha: .06 }, windows: 1 },
  { minute: 5 * 60, multiply: hex('#3F5E8A'), multiplyAlpha: .48, softLight: hex('#8FA6D3'), softLightAlpha: .2, vignette: .2, shadow: { dx: .05, dy: .08, alpha: .08 }, windows: .8 },
  { minute: 6 * 60, multiply: hex('#8FA6D3'), multiplyAlpha: .2, softLight: hex('#F2B9A0'), softLightAlpha: .22, vignette: .1, shadow: { dx: .07, dy: .1, alpha: .12 }, windows: .45 },
  { minute: 24 * 60, multiply: hex('#1E2A4A'), multiplyAlpha: .6333333333333333, softLight: hex('#5B6FA6'), softLightAlpha: .14, vignette: .3, shadow: { dx: .05, dy: .07, alpha: .06 }, windows: 1 },
].sort((a, b) => a.minute - b.minute);

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const lerpRgb = (a: Rgb, b: Rgb, t: number): Rgb => ({ r: Math.round(lerp(a.r, b.r, t)), g: Math.round(lerp(a.g, b.g, t)), b: Math.round(lerp(a.b, b.b, t)) });

/** The light at `minuteOfDay`; the appended endpoints meet continuously at midnight. */
export function daylight(minuteOfDay: number): Daylight {
  const first = KEYS[0]!;
  const last = KEYS[KEYS.length - 1]!;
  if (!Number.isFinite(minuteOfDay) || minuteOfDay <= first.minute) return strip(first);
  if (minuteOfDay >= last.minute) return strip(last);
  for (let i = 1; i < KEYS.length; i++) {
    const b = KEYS[i]!;
    if (minuteOfDay <= b.minute) {
      const a = KEYS[i - 1]!;
      const t = (minuteOfDay - a.minute) / (b.minute - a.minute);
      return {
        multiply: lerpRgb(a.multiply, b.multiply, t),
        multiplyAlpha: lerp(a.multiplyAlpha, b.multiplyAlpha, t),
        softLight: lerpRgb(a.softLight, b.softLight, t),
        softLightAlpha: lerp(a.softLightAlpha, b.softLightAlpha, t),
        vignette: lerp(a.vignette, b.vignette, t),
        shadow: { dx: lerp(a.shadow.dx, b.shadow.dx, t), dy: lerp(a.shadow.dy, b.shadow.dy, t), alpha: lerp(a.shadow.alpha, b.shadow.alpha, t) },
        windows: lerp(a.windows, b.windows, t),
      };
    }
  }
  return strip(last);
}

function strip(k: Key): Daylight {
  const { minute: _minute, ...rest } = k;
  return { ...rest, shadow: { ...rest.shadow } };
}

const css = (c: Rgb, a: number): string => `rgba(${c.r},${c.g},${c.b},${a.toFixed(3)})`;

/** The minimal subset of CanvasRenderingContext2D these passes need, so tests can use a recorder. */
export interface TintContext {
  globalCompositeOperation: string;
  fillStyle: string | CanvasGradient;
  fillRect(x: number, y: number, w: number, h: number): void;
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): CanvasGradient;
  save(): void;
  restore(): void;
}

/** Draw the light over an already-painted frame. Call once per frame, after the world and before UI overlays. */
export function drawDaylight(ctx: TintContext, width: number, height: number, d: Daylight): void {
  ctx.save();
  if (d.multiplyAlpha > 0.001) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = css(d.multiply, d.multiplyAlpha);
    ctx.fillRect(0, 0, width, height);
  }
  if (d.softLightAlpha > 0.001) {
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = css(d.softLight, d.softLightAlpha);
    ctx.fillRect(0, 0, width, height);
  }
  if (d.vignette > 0.001) {
    ctx.globalCompositeOperation = 'multiply';
    const r = Math.hypot(width, height) / 2;
    const g = ctx.createRadialGradient(width / 2, height / 2, r * 0.55, width / 2, height / 2, r);
    g.addColorStop(0, 'rgba(46,42,34,0)');
    g.addColorStop(1, `rgba(46,42,34,${d.vignette.toFixed(3)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.restore();
}

/** A paper drop shadow for a standing piece whose footprint is the ellipse (cx, cy, rx, ry) in CSS px. */
export function drawShadow(
  ctx: { fillStyle: string | CanvasGradient; beginPath(): void; ellipse(x: number, y: number, rx: number, ry: number, rot: number, a: number, b: number): void; fill(): void },
  cx: number, cy: number, rx: number, ry: number, tilePx: number, d: Daylight,
): void {
  ctx.fillStyle = `rgba(46,42,34,${d.shadow.alpha.toFixed(3)})`;
  ctx.beginPath();
  ctx.ellipse(cx + d.shadow.dx * tilePx, cy + d.shadow.dy * tilePx, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}
