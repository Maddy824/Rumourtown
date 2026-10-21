/**
 * Room floors: a pale felt per kind of room, a floor pattern (boards, checker or flagstones) and
 * one flat felt furnishing, so a chapel reads differently from a bakery at a glance.
 */
import type { TileKind, VillageMap } from '../sim/types.js';
import { BERRY, DENIM, FELT, INK, MOSS, MUSTARD, OAT, PAPER, darken, lighten, mix, rgba } from './palette.js';
import { hash } from './grain.js';
import { traceContours, type Inside } from './regions.js';
import { feltPieceSteps, roundRectPath, runningStitch } from './felt.js';
import type { Building } from './buildings.js';

const TINT = {
  rose: mix(PAPER, BERRY, 0.13),
  butter: mix(PAPER, MUSTARD, 0.26),
  sage: mix(PAPER, MOSS, 0.2),
  sky: mix(PAPER, DENIM, 0.16),
  warm: mix(OAT, BERRY, 0.1),
  stone: mix(OAT, INK, 0.13),
  flour: mix(PAPER, OAT, 0.45),
};

type Pattern = 'boards' | 'checker' | 'flags';

function floorFor(b: Building): { tint: string; pattern: Pattern } {
  switch (b.kind) {
    case 'bakery':
      return { tint: TINT.butter, pattern: 'checker' };
    case 'inn':
      return { tint: TINT.warm, pattern: 'boards' };
    case 'chapel':
      return { tint: TINT.sky, pattern: 'flags' };
    case 'school':
      return { tint: TINT.sage, pattern: 'boards' };
    case 'shop':
      return { tint: TINT.butter, pattern: 'boards' };
    case 'smithy':
      return { tint: TINT.stone, pattern: 'flags' };
    case 'mill':
      return { tint: TINT.flour, pattern: 'flags' };
    default: {
      const tints = [TINT.rose, TINT.butter, TINT.sage, TINT.sky];
      return { tint: tints[Math.floor(hash(b.x, b.y, 401) * tints.length)] as string, pattern: 'boards' };
    }
  }
}

const isRoomTile = (t: TileKind | undefined) => t === 'floor' || t === 'wall' || t === 'door';

/** Paints every room's floor into the ground layer. Called by the ground painter at the right depth. */
export function* paintRoomsSteps(ctx: CanvasRenderingContext2D, map: VillageMap, buildings: readonly Building[], z: number, s: number): Generator<void> {
  const u = z / 32;
  const W = map.width;
  const H = map.height;
  const tileAt = (x: number, y: number) => (x >= 0 && y >= 0 && x < W && y < H ? map.tiles[y * W + x] : undefined);
  const covered = new Uint8Array(W * H);
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i] as Building;
    yield;
    const inside: Inside = (x, y) => x >= b.x && y >= b.y && x < b.x + b.w && y < b.y + b.h && isRoomTile(tileAt(x, y));
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) if (inside(x, y)) covered[y * W + x] = 1;
    const f = floorFor(b);
    const shape = yield* feltPieceSteps(ctx, traceContours(W, H, inside, 1), inside, map, z, s, { fill: f.tint, light: lighten(f.tint, 0.45), dark: darken(f.tint, 0.1), thread: darken(f.tint, 0.3), radius: 3, lift: 0.75, fibres: 9, stitch: false, fuzz: false, seed: 61 + i });
    if (u < 0.4) continue;
    yield;
    floorPattern(ctx, shape, b, f, z);
    yield;
    furnish(ctx, b, map, f.tint, z, s);
  }
  const stray: Inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !covered[y * W + x] && isRoomTile(tileAt(x, y));
  const strayContours = traceContours(W, H, stray, 1);
  if (strayContours.length) yield* feltPieceSteps(ctx, strayContours, stray, map, z, s, { fill: FELT.floor, light: lighten(FELT.floor, 0.4), dark: darken(FELT.floor, 0.1), thread: FELT.floorLine, radius: 3, lift: 0.7, fibres: 9, stitch: false, fuzz: false, seed: 97 });
}

function floorPattern(ctx: CanvasRenderingContext2D, shape: Path2D, b: Building, f: { tint: string; pattern: Pattern }, z: number): void {
  const u = z / 32;
  const line = darken(f.tint, 0.2);
  ctx.save();
  ctx.clip(shape);
  ctx.lineCap = 'round';
  if (f.pattern === 'boards') {
    const p = new Path2D();
    for (let row = 0; row < b.h * 2; row++) {
      const y = (b.y + row * 0.5) * z;
      p.moveTo(b.x * z, y);
      p.lineTo((b.x + b.w) * z, y);
      const off = row % 2 ? 0.75 : 0.25;
      for (let x = b.x + off; x < b.x + b.w; x += 1.5) {
        p.moveTo((x + hash(row, Math.floor(x), 411) * 0.3) * z, y);
        p.lineTo((x + hash(row, Math.floor(x), 411) * 0.3) * z, y + 0.5 * z);
      }
    }
    ctx.lineWidth = 0.9 * u;
    ctx.strokeStyle = rgba(line, 0.6);
    ctx.stroke(p);
  } else if (f.pattern === 'checker') {
    ctx.fillStyle = rgba(lighten(f.tint, 0.55), 0.85);
    for (let j = 0; j < b.h * 2; j++) {
      for (let i = 0; i < b.w * 2; i++) {
        if ((i + j) % 2) continue;
        ctx.fillRect((b.x + i * 0.5) * z, (b.y + j * 0.5) * z, 0.5 * z, 0.5 * z);
      }
    }
    const grid = new Path2D();
    for (let i = 0; i <= b.w * 2; i++) {
      grid.moveTo((b.x + i * 0.5) * z, b.y * z);
      grid.lineTo((b.x + i * 0.5) * z, (b.y + b.h) * z);
    }
    for (let j = 0; j <= b.h * 2; j++) {
      grid.moveTo(b.x * z, (b.y + j * 0.5) * z);
      grid.lineTo((b.x + b.w) * z, (b.y + j * 0.5) * z);
    }
    runningStitch(ctx, grid, rgba(line, 0.7), u, 2.2, 2.4, 0.8);
  } else {
    const p = new Path2D();
    for (let j = 0; j < b.h * 2; j++) {
      for (let i = 0; i < b.w * 2; i++) {
        const h = hash(b.x * 2 + i, b.y * 2 + j, 421);
        const x = (b.x + i * 0.5 + 0.04 + (j % 2) * 0.12) * z;
        const y = (b.y + j * 0.5 + 0.04) * z;
        roundRectPath(p, x, y, (0.42 - h * 0.08) * z, 0.42 * z, (2 + h * 3) * u);
      }
    }
    ctx.lineWidth = 0.85 * u;
    ctx.strokeStyle = rgba(line, 0.38);
    ctx.stroke(p);
  }
  ctx.restore();
}

/** A flat felt piece on the floor: drop shadow, fill, stitched border. `build(inset)` makes its outline. */
function feltRug(ctx: CanvasRenderingContext2D, build: (inset: number) => Path2D, colour: string, z: number, s: number, inner = true): void {
  const u = z / 32;
  const shape = build(0);
  ctx.save();
  ctx.shadowColor = rgba(INK, 0.35);
  ctx.shadowBlur = 2.2 * u * s;
  ctx.shadowOffsetX = 0.6 * u * s;
  ctx.shadowOffsetY = 1.3 * u * s;
  ctx.fillStyle = colour;
  ctx.fill(shape);
  ctx.restore();
  ctx.lineWidth = 0.7 * u;
  ctx.strokeStyle = rgba(darken(colour, 0.4), 0.6);
  ctx.stroke(shape);
  if (u < 0.45) return;
  runningStitch(ctx, build(2.6 * u), mix(colour, PAPER, 0.62), u, 2.4, 2, 0.95);
  if (inner) runningStitch(ctx, build(6.5 * u), rgba(mix(colour, PAPER, 0.45), 0.85), u, 1.8, 2.2, 0.8);
}

function doorColumn(b: Building, map: VillageMap): number {
  for (let x = b.x; x < b.x + b.w; x++) if (map.tiles[(b.y + b.h - 1) * map.width + x] === 'door') return x;
  return b.x + Math.floor(b.w / 2);
}

function furnish(ctx: CanvasRenderingContext2D, b: Building, map: VillageMap, floor: string, z: number, s: number): void {
  const u = z / 32;
  const fx = b.x + 1;
  const fy = b.y + 1;
  const fw = b.w - 2;
  const fh = b.h - 2;
  if (fw < 1 || fh < 1) return;
  const cx = (fx + fw / 2) * z;
  const cy = (fy + fh / 2) * z;
  const pick = (list: string[], salt: number) => list[Math.floor(hash(b.x, b.y, salt) * list.length)] as string;
  // Furnishings stay quiet: dyes muted toward the floor, and no red, which belongs to the thread.
  const quiet = (c: string, t = 0.42) => mix(c, floor, t);
  const runner = (colour: string) => {
    const dx = (doorColumn(b, map) + 0.5) * z;
    const w = 0.78 * z;
    const top = (fy + 0.15) * z;
    const bottom = (b.y + b.h - 0.55) * z;
    feltRug(ctx, (k) => {
      const p = new Path2D();
      roundRectPath(p, dx - w / 2 + k, top + k, w - k * 2, bottom - top - k * 2, 3 * u);
      return p;
    }, colour, z, s, false);
    if (u >= 0.45) {
      const fringe = new Path2D();
      for (let x = dx - w / 2 + 2 * u; x <= dx + w / 2 - 2 * u; x += 2.6 * u) {
        fringe.moveTo(x, top);
        fringe.lineTo(x, top - 2.4 * u);
      }
      ctx.lineWidth = 0.8 * u;
      ctx.strokeStyle = mix(colour, PAPER, 0.5);
      ctx.stroke(fringe);
    }
  };
  switch (b.kind) {
    case 'home': {
      const colour = quiet(pick([DENIM, MUSTARD, MOSS, mix(DENIM, MOSS, 0.5)], 431));
      const rx = (fw / 2) * 0.68 * z;
      const ry = (fh / 2) * 0.64 * z;
      feltRug(ctx, (k) => {
        const p = new Path2D();
        p.ellipse(cx, cy, Math.max(1, rx - k), Math.max(1, ry - k), 0, 0, Math.PI * 2);
        return p;
      }, colour, z, s);
      return;
    }
    case 'inn':
      runner(quiet(mix(MOSS, DENIM, 0.3), 0.3));
      for (const side of [-1, 1]) {
        const tx = (doorColumn(b, map) + 0.5 + side * 1.9) * z;
        feltRug(ctx, (k) => {
          const p = new Path2D();
          p.arc(tx, cy, Math.max(1, 0.62 * z - k), 0, Math.PI * 2);
          return p;
        }, quiet(MUSTARD), z, s);
      }
      return;
    case 'chapel':
      runner(quiet(DENIM, 0.3));
      feltRug(ctx, (k) => {
        const p = new Path2D();
        roundRectPath(p, cx - 1.1 * z + k, (fy + 0.1) * z + k, 2.2 * z - k * 2, 0.55 * z - k * 2, 2 * u);
        return p;
      }, quiet(MUSTARD, 0.35), z, s, false);
      return;
    case 'school':
    case 'shop': {
      const colour = b.kind === 'school' ? quiet(MOSS, 0.35) : quiet(mix(MUSTARD, DENIM, 0.12), 0.4);
      const w = Math.max(1, fw - 0.9) * z;
      const h = Math.max(0.8, fh - 0.7) * z;
      feltRug(ctx, (k) => {
        const p = new Path2D();
        roundRectPath(p, cx - w / 2 + k, cy - h / 2 + k, w - k * 2, h - k * 2, 3 * u);
        return p;
      }, colour, z, s);
      return;
    }
    case 'mill': {
      const r = Math.min(fw, fh) * 0.42 * z;
      feltRug(ctx, (k) => {
        const p = new Path2D();
        p.arc(cx, cy, Math.max(1, r - k), 0, Math.PI * 2);
        return p;
      }, FELT.stone, z, s, false);
      if (u >= 0.45) {
        const grooves = new Path2D();
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          grooves.moveTo(cx + Math.cos(a) * r * 0.3, cy + Math.sin(a) * r * 0.3);
          grooves.lineTo(cx + Math.cos(a + 0.35) * r * 0.85, cy + Math.sin(a + 0.35) * r * 0.85);
        }
        ctx.lineWidth = 0.9 * u;
        ctx.strokeStyle = rgba(FELT.stoneDark, 0.8);
        ctx.stroke(grooves);
        ctx.fillStyle = FELT.stoneDark;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.16, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    default:
      return;
  }
}

