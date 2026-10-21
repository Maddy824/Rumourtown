/**
 * Felt villagers composed from `Look`, and the stranger: a hooded ink figure with no face.
 * Each composed sprite is cached per (look, facing, walk frame, mood) at the current zoom on its
 * own offscreen canvas, so a frame only blits.
 */
import type { Facing, Look } from '../sim/types.js';
import { BERRY, DENIM, FELT, INK, PAPER, darken, mix, rgba } from './palette.js';
import { makeCanvas } from './grain.js';
import { METRICS, bottomPath, ellipsePath, moodBucket, piece, rrectPath, topPath, type Metrics, type MoodBucket, type Pen } from './figure.js';
import { hairBehind, hairFront, hatBehind, hatFront, prop, type View } from './wardrobe.js';

export interface SpriteImage {
  img: HTMLCanvasElement;
  /** The feet within the image, in CSS pixels from its top-left. */
  ax: number;
  ay: number;
  /** Size in CSS pixels. */
  w: number;
  h: number;
}

/** Core villagers are drawn a little larger. */
export const CORE_SCALE = 1.1;
/** The drawn body relative to the feet, in tiles, for hit-testing. */
export const BODY = { left: -0.36, right: 0.36, top: -1.12, bottom: 0.04 } as const;

const BOX_W = 1.2;
const BOX_H = 1.6;
const FEET_X = 0.6;
const FEET_Y = 1.4;
const SHOE = darken(FELT.wood, 0.45);

type Frame = 0 | 1;

function surfaceFor(s: number, dpr: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; S: number } {
  const S = s * dpr;
  const { canvas, ctx } = makeCanvas(BOX_W * S, BOX_H * S);
  return { canvas, ctx, S };
}

function finish(ctx: CanvasRenderingContext2D, S: number, s: number, dpr: number): void {
  ctx.setTransform(S, 0, 0, S, FEET_X * S, FEET_Y * S);
  // One light for the whole figure, from the upper left.
  ctx.globalCompositeOperation = 'source-atop';
  const g = ctx.createLinearGradient(-0.4, -1.15, 0.4, 0);
  g.addColorStop(0, rgba(PAPER, 0.2));
  g.addColorStop(0.45, rgba(PAPER, 0));
  g.addColorStop(1, rgba(INK, 0.2));
  ctx.fillStyle = g;
  ctx.fillRect(-0.6, -1.4, 1.2, 1.6);
  // Contact shadow under the feet, drawn behind everything.
  ctx.globalCompositeOperation = 'destination-over';
  ctx.save();
  ctx.shadowColor = rgba(INK, 0.55);
  ctx.shadowBlur = Math.max(1, 2.2 * (s / 32)) * dpr;
  ctx.fillStyle = rgba(INK, 0.38);
  ctx.beginPath();
  ctx.ellipse(0.03, -0.005, 0.27, 0.075, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
}

function feet(p: Pen, view: View, frame: Frame, colour: string): void {
  if (view === 'e') {
    const [back, front] = frame ? [-0.085, 0.1] : [-0.025, 0.04];
    piece(p, ellipsePath(back, frame ? -0.05 : -0.035, 0.062, 0.035), darken(colour, 0.15));
    piece(p, ellipsePath(front + 0.015, -0.035, 0.068, 0.036), colour);
    return;
  }
  piece(p, ellipsePath(-0.072, frame ? -0.062 : -0.035, 0.06, frame ? 0.03 : 0.036), colour);
  piece(p, ellipsePath(0.072, -0.035, 0.06, 0.036), colour);
}

function apron(p: Pen, look: Look, m: Metrics, view: View): void {
  if (!look.apron) return;
  const c = look.apron;
  if (view === 'n') {
    const y = m.hipY - 0.05;
    const tie = new Path2D();
    tie.moveTo(0, y);
    tie.lineTo(-0.065, y - 0.035);
    tie.lineTo(-0.06, y + 0.03);
    tie.closePath();
    tie.moveTo(0, y);
    tie.lineTo(0.065, y - 0.035);
    tie.lineTo(0.06, y + 0.03);
    tie.closePath();
    piece(p, tie, c);
    return;
  }
  const top = m.shoulderY + 0.085;
  const bottom = -0.11;
  if (view === 's') {
    const hw = m.hemHw * 0.66;
    const bib = Math.min(hw, m.topHw * 0.75);
    const a = new Path2D();
    a.moveTo(-bib, top);
    a.lineTo(bib, top);
    a.lineTo(bib, m.hipY - 0.06);
    a.lineTo(hw, m.hipY - 0.03);
    a.lineTo(hw, bottom - 0.03);
    a.quadraticCurveTo(hw, bottom, hw - 0.04, bottom);
    a.lineTo(-hw + 0.04, bottom);
    a.quadraticCurveTo(-hw, bottom, -hw, bottom - 0.03);
    a.lineTo(-hw, m.hipY - 0.03);
    a.lineTo(-bib, m.hipY - 0.06);
    a.closePath();
    piece(p, a, c, rrectPath(-hw + 0.03, m.hipY - 0.01, hw * 2 - 0.06, bottom - m.hipY - 0.02, 0.03));
    p.ctx.fillStyle = darken(c, 0.2);
    p.ctx.fillRect(-m.hemHw * 0.95, m.hipY - 0.055, m.hemHw * 1.9, 0.024);
  } else {
    const x0 = m.topHw * 0.25;
    const x1 = m.hemHw * 0.86 + 0.02;
    piece(p, rrectPath(x0, top, x1 - x0, bottom - top, 0.03), c);
  }
}

function arms(p: Pen, look: Look, m: Metrics, view: View, frame: Frame): void {
  const sleeve = darken(look.top, 0.08);
  if (view === 'e') {
    const px = 0.02;
    const py = m.shoulderY + 0.05;
    const phi = frame ? -0.38 : 0.14;
    const sx = Math.sin(phi);
    const cy = Math.cos(phi);
    const hx = px + sx * 0.24;
    const hy = py + cy * 0.24;
    if (look.prop === 'broom' || look.prop === 'bucket' || look.prop === 'basket' || look.prop === 'sack') prop(p, look.prop, hx + 0.02, hy, false);
    piece(p, ellipsePath(px + sx * 0.12, py + cy * 0.12, 0.056, 0.13, -phi), sleeve);
    piece(p, ellipsePath(hx, hy, 0.048, 0.048), look.skin);
    if (!(look.prop === 'broom' || look.prop === 'bucket' || look.prop === 'basket' || look.prop === 'sack')) prop(p, look.prop, hx + 0.03, hy, false);
    return;
  }
  const ax = m.topHw + 0.022;
  const ay = m.shoulderY + 0.13;
  const holdSide = view === 's' ? 1 : -1;
  for (const side of [-1, 1]) {
    const swing = frame ? side * 0.018 : 0;
    const hx = side * (ax + 0.034);
    const hy = ay + 0.125 + swing;
    piece(p, ellipsePath(side * ax, ay + swing * 0.5, 0.055, 0.13, -side * 0.26), sleeve);
    if (side === holdSide && (look.prop === 'basket' || look.prop === 'bucket' || look.prop === 'sack')) prop(p, look.prop, hx, hy, side < 0);
    piece(p, ellipsePath(hx, hy, 0.048, 0.048), look.skin);
    if (side === holdSide && !(look.prop === 'basket' || look.prop === 'bucket' || look.prop === 'sack')) prop(p, look.prop, hx, hy, side < 0);
  }
}

function face(p: Pen, look: Look, m: Metrics, view: View, mood: MoodBucket): void {
  if (view === 'n') return;
  const { ctx } = p;
  const R = m.headR;
  const cy = m.headY;
  const eyes = view === 's' ? [-0.075, 0.075] : [R * 0.45];
  ctx.fillStyle = INK;
  for (const x of eyes) {
    ctx.beginPath();
    ctx.ellipse(x, cy + 0.008, 0.026, 0.029, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (p.detail) {
    ctx.fillStyle = rgba(PAPER, 0.85);
    for (const x of eyes) {
      ctx.beginPath();
      ctx.arc(x - 0.008, cy - 0.002, 0.008, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = rgba(BERRY, 0.3);
  for (const x of view === 's' ? [-0.128, 0.128] : [R * 0.18]) {
    ctx.beginPath();
    ctx.arc(x, cy + 0.072, 0.042, 0, Math.PI * 2);
    ctx.fill();
  }
  // The mouth: a short stitched curve whose bend and thread colour follow the mood.
  const bend = mood === 1 ? 0.042 : mood === -1 ? -0.036 : 0.004;
  const colour = mood === 1 ? mix(BERRY, INK, 0.15) : mood === -1 ? mix(DENIM, INK, 0.25) : mix(INK, look.skin, 0.2);
  const [x0, x1, y] = view === 's' ? [-0.045, 0.045, cy + 0.108] : [R * 0.5, R * 0.86, cy + 0.11];
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.lineWidth = Math.max(0.9 * p.px, 0.026);
  ctx.lineCap = 'round';
  if (p.detail) ctx.setLineDash([1.6 * p.px, 0.7 * p.px]);
  ctx.beginPath();
  ctx.moveTo(x0, y - (mood === -1 ? 0.012 : 0));
  ctx.quadraticCurveTo((x0 + x1) / 2, y + bend, x1, y - (mood === -1 ? 0.012 : mood === 1 ? 0.006 : 0));
  ctx.stroke();
  ctx.restore();
}

function figure(p: Pen, look: Look, view: View, frame: Frame, mood: MoodBucket): void {
  const m = METRICS[look.body] ?? METRICS.round;
  const { ctx } = p;
  const lift = frame ? -0.035 : 0;
  const f = view === 'e' ? 0.84 : 1;
  feet(p, view, frame, SHOE);
  ctx.save();
  ctx.translate(0, lift);
  if (view !== 'n') {
    hairBehind(p, look, m, view);
    hatBehind(p, look, m, view);
  }
  piece(p, bottomPath(m, 0, f), look.bottom, view === 's' ? centreSeam(m) : undefined);
  piece(p, topPath(m, 0, f), look.top, topPath(m, 0.035, f));
  apron(p, look, m, view);
  if (view !== 'e') arms(p, look, m, view, frame);
  const head = new Path2D();
  head.arc(0, m.headY, m.headR, 0, Math.PI * 2);
  if (view === 'e') {
    head.moveTo(m.headR * 0.98 + 0.034, m.headY + 0.03);
    head.arc(m.headR * 0.98, m.headY + 0.03, 0.034, 0, Math.PI * 2);
  }
  piece(p, head, look.skin);
  face(p, look, m, view, mood);
  hairFront(p, look, m, view);
  hatFront(p, look, m, view);
  if (view === 'e') arms(p, look, m, view, frame);
  ctx.restore();
}

function centreSeam(m: Metrics): Path2D {
  const s = new Path2D();
  s.moveTo(0, m.legTop + 0.05);
  s.lineTo(0, -0.1);
  return s;
}

/** The stranger: a hooded ink figure with no face, the same size as a villager. */
function stranger(p: Pen, view: View, frame: Frame): void {
  const { ctx } = p;
  feet(p, view, frame, mix(INK, BERRY, 0.18));
  ctx.save();
  ctx.translate(0, frame ? -0.035 : 0);
  const f = view === 'e' ? 0.86 : 1;
  const cloak = new Path2D();
  cloak.moveTo(0, -1.08);
  cloak.bezierCurveTo(0.2 * f, -1.08, 0.26 * f, -0.88, 0.205 * f, -0.7);
  cloak.bezierCurveTo(0.25 * f, -0.5, 0.31 * f, -0.22, 0.3 * f, -0.07);
  cloak.quadraticCurveTo(0, -0.02, -0.3 * f, -0.07);
  cloak.bezierCurveTo(-0.31 * f, -0.22, -0.25 * f, -0.5, -0.205 * f, -0.7);
  cloak.bezierCurveTo(-0.26 * f, -0.88, -0.2 * f, -1.08, 0, -1.08);
  cloak.closePath();
  const inner = new Path2D();
  inner.moveTo(0, -1.04);
  inner.bezierCurveTo(0.17 * f, -1.04, 0.22 * f, -0.87, 0.17 * f, -0.7);
  inner.bezierCurveTo(0.21 * f, -0.5, 0.27 * f, -0.23, 0.26 * f, -0.1);
  inner.quadraticCurveTo(0, -0.06, -0.26 * f, -0.1);
  inner.bezierCurveTo(-0.27 * f, -0.23, -0.21 * f, -0.5, -0.17 * f, -0.7);
  inner.bezierCurveTo(-0.22 * f, -0.87, -0.17 * f, -1.04, 0, -1.04);
  piece(p, cloak, INK, inner, mix(INK, PAPER, 0.42));
  // The hood's fold line and the empty opening where a face would be.
  ctx.strokeStyle = rgba(mix(INK, PAPER, 0.3), 0.9);
  ctx.lineWidth = 0.8 * p.px;
  ctx.beginPath();
  ctx.moveTo(-0.19 * f, -0.68);
  ctx.quadraticCurveTo(0, -0.6, 0.19 * f, -0.68);
  ctx.stroke();
  if (view !== 'n') {
    const ox = view === 'e' ? 0.095 : 0;
    const opening = ellipsePath(ox, -0.83, view === 'e' ? 0.085 : 0.128, 0.138);
    ctx.fillStyle = mix(INK, DENIM, 0.06);
    ctx.fill(opening);
    ctx.save();
    ctx.clip(opening);
    ctx.fillStyle = rgba('#141210', 0.55);
    ctx.beginPath();
    ctx.ellipse(ox + 0.02, -0.86, 0.13, 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    if (p.detail) ctx.setLineDash([1.4 * p.px, 1.1 * p.px]);
    ctx.strokeStyle = mix(INK, PAPER, 0.5);
    ctx.lineWidth = 0.75 * p.px;
    ctx.stroke(ellipsePath(ox, -0.83, (view === 'e' ? 0.085 : 0.128) + 0.03, 0.168));
    ctx.restore();
  } else {
    ctx.save();
    if (p.detail) ctx.setLineDash([1.4 * p.px, 1.1 * p.px]);
    ctx.strokeStyle = mix(INK, PAPER, 0.42);
    ctx.lineWidth = 0.75 * p.px;
    ctx.beginPath();
    ctx.moveTo(0, -1.0);
    ctx.lineTo(0, -0.62);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function compose(look: Look | null, facing: Facing, frame: Frame, mood: MoodBucket, s: number, dpr: number): SpriteImage {
  const { canvas, ctx, S } = surfaceFor(s, dpr);
  ctx.setTransform(S, 0, 0, S, FEET_X * S, FEET_Y * S);
  if (facing === 'w') ctx.scale(-1, 1);
  const view: View = facing === 'w' ? 'e' : facing;
  const pen: Pen = { ctx, px: 1 / s, dpr, u: s / 32, detail: s >= 17 };
  if (look) figure(pen, look, view, frame, mood);
  else stranger(pen, view, frame);
  finish(ctx, S, s, dpr);
  return { img: canvas, ax: FEET_X * s, ay: FEET_Y * s, w: BOX_W * s, h: BOX_H * s };
}

function lookKey(look: Look): string {
  return `${look.body}|${look.skin}|${look.hair.style}|${look.hair.color}|${look.hat}|${look.top}|${look.bottom}|${look.apron ?? ''}|${look.prop}`;
}

/** Sprites per zoom bucket; at most three zoom levels kept. */
export class SpriteCache {
  private buckets = new Map<string, Map<string, SpriteImage>>();
  private keys = new WeakMap<Look, string>();

  private bucket(zoom: number, dpr: number): Map<string, SpriteImage> {
    const id = `${zoom.toFixed(3)}@${dpr}`;
    let b = this.buckets.get(id);
    if (!b) {
      b = new Map();
      this.buckets.set(id, b);
      if (this.buckets.size > 3) {
        const oldest = this.buckets.keys().next().value;
        if (oldest !== undefined) this.buckets.delete(oldest);
      }
    }
    return b;
  }

  villager(look: Look, facing: Facing, frame: Frame, mood: number, core: boolean, zoom: number, dpr: number): SpriteImage {
    let lk = this.keys.get(look);
    if (lk === undefined) {
      lk = lookKey(look);
      this.keys.set(look, lk);
    }
    const mb = facing === 'n' ? 0 : moodBucket(mood);
    const key = `${lk}|${facing}|${frame}|${mb}|${core ? 1 : 0}`;
    const b = this.bucket(zoom, dpr);
    let img = b.get(key);
    if (!img) {
      img = compose(look, facing, frame, mb, zoom * (core ? CORE_SCALE : 1), dpr);
      b.set(key, img);
    }
    return img;
  }

  stranger(facing: Facing, frame: Frame, zoom: number, dpr: number): SpriteImage {
    const key = `stranger|${facing}|${frame}`;
    const b = this.bucket(zoom, dpr);
    let img = b.get(key);
    if (!img) {
      img = compose(null, facing, frame, 0, zoom, dpr);
      b.set(key, img);
    }
    return img;
  }
}
