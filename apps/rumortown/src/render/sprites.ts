/**
 * Felt villagers composed from `Look`, and the stranger: a hooded ink figure with no face.
 * Each composed sprite is cached per (look, facing, walk frame, mood) at the current zoom on its
 * own offscreen canvas, so a frame only blits.
 */
import type { Facing, Look } from '../sim/types.js';
import { BERRY, DENIM, FELT, INK, OAT, PAPER, darken, luma, mix, rgba } from './palette.js';
import { makeCanvas } from './grain.js';
import { METRICS, bottomPath, ellipsePath, moodBucket, piece, topPath, type Metrics, type MoodBucket, type Pen } from './figure.js';
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
export const BODY = { left: -0.4, right: 0.4, top: -1.14, bottom: 0.05 } as const;

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
  ctx.ellipse(0.03, -0.005, 0.32, 0.085, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
}

function feet(p: Pen, view: View, frame: Frame, colour: string): void {
  if (view === 'e') {
    const [back, front] = frame ? [-0.085, 0.1] : [-0.025, 0.04];
    piece(p, ellipsePath(back, frame ? -0.055 : -0.038, 0.07, 0.038), darken(colour, 0.15));
    piece(p, ellipsePath(front + 0.015, -0.038, 0.076, 0.04), colour);
    return;
  }
  piece(p, ellipsePath(-0.085, frame ? -0.066 : -0.038, 0.07, frame ? 0.033 : 0.04), colour);
  piece(p, ellipsePath(0.085, -0.038, 0.07, 0.04), colour);
}

function apron(p: Pen, look: Look, m: Metrics, view: View): void {
  if (!look.apron) return;
  // Very pale aprons read as paper glare at this size; take them toward oat felt.
  const c = luma(look.apron) > 0.85 ? mix(look.apron, OAT, 0.35) : look.apron;
  if (view === 'n') {
    const y = m.hipY - 0.04;
    const tie = new Path2D();
    tie.moveTo(0, y);
    tie.lineTo(-0.075, y - 0.04);
    tie.lineTo(-0.07, y + 0.035);
    tie.closePath();
    tie.moveTo(0, y);
    tie.lineTo(0.075, y - 0.04);
    tie.lineTo(0.07, y + 0.035);
    tie.closePath();
    piece(p, tie, c);
    p.ctx.fillStyle = darken(c, 0.18);
    p.ctx.fillRect(-m.hemHw * 0.92, y - 0.012, m.hemHw * 1.84, 0.024);
    return;
  }
  const waist = m.hipY - 0.035;
  const bottom = -0.1;
  if (view === 's') {
    const bib = m.topHw * 0.52;
    const bibTop = m.shoulderY + 0.15;
    const skirtTop = m.hemHw * 0.62;
    const skirtBottom = m.hemHw * 0.74;
    const a = new Path2D();
    a.moveTo(-bib, bibTop);
    a.lineTo(bib, bibTop);
    a.lineTo(bib, waist);
    a.lineTo(skirtTop, waist);
    a.lineTo(skirtBottom, bottom - 0.03);
    a.quadraticCurveTo(skirtBottom, bottom, skirtBottom - 0.04, bottom);
    a.lineTo(-skirtBottom + 0.04, bottom);
    a.quadraticCurveTo(-skirtBottom, bottom, -skirtBottom, bottom - 0.03);
    a.lineTo(-skirtTop, waist);
    a.lineTo(-bib, waist);
    a.closePath();
    const hem = new Path2D();
    hem.moveTo(-skirtBottom + 0.035, bottom - 0.03);
    hem.lineTo(skirtBottom - 0.035, bottom - 0.03);
    piece(p, a, c, hem);
    const { ctx } = p;
    // Straps up to the neck, the waist tie, and a stitched pocket.
    ctx.strokeStyle = darken(c, 0.15);
    ctx.lineWidth = 0.028;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-bib + 0.015, bibTop);
    ctx.lineTo(-m.topHw * 0.42, m.shoulderY + 0.02);
    ctx.moveTo(bib - 0.015, bibTop);
    ctx.lineTo(m.topHw * 0.42, m.shoulderY + 0.02);
    ctx.stroke();
    ctx.fillStyle = darken(c, 0.2);
    ctx.fillRect(-m.hemHw * 0.95, waist - 0.012, m.hemHw * 1.9, 0.026);
    if (p.detail) {
      ctx.save();
      ctx.setLineDash([1.3 * p.px, 1.1 * p.px]);
      ctx.lineWidth = 0.65 * p.px;
      ctx.strokeStyle = darken(c, 0.35);
      ctx.strokeRect(-0.07, waist + 0.04, 0.14, Math.max(0.03, bottom - waist - 0.09));
      ctx.restore();
    }
  } else {
    const x0 = m.topHw * 0.3;
    const x1 = m.hemHw * 0.86 + 0.025;
    const a = new Path2D();
    a.moveTo(x0, m.shoulderY + 0.15);
    a.lineTo(x0 + 0.06, m.shoulderY + 0.15);
    a.lineTo(x0 + 0.06, waist);
    a.lineTo(x1, waist);
    a.lineTo(x1 + 0.02, bottom);
    a.lineTo(x0, bottom);
    a.closePath();
    piece(p, a, c);
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
    const hx = px + sx * 0.27;
    const hy = py + cy * 0.27;
    if (look.prop === 'broom' || look.prop === 'bucket' || look.prop === 'basket' || look.prop === 'sack') prop(p, look.prop, hx + 0.02, hy, false);
    piece(p, ellipsePath(px + sx * 0.135, py + cy * 0.135, 0.064, 0.148, -phi), sleeve);
    piece(p, ellipsePath(hx, hy, 0.056, 0.056), look.skin);
    if (!(look.prop === 'broom' || look.prop === 'bucket' || look.prop === 'basket' || look.prop === 'sack')) prop(p, look.prop, hx + 0.03, hy, false);
    return;
  }
  const ax = m.topHw + 0.03;
  const ay = m.shoulderY + 0.14;
  const holdSide = view === 's' ? 1 : -1;
  for (const side of [-1, 1]) {
    const swing = frame ? side * 0.02 : 0;
    const hx = side * (ax + 0.04);
    const hy = ay + 0.14 + swing;
    piece(p, ellipsePath(side * ax, ay + swing * 0.5, 0.064, 0.148, -side * 0.26), sleeve);
    if (side === holdSide && (look.prop === 'basket' || look.prop === 'bucket' || look.prop === 'sack')) prop(p, look.prop, hx, hy, side < 0);
    piece(p, ellipsePath(hx, hy, 0.056, 0.056), look.skin);
    if (side === holdSide && !(look.prop === 'basket' || look.prop === 'bucket' || look.prop === 'sack')) prop(p, look.prop, hx, hy, side < 0);
  }
}

function face(p: Pen, look: Look, m: Metrics, view: View, mood: MoodBucket): void {
  if (view === 'n') return;
  const { ctx } = p;
  const R = m.headR;
  const cy = m.headY;
  const eyes = view === 's' ? [-0.34 * R, 0.34 * R] : [0.47 * R];
  ctx.fillStyle = INK;
  for (const x of eyes) {
    ctx.beginPath();
    ctx.ellipse(x, cy + 0.05 * R, 0.105 * R, 0.125 * R, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (p.detail) {
    ctx.fillStyle = rgba(PAPER, 0.9);
    for (const x of eyes) {
      ctx.beginPath();
      ctx.arc(x - 0.035 * R, cy + 0.005 * R, 0.035 * R, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = rgba(BERRY, 0.32);
  for (const x of view === 's' ? [-0.56 * R, 0.56 * R] : [0.16 * R]) {
    ctx.beginPath();
    ctx.ellipse(x, cy + 0.33 * R, 0.17 * R, 0.14 * R, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // The mouth: a short stitched curve whose bend and thread colour follow the mood.
  const bend = mood === 1 ? 0.19 * R : mood === -1 ? -0.15 * R : 0.02 * R;
  const colour = mood === 1 ? mix(BERRY, INK, 0.15) : mood === -1 ? mix(DENIM, INK, 0.25) : mix(INK, look.skin, 0.2);
  const [x0, x1, y] = view === 's' ? [-0.2 * R, 0.2 * R, cy + 0.47 * R] : [0.52 * R, 0.86 * R, cy + 0.5 * R];
  const ends = mood === -1 ? -0.05 * R : mood === 1 ? -0.03 * R : 0;
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.lineWidth = Math.max(0.9 * p.px, 0.028);
  ctx.lineCap = 'round';
  if (p.detail) ctx.setLineDash([1.7 * p.px, 0.8 * p.px]);
  ctx.beginPath();
  ctx.moveTo(x0, y + ends);
  ctx.quadraticCurveTo((x0 + x1) / 2, y + bend, x1, y + ends);
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
  cloak.moveTo(0, -1.09);
  cloak.bezierCurveTo(0.23 * f, -1.09, 0.29 * f, -0.88, 0.23 * f, -0.69);
  cloak.bezierCurveTo(0.28 * f, -0.5, 0.35 * f, -0.22, 0.34 * f, -0.07);
  cloak.quadraticCurveTo(0, -0.015, -0.34 * f, -0.07);
  cloak.bezierCurveTo(-0.35 * f, -0.22, -0.28 * f, -0.5, -0.23 * f, -0.69);
  cloak.bezierCurveTo(-0.29 * f, -0.88, -0.23 * f, -1.09, 0, -1.09);
  cloak.closePath();
  const inner = new Path2D();
  inner.moveTo(0, -1.05);
  inner.bezierCurveTo(0.2 * f, -1.05, 0.25 * f, -0.87, 0.19 * f, -0.69);
  inner.bezierCurveTo(0.24 * f, -0.5, 0.31 * f, -0.23, 0.3 * f, -0.1);
  inner.quadraticCurveTo(0, -0.055, -0.3 * f, -0.1);
  inner.bezierCurveTo(-0.31 * f, -0.23, -0.24 * f, -0.5, -0.19 * f, -0.69);
  inner.bezierCurveTo(-0.25 * f, -0.87, -0.2 * f, -1.05, 0, -1.05);
  // Ink with a whisper of denim, so the empty hood opening can be pure ink without near-black.
  piece(p, cloak, mix(INK, DENIM, 0.1), inner, mix(INK, PAPER, 0.42));
  // The hood's fold line and the empty opening where a face would be.
  ctx.strokeStyle = rgba(mix(INK, PAPER, 0.3), 0.9);
  ctx.lineWidth = 0.8 * p.px;
  ctx.beginPath();
  ctx.moveTo(-0.22 * f, -0.67);
  ctx.quadraticCurveTo(0, -0.59, 0.22 * f, -0.67);
  ctx.stroke();
  if (view !== 'n') {
    const ox = view === 'e' ? 0.11 : 0;
    const opening = ellipsePath(ox, -0.83, view === 'e' ? 0.095 : 0.145, 0.155);
    ctx.fillStyle = INK;
    ctx.fill(opening);
    ctx.save();
    ctx.clip(opening);
    ctx.fillStyle = rgba(INK, 0.85);
    ctx.beginPath();
    ctx.ellipse(ox + 0.025, -0.865, 0.145, 0.145, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    if (p.detail) ctx.setLineDash([1.4 * p.px, 1.1 * p.px]);
    ctx.strokeStyle = mix(INK, PAPER, 0.5);
    ctx.lineWidth = 0.75 * p.px;
    ctx.stroke(ellipsePath(ox, -0.83, (view === 'e' ? 0.095 : 0.145) + 0.032, 0.188));
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

/** Sprites for the two supported zooms. Composition is confined to preparation jobs. */
export class SpriteCache {
  private buckets = new Map<string, Map<string, SpriteImage>>();
  private keys = new WeakMap<Look, string>();
  private prepared = new Set<string>();

  private bucketId(zoom: number, dpr: number): string {
    return `${zoom.toFixed(3)}@${dpr}`;
  }

  private appearance(look: Look, core: boolean): string {
    let key = this.keys.get(look);
    if (key === undefined) {
      key = lookKey(look);
      this.keys.set(look, key);
    }
    return `${key}|${core ? 1 : 0}`;
  }

  private villagerKey(look: Look, facing: Facing, frame: Frame, mood: number, core: boolean): string {
    return `${this.appearance(look, core)}|${facing}|${frame}|${facing === 'n' ? 0 : moodBucket(mood)}`;
  }

  /** A resize keeps only the two zoom/DPR buckets which can still be used. */
  retain(zooms: readonly number[], dpr: number): void {
    const ids = zooms.map((zoom) => this.bucketId(zoom, dpr));
    for (const id of this.buckets.keys()) if (!ids.includes(id)) this.buckets.delete(id);
    for (const key of this.prepared) if (!ids.some((id) => key.startsWith(`${id}:`))) this.prepared.delete(key);
  }

  ready(look: Look, core: boolean, zoom: number, dpr: number): boolean {
    return this.prepared.has(`${this.bucketId(zoom, dpr)}:${this.appearance(look, core)}`);
  }

  /** Warm all facings, walk frames and moods before a new appearance enters the draw pass. */
  *prepare(look: Look, core: boolean, zoom: number, dpr: number): Generator<void> {
    if (this.ready(look, core, zoom, dpr)) return;
    for (const facing of ['s', 'n', 'e', 'w'] as const) {
      for (const frame of [0, 1] as const) {
        for (const mood of facing === 'n' ? [0] : [-1, 0, 1]) {
          this.villager(look, facing, frame, mood, core, zoom, dpr);
          yield;
        }
      }
    }
    this.prepared.add(`${this.bucketId(zoom, dpr)}:${this.appearance(look, core)}`);
  }

  cachedVillager(look: Look, facing: Facing, frame: Frame, mood: number, core: boolean, zoom: number, dpr: number): SpriteImage | undefined {
    return this.buckets.get(this.bucketId(zoom, dpr))?.get(this.villagerKey(look, facing, frame, mood, core));
  }

  cachedStranger(facing: Facing, frame: Frame, zoom: number, dpr: number): SpriteImage | undefined {
    return this.buckets.get(this.bucketId(zoom, dpr))?.get(`stranger|${facing}|${frame}`);
  }

  private bucket(zoom: number, dpr: number): Map<string, SpriteImage> {
    const id = this.bucketId(zoom, dpr);
    let b = this.buckets.get(id);
    if (!b) {
      b = new Map();
      this.buckets.set(id, b);
    }
    return b;
  }

  villager(look: Look, facing: Facing, frame: Frame, mood: number, core: boolean, zoom: number, dpr: number): SpriteImage {
    const mb = facing === 'n' ? 0 : moodBucket(mood);
    const key = this.villagerKey(look, facing, frame, mood, core);
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
