/**
 * Texture helpers shared by every layer: seeded hashing, offscreen canvases, felt fibres,
 * soft mottling blobs, the paper-grain overlay and the cork table.
 * Rendering is not simulation, but textures are still seeded so the village looks the same
 * on every load.
 */
import { INK, PAPER, FELT, rgba } from './palette.js';

/** Integer hash of a tile coordinate to [0, 1). */
export function hash(x: number, y: number, seed = 0): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Hash of a string, for per-villager variation. */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return hash(h, 7, 11);
}

/** mulberry32: a small seeded generator for texture scattering. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Surface {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

export function makeCanvas(width: number, height: number): Surface {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available');
  return { canvas, ctx };
}

/**
 * Adds short curly fibres to a path: felt's fuzz. Each fibre is a tiny quadratic stroke at a
 * random angle, so a dense field of them reads as matted wool rather than noise.
 */
export function addFibres(
  path: Path2D,
  x: number,
  y: number,
  w: number,
  h: number,
  count: number,
  rnd: () => number,
  minLen: number,
  maxLen: number,
): void {
  for (let i = 0; i < count; i++) {
    const px = x + rnd() * w;
    const py = y + rnd() * h;
    const a = rnd() * Math.PI * 2;
    const len = minLen + rnd() * (maxLen - minLen);
    const bend = (rnd() - 0.5) * 1.6;
    const ex = px + Math.cos(a) * len;
    const ey = py + Math.sin(a) * len;
    path.moveTo(px, py);
    path.quadraticCurveTo(px + Math.cos(a + bend) * len * 0.55, py + Math.sin(a + bend) * len * 0.55, ex, ey);
  }
}

/** A soft round blob of one colour fading to transparent, used for felt dye mottling. */
export function softBlob(color: string, size = 64): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(size, size);
  const r = size / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, rgba(color, 1));
  g.addColorStop(0.55, rgba(color, 0.55));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

/**
 * The paper-grain tile laid over the whole frame at 6%. Strong contrast on purpose: at 6% it
 * becomes a faint tooth. Ink and paper speckles plus a few long paper fibres; wraps seamlessly.
 */
export function makeGrain(size = 256, seed = 31): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(size, size);
  const img = ctx.createImageData(size, size);
  const rnd = seeded(seed);
  const ink = [46, 42, 34];
  const paper = [246, 240, 228];
  for (let i = 0; i < size * size; i++) {
    const v = rnd();
    const c = v < 0.5 ? ink : paper;
    const o = i * 4;
    img.data[o] = c[0] as number;
    img.data[o + 1] = c[1] as number;
    img.data[o + 2] = c[2] as number;
    img.data[o + 3] = Math.round(Math.abs(v - 0.5) * 2 * 150 + (rnd() < 0.04 ? 105 : 0));
  }
  ctx.putImageData(img, 0, 0);
  ctx.lineCap = 'round';
  for (let pass = 0; pass < 2; pass++) {
    const fib = new Path2D();
    for (let i = 0; i < 70; i++) {
      const x = rnd() * size;
      const y = rnd() * size;
      const a = rnd() * Math.PI * 2;
      const len = 6 + rnd() * 18;
      for (const dx of [-size, 0, size]) {
        for (const dy of [-size, 0, size]) {
          fib.moveTo(x + dx, y + dy);
          fib.quadraticCurveTo(x + dx + Math.cos(a + 0.5) * len * 0.5, y + dy + Math.sin(a + 0.5) * len * 0.5, x + dx + Math.cos(a) * len, y + dy + Math.sin(a) * len);
        }
      }
    }
    ctx.strokeStyle = pass === 0 ? rgba(INK, 0.55) : rgba(PAPER, 0.8);
    ctx.lineWidth = 0.8;
    ctx.stroke(fib);
  }
  return canvas;
}

/** A tileable cork board for the table around the village sheet. Size in device pixels. */
export function makeCork(size: number, seed = 5): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(size, size);
  ctx.fillStyle = FELT.cork;
  ctx.fillRect(0, 0, size, size);
  const rnd = seeded(seed);
  const unit = size / 256;
  const tones = [FELT.corkDark, FELT.corkLight, FELT.corkDark, rgba(INK, 0.5)];
  for (let t = 0; t < tones.length; t++) {
    const p = new Path2D();
    const n = t === 3 ? 160 : 1400;
    for (let i = 0; i < n; i++) {
      const x = rnd() * size;
      const y = rnd() * size;
      const r = (t === 3 ? 0.5 + rnd() * 0.9 : 0.4 + rnd() * 1.6) * unit;
      for (const dx of [-size, 0, size]) {
        for (const dy of [-size, 0, size]) {
          const cx = x + dx;
          const cy = y + dy;
          if (cx < -4 * unit || cy < -4 * unit || cx > size + 4 * unit || cy > size + 4 * unit) continue;
          p.moveTo(cx + r, cy);
          p.ellipse(cx, cy, r, r * (0.6 + rnd() * 0.4), rnd() * Math.PI, 0, Math.PI * 2);
        }
      }
    }
    ctx.globalAlpha = t === 1 ? 0.5 : 0.42;
    ctx.fillStyle = tones[t] as string;
    ctx.fill(p);
  }
  ctx.globalAlpha = 1;
  return canvas;
}
