/**
 * Cut-felt primitives shared by every painter: tile sampling, the standing-piece type, and the
 * felt piece itself (shadow, dye mottling, fibres, fuzzy edge, running stitch).
 */
import type { Place, TileKind, VillageMap } from '../sim/types.js';
import { INK, rgba } from './palette.js';
import { addFibres, hash, seeded, softBlob } from './grain.js';
import { contourPath, forEachEdge, type Contour, type Inside } from './regions.js';

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
  /** Only roof façades fade when they overlap an important figure. */
  roof?: true;
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

export function placeAt(places: readonly Place[], x: number, y: number, test: (p: Place) => boolean): Place | undefined {
  return places.find((p) => test(p) && x >= p.rect.x && y >= p.rect.y && x < p.rect.x + p.rect.w && y < p.rect.y + p.rect.h);
}

export interface PieceStyle {
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
export function* feltPieceSteps(ctx: CanvasRenderingContext2D, contours: Contour[], inside: Inside, map: VillageMap, z: number, s: number, st: PieceStyle): Generator<void, Path2D> {
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
  yield* mottleSteps(ctx, map, inside, z, st.light, st.dark, st.seed);
  if (u >= 0.35 && st.fibres > 0) yield* fibreFieldSteps(ctx, map, inside, z, st.light, st.dark, st.fibres, st.seed + 1);
  ctx.restore();

  if (st.fuzz && u >= 0.45) yield* edgeFuzzSteps(ctx, contours, z, st.fill, st.light, st.seed + 2);
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
export function* mottleSteps(ctx: CanvasRenderingContext2D, map: VillageMap, inside: Inside, z: number, light: string, dark: string, seed: number): Generator<void, void> {
  const lb = blob(light);
  yield;
  const db = blob(dark);
  yield;
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
      yield;
    }
  }
  ctx.globalAlpha = 1;
}

/** Fibres over every tile of a region, in two tones. `density` is fibres per tile at the close zoom. */
export function* fibreFieldSteps(ctx: CanvasRenderingContext2D, map: VillageMap, inside: Inside, z: number, light: string, dark: string, density: number, seed: number): Generator<void, void> {
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
      yield;
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
export function* edgeFuzzSteps(ctx: CanvasRenderingContext2D, contours: Contour[], z: number, fill: string, light: string, seed: number): Generator<void, void> {
  const u = z / 32;
  const rnd = seeded(seed * 131 + 7);
  const pf = new Path2D();
  const pl = new Path2D();
  for (const c of contours) {
    const edges: [number, number, number, number, number, number][] = [];
    forEachEdge(c, z, (...edge) => edges.push(edge));
    for (const [x0, y0, x1, y1, nx, ny] of edges) {
      const len = Math.hypot(x1 - x0, y1 - y0);
      const count = Math.floor(len / (1.7 * u));
      for (let i = 0; i < count; i++) {
        if (i % 16 === 0) yield;
        const t = rnd();
        const bx = x0 + (x1 - x0) * t - nx * (0.4 + rnd()) * u;
        const by = y0 + (y1 - y0) * t - ny * (0.4 + rnd()) * u;
        const a = Math.atan2(ny, nx) + (rnd() - 0.5) * 1.9;
        const l = (1.4 + rnd() * 2.4) * u;
        const p = rnd() < 0.75 ? pf : pl;
        p.moveTo(bx, by);
        p.quadraticCurveTo(bx + Math.cos(a + 0.6) * l * 0.5, by + Math.sin(a + 0.6) * l * 0.5, bx + Math.cos(a) * l, by + Math.sin(a) * l);
      }
    }
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

export function roundRectPath(p: Path2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  p.moveTo(x + rr, y);
  p.arcTo(x + w, y, x + w, y + h, rr);
  p.arcTo(x + w, y + h, x, y + h, rr);
  p.arcTo(x, y + h, x, y, rr);
  p.arcTo(x, y, x + w, y, rr);
  p.closePath();
}
