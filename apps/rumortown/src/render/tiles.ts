/**
 * The ground layer: a felt sheet with cut felt pieces laid on it (river, fields, paths, room
 * floors), each with a soft shadow, dye mottling, fibres, fuzzy edges and a running stitch.
 * Painted once per zoom level into an offscreen canvas.
 */
import type { TileKind, VillageMap } from '../sim/types.js';
import { BERRY, FELT, INK, MUSTARD, PAPER, darken, mix, rgba } from './palette.js';
import { hash, seeded, makeCanvas } from './grain.js';
import { components, traceContours, type Inside } from './regions.js';
import { feltPieceSteps, fibreFieldSteps, groundOf, mottleSteps, placeAt, roundRectPath, sampler, type Ground, type Standing } from './felt.js';
import { paintRiver } from './water.js';
import { paintDistricts, paintWayfinding, oldVillagePath } from './wayfinding.js';
import { bridge, well } from './landmarks.js';

/** Tiles of felt sheet beyond the map edge, seen only at the far zoom. */
export const SHEET_OVERHANG = 0.3;
/** Tiles of transparent canvas around the sheet, room for its shadow. */
export const LAYER_MARGIN = 0.7;

/**
 * Paints the whole ground: the sheet, river, fields, paths, then `rooms` (floors, from the
 * buildings module) at the right depth, then the bridge, well and fixed decorations. Origin = tile (0, 0).
 */
export function* paintGroundSteps(ctx: CanvasRenderingContext2D, map: VillageMap, z: number, s: number, rooms?: () => Generator<void>): Generator<void> {
  const u = z / 32;
  const g = groundOf(map);
  const k = sampler(map);
  const W = map.width;
  const H = map.height;
  const ov = SHEET_OVERHANG * z;

  // The felt sheet on the table, with its own shadow.
  const sheet = new Path2D();
  roundRectPath(sheet, -ov, -ov, W * z + ov * 2, H * z + ov * 2, 5 * u);
  ctx.save();
  ctx.shadowColor = rgba(INK, 0.5);
  ctx.shadowBlur = 9 * u * s;
  ctx.shadowOffsetX = 2 * u * s;
  ctx.shadowOffsetY = 4 * u * s;
  ctx.fillStyle = FELT.grass;
  ctx.fill(sheet);
  ctx.restore();

  ctx.save();
  ctx.clip(sheet);
  const all: Inside = () => true;
  yield* mottleSteps(ctx, map, all, z, FELT.grassLight, FELT.grassDark, 11);
  if (u >= 0.35) yield* fibreFieldSteps(ctx, map, all, z, FELT.grassLight, FELT.grassDark, 26, 12);

  yield* paintDistricts(ctx, map, z);
  // Two mosses show through district dyes; flowers and stones sit above those dyes.
  yield* grassMoss(ctx, map, z);
  if (u >= .5) yield* grassDetails(ctx, map, g, k, z);

  const isField: Inside = (x, y) => g(x, y) === 'field';
  const isPath: Inside = (x, y) => g(x, y) === 'path';

  yield* paintRiver(ctx, map, z);

  const fieldComps = components(W, H, isField);
  for (let i = 0; i < fieldComps.length; i++) {
    const comp = fieldComps[i] as (typeof fieldComps)[number];
    const set = new Set(comp.tiles);
    const inComp: Inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H && set.has(y * W + x);
    const contours = traceContours(W, H, inComp, 2);
    yield* feltPieceSteps(ctx, contours, inComp, map, z, s, { fill: FELT.soil, light: mix(FELT.soil, MUSTARD, 0.25), dark: darken(FELT.soil, 0.25), thread: FELT.soilThread, radius: 7, lift: 0.8, fibres: 16, stitch: true, fuzz: true, seed: 31 + i });
    // Crops are cached separately and blitted on the dynamic layer for wind.
  }

  const path = traceContours(W, H, isPath, 2);
  if (path.length) {
    const shape = yield* feltPieceSteps(ctx, path, isPath, map, z, s, { fill: FELT.path, light: FELT.pathLight, dark: darken(FELT.path, 0.16), thread: FELT.pathThread, radius: 10, lift: 0.85, fibres: 18, stitch: true, fuzz: true, seed: 51 });
    if (u >= 0.4) yield* cobbles(ctx, shape, map, isPath, z);
    if (u >= 0.5) yield* pathPebbles(ctx, map, isPath, z);
  }

  if (rooms) yield* rooms();

  for (const comp of components(W, H, (x, y) => k(x, y) === 'bridge')) { bridge(ctx, comp, k, z, s); yield; }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) if (k(x, y) === 'well') { puddles(ctx, x, y, map, z); well(ctx, x, y, z, s); yield; }
    yield;
  }

  yield* paintWayfinding(ctx, map, z);
  ctx.restore();
  if (u >= 0.3) yield* sheetEdge(ctx, -ov, -ov, W * z + ov * 2, H * z + ov * 2, u);
}

/** Blanket stitch around the village sheet: a line along the edge with ticks running off it. */
function* sheetEdge(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, u: number): Generator<void> {
  const inset = 5 * u;
  const step = 7 * u;
  const p = new Path2D();
  const edge = function* (ax: number, ay: number, bx: number, by: number, nx: number, ny: number): Generator<void> {
    const len = Math.hypot(bx - ax, by - ay);
    const n = Math.max(1, Math.round(len / step));
    for (let i = 0; i < n; i++) {
      if (i % 16 === 0) yield;
      const t0 = i / n;
      const t1 = (i + 1) / n;
      const px = ax + (bx - ax) * t0;
      const py = ay + (by - ay) * t0;
      p.moveTo(px + nx * inset, py + ny * inset);
      p.lineTo(px + nx * 0.8 * u, py + ny * 0.8 * u);
      p.moveTo(px + nx * inset, py + ny * inset);
      p.lineTo(ax + (bx - ax) * t1 + nx * inset, ay + (by - ay) * t1 + ny * inset);
    }
  };
  yield* edge(x, y, x + w, y, 0, 1);
  yield* edge(x + w, y, x + w, y + h, -1, 0);
  yield* edge(x + w, y + h, x, y + h, 0, -1);
  yield* edge(x, y + h, x, y, 1, 0);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.2 * u;
  ctx.strokeStyle = rgba(INK, 0.25);
  ctx.translate(0.4 * u, 0.7 * u);
  ctx.stroke(p);
  ctx.translate(-0.4 * u, -0.7 * u);
  ctx.strokeStyle = mix(FELT.path, PAPER, 0.4);
  ctx.stroke(p);
  ctx.restore();
}

/** Small stitched tufts and French-knot flowers, sparse and quiet. */
function* grassDetails(ctx: CanvasRenderingContext2D, map: VillageMap, g: (x: number, y: number) => Ground, k: (x: number, y: number) => TileKind, z: number): Generator<void> {
  const u = z / 32;
  const tufts = new Path2D();
  const knots: { x: number; y: number; c: string }[] = [];
  const flowerColours = [PAPER, MUSTARD, mix(BERRY, PAPER, 0.25)];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      yield;
      if (g(x, y) !== 'grass' || k(x, y) !== 'grass') continue;
      const h = hash(x, y, 71);
      const px = (x + 0.2 + hash(x, y, 72) * 0.6) * z;
      const py = (y + 0.25 + hash(x, y, 73) * 0.6) * z;
      if (h < 0.13) {
        for (let i = -1; i <= 1; i++) {
          tufts.moveTo(px + i * 1.6 * u, py);
          tufts.lineTo(px + i * 3.2 * u, py - (3.6 - Math.abs(i)) * u);
        }
      } else if (h > .94) {
        ctx.fillStyle = rgba(FELT.stone, .65); ctx.beginPath(); ctx.ellipse(px, py, 2.2 * u, 1.4 * u, h * 3, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = rgba(PAPER, .5); ctx.lineWidth = .7 * u; ctx.beginPath(); ctx.moveTo(px - u, py - u); ctx.lineTo(px + u, py - u); ctx.stroke();
      } else if (h < 0.165) {
        const c = flowerColours[Math.floor(hash(x, y, 74) * flowerColours.length)] as string;
        for (let i = 0; i < 3; i++) knots.push({ x: px + Math.cos(i * 2.1 + h * 40) * 2.6 * u, y: py + Math.sin(i * 2.1 + h * 40) * 2.2 * u, c });
      }
    }
  }
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.1 * u;
  ctx.strokeStyle = FELT.grassThread;
  ctx.stroke(tufts);
  for (const n of knots) {
    yield;
    ctx.fillStyle = rgba(INK, 0.25);
    ctx.beginPath();
    ctx.arc(n.x + 0.4 * u, n.y + 0.6 * u, 1.35 * u, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = n.c;
    ctx.beginPath();
    ctx.arc(n.x, n.y, 1.35 * u, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Crop rows across a field: raised felt strips of wheat (with stalk stitches) or greens (with knots). */
function* cropRows(ctx: CanvasRenderingContext2D, shape: Path2D, comp: { x: number; y: number; w: number; h: number }, z: number, wheat: boolean, seed: number): Generator<void> {
  const u = z / 32;
  const horizontal = comp.w >= comp.h;
  const span = horizontal ? comp.h : comp.w;
  const along = horizontal ? comp.w : comp.h;
  const pitch = 0.5;
  const rows = Math.max(1, Math.floor((span - 0.3) / pitch));
  const offset = (span - rows * pitch) / 2 + (pitch - 0.3) / 2;
  const fill = wheat ? FELT.wheat : FELT.greens;
  const dark = wheat ? FELT.wheatDark : FELT.greensDark;
  const rnd = seeded(seed);
  ctx.save();
  ctx.clip(shape);
  const strips = new Path2D();
  const ticks = new Path2D();
  const knots: { x: number; y: number; r: number }[] = [];
  for (let r = 0; r < rows; r++) {
    yield;
    const a0 = 0.32 + rnd() * 0.08;
    const a1 = along - 0.32 - rnd() * 0.08;
    const b = offset + r * pitch;
    const t = 0.3;
    const [x, y, w, h] = horizontal
      ? [(comp.x + a0) * z, (comp.y + b) * z, (a1 - a0) * z, t * z]
      : [(comp.x + b) * z, (comp.y + a0) * z, t * z, (a1 - a0) * z];
    roundRectPath(strips, x, y, w, h, (t * z) / 2);
    const len = (a1 - a0) * z;
    if (wheat) {
      for (let d = 3 * u; d < len - 2 * u; d += 3.4 * u) {
        yield;
        const jitter = (rnd() - 0.5) * 1.2 * u;
        if (horizontal) {
          ticks.moveTo(x + d + jitter, y + h * 0.78);
          ticks.lineTo(x + d + jitter + 0.8 * u, y + h * 0.22);
        } else {
          ticks.moveTo(x + w * 0.22, y + d + jitter);
          ticks.lineTo(x + w * 0.78, y + d + jitter + 0.8 * u);
        }
      }
    } else {
      for (let d = 4 * u; d < len - 3 * u; d += 6.5 * u) {
        yield;
        knots.push(horizontal ? { x: x + d + (rnd() - 0.5) * 1.5 * u, y: y + h / 2, r: (2.6 + rnd()) * u } : { x: x + w / 2, y: y + d + (rnd() - 0.5) * 1.5 * u, r: (2.6 + rnd()) * u });
      }
    }
  }
  ctx.save();
  ctx.shadowColor = rgba(INK, 0.35);
  ctx.shadowBlur = 1.6 * u * (ctx.getTransform().a || 1);
  ctx.shadowOffsetY = 1.2 * u * (ctx.getTransform().a || 1);
  ctx.fillStyle = fill;
  ctx.fill(strips);
  ctx.restore();
  if (u >= 0.45) {
    ctx.lineCap = 'round';
    ctx.lineWidth = 0.9 * u;
    ctx.strokeStyle = dark;
    ctx.stroke(ticks);
    for (const n of knots) {
      yield;
      ctx.fillStyle = mix(FELT.greens, PAPER, 0.18);
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = dark;
      ctx.lineWidth = 0.8 * u;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r * 0.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/**
 * Felt cobbles on the village square: rounded patches a shade darker than the path, each with
 * a lighter upper edge, so the square reads as paved and the lanes as plain felt.
 */
function* cobbles(ctx: CanvasRenderingContext2D, shape: Path2D, map: VillageMap, isPath: Inside, z: number): Generator<void> {
  const u = z / 32;
  const plazas = map.places.filter((p) => (p.kind === 'square' && p.id !== 'riverside' && p.rect.w > 1 && p.rect.h > 1) || p.kind === 'well');
  if (!plazas.length) return;
  const fill = new Path2D();
  const rim = new Path2D();
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      yield;
      if (!isPath(x, y) || !oldVillagePath(x, y) && !plazas.some((p) => x >= p.rect.x && y >= p.rect.y && x < p.rect.x + p.rect.w && y < p.rect.y + p.rect.h)) continue;
      for (let j = 0; j < 3; j++) {
        for (let i = 0; i < 3; i++) {
          const h = hash(x * 3 + i, y * 3 + j, 131);
          if (h < 0.18) continue;
          const cx = (x + (i + 0.5) / 3 + (hash(x * 3 + i, y * 3 + j, 132) - 0.5) * 0.08 + (j % 2 ? 0.08 : -0.04)) * z;
          const cy = (y + (j + 0.5) / 3 + (hash(x * 3 + i, y * 3 + j, 133) - 0.5) * 0.06) * z;
          const rx = (3.6 + h * 1.4) * u;
          const ry = (3.0 + hash(x * 3 + i, y * 3 + j, 134) * 0.9) * u;
          fill.moveTo(cx + rx, cy);
          fill.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          rim.moveTo(cx - rx * 0.75, cy - ry * 0.45);
          rim.quadraticCurveTo(cx - rx * 0.2, cy - ry * 1.05, cx + rx * 0.55, cy - ry * 0.7);
        }
      }
    }
  }
  ctx.save();
  ctx.clip(shape);
  ctx.fillStyle = rgba(darken(FELT.path, 0.2), 0.5);
  ctx.fill(fill);
  ctx.lineCap = 'round';
  ctx.lineWidth = 0.9 * u;
  ctx.strokeStyle = rgba(FELT.pathLight, 0.75);
  ctx.setLineDash([2 * u, 1.5 * u]);
  ctx.stroke(rim);
  ctx.restore();
}

/** A few felt pebbles on the paths. */
function* pathPebbles(ctx: CanvasRenderingContext2D, map: VillageMap, isPath: Inside, z: number): Generator<void> {
  const u = z / 32;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      yield;
      if (!isPath(x, y)) continue;
      // Quiet rubbed edges on lanes; the cut felt still carries the running stitch.
      if (hash(x, y, 2411) < .3) for (const dx of [-1, 1]) {
        if (isPath(x + dx, y)) continue;
        ctx.fillStyle = rgba(FELT.pathLight, .65); ctx.beginPath();
        ctx.ellipse((x + (dx < 0 ? .12 : .88)) * z, (y + .5) * z, .07 * z, .22 * z, 0, 0, Math.PI * 2); ctx.fill();
      }
      if (hash(x, y, 91) > .09) continue;
      const cx = (x + 0.25 + hash(x, y, 92) * 0.5) * z;
      const cy = (y + 0.25 + hash(x, y, 93) * 0.5) * z;
      ctx.fillStyle = FELT.pathDark;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 2.4 * u, 1.7 * u, hash(x, y, 94) * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Subtle two-tone moss patches remain in the ground cache. */
function* grassMoss(ctx: CanvasRenderingContext2D, map: VillageMap, z: number): Generator<void> {
  ctx.save(); ctx.fillStyle = darken(FELT.grass, .06);
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) if (map.tiles[y * map.width + x] === 'grass' && hash(x, y, 2201) < .35) {
      ctx.beginPath(); ctx.ellipse((x + .5) * z, (y + .5) * z, .48 * z, .34 * z, hash(x, y, 2202) * 3, 0, Math.PI * 2); ctx.fill();
    }
    yield;
  }
  ctx.restore();
}

function puddles(ctx: CanvasRenderingContext2D, x: number, y: number, map: VillageMap, z: number): void {
  for (const [dx, dy] of [[1, 0], [-1, 1]]) {
    const tile = map.tiles[(y + dy!) * map.width + x + dx!];
    if (tile !== 'path' && tile !== 'grass') continue;
    const px = (x + dx! + .5) * z, py = (y + dy! + .6) * z;
    ctx.fillStyle = rgba(FELT.waterLight, .4); ctx.beginPath(); ctx.ellipse(px, py, .32 * z, .13 * z, -.15, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = rgba(PAPER, .6); ctx.lineWidth = Math.max(.7, z * .025); ctx.beginPath(); ctx.ellipse(px, py, .22 * z, .07 * z, -.15, Math.PI, Math.PI * 1.8); ctx.stroke();
  }
}

/** Whole field sprites keep every stalk cached; wind only changes the blit transform. */
export function* buildCropsSteps(map: VillageMap, z: number, scale: number): Generator<void, Standing[]> {
  const g = groundOf(map);
  const out: Standing[] = [];
  const comps = components(map.width, map.height, (x, y) => g(x, y) === 'field');
  for (let i = 0; i < comps.length; i++) {
    const comp = comps[i]!;
    const surf = makeCanvas(comp.w * z * scale, comp.h * z * scale);
    surf.ctx.setTransform(scale, 0, 0, scale, -comp.x * z * scale, -comp.y * z * scale);
    const shape = new Path2D();
    for (const index of comp.tiles) { shape.rect((index % map.width) * z, Math.floor(index / map.width) * z, z, z); yield; }
    const place = placeAt(map.places, comp.x + Math.floor(comp.w / 2), comp.y + Math.floor(comp.h / 2), p => p.kind === 'field');
    yield* cropRows(surf.ctx, shape, comp, z, place ? !/south/.test(place.id) : i % 2 === 0, 41 + i);
    out.push({ img: surf.canvas, x: comp.x * z, y: comp.y * z, w: comp.w * z, h: comp.h * z, sortY: comp.y + comp.h, wind: comp.x * 71 + comp.y });
  }
  return out;
}
