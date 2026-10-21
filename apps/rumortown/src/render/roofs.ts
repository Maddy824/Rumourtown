/**
 * Roof façades: a standing paper piece above each room's top wall, depth-sorted with villagers,
 * so a house reads as a house from outside while its floor stays open. Shape and ornaments
 * follow the kind of building.
 */
import { BERRY, DENIM, INK, MUSTARD, PAPER, MOSS, OAT, darken, lighten, mix, rgba } from './palette.js';
import { addFibres, hash, makeCanvas, seeded } from './grain.js';
import type { Standing } from './felt.js';
import type { Building } from './buildings.js';
import { districtAt } from '../content/map/wayfinding.js';
import { BODY } from './sprites.js';
import { awning, chimney, doorway, dormer, gableSteps, shinglesSteps, sign, tower, wheel, type RoofStyle } from './ornaments.js';

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
    default: {
      const district = districtAt(b);
      const paper = district === 'commons' ? MUSTARD : district === 'woodland' ? mix(MOSS, OAT, .28) : district === 'eastbank' ? DENIM : BERRY;
      return { paper, shingle: district === 'commons' ? 'thatch' : district === 'eastbank' ? 'slate' : v < .5 ? 'scallop' : 'slate' };
    }
  }
}

const PAD = 0.35;
const OVERHANG = 0.16;
const BAND = 0.95;

/** Builds one façade sprite per building at this zoom. */
export function* buildRoofsSteps(buildings: readonly Building[], z: number, s: number): Generator<void, Standing[]> {
  const out: Standing[] = [];
  for (const b of buildings) {
    const wT = b.w + OVERHANG * 2 + PAD * 2;
    const hT = BAND + 1.7 + PAD;
    const surf = makeCanvas(wT * z * s, hT * z * s);
    // Local origin: bottom-left of the façade's base, at the building's top-left corner.
    const left = (PAD + OVERHANG) * z;
    const base = (hT - .8) * z;
    surf.ctx.setTransform(s, 0, 0, s, left * s, base * s);
    yield* paintFacadeSteps(surf.ctx, b, z, s);
    out.push({ img: surf.canvas, x: b.x * z - left, y: b.y * z - base, w: wT * z, h: hT * z, sortY: b.y + 0.05, roof: true });
  }
  return out;
}

/** Compare the façade's drawn footprint with the figure's body, in layer pixels. */
export function roofOverlaps(roof: Standing, x: number, y: number, zoom: number, scale = 1): boolean {
  const size = zoom * scale;
  return x * zoom + BODY.right * size > roof.x && x * zoom + BODY.left * size < roof.x + roof.w
    && y * zoom + BODY.bottom * size > roof.y && y * zoom + BODY.top * size < roof.y + roof.h;
}

/** Paints a façade with its base on y = 0, spanning x = 0..b.w tiles. */
function* paintFacadeSteps(ctx: CanvasRenderingContext2D, b: Building, z: number, s: number): Generator<void> {
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
  yield* shinglesSteps(ctx, style, x0, x1, band, z, seed);
  const nap = new Path2D();
  addFibres(nap, x0, -band, x1 - x0, band, Math.round(b.w * 14), seeded(seed + 990), .8 * u, 2.4 * u);
  ctx.lineWidth = .65 * u; ctx.strokeStyle = rgba(lighten(style.paper, .45), .28); ctx.stroke(nap);
  yield;
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

  // Features on the band: a front gable makes a home read as a house; dormers for the rest.
  const span = x1 - x0;
  if (b.kind === 'home' || b.kind === 'bakery') yield* gableSteps(ctx, x0 + span * (b.kind === 'bakery' ? (chimneyLeft ? 0.6 : 0.4) : 0.5), -band, Math.min(2.4 * z, span * 0.5), 0.7 * z, style, z, s);
  if (b.kind === 'inn') for (const f of [0.28, 0.72]) yield* gableSteps(ctx, x0 + span * f, -band, Math.min(2 * z, span * 0.36), 0.62 * z, style, z, s);
  if (b.kind === 'shop') dormer(ctx, x0 + span * 0.5, -band, style, z, s);
  if (b.kind === 'shop' || b.kind === 'bakery') awning(ctx, x0, x1, z);
  if (b.kind === 'bakery') sign(ctx, x1 - 0.2 * z, -band * 0.45, 'loaf', z, s);
  if (b.kind === 'inn') sign(ctx, x0 + 0.25 * z, -band * 0.45, 'mug', z, s);
  if (b.kind === 'smithy') sign(ctx, x0 + 0.25 * z, -band * 0.45, 'anvil', z, s);
  if (b.kind === 'inn') {
    ctx.strokeStyle = INK; ctx.lineWidth = 1.5 * u; ctx.strokeRect(w - .5 * z, -.3 * z, .28 * z, .42 * z);
    ctx.fillStyle = MUSTARD; ctx.fillRect(w - .46 * z, -.26 * z, .2 * z, .32 * z);
  }
  if (b.kind === 'home') {
    ctx.fillStyle = mix(MOSS, OAT, .25); ctx.fillRect(w * .5 - .5 * z, -.08 * z, z, .18 * z);
    ctx.strokeStyle = rgba(INK, .6); ctx.lineWidth = .8 * u; ctx.setLineDash([2 * u, 2 * u]); ctx.strokeRect(w * .5 - .5 * z, -.08 * z, z, .18 * z); ctx.setLineDash([]);
    for (let i = -1; i <= 1; i++) { ctx.fillStyle = i % 2 ? MUSTARD : mix(BERRY, PAPER, .3); ctx.beginPath(); ctx.arc(w * .5 + i * .27 * z, -.14 * z, .085 * z, 0, Math.PI * 2); ctx.fill(); }
  }
  if (b.kind === 'shop') {
    ctx.fillStyle = mix(MUSTARD, INK, .25); ctx.fillRect(w - .9 * z, -.12 * z, .45 * z, .35 * z);
    ctx.strokeStyle = INK; ctx.strokeRect(w - .9 * z, -.12 * z, .45 * z, .35 * z);
  }
  for (const dx of b.topDoors) doorway(ctx, (dx - b.x + 0.5) * z, z);
}
