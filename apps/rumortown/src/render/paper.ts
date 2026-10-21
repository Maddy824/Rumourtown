/** Small paper signs are fully rasterized at resize, including text and torn fibres. */
import { makeCanvas } from './grain.js';
import { INK, MUSTARD, PAPER, rgba } from './palette.js';

export interface PaperTag { img: HTMLCanvasElement; w: number; h: number }

export function paperTag(text: string, fontSize: number, dpr: number, grain: HTMLCanvasElement, minWidth = 0): PaperTag {
  const measure = makeCanvas(1, 1).ctx;
  const font = `650 ${fontSize}px 'Bricolage Grotesque', sans-serif`;
  measure.font = font;
  const w = Math.ceil(Math.max(minWidth, measure.measureText(text).width + 18)), h = fontSize + 9;
  const surf = makeCanvas((w + 2) * dpr, (h + 2) * dpr);
  const ctx = surf.ctx;
  ctx.setTransform(dpr, 0, 0, dpr, dpr, dpr);
  const edge = new Path2D();
  edge.moveTo(0, .5);
  for (let x = 0; x <= w; x += 3) edge.lineTo(x, x % 2 ? 0 : 1);
  edge.lineTo(w, h);
  for (let x = w; x >= 0; x -= 3) edge.lineTo(x, h - (x % 2 ? 0 : 1));
  edge.closePath();
  ctx.fillStyle = PAPER; ctx.fill(edge);
  ctx.save(); ctx.clip(edge); const texture = ctx.createPattern(grain, 'repeat');
  if (texture) { ctx.fillStyle = texture; ctx.globalAlpha = .10; ctx.fillRect(0, 0, w, h); }
  ctx.restore();
  ctx.strokeStyle = rgba(INK, .28); ctx.lineWidth = 1; ctx.stroke(edge);
  ctx.save(); ctx.setLineDash([2, 2]); ctx.strokeStyle = rgba(INK, .42); ctx.lineWidth = .7; ctx.strokeRect(3, 3, w - 6, h - 6); ctx.restore();
  ctx.fillStyle = MUSTARD; ctx.beginPath(); ctx.arc(5, h / 2, 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = rgba(PAPER, .95); ctx.beginPath(); ctx.arc(4.4, h / 2 - .7, .65, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = INK; ctx.font = font; ctx.textAlign = 'center'; ctx.fillText(text, w / 2 + 2, fontSize + 1);
  return { img: surf.canvas, w: w + 2, h: h + 2 };
}
