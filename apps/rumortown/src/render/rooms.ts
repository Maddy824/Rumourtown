/**
 * Room floors: a pale felt per kind of room, a floor pattern (boards, checker or flagstones) and
 * cached cut-out furniture, so a chapel reads differently from a bakery at a glance.
 */
import type { TileKind, VillageMap } from '../sim/types.js';
import { BERRY, DENIM, FELT, INK, MOSS, MUSTARD, OAT, PAPER, darken, lighten, mix, rgba } from './palette.js';
import { hash } from './grain.js';
import { traceContours, type Inside } from './regions.js';
import { feltPieceSteps, roundRectPath, runningStitch } from './felt.js';
import type { Building } from './buildings.js';
import { paintInterior, roomRect } from './room-cache.js';

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
export function* paintRoomsSteps(ctx: CanvasRenderingContext2D, map: VillageMap, buildings: readonly Building[], z: number, s: number, capture?: (b: Building) => void): Generator<void> {
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
    yield;
    floorPattern(ctx, shape, b, f, z);
    yield;
    capture?.(b);
    paintInterior(ctx, b, roomRect(b, z), z, 0, false);
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

