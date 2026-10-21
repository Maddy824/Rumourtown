/**
 * The rumour trail: red embroidery thread pinned from teller to listener. Older threads fade;
 * the newest one stitches itself across the village over 400 ms behind a small needle, unless
 * reduced motion is on. This is the one orchestrated moment in the scene.
 */
import type { ThreadLink } from '../sim/types.js';
import { DENIM, FELT, INK, MUSTARD, PAPER, darken, mix, rgba } from './palette.js';
import { hashString } from './grain.js';

/** Writes the screen position of a thread end into `out`; false when that villager is not shown. */
export type ResolveEnd = (id: string, out: { x: number; y: number }) => boolean;

const DRAW_MS = 400;
const HALF_LIFE_TICKS = 90;

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export class ThreadPainter {
  private newestTick = -Infinity;
  private newestCount = 0;
  private animStart = -Infinity;
  private primed = false;
  private readonly a = { x: 0, y: 0 };
  private readonly b = { x: 0, y: 0 };
  private readonly solid: number[] = [];
  private readonly sagCache = new Map<string, number>();

  /**
   * Notes when a new thread appears. Called every frame, even while threads are hidden, so that
   * showing them later does not replay an old stitch. Threads already present on the first frame,
   * or after the timeline jumps back, never animate.
   */
  track(threads: readonly ThreadLink[], now: number): void {
    let maxTick = -Infinity;
    let atMax = 0;
    for (const t of threads) {
      if (t.tick > maxTick) {
        maxTick = t.tick;
        atMax = 1;
      } else if (t.tick === maxTick) atMax++;
    }
    if (!this.primed || maxTick < this.newestTick) {
      this.primed = true;
      this.newestTick = maxTick;
      this.newestCount = atMax;
      this.animStart = -Infinity;
    } else if (maxTick > this.newestTick || (maxTick === this.newestTick && atMax > this.newestCount)) {
      this.newestTick = maxTick;
      this.newestCount = atMax;
      this.animStart = now;
    }
  }

  /** Draws all threads; returns true while the newest thread is still being stitched. */
  draw(ctx: CanvasRenderingContext2D, threads: readonly ThreadLink[], resolve: ResolveEnd, zoom: number, reducedMotion: boolean, now: number): boolean {
    const maxTick = this.newestTick;
    const progress = reducedMotion ? 1 : Math.min(1, Math.max(0, (now - this.animStart) / DRAW_MS));
    const u = Math.max(0.35, Math.min(1.1, zoom / 32));
    const width = Math.max(1.4, 2.8 * u);
    const pinR = Math.max(2.4, 3.9 * u);

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const t of threads) {
      if (!resolve(t.from, this.a) || !resolve(t.to, this.b)) continue;
      const alpha = 0.22 + 0.78 * Math.pow(0.5, (maxTick - t.tick) / HALF_LIFE_TICKS);
      const p = t.tick === maxTick ? easeOut(progress) : 1;
      this.thread(ctx, t, alpha, p, width, pinR, u);
    }
    ctx.restore();
    return progress < 1;
  }

  private sag(t: ThreadLink): number {
    const key = `${t.from}>${t.to}:${t.claimId}`;
    let s = this.sagCache.get(key);
    if (s === undefined) {
      s = 0.09 + hashString(key) * 0.07;
      if (this.sagCache.size > 512) this.sagCache.clear();
      this.sagCache.set(key, s);
    }
    return s;
  }

  private thread(ctx: CanvasRenderingContext2D, t: ThreadLink, alpha: number, p: number, width: number, pinR: number, u: number): void {
    const ax = this.a.x;
    const ay = this.a.y;
    const bx = this.b.x;
    const by = this.b.y;
    const dist = Math.hypot(bx - ax, by - ay);
    if (dist < 1) return;
    const sag = Math.min(dist * this.sag(t), 60 * u) + 4 * u;
    const cx = (ax + bx) / 2;
    const cy = (ay + by) / 2 + sag;
    // The drawn part of the curve, split at p (de Casteljau for a quadratic).
    const qcx = ax + (cx - ax) * p;
    const qcy = ay + (cy - ay) * p;
    const ex = (1 - p) * (1 - p) * ax + 2 * (1 - p) * p * cx + p * p * bx;
    const ey = (1 - p) * (1 - p) * ay + 2 * (1 - p) * p * cy + p * p * by;

    const fromStranger = t.from === 'stranger';
    this.pin(ctx, ax, ay, pinR, alpha, fromStranger);

    ctx.setLineDash(this.solid);
    ctx.lineWidth = width;
    // Shadow on the board below the lifted thread.
    ctx.strokeStyle = rgba(INK, 0.3 * alpha);
    ctx.beginPath();
    ctx.moveTo(ax + 0.9 * u, ay + 2.2 * u);
    ctx.quadraticCurveTo(qcx + 0.9 * u, qcy + 2.6 * u, ex + 0.9 * u, ey + 2.2 * u);
    ctx.stroke();
    // The floss itself, and a pale dashed strand for its twist.
    ctx.strokeStyle = rgba(FELT.thread, alpha);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo(qcx, qcy, ex, ey);
    ctx.stroke();
    this.twistMarks(ctx, ax, ay, qcx, qcy, ex, ey, width, alpha, u);

    if (p >= 1) this.pin(ctx, bx, by, pinR, alpha, false);
    else this.needle(ctx, ex, ey, 2 * (1 - p) * (cx - ax) + 2 * p * (bx - cx), 2 * (1 - p) * (cy - ay) + 2 * p * (by - cy), u);
  }

  /**
   * Floss is twisted strands: short pale diagonals across the thread at a steady pitch. At the
   * far zoom the thread is too thin for them and stays plain.
   */
  private twistMarks(ctx: CanvasRenderingContext2D, ax: number, ay: number, cx: number, cy: number, bx: number, by: number, width: number, alpha: number, u: number): void {
    if (u < 0.5) return;
    const length = Math.hypot(cx - ax, cy - ay) + Math.hypot(bx - cx, by - cy);
    const pitch = width * 1.35;
    const n = Math.floor(length / pitch);
    if (n < 2) return;
    const half = width * 0.5;
    ctx.beginPath();
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const mt = 1 - t;
      const x = mt * mt * ax + 2 * mt * t * cx + t * t * bx;
      const y = mt * mt * ay + 2 * mt * t * cy + t * t * by;
      let tx = 2 * mt * (cx - ax) + 2 * t * (bx - cx);
      let ty = 2 * mt * (cy - ay) + 2 * t * (by - cy);
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl;
      ty /= tl;
      // A strand crosses the thread at about 60 degrees.
      const dx = tx * 0.55 - ty * 0.85;
      const dy = ty * 0.55 + tx * 0.85;
      ctx.moveTo(x - dx * half, y - dy * half);
      ctx.lineTo(x + dx * half, y + dy * half);
    }
    ctx.lineWidth = Math.max(0.6, width * 0.32);
    ctx.strokeStyle = rgba(FELT.threadLight, 0.7 * alpha);
    ctx.stroke();
  }

  /** A glass-headed pin: mustard for villagers, pale for the stranger so it shows on the ink cloak. */
  private pin(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number, pale: boolean): void {
    const head = pale ? PAPER : FELT.pin;
    ctx.globalAlpha = Math.min(1, alpha + 0.25);
    ctx.fillStyle = rgba(INK, 0.35);
    ctx.beginPath();
    ctx.arc(x + r * 0.35, y + r * 0.6, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = head;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = Math.max(0.6, r * 0.22);
    ctx.strokeStyle = darken(pale ? mix(PAPER, INK, 0.3) : MUSTARD, 0.35);
    ctx.stroke();
    ctx.fillStyle = rgba(PAPER, 0.9);
    ctx.beginPath();
    ctx.arc(x - r * 0.35, y - r * 0.38, r * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  /** The needle leading the thread while it stitches itself. */
  private needle(ctx: CanvasRenderingContext2D, x: number, y: number, dx: number, dy: number, u: number): void {
    const a = Math.atan2(dy, dx);
    const len = 23 * u;
    const w = 2.1 * u;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    // The thread runs through the eye, so the eye sits on the thread's end.
    ctx.translate(len * 0.22, 0);
    ctx.fillStyle = rgba(INK, 0.3);
    ctx.beginPath();
    ctx.ellipse(len * 0.25 + 0.8 * u, 2 * u, len * 0.62, w, 0, 0, Math.PI * 2);
    ctx.fill();
    const steel = mix(PAPER, DENIM, 0.28);
    ctx.fillStyle = steel;
    ctx.beginPath();
    ctx.moveTo(-len * 0.35, -w);
    ctx.lineTo(len * 0.55, -w * 0.5);
    ctx.lineTo(len * 0.88, 0);
    ctx.lineTo(len * 0.55, w * 0.5);
    ctx.lineTo(-len * 0.35, w);
    ctx.quadraticCurveTo(-len * 0.45, 0, -len * 0.35, -w);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 0.6 * u;
    ctx.strokeStyle = mix(steel, INK, 0.45);
    ctx.stroke();
    ctx.fillStyle = mix(steel, INK, 0.55);
    ctx.beginPath();
    ctx.ellipse(-len * 0.22, 0, 1.6 * u, 0.55 * u, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = rgba(PAPER, 0.95);
    ctx.lineWidth = 0.7 * u;
    ctx.beginPath();
    ctx.moveTo(-len * 0.1, -w * 0.45);
    ctx.lineTo(len * 0.5, -w * 0.25);
    ctx.stroke();
    ctx.restore();
  }
}
