/**
 * Buildings as cut-away paper rooms. Walls are thick paper strips laid along the wall tiles,
 * flush with the outside of the room, showing their cut edge as a kraft-coloured front face.
 * Doors are a darker strip in the wall line. Above each room's top wall stands a paper roof
 * façade, depth-sorted with villagers, so the house reads as a house while its floor stays open.
 */
import type { Place, PlaceKind, TileKind, VillageMap } from '../sim/types.js';
import { BERRY, DENIM, FELT, INK, MUSTARD, PAPER, darken, lighten, mix, rgba } from './palette.js';
import { hash, makeCanvas } from './grain.js';
import { components } from './regions.js';
import { roundRectPath, runningStitch, sampler, type Standing } from './tiles.js';

/** Wall strip thickness and the height of its visible cut face, in tiles. */
const T = 0.36;
const FACE = 0.13;

export type BuildingKind = PlaceKind;

export interface Building {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: BuildingKind;
  id: string;
  /** Door tiles in this building's top wall: the façade gets a doorway there. */
  topDoors: number[];
  /** True if the building touches water on its east or west side (a water mill). */
  waterSide: 'e' | 'w' | null;
}

const BUILDING_KINDS: readonly PlaceKind[] = ['home', 'bakery', 'inn', 'mill', 'chapel', 'school', 'shop', 'smithy'];

function overlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/** Rooms are connected rings of wall and door tiles at least 3 by 3; each gets a kind from the place it overlaps. */
export function findBuildings(map: VillageMap): Building[] {
  const k = sampler(map);
  const isNode = (x: number, y: number) => {
    const t = map.tiles[y * map.width + x];
    return t === 'wall' || t === 'door';
  };
  const out: Building[] = [];
  for (const c of components(map.width, map.height, isNode)) {
    if (c.w < 3 || c.h < 3) continue;
    let best: Place | undefined;
    let bestArea = 0;
    for (const p of map.places) {
      if (!BUILDING_KINDS.includes(p.kind) && p.id !== 'smithy') continue;
      const a = overlap(c, p.rect);
      if (a > bestArea) {
        bestArea = a;
        best = p;
      }
    }
    const topDoors: number[] = [];
    for (let x = c.x; x < c.x + c.w; x++) if (k(x, c.y) === 'door') topDoors.push(x);
    let east = 0;
    let west = 0;
    for (let y = c.y; y < c.y + c.h; y++) {
      if (k(c.x + c.w, y) === 'water' || k(c.x + c.w + 1, y) === 'water') east++;
      if (k(c.x - 1, y) === 'water' || k(c.x - 2, y) === 'water') west++;
    }
    const kind: BuildingKind = best ? (best.id === 'smithy' ? 'smithy' : best.kind) : 'home';
    out.push({
      x: c.x,
      y: c.y,
      w: c.w,
      h: c.h,
      kind,
      id: best?.id ?? `building-${c.x}-${c.y}`,
      topDoors,
      waterSide: east > 0 ? 'e' : west > 0 ? 'w' : null,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Walls and doors, painted into the ground layer                     */

export function paintWalls(ctx: CanvasRenderingContext2D, map: VillageMap, z: number, s: number): void {
  const u = z / 32;
  const W = map.width;
  const H = map.height;
  const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const kind = (x: number, y: number): TileKind | null => (inMap(x, y) ? (map.tiles[y * W + x] ?? null) : null);
  const isNode = (x: number, y: number) => {
    const t = kind(x, y);
    return t === 'wall' || t === 'door';
  };
  const outside = (x: number, y: number) => {
    const t = kind(x, y);
    return t === null || !(t === 'wall' || t === 'door' || t === 'floor');
  };
  const ax = (x: number, y: number) => (outside(x - 1, y) && !outside(x + 1, y) ? T / 2 : outside(x + 1, y) && !outside(x - 1, y) ? 1 - T / 2 : 0.5);
  const ay = (x: number, y: number) => (outside(x, y - 1) && !outside(x, y + 1) ? T / 2 : outside(x, y + 1) && !outside(x, y - 1) ? 1 - T / 2 : 0.5);

  const paper = new Path2D();
  const paperButt = new Path2D();
  const doors: { x: number; y: number; horizontal: boolean }[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!isNode(x, y)) continue;
      const here = kind(x, y);
      const px = (x + ax(x, y)) * z;
      const py = (y + ay(x, y)) * z;
      if (here === 'door') doors.push({ x, y, horizontal: isNode(x - 1, y) || isNode(x + 1, y) || !(isNode(x, y - 1) || isNode(x, y + 1)) });
      const neighbours: [number, number][] = [[x + 1, y], [x, y + 1]];
      for (const [nx, ny] of neighbours) {
        if (!isNode(nx, ny)) continue;
        const there = kind(nx, ny);
        const qx = (nx + ax(nx, ny)) * z;
        const qy = (ny + ay(nx, ny)) * z;
        if (here === 'wall' && there === 'wall') {
          paper.moveTo(px, py);
          paper.lineTo(qx, qy);
        } else if (here === 'wall' || there === 'wall') {
          // Half a strip, from the wall's anchor to the edge of the door tile.
          const bx = nx === x ? px : (x + 1) * z;
          const by = ny === y ? py : (y + 1) * z;
          if (here === 'wall') {
            paperButt.moveTo(px, py);
            paperButt.lineTo(nx === x ? qx : bx, ny === y ? qy : by);
          } else {
            paperButt.moveTo(nx === x ? px : bx, ny === y ? py : by);
            paperButt.lineTo(qx, qy);
          }
        }
      }
    }
  }

  const thick = T * z;
  const face = FACE * z;
  const strokeBoth = (style: string, width: number) => {
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ctx.lineCap = 'square';
    ctx.stroke(paper);
    ctx.lineCap = 'butt';
    ctx.stroke(paperButt);
  };
  ctx.save();
  ctx.lineJoin = 'miter';
  // Shadow and cut face, shifted down: the front face of the strip shows below it.
  ctx.translate(0, face);
  ctx.save();
  ctx.shadowColor = rgba(INK, 0.45);
  ctx.shadowBlur = 3.5 * u * s;
  ctx.shadowOffsetX = 1 * u * s;
  ctx.shadowOffsetY = 1.6 * u * s;
  strokeBoth(FELT.wallEdge, thick);
  ctx.restore();
  strokeBoth(rgba(INK, 0.28), thick + 1.1 * u);
  strokeBoth(FELT.wallEdge, thick);
  ctx.translate(0, -face);
  // The cut line between the top and the face, then the top of the strip.
  strokeBoth(rgba(INK, 0.4), thick + 1.2 * u);
  strokeBoth(FELT.wallTop, thick);
  if (u >= 0.45) {
    // A faint pencil guideline along the strip, as if ruled before cutting.
    ctx.setLineDash([]);
    strokeBoth(rgba(mix(PAPER, MUSTARD, 0.35), 0.9), 0.9 * u);
  }
  ctx.restore();

  for (const d of doors) paintDoor(ctx, d.x, d.y, d.horizontal, ax(d.x, d.y), ay(d.x, d.y), z, s);
}

function paintDoor(ctx: CanvasRenderingContext2D, x: number, y: number, horizontal: boolean, ax: number, ay: number, z: number, s: number): void {
  const u = z / 32;
  const thick = T * z * 0.92;
  const gap = 0.1 * z;
  const [rx, ry, rw, rh] = horizontal
    ? [x * z + gap, (y + ay) * z - thick / 2, z - gap * 2, thick]
    : [(x + ax) * z - thick / 2, y * z + gap, thick, z - gap * 2];
  const p = new Path2D();
  roundRectPath(p, rx, ry, rw, rh, 1.6 * u);
  ctx.save();
  ctx.shadowColor = rgba(INK, 0.4);
  ctx.shadowBlur = 2 * u * s;
  ctx.shadowOffsetY = 1.4 * u * s;
  ctx.fillStyle = darken(FELT.door, 0.25);
  ctx.translate(0, horizontal ? FACE * z * 0.8 : 0);
  ctx.fill(p);
  ctx.restore();
  ctx.fillStyle = FELT.door;
  ctx.fill(p);
  if (u >= 0.45) {
    const st = new Path2D();
    roundRectPath(st, rx + 2 * u, ry + 2 * u, rw - 4 * u, rh - 4 * u, 1 * u);
    runningStitch(ctx, st, mix(FELT.door, PAPER, 0.45), u, 2, 1.8, 0.8);
    ctx.fillStyle = MUSTARD;
    ctx.beginPath();
    ctx.arc(horizontal ? rx + rw * 0.78 : rx + rw / 2, horizontal ? ry + rh / 2 : ry + rh * 0.78, 1.3 * u, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ------------------------------------------------------------------ */
/* Roof façades: standing paper pieces                                */

interface RoofStyle {
  paper: string;
  shingle: 'scallop' | 'thatch' | 'slate';
}

function roofStyle(b: Building): RoofStyle {
  const v = hash(b.x, b.y, 301);
  switch (b.kind) {
    case 'chapel':
      return { paper: mix(DENIM, INK, 0.3), shingle: 'slate' };
    case 'smithy':
      return { paper: mix(DENIM, INK, 0.5), shingle: 'slate' };
    case 'mill':
      return { paper: mix(MUSTARD, INK, 0.12), shingle: 'thatch' };
    case 'school':
      return { paper: mix(BERRY, MUSTARD, 0.18), shingle: 'scallop' };
    case 'inn':
      return { paper: darken(BERRY, 0.12), shingle: 'scallop' };
    default:
      return { paper: v < 0.35 ? darken(BERRY, 0.1) : v < 0.7 ? BERRY : lighten(BERRY, 0.1), shingle: v > 0.88 && b.kind === 'home' ? 'thatch' : 'scallop' };
  }
}

const PAD = 0.35;
const OVERHANG = 0.16;
const BAND = 0.95;

/** Builds one façade sprite per building at this zoom. */
export function buildRoofs(buildings: readonly Building[], z: number, s: number): Standing[] {
  const out: Standing[] = [];
  for (const b of buildings) {
    const wT = b.w + OVERHANG * 2 + PAD * 2;
    const hT = BAND + 0.95 + PAD;
    const surf = makeCanvas(wT * z * s, hT * z * s);
    // Local origin: bottom-left of the façade's base, at the building's top-left corner.
    const left = (PAD + OVERHANG) * z;
    const base = (hT - PAD * 0.35) * z;
    surf.ctx.setTransform(s, 0, 0, s, left * s, base * s);
    paintFacade(surf.ctx, b, z, s);
    out.push({ img: surf.canvas, x: b.x * z - left, y: b.y * z - base, w: wT * z, h: hT * z, sortY: b.y + 0.05 });
  }
  return out;
}

/** Paints a façade with its base on y = 0, spanning x = 0..b.w tiles. */
function paintFacade(ctx: CanvasRenderingContext2D, b: Building, z: number, s: number): void {
  const u = z / 32;
  const style = roofStyle(b);
  const w = b.w * z;
  const x0 = -OVERHANG * z;
  const x1 = w + OVERHANG * z;
  const band = BAND * z;
  const inset = Math.min(0.42 * z, (x1 - x0) * 0.12);
  const seed = Math.floor(hash(b.x, b.y, 307) * 1000);

  // Pieces that stand behind the roof band: chimney, bell tower, mill wheel.
  const chimneyLeft = hash(b.x, b.y, 311) < 0.5;
  if (b.kind === 'chapel' || b.kind === 'school') tower(ctx, w / 2, -band, b.kind === 'chapel' ? 0.95 : 0.6, style.paper, z, s);
  else if (b.kind !== 'mill' && b.kind !== 'shop') chimney(ctx, chimneyLeft ? x0 + inset + 0.5 * z : x1 - inset - 0.8 * z, -band + 0.1 * z, b.kind === 'bakery' || b.kind === 'smithy' ? 0.62 : 0.45, z, s);
  if (b.kind === 'mill') wheel(ctx, b.waterSide === 'w' ? x0 + 0.1 * z : x1 - 0.1 * z, -band * 0.55, z, s);

  const shape = new Path2D();
  shape.moveTo(x0, 0);
  shape.lineTo(x0 + 1.5 * u, -band * 0.18);
  shape.lineTo(x0 + inset, -band);
  shape.lineTo(x1 - inset, -band);
  shape.lineTo(x1 - 1.5 * u, -band * 0.18);
  shape.lineTo(x1, 0);
  shape.closePath();
  ctx.save();
  ctx.shadowColor = rgba(INK, 0.5);
  ctx.shadowBlur = 4 * u * s;
  ctx.shadowOffsetX = 1.2 * u * s;
  ctx.shadowOffsetY = 2.4 * u * s;
  ctx.fillStyle = style.paper;
  ctx.fill(shape);
  ctx.restore();

  ctx.save();
  ctx.clip(shape);
  shingles(ctx, style, x0, x1, band, z, seed);
  // Light from the upper left falls across the paper.
  const g = ctx.createLinearGradient(x0, -band, x1, 0);
  g.addColorStop(0, rgba(PAPER, 0.16));
  g.addColorStop(0.5, rgba(PAPER, 0));
  g.addColorStop(1, rgba(INK, 0.16));
  ctx.fillStyle = g;
  ctx.fillRect(x0, -band, x1 - x0, band);
  // Ridge cap and eave: the paper's cut edges.
  ctx.fillStyle = darken(style.paper, 0.3);
  ctx.fillRect(x0, -band, x1 - x0, 0.09 * z);
  ctx.fillStyle = darken(style.paper, 0.35);
  ctx.fillRect(x0, -0.1 * z, x1 - x0, 0.1 * z);
  ctx.restore();
  ctx.strokeStyle = rgba(lighten(style.paper, 0.75), 0.9);
  ctx.lineWidth = 1 * u;
  ctx.beginPath();
  ctx.moveTo(x0 + 1.5 * u, -band * 0.18);
  ctx.lineTo(x0 + inset, -band + 0.5 * u);
  ctx.lineTo(x1 - inset, -band + 0.5 * u);
  ctx.stroke();
  ctx.strokeStyle = rgba(INK, 0.45);
  ctx.lineWidth = 0.8 * u;
  ctx.stroke(shape);

  // Features on the band.
  const dormers = b.kind === 'inn' ? [0.3, 0.7] : b.kind === 'home' || b.kind === 'bakery' ? [chimneyLeft ? 0.66 : 0.34] : b.kind === 'shop' ? [0.5] : [];
  for (const f of dormers) dormer(ctx, x0 + (x1 - x0) * f, -band, style, z, s);
  if (b.kind === 'shop') awning(ctx, x0, x1, z);
  if (b.kind === 'bakery') sign(ctx, x1 - 0.2 * z, -band * 0.45, 'loaf', z, s);
  if (b.kind === 'inn') sign(ctx, x0 + 0.25 * z, -band * 0.45, 'mug', z, s);
  if (b.kind === 'smithy') sign(ctx, x0 + 0.25 * z, -band * 0.45, 'anvil', z, s);
  for (const dx of b.topDoors) doorway(ctx, (dx - b.x + 0.5) * z, z);
}

function shingles(ctx: CanvasRenderingContext2D, style: RoofStyle, x0: number, x1: number, band: number, z: number, seed: number): void {
  const u = z / 32;
  const row = 0.19 * z;
  const dark = rgba(darken(style.paper, 0.42), 0.55);
  const light = rgba(lighten(style.paper, 0.5), 0.35);
  ctx.lineCap = 'round';
  if (style.shingle === 'thatch') {
    ctx.lineWidth = 0.9 * u;
    for (let y = -band + 0.12 * z, r = 0; y < 0; y += row, r++) {
      ctx.strokeStyle = r % 2 ? dark : light;
      ctx.beginPath();
      for (let x = x0 + ((seed + r * 3) % 5) * u; x < x1; x += 2.6 * u) {
        ctx.moveTo(x, y);
        ctx.lineTo(x + 0.8 * u, y + row * 0.85);
      }
      ctx.stroke();
    }
    return;
  }
  const scallop = style.shingle === 'slate' ? 0.24 * z : 0.21 * z;
  ctx.lineWidth = 0.9 * u;
  for (let y = -band + 0.1 * z + row, r = 0; y < 0.01 * z; y += row, r++) {
    const off = r % 2 ? scallop / 2 : 0;
    ctx.strokeStyle = dark;
    ctx.beginPath();
    for (let x = x0 - scallop + off; x < x1 + scallop; x += scallop) {
      if (style.shingle === 'slate') {
        ctx.moveTo(x, y);
        ctx.lineTo(x + scallop, y);
        ctx.moveTo(x, y);
        ctx.lineTo(x, y - row * 0.95);
      } else {
        ctx.moveTo(x + scallop, y - row * 0.45);
        ctx.arc(x + scallop / 2, y - row * 0.45, scallop / 2, 0, Math.PI);
      }
    }
    ctx.stroke();
    ctx.strokeStyle = light;
    ctx.beginPath();
    for (let x = x0 - scallop + off; x < x1 + scallop; x += scallop) {
      ctx.moveTo(x + scallop * 0.25, y - row * 0.82);
      ctx.lineTo(x + scallop * 0.62, y - row * 0.82);
    }
    ctx.stroke();
  }
}

function chimney(ctx: CanvasRenderingContext2D, x: number, y: number, height: number, z: number, s: number): void {
  const u = z / 32;
  const w = 0.3 * z;
  const h = height * z;
  const p = new Path2D();
  roundRectPath(p, x, y - h, w, h, 1.2 * u);
  ctx.save();
  ctx.shadowColor = rgba(INK, 0.45);
  ctx.shadowBlur = 2.5 * u * s;
  ctx.shadowOffsetX = 1 * u * s;
  ctx.shadowOffsetY = 1.5 * u * s;
  ctx.fillStyle = FELT.stone;
  ctx.fill(p);
  ctx.restore();
  ctx.fillStyle = FELT.stoneLight;
  ctx.fillRect(x + w * 0.12, y - h + 0.08 * z, w * 0.3, h - 0.12 * z);
  ctx.fillStyle = FELT.stoneDark;
  ctx.fillRect(x - 1 * u, y - h - 0.02 * z, w + 2 * u, 0.09 * z);
  ctx.strokeStyle = rgba(INK, 0.4);
  ctx.lineWidth = 0.7 * u;
  ctx.stroke(p);
}

/** A small paper bell tower standing behind the roof band. */
function tower(ctx: CanvasRenderingContext2D, cx: number, y: number, height: number, paper: string, z: number, s: number): void {
  const u = z / 32;
  const w = 0.62 * z;
  const h = height * z;
  const body = new Path2D();
  roundRectPath(body, cx - w / 2, y - h + 0.15 * z, w, h, 1.2 * u);
  ctx.save();
  ctx.shadowColor = rgba(INK, 0.45);
  ctx.shadowBlur = 3 * u * s;
  ctx.shadowOffsetX = 1 * u * s;
  ctx.shadowOffsetY = 2 * u * s;
  ctx.fillStyle = PAPER;
  ctx.fill(body);
  ctx.restore();
  ctx.strokeStyle = rgba(INK, 0.4);
  ctx.lineWidth = 0.8 * u;
  ctx.stroke(body);
  // Arched opening with a mustard bell.
  const oy = y - h + 0.35 * z;
  ctx.fillStyle = mix(INK, DENIM, 0.2);
  ctx.beginPath();
  ctx.moveTo(cx - 0.13 * z, oy + 0.3 * z);
  ctx.lineTo(cx - 0.13 * z, oy + 0.1 * z);
  ctx.arc(cx, oy + 0.1 * z, 0.13 * z, Math.PI, 0);
  ctx.lineTo(cx + 0.13 * z, oy + 0.3 * z);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = MUSTARD;
  ctx.beginPath();
  ctx.arc(cx, oy + 0.17 * z, 0.075 * z, Math.PI, 0);
  ctx.lineTo(cx + 0.09 * z, oy + 0.24 * z);
  ctx.lineTo(cx - 0.09 * z, oy + 0.24 * z);
  ctx.closePath();
  ctx.fill();
  // Pointed cap.
  const cap = new Path2D();
  cap.moveTo(cx - w / 2 - 0.06 * z, y - h + 0.17 * z);
  cap.lineTo(cx, y - h - 0.32 * z);
  cap.lineTo(cx + w / 2 + 0.06 * z, y - h + 0.17 * z);
  cap.closePath();
  ctx.fillStyle = paper;
  ctx.fill(cap);
  ctx.strokeStyle = rgba(INK, 0.45);
  ctx.stroke(cap);
}

/** The mill's water wheel, a felt ring with spokes, half behind the façade. */
function wheel(ctx: CanvasRenderingContext2D, cx: number, cy: number, z: number, s: number): void {
  const u = z / 32;
  const r = 0.62 * z;
  ctx.save();
  ctx.shadowColor = rgba(INK, 0.45);
  ctx.shadowBlur = 3 * u * s;
  ctx.shadowOffsetY = 2 * u * s;
  ctx.strokeStyle = FELT.wood;
  ctx.lineWidth = 0.13 * z;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = FELT.woodDark;
  ctx.lineWidth = 0.06 * z;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.stroke();
  ctx.fillStyle = FELT.woodLight;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0.06 * z, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = FELT.woodDark;
  ctx.beginPath();
  ctx.arc(cx, cy, 0.1 * z, 0, Math.PI * 2);
  ctx.fill();
}

/** A small gable dormer with a paper window, rising out of the band's top edge. */
function dormer(ctx: CanvasRenderingContext2D, cx: number, top: number, style: RoofStyle, z: number, s: number): void {
  const u = z / 32;
  const w = 0.62 * z;
  const h = 0.62 * z;
  const y = top + 0.36 * z;
  const p = new Path2D();
  p.moveTo(cx - w / 2, y);
  p.lineTo(cx - w / 2, y - h * 0.45);
  p.lineTo(cx, y - h);
  p.lineTo(cx + w / 2, y - h * 0.45);
  p.lineTo(cx + w / 2, y);
  p.closePath();
  ctx.save();
  ctx.shadowColor = rgba(INK, 0.45);
  ctx.shadowBlur = 2.5 * u * s;
  ctx.shadowOffsetX = 0.8 * u * s;
  ctx.shadowOffsetY = 1.6 * u * s;
  ctx.fillStyle = darken(style.paper, 0.08);
  ctx.fill(p);
  ctx.restore();
  ctx.strokeStyle = rgba(lighten(style.paper, 0.7), 0.9);
  ctx.lineWidth = 0.9 * u;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2 + 0.8 * u, y - h * 0.45);
  ctx.lineTo(cx, y - h + 1 * u);
  ctx.stroke();
  ctx.strokeStyle = rgba(INK, 0.45);
  ctx.lineWidth = 0.8 * u;
  ctx.stroke(p);
  // Window: paper pane with an ink cross, lit faintly mustard.
  const ww = 0.26 * z;
  const wh = 0.24 * z;
  const wx = cx - ww / 2;
  const wy = y - h * 0.5;
  const win = new Path2D();
  roundRectPath(win, wx, wy, ww, wh, 1 * u);
  ctx.fillStyle = mix(PAPER, MUSTARD, 0.35);
  ctx.fill(win);
  ctx.strokeStyle = mix(INK, BERRY, 0.15);
  ctx.lineWidth = 0.9 * u;
  ctx.stroke(win);
  ctx.beginPath();
  ctx.moveTo(cx, wy);
  ctx.lineTo(cx, wy + wh);
  ctx.moveTo(wx, wy + wh / 2);
  ctx.lineTo(wx + ww, wy + wh / 2);
  ctx.stroke();
}

/** Shop awning: berry and paper stripes along the eave. */
function awning(ctx: CanvasRenderingContext2D, x0: number, x1: number, z: number): void {
  const u = z / 32;
  const y = -0.3 * z;
  const h = 0.3 * z;
  const n = Math.max(4, Math.round((x1 - x0) / (0.28 * z)));
  const sw = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i % 2 ? PAPER : mix(BERRY, PAPER, 0.08);
    ctx.beginPath();
    ctx.moveTo(x0 + i * sw, y);
    ctx.lineTo(x0 + (i + 1) * sw, y);
    ctx.lineTo(x0 + (i + 1) * sw, y + h * 0.75);
    ctx.quadraticCurveTo(x0 + (i + 0.5) * sw, y + h * 1.15, x0 + i * sw, y + h * 0.75);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = rgba(INK, 0.4);
  ctx.lineWidth = 0.8 * u;
  ctx.strokeRect(x0, y, x1 - x0, h * 0.75);
}

/** A round paper sign hanging off the roof, with a tiny felt emblem. */
function sign(ctx: CanvasRenderingContext2D, cx: number, cy: number, emblem: 'loaf' | 'mug' | 'anvil', z: number, s: number): void {
  const u = z / 32;
  const r = 0.2 * z;
  ctx.save();
  ctx.shadowColor = rgba(INK, 0.45);
  ctx.shadowBlur = 2 * u * s;
  ctx.shadowOffsetY = 1.5 * u * s;
  ctx.fillStyle = PAPER;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = rgba(INK, 0.5);
  ctx.lineWidth = 0.8 * u;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  if (emblem === 'loaf') {
    ctx.fillStyle = mix(MUSTARD, BERRY, 0.3);
    ctx.beginPath();
    ctx.ellipse(cx, cy + 0.02 * z, r * 0.62, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PAPER;
    ctx.lineWidth = 0.8 * u;
    ctx.beginPath();
    for (const dx of [-0.25, 0, 0.25]) {
      ctx.moveTo(cx + (dx - 0.06) * r * 2, cy - 0.05 * z);
      ctx.lineTo(cx + (dx + 0.06) * r * 2, cy + 0.06 * z);
    }
    ctx.stroke();
  } else if (emblem === 'mug') {
    ctx.fillStyle = MUSTARD;
    ctx.fillRect(cx - r * 0.42, cy - r * 0.4, r * 0.62, r * 0.85);
    ctx.fillStyle = PAPER;
    ctx.fillRect(cx - r * 0.42, cy - r * 0.5, r * 0.62, r * 0.22);
    ctx.strokeStyle = MUSTARD;
    ctx.lineWidth = 1.2 * u;
    ctx.beginPath();
    ctx.arc(cx + r * 0.25, cy, r * 0.22, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = mix(INK, DENIM, 0.2);
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.6, cy - r * 0.25);
    ctx.lineTo(cx + r * 0.6, cy - r * 0.25);
    ctx.lineTo(cx + r * 0.25, cy + r * 0.05);
    ctx.lineTo(cx + r * 0.2, cy + r * 0.45);
    ctx.lineTo(cx - r * 0.2, cy + r * 0.45);
    ctx.lineTo(cx - r * 0.25, cy + r * 0.05);
    ctx.closePath();
    ctx.fill();
  }
}

/** When the door is in the top wall, the façade gets an arched opening so the door stays visible. */
function doorway(ctx: CanvasRenderingContext2D, cx: number, z: number): void {
  const w = 0.56 * z;
  const h = 0.62 * z;
  ctx.fillStyle = darken(FELT.door, 0.2);
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, 0);
  ctx.lineTo(cx - w / 2, -h + w / 2);
  ctx.arc(cx, -h + w / 2, w / 2, Math.PI, 0);
  ctx.lineTo(cx + w / 2, 0);
  ctx.closePath();
  ctx.fill();
}
