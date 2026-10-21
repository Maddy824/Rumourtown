/**
 * The felt villager's body: proportions per body type, and the one drawing primitive every
 * piece uses — a felt cut-out with a tiny shadow onto the layer below, a soft darker edge and
 * a contrasting running stitch. All shapes are in tile units with the feet at the origin and
 * up as negative y.
 */
import type { Body } from '../sim/types.js';
import { INK, darken, lighten, luma, rgba } from './palette.js';

export interface Pen {
  ctx: CanvasRenderingContext2D;
  /** One CSS pixel in tile units. */
  px: number;
  /** Device pixels per CSS pixel, for shadow sizes (shadows ignore transforms). */
  dpr: number;
  /** Size relative to the close zoom: 1 at 32 px per tile. */
  u: number;
  /** Enough pixels for stitches and small features. */
  detail: boolean;
}

export interface Metrics {
  headR: number;
  headY: number;
  shoulderY: number;
  hipY: number;
  topHw: number;
  hemHw: number;
  legTop: number;
  legHw: number;
  belly: number;
}

export const METRICS: Record<Body, Metrics> = {
  round: { headR: 0.225, headY: -0.835, shoulderY: -0.635, hipY: -0.27, topHw: 0.16, hemHw: 0.27, legTop: -0.33, legHw: 0.165, belly: 0.07 },
  stout: { headR: 0.215, headY: -0.8, shoulderY: -0.6, hipY: -0.255, topHw: 0.225, hemHw: 0.275, legTop: -0.3, legHw: 0.195, belly: 0.025 },
  tall: { headR: 0.2, headY: -0.895, shoulderY: -0.7, hipY: -0.3, topHw: 0.15, hemHw: 0.19, legTop: -0.35, legHw: 0.13, belly: 0 },
  slight: { headR: 0.195, headY: -0.84, shoulderY: -0.65, hipY: -0.285, topHw: 0.12, hemHw: 0.17, legTop: -0.33, legHw: 0.11, belly: 0 },
};

/** A thread colour that shows on this felt: lighter on dark felt, darker on pale felt. */
export function threadFor(color: string): string {
  return luma(color) > 0.62 ? darken(color, 0.38) : lighten(color, 0.55);
}

/** One felt piece: tiny drop shadow, fill, soft edge, and an optional inset running stitch. */
export function piece(p: Pen, shape: Path2D, color: string, stitch?: Path2D, thread?: string): void {
  const { ctx } = p;
  ctx.save();
  ctx.shadowColor = rgba(INK, 0.4);
  ctx.shadowBlur = Math.max(0.6, 1.3 * p.u) * p.dpr;
  ctx.shadowOffsetX = 0.35 * p.u * p.dpr;
  ctx.shadowOffsetY = 0.8 * p.u * p.dpr;
  ctx.fillStyle = color;
  ctx.fill(shape);
  ctx.restore();
  ctx.lineWidth = 0.75 * p.px;
  ctx.strokeStyle = rgba(darken(color, 0.4), 0.6);
  ctx.stroke(shape);
  if (stitch && p.detail) {
    ctx.save();
    ctx.setLineDash([1.5 * p.px, 1.25 * p.px]);
    ctx.lineCap = 'round';
    ctx.lineWidth = 0.7 * p.px;
    ctx.strokeStyle = thread ?? threadFor(color);
    ctx.stroke(stitch);
    ctx.restore();
  }
}

export function ellipsePath(cx: number, cy: number, rx: number, ry: number, rot = 0): Path2D {
  const p = new Path2D();
  p.ellipse(cx, cy, Math.max(0.001, rx), Math.max(0.001, ry), rot, 0, Math.PI * 2);
  return p;
}

export function rrectPath(x: number, y: number, w: number, h: number, r: number): Path2D {
  const p = new Path2D();
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  p.moveTo(x + rr, y);
  p.arcTo(x + w, y, x + w, y + h, rr);
  p.arcTo(x + w, y + h, x, y + h, rr);
  p.arcTo(x, y + h, x, y, rr);
  p.arcTo(x, y, x + w, y, rr);
  p.closePath();
  return p;
}

/** The top garment: a soft bell from shoulders to hips. `f` narrows it in profile; `k` insets it for stitching. */
export function topPath(m: Metrics, k: number, f = 1): Path2D {
  const tw = m.topHw * f - k;
  const hw = m.hemHw * f - k;
  const y0 = m.shoulderY + k;
  const y1 = m.hipY - k;
  const r = Math.min(0.07, tw * 0.6);
  const b = m.belly * f;
  const p = new Path2D();
  p.moveTo(-tw, y0 + r);
  p.quadraticCurveTo(-tw, y0, -tw + r, y0);
  p.lineTo(tw - r, y0);
  p.quadraticCurveTo(tw, y0, tw, y0 + r);
  p.bezierCurveTo(tw + b + (hw - tw) * 0.6, y0 + (y1 - y0) * 0.45, hw + b * 0.5, y1 - 0.09, hw, y1 - 0.035);
  p.quadraticCurveTo(hw, y1, hw - 0.05, y1);
  p.lineTo(-hw + 0.05, y1);
  p.quadraticCurveTo(-hw, y1, -hw, y1 - 0.035);
  p.bezierCurveTo(-hw - b * 0.5, y1 - 0.09, -tw - b - (hw - tw) * 0.6, y0 + (y1 - y0) * 0.45, -tw, y0 + r);
  p.closePath();
  return p;
}

/** Trousers or skirt: a rounded block from the hips to just above the feet. */
export function bottomPath(m: Metrics, k: number, f = 1): Path2D {
  const hw = m.legHw * f - k;
  return rrectPath(-hw, m.legTop + k, hw * 2, -0.07 - m.legTop - k * 2, 0.05);
}

export type MoodBucket = -1 | 0 | 1;

export function moodBucket(mood: number): MoodBucket {
  return mood > 0.25 ? 1 : mood < -0.25 ? -1 : 0;
}
