/**
 * Landmarks on the sheet: the plank bridge and the stone well, painted into the ground layer,
 * and the trees, which stand up and are depth-sorted with villagers.
 */
import type { TileKind, VillageMap } from '../sim/types.js';
import { BERRY, FELT, INK, MUSTARD, PAPER, lighten, mix, rgba } from './palette.js';
import { addFibres, hash, makeCanvas, seeded } from './grain.js';
import { placeAt, roundRectPath, runningStitch, sampler, type Standing } from './felt.js';

/** Wooden plank bridge over the river, laid across the crossing, with rails and a shadow on the water. */
export function bridge(ctx: CanvasRenderingContext2D, comp: { x: number; y: number; w: number; h: number }, k: (x: number, y: number) => TileKind, z: number, s: number): void {
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
export function well(ctx: CanvasRenderingContext2D, tx: number, ty: number, z: number, s: number): void {
  const u = z / 32;
  const cx = (tx + 0.5) * z;
  const cy = (ty + 0.5) * z;
  const ro = 0.5 * z;
  const ri = 0.28 * z;
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
    const tone = [FELT.stone, mix(FELT.stoneLight, MUSTARD, 0.08), mix(FELT.stone, BERRY, 0.06)][i % 3] as string;
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

export function* treeShadowsSteps(ctx: CanvasRenderingContext2D, map: VillageMap, k: (x: number, y: number) => TileKind, z: number, s: number): Generator<void> {
  const u = z / 32;
  ctx.save();
  ctx.shadowColor = rgba(INK, 0.4);
  ctx.shadowBlur = 5 * u * s;
  ctx.fillStyle = rgba(INK, 0.32);
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      yield;
      if (k(x, y) !== 'tree') continue;
      ctx.beginPath();
      ctx.ellipse((x + 0.6) * z, (y + 0.8) * z, 0.52 * z, 0.19 * z, 0, 0, Math.PI * 2);
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
  const k = 1.22;
  const scale = (list: Disc[]) => list.map((c) => ({ x: c.x * k, y: c.y * k, r: c.r * k, c: c.c }));
  if (orchard) {
    const o = mix(FELT.leafLight, '#A9C25E', 0.25);
    return scale(
      variant % 2
        ? [{ x: -0.16, y: -0.3, r: 0.3, c: m }, { x: 0.17, y: -0.32, r: 0.28, c: d }, { x: 0.01, y: -0.5, r: 0.3, c: o }]
        : [{ x: 0.0, y: -0.36, r: 0.38, c: m }, { x: -0.06, y: -0.48, r: 0.26, c: o }],
    );
  }
  switch (variant % 4) {
    case 0:
      return scale([{ x: -0.19, y: -0.33, r: 0.34, c: d }, { x: 0.2, y: -0.3, r: 0.32, c: m }, { x: 0.0, y: -0.57, r: 0.34, c: l }]);
    case 1:
      return scale([{ x: -0.16, y: -0.3, r: 0.3, c: d }, { x: 0.19, y: -0.36, r: 0.33, c: d }, { x: -0.02, y: -0.62, r: 0.3, c: m }, { x: 0.05, y: -0.42, r: 0.26, c: l }]);
    case 2:
      return scale([{ x: 0.02, y: -0.4, r: 0.42, c: m }, { x: -0.1, y: -0.56, r: 0.27, c: l }]);
    default:
      return scale([{ x: 0.0, y: -0.28, r: 0.3, c: d }, { x: 0.0, y: -0.52, r: 0.27, c: m }, { x: 0.0, y: -0.74, r: 0.21, c: l }]);
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
export function* buildTreesSteps(map: VillageMap, z: number, s: number, own: (canvas: HTMLCanvasElement) => void = () => {}): Generator<void, Standing[]> {
  const k = sampler(map);
  const sprites = new Map<string, HTMLCanvasElement>();
  const left = 0.9;
  const top = 1.55;
  const wT = 1.8;
  const hT = 2.05;
  const out: Standing[] = [];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      yield;
      if (k(x, y) !== 'tree') continue;
      const orchard = !!placeAt(map.places, x, y, (p) => p.kind === 'orchard' || p.id === 'orchard');
      const variant = Math.floor(hash(x, y, 111) * 4);
      const key = `${variant}|${orchard ? 1 : 0}`;
      let img = sprites.get(key);
      if (!img) {
        const surf = makeCanvas(wT * z * s, hT * z * s);
        own(surf.canvas);
        surf.ctx.setTransform(s, 0, 0, s, left * z * s, top * z * s);
        paintTree(surf.ctx, variant, orchard, z, 1000 + variant * 7 + (orchard ? 3 : 0));
        img = surf.canvas;
        sprites.set(key, img);
      }
      const jx = (hash(x, y, 112) - 0.5) * 0.12;
      out.push({ img, x: (x + 0.5 + jx - left) * z, y: (y + 0.5 - top) * z, w: wT * z, h: hT * z, sortY: y + 0.8, wind: x * 71 + y });
    }
  }
  return out;
}
