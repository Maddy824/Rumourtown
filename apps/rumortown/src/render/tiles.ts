/**
 * The ground layer: a felt sheet with cut felt pieces laid on it (river, fields, paths, room
 * floors), each with a soft shadow, dye mottling, fibres, fuzzy edges and a running stitch.
 * Painted once per zoom level into an offscreen canvas. Trees are returned separately as
 * standing pieces so villagers can walk behind them.
 */
import type { Place, TileKind, VillageMap } from '../sim/types.js';
import { BERRY, FELT, INK, MUSTARD, PAPER, darken, lighten, mix, rgba } from './palette.js';
import { addFibres, hash, makeCanvas, seeded, softBlob } from './grain.js';
import { components, contourPath, forEachEdge, traceContours, type Contour, type Inside } from './regions.js';

/** Tiles of felt sheet beyond the map edge, seen only at the far zoom. */
export const SHEET_OVERHANG = 0.3;
/** Tiles of transparent canvas around the sheet, room for its shadow. */
export const LAYER_MARGIN = 0.7;

/** A piece that stands up from the board and is depth-sorted with villagers. */
export interface Standing {
  img: HTMLCanvasElement;
  /** Top-left in CSS pixels from the map origin, at the layer's zoom. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Depth line in tiles: things whose feet are below it draw in front. */
  sortY: number;
}

export type Ground = 'grass' | 'path' | 'water' | 'field' | 'room';

export function sampler(map: VillageMap): (x: number, y: number) => TileKind {
  const w = map.width;
  const h = map.height;
  return (x, y) => {
    const cx = x < 0 ? 0 : x >= w ? w - 1 : x;
    const cy = y < 0 ? 0 : y >= h ? h - 1 : y;
    return map.tiles[cy * w + cx] ?? 'grass';
  };
}

/** What felt lies under each tile. Wells and trees take the ground most of their neighbours have. */
export function groundOf(map: VillageMap): (x: number, y: number) => Ground {
  const k = sampler(map);
  const grid: Ground[] = new Array(map.width * map.height);
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const t = k(x, y);
      let g: Ground = 'grass';
      if (t === 'path') g = 'path';
      else if (t === 'water' || t === 'bridge') g = 'water';
      else if (t === 'field') g = 'field';
      else if (t === 'floor' || t === 'wall' || t === 'door') g = 'room';
      else if (t === 'well' || t === 'tree') {
        const around = [k(x - 1, y), k(x + 1, y), k(x, y - 1), k(x, y + 1)];
        const paths = around.filter((n) => n === 'path').length;
        const fields = around.filter((n) => n === 'field').length;
        const floors = around.filter((n) => n === 'floor').length;
        g = paths >= 2 ? 'path' : floors >= 2 ? 'room' : fields >= 2 ? 'field' : 'grass';
      }
      grid[y * map.width + x] = g;
    }
  }
  const w = map.width;
  const h = map.height;
  return (x, y) => grid[(y < 0 ? 0 : y >= h ? h - 1 : y) * w + (x < 0 ? 0 : x >= w ? w - 1 : x)] ?? 'grass';
}

function placeAt(places: readonly Place[], x: number, y: number, test: (p: Place) => boolean): Place | undefined {
  return places.find((p) => test(p) && x >= p.rect.x && y >= p.rect.y && x < p.rect.x + p.rect.w && y < p.rect.y + p.rect.h);
}

interface PieceStyle {
  fill: string;
  light: string;
  dark: string;
  thread: string;
  radius: number;
  /** Shadow strength 0..1. */
  lift: number;
  fibres: number;
  stitch: boolean;
  fuzz: boolean;
  seed: number;
}

/** One cut felt piece: shadow, fill, mottling, fibres, fuzzy edge, running stitch. */
function feltPiece(ctx: CanvasRenderingContext2D, contours: Contour[], inside: Inside, map: VillageMap, z: number, s: number, st: PieceStyle): Path2D {
  const u = z / 32;
  const shape = new Path2D();
  for (const c of contours) contourPath(shape, c, z, 0, st.radius * u);

  ctx.save();
  ctx.shadowColor = rgba(INK, 0.42 * st.lift);
  ctx.shadowBlur = 3.2 * u * s;
  ctx.shadowOffsetX = 0.7 * u * s;
  ctx.shadowOffsetY = 1.8 * u * s;
  ctx.fillStyle = st.fill;
  ctx.fill(shape);
  ctx.restore();

  ctx.save();
  ctx.clip(shape);
  mottle(ctx, map, inside, z, st.light, st.dark, st.seed);
  if (u >= 0.35 && st.fibres > 0) fibreField(ctx, map, inside, z, st.light, st.dark, st.fibres, st.seed + 1);
  ctx.restore();

  if (st.fuzz && u >= 0.45) edgeFuzz(ctx, contours, z, st.fill, st.light, st.seed + 2);
  if (st.stitch && u >= 0.4) {
    const stitch = new Path2D();
    for (const c of contours) contourPath(stitch, c, z, 3.6 * u, st.radius * u);
    runningStitch(ctx, stitch, st.thread, u);
  }
  return shape;
}

/** A running stitch: short dashes with round ends, slightly raised from the felt. */
export function runningStitch(ctx: CanvasRenderingContext2D, path: Path2D, color: string, u: number, dash = 3.4, gap = 2.6, width = 1.15): void {
  ctx.save();
  ctx.setLineDash([dash * u, gap * u]);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = width * u;
  ctx.strokeStyle = rgba(INK, 0.22);
  ctx.translate(0.35 * u, 0.6 * u);
  ctx.stroke(path);
  ctx.translate(-0.35 * u, -0.6 * u);
  ctx.strokeStyle = color;
  ctx.stroke(path);
  ctx.restore();
}

const blobCache = new Map<string, HTMLCanvasElement>();
function blob(color: string): HTMLCanvasElement {
  let b = blobCache.get(color);
  if (!b) {
    b = softBlob(color, 64);
    blobCache.set(color, b);
  }
  return b;
}

/** Dye variation: one soft blob per tile, keyed by a seeded hash, wider than the tile so no grid shows. */
function mottle(ctx: CanvasRenderingContext2D, map: VillageMap, inside: Inside, z: number, light: string, dark: string, seed: number): void {
  const lb = blob(light);
  const db = blob(dark);
  for (let y = -1; y <= map.height; y++) {
    for (let x = -1; x <= map.width; x++) {
      if (!inside(x, y)) continue;
      const h = hash(x, y, seed);
      const h2 = hash(x, y, seed + 17);
      const size = (1.6 + h2 * 1.5) * z;
      const cx = (x + 0.5 + (hash(x, y, seed + 3) - 0.5) * 0.8) * z;
      const cy = (y + 0.5 + (hash(x, y, seed + 5) - 0.5) * 0.8) * z;
      ctx.globalAlpha = 0.1 + Math.abs(h - 0.5) * 0.42;
      ctx.drawImage(h < 0.5 ? db : lb, cx - size / 2, cy - size / 2, size, size);
    }
  }
  ctx.globalAlpha = 1;
}

/** Fibres over every tile of a region, in two tones. `density` is fibres per tile at the close zoom. */
function fibreField(ctx: CanvasRenderingContext2D, map: VillageMap, inside: Inside, z: number, light: string, dark: string, density: number, seed: number): void {
  const u = z / 32;
  const rnd = seeded(seed * 7919 + 13);
  const pl = new Path2D();
  const pd = new Path2D();
  const n = Math.max(1, Math.round(density * u * u));
  for (let y = -1; y <= map.height; y++) {
    for (let x = -1; x <= map.width; x++) {
      if (!inside(x, y)) continue;
      addFibres(pl, x * z, y * z, z, z, n, rnd, 1.6 * u, 4.4 * u);
      addFibres(pd, x * z, y * z, z, z, n, rnd, 1.6 * u, 4.4 * u);
    }
  }
  ctx.lineCap = 'round';
  ctx.lineWidth = 0.75 * u;
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = light;
  ctx.stroke(pl);
  ctx.globalAlpha = 0.45;
  ctx.strokeStyle = dark;
  ctx.stroke(pd);
  ctx.globalAlpha = 1;
}

/** Fibres poking out across a piece's edge so it reads as cut felt, not a vector shape. */
function edgeFuzz(ctx: CanvasRenderingContext2D, contours: Contour[], z: number, fill: string, light: string, seed: number): void {
  const u = z / 32;
  const rnd = seeded(seed * 131 + 7);
  const pf = new Path2D();
  const pl = new Path2D();
  for (const c of contours) {
    forEachEdge(c, z, (x0, y0, x1, y1, nx, ny) => {
      const len = Math.hypot(x1 - x0, y1 - y0);
      const count = Math.floor(len / (1.7 * u));
      for (let i = 0; i < count; i++) {
        const t = rnd();
        const bx = x0 + (x1 - x0) * t - nx * (0.4 + rnd()) * u;
        const by = y0 + (y1 - y0) * t - ny * (0.4 + rnd()) * u;
        const a = Math.atan2(ny, nx) + (rnd() - 0.5) * 1.9;
        const l = (1.4 + rnd() * 2.4) * u;
        const p = rnd() < 0.75 ? pf : pl;
        p.moveTo(bx, by);
        p.quadraticCurveTo(bx + Math.cos(a + 0.6) * l * 0.5, by + Math.sin(a + 0.6) * l * 0.5, bx + Math.cos(a) * l, by + Math.sin(a) * l);
      }
    });
  }
  ctx.lineCap = 'round';
  ctx.lineWidth = 0.8 * u;
  ctx.strokeStyle = fill;
  ctx.stroke(pf);
  ctx.globalAlpha = 0.7;
  ctx.strokeStyle = light;
  ctx.stroke(pl);
  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------------ */

/** Paints the whole ground (everything but walls, doors and standing pieces). Origin = tile (0, 0). */
export function paintGround(ctx: CanvasRenderingContext2D, map: VillageMap, z: number, s: number): void {
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
  mottle(ctx, map, all, z, FELT.grassLight, FELT.grassDark, 11);
  if (u >= 0.35) fibreField(ctx, map, all, z, FELT.grassLight, FELT.grassDark, 26, 12);
  if (u >= 0.5) grassDetails(ctx, map, g, k, z);

  const isWater: Inside = (x, y) => g(x, y) === 'water';
  const isField: Inside = (x, y) => g(x, y) === 'field';
  const isPath: Inside = (x, y) => g(x, y) === 'path';
  const isRoom: Inside = (x, y) => g(x, y) === 'room';

  const water = traceContours(W, H, isWater, 2);
  if (water.length) {
    feltPiece(ctx, water, isWater, map, z, s, { fill: FELT.water, light: FELT.waterLight, dark: FELT.waterDark, thread: FELT.waterThread, radius: 9, lift: 0.9, fibres: 18, stitch: true, fuzz: true, seed: 21 });
    if (u >= 0.4) waterMarks(ctx, map, isWater, k, z);
  }

  const fieldComps = components(W, H, isField);
  for (let i = 0; i < fieldComps.length; i++) {
    const comp = fieldComps[i] as (typeof fieldComps)[number];
    const set = new Set(comp.tiles);
    const inComp: Inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H && set.has(y * W + x);
    const contours = traceContours(W, H, inComp, 2);
    const shape = feltPiece(ctx, contours, inComp, map, z, s, { fill: FELT.soil, light: mix(FELT.soil, MUSTARD, 0.25), dark: darken(FELT.soil, 0.25), thread: FELT.soilThread, radius: 7, lift: 0.8, fibres: 16, stitch: true, fuzz: true, seed: 31 + i });
    const place = placeAt(map.places, comp.x + Math.floor(comp.w / 2), comp.y + Math.floor(comp.h / 2), (p) => p.kind === 'field');
    const wheat = place ? !/south/.test(place.id) : i % 2 === 0;
    cropRows(ctx, shape, comp, z, wheat, 41 + i);
  }

  const path = traceContours(W, H, isPath, 2);
  if (path.length) {
    feltPiece(ctx, path, isPath, map, z, s, { fill: FELT.path, light: FELT.pathLight, dark: FELT.pathDark, thread: FELT.pathThread, radius: 10, lift: 0.85, fibres: 16, stitch: true, fuzz: true, seed: 51 });
    if (u >= 0.5) pathPebbles(ctx, map, isPath, z);
  }

  const rooms = traceContours(W, H, isRoom, 2);
  if (rooms.length) {
    const shape = feltPiece(ctx, rooms, isRoom, map, z, s, { fill: FELT.floor, light: lighten(FELT.floor, 0.3), dark: darken(FELT.floor, 0.12), thread: FELT.floorLine, radius: 3, lift: 0.7, fibres: 10, stitch: false, fuzz: false, seed: 61 });
    if (u >= 0.4) floorBoards(ctx, shape, map, k, z);
  }

  for (const comp of components(W, H, (x, y) => k(x, y) === 'bridge')) bridge(ctx, comp, k, z, s);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (k(x, y) === 'well') well(ctx, x, y, z, s);
  treeShadows(ctx, map, k, z, s);

  ctx.restore();
  if (u >= 0.3) sheetEdge(ctx, -ov, -ov, W * z + ov * 2, H * z + ov * 2, u);
}

export function roundRectPath(p: Path2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  p.moveTo(x + rr, y);
  p.arcTo(x + w, y, x + w, y + h, rr);
  p.arcTo(x + w, y + h, x, y + h, rr);
  p.arcTo(x, y + h, x, y, rr);
  p.arcTo(x, y, x + w, y, rr);
  p.closePath();
}

/** Blanket stitch around the village sheet: a line along the edge with ticks running off it. */
function sheetEdge(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, u: number): void {
  const inset = 5 * u;
  const step = 7 * u;
  const p = new Path2D();
  const edge = (ax: number, ay: number, bx: number, by: number, nx: number, ny: number) => {
    const len = Math.hypot(bx - ax, by - ay);
    const n = Math.max(1, Math.round(len / step));
    for (let i = 0; i < n; i++) {
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
  edge(x, y, x + w, y, 0, 1);
  edge(x + w, y, x + w, y + h, -1, 0);
  edge(x + w, y + h, x, y + h, 0, -1);
  edge(x, y + h, x, y, 1, 0);
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
function grassDetails(ctx: CanvasRenderingContext2D, map: VillageMap, g: (x: number, y: number) => Ground, k: (x: number, y: number) => TileKind, z: number): void {
  const u = z / 32;
  const tufts = new Path2D();
  const knots: { x: number; y: number; c: string }[] = [];
  const flowerColours = [PAPER, MUSTARD, mix(BERRY, PAPER, 0.25)];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (g(x, y) !== 'grass' || k(x, y) !== 'grass') continue;
      const h = hash(x, y, 71);
      const px = (x + 0.2 + hash(x, y, 72) * 0.6) * z;
      const py = (y + 0.25 + hash(x, y, 73) * 0.6) * z;
      if (h < 0.13) {
        for (let i = -1; i <= 1; i++) {
          tufts.moveTo(px + i * 1.6 * u, py);
          tufts.lineTo(px + i * 3.2 * u, py - (3.6 - Math.abs(i)) * u);
        }
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

/** Short stitched wave marks on the river: two or three stitches on a gentle arc. */
function waterMarks(ctx: CanvasRenderingContext2D, map: VillageMap, isWater: Inside, k: (x: number, y: number) => TileKind, z: number): void {
  const u = z / 32;
  const p = new Path2D();
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (!isWater(x, y) || k(x, y) === 'bridge') continue;
      const marks = hash(x, y, 81) < 0.55 ? 1 : 2;
      for (let m = 0; m < marks; m++) {
        const cx = (x + 0.25 + hash(x, y, 82 + m) * 0.5) * z;
        const cy = (y + 0.22 + (m * 0.45 + hash(x, y, 84 + m) * 0.3)) * z;
        const w = (6 + hash(x, y, 86 + m) * 4) * u;
        p.moveTo(cx - w / 2, cy);
        p.quadraticCurveTo(cx, cy + 2.4 * u, cx + w / 2, cy);
      }
    }
  }
  ctx.save();
  ctx.setLineDash([2.6 * u, 1.9 * u]);
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.15 * u;
  ctx.strokeStyle = rgba(FELT.waterThread, 0.85);
  ctx.stroke(p);
  ctx.restore();
}

/** Crop rows across a field: raised felt strips of wheat (with stalk stitches) or greens (with knots). */
function cropRows(ctx: CanvasRenderingContext2D, shape: Path2D, comp: { x: number; y: number; w: number; h: number }, z: number, wheat: boolean, seed: number): void {
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

/** A few felt pebbles on the paths. */
function pathPebbles(ctx: CanvasRenderingContext2D, map: VillageMap, isPath: Inside, z: number): void {
  const u = z / 32;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (!isPath(x, y) || hash(x, y, 91) > 0.09) continue;
      const cx = (x + 0.25 + hash(x, y, 92) * 0.5) * z;
      const cy = (y + 0.25 + hash(x, y, 93) * 0.5) * z;
      ctx.fillStyle = FELT.pathDark;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 2.4 * u, 1.7 * u, hash(x, y, 94) * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Stitched floorboards inside rooms. */
function floorBoards(ctx: CanvasRenderingContext2D, shape: Path2D, map: VillageMap, k: (x: number, y: number) => TileKind, z: number): void {
  const u = z / 32;
  const p = new Path2D();
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const t = k(x, y);
      if (t !== 'floor') continue;
      for (let i = 0; i < 2; i++) {
        const yy = (y + 0.25 + i * 0.5) * z;
        const seam = (x + (hash(x, y, 101 + i) * 0.6 + 0.2)) * z;
        p.moveTo(x * z, yy);
        p.lineTo(seam - 1.5 * u, yy);
        p.moveTo(seam + 1.5 * u, yy);
        p.lineTo((x + 1) * z, yy);
      }
    }
  }
  ctx.save();
  ctx.clip(shape);
  ctx.lineWidth = 0.9 * u;
  ctx.strokeStyle = rgba(FELT.floorLine, 0.75);
  ctx.stroke(p);
  ctx.restore();
}

/** Wooden plank bridge over the river, laid across the crossing, with rails and a shadow on the water. */
function bridge(ctx: CanvasRenderingContext2D, comp: { x: number; y: number; w: number; h: number }, k: (x: number, y: number) => TileKind, z: number, s: number): void {
  const u = z / 32;
  let waterNS = 0;
  let waterEW = 0;
  for (let x = comp.x; x < comp.x + comp.w; x++) {
    if (k(x, comp.y - 1) === 'water') waterNS++;
    if (k(x, comp.y + comp.h) === 'water') waterNS++;
  }
  for (let y = comp.y; y < comp.y + comp.h; y++) {
    if (k(comp.x - 1, y) === 'water') waterEW++;
    if (k(comp.x + comp.w, y) === 'water') waterEW++;
  }
  // Water above and below means the bridge carries walkers east to west.
  const eastWest = waterNS > waterEW || (waterNS === waterEW && comp.w >= comp.h);
  ctx.save();
  if (!eastWest) {
    // Draw in a rotated frame so the same code lays planks for both directions.
    const cx = (comp.x + comp.w / 2) * z;
    const cy = (comp.y + comp.h / 2) * z;
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 2);
    ctx.translate(-cx, -cy);
  }
  const w = eastWest ? comp.w : comp.h;
  const h = eastWest ? comp.h : comp.w;
  const cx = (comp.x + comp.w / 2) * z;
  const cy = (comp.y + comp.h / 2) * z;
  const x0 = cx - (w / 2 + 0.32) * z;
  const x1 = cx + (w / 2 + 0.32) * z;
  const y0 = cy - (h / 2 - 0.06) * z;
  const y1 = cy + (h / 2 - 0.06) * z;
  const deck = new Path2D();
  roundRectPath(deck, x0, y0, x1 - x0, y1 - y0, 3 * u);
  ctx.save();
  ctx.shadowColor = rgba(INK, 0.5);
  ctx.shadowBlur = 5 * u * s;
  ctx.shadowOffsetX = (eastWest ? 1.5 : 3.5) * u * s;
  ctx.shadowOffsetY = (eastWest ? 3.5 : -1.5) * u * s;
  ctx.fillStyle = FELT.woodDark;
  ctx.fill(deck);
  ctx.restore();
  const rnd = seeded(comp.x * 31 + comp.y);
  const plank = 0.2 * z;
  const gapW = 0.035 * z;
  let i = 0;
  for (let x = x0 + gapW; x < x1 - gapW - 1; x += plank + gapW, i++) {
    const pw = Math.min(plank, x1 - gapW - x);
    const jt = (rnd() - 0.5) * 1.4 * u;
    const pb = new Path2D();
    roundRectPath(pb, x, y0 + 0.5 * u + jt, pw, y1 - y0 - 1 * u, 1.4 * u);
    ctx.fillStyle = i % 2 ? FELT.wood : FELT.woodLight;
    ctx.fill(pb);
    if (u >= 0.45) {
      ctx.fillStyle = FELT.woodDark;
      for (const yy of [y0 + 3.2 * u, y1 - 3.2 * u]) {
        ctx.beginPath();
        ctx.arc(x + pw / 2, yy + jt, 0.8 * u, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // Rails along both long edges.
  for (const ry of [y0 - 1.2 * u, y1 - 2.6 * u]) {
    const rail = new Path2D();
    roundRectPath(rail, x0 - 1 * u, ry, x1 - x0 + 2 * u, 3.8 * u, 1.8 * u);
    ctx.save();
    ctx.shadowColor = rgba(INK, 0.4);
    ctx.shadowBlur = 2 * u * s;
    ctx.shadowOffsetY = 1.2 * u * s;
    ctx.fillStyle = FELT.woodDark;
    ctx.fill(rail);
    ctx.restore();
    if (u >= 0.45) {
      const st = new Path2D();
      st.moveTo(x0 + 2 * u, ry + 1.9 * u);
      st.lineTo(x1 - 2 * u, ry + 1.9 * u);
      runningStitch(ctx, st, FELT.woodLight, u, 2.6, 2.2, 0.9);
    }
  }
  ctx.restore();
}

/** The well: a ring of felt stones around dark water, with a little bucket on the rim. */
function well(ctx: CanvasRenderingContext2D, tx: number, ty: number, z: number, s: number): void {
  const u = z / 32;
  const cx = (tx + 0.5) * z;
  const cy = (ty + 0.5) * z;
  const ro = 0.47 * z;
  const ri = 0.27 * z;
  ctx.save();
  ctx.shadowColor = rgba(INK, 0.45);
  ctx.shadowBlur = 4 * u * s;
  ctx.shadowOffsetX = 1 * u * s;
  ctx.shadowOffsetY = 2.5 * u * s;
  ctx.fillStyle = FELT.stoneDark;
  ctx.beginPath();
  ctx.arc(cx, cy, ro, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  const stones = 9;
  for (let i = 0; i < stones; i++) {
    const a0 = (i / stones) * Math.PI * 2 + 0.05;
    const a1 = ((i + 1) / stones) * Math.PI * 2 - 0.05;
    const p = new Path2D();
    p.arc(cx, cy, ro - 0.6 * u, a0, a1);
    p.arc(cx, cy, ri + 0.6 * u, a1, a0, true);
    p.closePath();
    const tone = [FELT.stone, FELT.stoneLight, mix(FELT.stone, FELT.stoneLight, 0.5)][i % 3] as string;
    ctx.fillStyle = tone;
    ctx.fill(p);
    ctx.lineWidth = 0.7 * u;
    ctx.strokeStyle = rgba(INK, 0.3);
    ctx.stroke(p);
  }
  if (u >= 0.4) {
    const st = new Path2D();
    st.arc(cx, cy, (ro + ri) / 2, 0, Math.PI * 2);
    runningStitch(ctx, st, lighten(FELT.stoneLight, 0.4), u, 2.2, 2.4, 0.9);
  }
  const water = ctx.createRadialGradient(cx - ri * 0.3, cy - ri * 0.3, 0, cx, cy, ri);
  water.addColorStop(0, mix(FELT.water, INK, 0.35));
  water.addColorStop(1, mix(FELT.water, INK, 0.65));
  ctx.fillStyle = water;
  ctx.beginPath();
  ctx.arc(cx, cy, ri, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgba(FELT.waterThread, 0.7);
  ctx.lineWidth = 1.1 * u;
  ctx.beginPath();
  ctx.arc(cx, cy, ri * 0.55, Math.PI * 1.1, Math.PI * 1.55);
  ctx.stroke();
  // A small mustard bucket resting on the rim.
  const bx = cx + ro * 0.62;
  const by = cy - ro * 0.62;
  ctx.fillStyle = rgba(INK, 0.3);
  ctx.beginPath();
  ctx.ellipse(bx + 0.8 * u, by + 1.5 * u, 3.6 * u, 2.4 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = FELT.wood;
  ctx.beginPath();
  ctx.ellipse(bx, by, 3.4 * u, 3.0 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = mix(FELT.water, INK, 0.4);
  ctx.beginPath();
  ctx.ellipse(bx, by - 0.3 * u, 2.2 * u, 1.9 * u, 0, 0, Math.PI * 2);
  ctx.fill();
}

function treeShadows(ctx: CanvasRenderingContext2D, map: VillageMap, k: (x: number, y: number) => TileKind, z: number, s: number): void {
  const u = z / 32;
  ctx.save();
  ctx.shadowColor = rgba(INK, 0.4);
  ctx.shadowBlur = 5 * u * s;
  ctx.fillStyle = rgba(INK, 0.32);
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (k(x, y) !== 'tree') continue;
      ctx.beginPath();
      ctx.ellipse((x + 0.58) * z, (y + 0.78) * z, 0.44 * z, 0.17 * z, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Trees: standing felt pieces                                         */

interface Disc {
  x: number;
  y: number;
  r: number;
  c: string;
}

function treeDiscs(variant: number, orchard: boolean): Disc[] {
  const { leafDark: d, leaf: m, leafLight: l } = FELT;
  if (orchard) {
    const o = mix(FELT.leafLight, '#A9C25E', 0.25);
    return variant % 2
      ? [{ x: -0.16, y: -0.3, r: 0.3, c: m }, { x: 0.17, y: -0.32, r: 0.28, c: d }, { x: 0.01, y: -0.5, r: 0.3, c: o }]
      : [{ x: 0.0, y: -0.36, r: 0.38, c: m }, { x: -0.06, y: -0.48, r: 0.26, c: o }];
  }
  switch (variant % 4) {
    case 0:
      return [{ x: -0.19, y: -0.33, r: 0.34, c: d }, { x: 0.2, y: -0.3, r: 0.32, c: m }, { x: 0.0, y: -0.57, r: 0.34, c: l }];
    case 1:
      return [{ x: -0.16, y: -0.3, r: 0.3, c: d }, { x: 0.19, y: -0.36, r: 0.33, c: d }, { x: -0.02, y: -0.62, r: 0.3, c: m }, { x: 0.05, y: -0.42, r: 0.26, c: l }];
    case 2:
      return [{ x: 0.02, y: -0.4, r: 0.42, c: m }, { x: -0.1, y: -0.56, r: 0.27, c: l }];
    default:
      return [{ x: 0.0, y: -0.28, r: 0.3, c: d }, { x: 0.0, y: -0.52, r: 0.27, c: m }, { x: 0.0, y: -0.74, r: 0.21, c: l }];
  }
}

/** One felt tree at layer scale. The origin is the tile centre. */
function paintTree(ctx: CanvasRenderingContext2D, variant: number, orchard: boolean, z: number, seed: number): void {
  const u = z / 32;
  // Trunk.
  const trunk = new Path2D();
  trunk.moveTo(-0.07 * z, -0.1 * z);
  trunk.lineTo(0.07 * z, -0.1 * z);
  trunk.lineTo(0.085 * z, 0.27 * z);
  trunk.quadraticCurveTo(0, 0.31 * z, -0.085 * z, 0.27 * z);
  trunk.closePath();
  ctx.fillStyle = FELT.trunk;
  ctx.fill(trunk);
  ctx.strokeStyle = rgba(INK, 0.35);
  ctx.lineWidth = 0.7 * u;
  ctx.stroke(trunk);
  const discs = treeDiscs(variant, orchard);
  const rnd = seeded(seed);
  for (const d of discs) {
    const cx = d.x * z;
    const cy = d.y * z;
    const r = d.r * z;
    ctx.save();
    ctx.shadowColor = rgba(INK, 0.35);
    ctx.shadowBlur = 2.4 * u * (ctx.getTransform().a || 1);
    ctx.shadowOffsetX = 0.6 * u * (ctx.getTransform().a || 1);
    ctx.shadowOffsetY = 1.4 * u * (ctx.getTransform().a || 1);
    ctx.fillStyle = d.c;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    const gl = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
    gl.addColorStop(0, rgba(PAPER, 0.18));
    gl.addColorStop(0.6, rgba(PAPER, 0));
    gl.addColorStop(1, rgba(INK, 0.16));
    ctx.fillStyle = gl;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    if (u >= 0.4) {
      const f = new Path2D();
      addFibres(f, cx - r * 0.7, cy - r * 0.7, r * 1.4, r * 1.4, Math.round(10 * u * u * d.r * 4), rnd, 1.2 * u, 3 * u);
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r - 0.5 * u, 0, Math.PI * 2);
      ctx.clip();
      ctx.lineWidth = 0.7 * u;
      ctx.strokeStyle = rgba(lighten(d.c, 0.3), 0.5);
      ctx.stroke(f);
      ctx.restore();
      const st = new Path2D();
      st.arc(cx, cy, r - 2.6 * u, 0, Math.PI * 2);
      runningStitch(ctx, st, rgba(FELT.leafThread, 0.85), u, 2.4, 2.1, 0.95);
    }
  }
  if (orchard && u >= 0.3) {
    const top = discs[discs.length - 1] as Disc;
    const fruit = 3 + Math.floor(rnd() * 3);
    for (let i = 0; i < fruit; i++) {
      const a = rnd() * Math.PI * 2;
      const rr = rnd() * top.r * 0.75 * z;
      const fx = top.x * z + Math.cos(a) * rr;
      const fy = top.y * z + Math.sin(a) * rr * 0.9 + 0.1 * z;
      ctx.fillStyle = rgba(INK, 0.3);
      ctx.beginPath();
      ctx.arc(fx + 0.4 * u, fy + 0.7 * u, 2 * u, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = mix(BERRY, '#D2453F', 0.35);
      ctx.beginPath();
      ctx.arc(fx, fy, 2 * u, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgba(PAPER, 0.7);
      ctx.beginPath();
      ctx.arc(fx - 0.6 * u, fy - 0.6 * u, 0.6 * u, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Builds a sprite per tree variant at this zoom and returns one standing piece per tree tile. */
export function buildTrees(map: VillageMap, z: number, s: number): Standing[] {
  const k = sampler(map);
  const sprites = new Map<string, HTMLCanvasElement>();
  const left = 0.75;
  const top = 1.25;
  const wT = 1.5;
  const hT = 1.75;
  const out: Standing[] = [];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (k(x, y) !== 'tree') continue;
      const orchard = !!placeAt(map.places, x, y, (p) => p.kind === 'orchard' || p.id === 'orchard');
      const variant = Math.floor(hash(x, y, 111) * 4);
      const key = `${variant}|${orchard ? 1 : 0}`;
      let img = sprites.get(key);
      if (!img) {
        const surf = makeCanvas(wT * z * s, hT * z * s);
        surf.ctx.setTransform(s, 0, 0, s, left * z * s, top * z * s);
        paintTree(surf.ctx, variant, orchard, z, 1000 + variant * 7 + (orchard ? 3 : 0));
        img = surf.canvas;
        sprites.set(key, img);
      }
      const jx = (hash(x, y, 112) - 0.5) * 0.12;
      out.push({ img, x: (x + 0.5 + jx - left) * z, y: (y + 0.5 - top) * z, w: wT * z, h: hT * z, sortY: y + 0.8 });
    }
  }
  return out;
}
