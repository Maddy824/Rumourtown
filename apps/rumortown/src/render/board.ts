/** Cached torn paper backing, with a fixed 24 CSS pixel margin at its prepared overview. */
import type { VillageMap } from '../sim/types.js';
import { hash, makeCanvas } from './grain.js';
import { INK, OAT, PAPER, rgba } from './palette.js';

export const BOARD_MARGIN = 24;
export const BOARD_PAD = 32;

export function* prepareBoard(map: VillageMap, z: number, scale: number, own: (canvas: HTMLCanvasElement) => void = () => {}): Generator<void, HTMLCanvasElement> {
  const w = map.width * z, h = map.height * z;
  const surf = makeCanvas((w + BOARD_PAD * 2) * scale, (h + BOARD_PAD * 2) * scale);
  own(surf.canvas);
  const ctx = surf.ctx;
  ctx.setTransform(scale, 0, 0, scale, BOARD_PAD * scale, BOARD_PAD * scale);
  const path = new Path2D();
  const edge = function* (x0: number, y0: number, x1: number, y1: number, nx: number, ny: number, seed: number): Generator<void> {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 7);
    for (let i = 0; i <= n; i++) {
      const jitter = (hash(i, seed, 2301) - .5) * 2.4;
      const x = x0 + (x1 - x0) * i / n + nx * jitter, y = y0 + (y1 - y0) * i / n + ny * jitter;
      if (seed === 0 && i === 0) path.moveTo(x, y); else path.lineTo(x, y);
      if (i % 16 === 0) yield;
    }
  };
  yield* edge(-24, -24, w + 24, -24, 0, 1, 0);
  yield* edge(w + 24, -24, w + 24, h + 24, 1, 0, 1);
  yield* edge(w + 24, h + 24, -24, h + 24, 0, 1, 2);
  yield* edge(-24, h + 24, -24, -24, 1, 0, 3);
  path.closePath();
  ctx.save(); ctx.shadowColor = rgba(INK, .3); ctx.shadowBlur = 6 * scale; ctx.shadowOffsetY = 3 * scale;
  ctx.fillStyle = PAPER; ctx.fill(path); ctx.restore();
  ctx.strokeStyle = rgba(OAT, .8); ctx.lineWidth = 1; ctx.stroke(path);
  // Sparse fibres only in the visible paper border.
  ctx.save(); ctx.clip(path); ctx.strokeStyle = rgba(INK, .07); ctx.lineWidth = .6;
  for (let i = 0; i < 100; i++) {
    const vertical = i % 2 === 0;
    const side = i % 4 < 2;
    const x = vertical ? (side ? -18 : w + 8) + hash(i, 1, 2302) * 9 : hash(i, 2, 2302) * w;
    const y = vertical ? hash(i, 3, 2302) * h : (side ? -18 : h + 8) + hash(i, 4, 2302) * 9;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 2, y + .5); ctx.stroke();
    if (i % 12 === 0) yield;
  }
  ctx.restore();
  return surf.canvas;
}
