/**
 * Buildings as cut-away paper rooms. Walls are thick paper strips laid along the wall tiles,
 * flush with the outside of the room, showing their cut edge as a kraft-coloured front face.
 * Doors are a darker strip in the wall line. Floors are in rooms.ts, roof façades in roofs.ts.
 */
import type { Place, PlaceKind, TileKind, VillageMap } from '../sim/types.js';
import { FELT, INK, MUSTARD, PAPER, darken, mix, rgba } from './palette.js';
import { components } from './regions.js';
import { roundRectPath, runningStitch, sampler } from './felt.js';

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
  name?: string;
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
      name: best?.name,
      topDoors,
      waterSide: east > 0 ? 'e' : west > 0 ? 'w' : null,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Walls and doors, painted into the ground layer                     */

export function* paintWallsSteps(ctx: CanvasRenderingContext2D, map: VillageMap, z: number, s: number): Generator<void> {
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
      yield;
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
  strokeBoth(rgba(INK, 0.4), thick + 1);
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

  yield;
  for (const d of doors) {
    paintDoor(ctx, d.x, d.y, d.horizontal, ax(d.x, d.y), ay(d.x, d.y), z, s);
    yield;
  }
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

