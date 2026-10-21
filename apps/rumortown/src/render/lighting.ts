/** Snapshot-derived occupancy and small clock-lit windows. No ground cache invalidation. */
import type { Camera, VillageMap, WorldSnapshot } from '../sim/types.js';
import type { Building } from './buildings.js';
import type { Daylight } from './daylight.js';
import { hash } from './grain.js';
import { INK, MUSTARD, PAPER, mix, rgba } from './palette.js';

export function occupiedBuildings(buildings: readonly Building[], snapshot: WorldSnapshot): Set<string> {
  const result = new Set<string>();
  for (const b of buildings) {
    const inside = (p: { x: number; y: number }) => p.x > b.x && p.x < b.x + b.w - 1 && p.y > b.y && p.y < b.y + b.h - 1;
    if (inside(snapshot.player.pos) || snapshot.villagers.some(v => inside(v.pos))) result.add(b.id);
  }
  return result;
}

export function drawBuildingLight(ctx: CanvasRenderingContext2D, buildings: readonly Building[], map: VillageMap, occupied: ReadonlySet<string>, view: { ox: number; oy: number; zoom: number }, light: Daylight, camera: Camera): void {
  if (light.windows <= .02) return;
  const z = view.zoom;
  ctx.save();
  const lamp = (x: number, y: number, window: boolean) => {
    x = view.ox + x * z; y = view.oy + y * z;
    if (x < -z || y < -z || x > camera.width + z || y > camera.height + z) return;
    ctx.fillStyle = rgba(MUSTARD, .12 * light.windows);
    ctx.beginPath(); ctx.ellipse(x, y, z * .4, z * .32, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = rgba(mix(MUSTARD, PAPER, .3), .85 * light.windows);
    ctx.fillRect(x - z * .10, y - z * .13, z * .2, z * .26);
    ctx.strokeStyle = rgba(INK, .7); ctx.lineWidth = Math.max(.7, z * .025);
    ctx.strokeRect(x - z * .10, y - z * .13, z * .2, z * .26);
    if (window) { ctx.beginPath(); ctx.moveTo(x, y - z * .13); ctx.lineTo(x, y + z * .13); ctx.stroke(); }
  };
  for (const b of buildings) {
    if (occupied.has(b.id)) for (const dx of [.9, b.w - .9]) lamp(b.x + dx, b.y + .65, true);
    if (b.kind === 'inn') lamp(b.x + b.w - .35, b.y, false);
  }
  for (const p of map.places) if (p.kind === 'square') for (const dx of [.5, p.rect.w - .5]) lamp(p.rect.x + dx, p.rect.y + .5, false);
  ctx.restore();
}

/** Stitched smoke appears only above occupied buildings with a chimney. */
export function drawOccupiedSmoke(ctx: CanvasRenderingContext2D, buildings: readonly Building[], occupied: ReadonlySet<string>, view: { ox: number; oy: number; zoom: number }, camera: Camera): void {
  const z = view.zoom;
  ctx.save(); ctx.strokeStyle = rgba(PAPER, .65); ctx.lineWidth = Math.max(.8, z * .04); ctx.setLineDash([z * .065, z * .065]);
  for (const b of buildings) {
    if (!occupied.has(b.id) || ['chapel', 'school', 'mill', 'shop'].includes(b.kind)) continue;
    const left = hash(b.x, b.y, 311) < .5;
    const x = view.ox + (b.x + (left ? .91 : b.w - .91)) * z, y = view.oy + (b.y - 1.5) * z;
    if (x < -z || x > camera.width + z || y < -z || y > camera.height + z) continue;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x - z * .3, y - z * .25, x + z * .35, y - z * .35, x, y - z * .6); ctx.stroke();
  }
  ctx.restore();
}
