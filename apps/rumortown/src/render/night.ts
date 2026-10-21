/** Small dynamic paper lights. Uses the simulation clock, never advances its random stream. */
import type { Camera, Place, VillageMap, WorldSnapshot } from '../sim/types.js';
import type { RenderOptions } from '../sim/types.js';

export const clockMinute = (minute: number): number => ((minute % 1440) + 1440) % 1440;
export const isNight = (minute: number): boolean => clockMinute(minute) >= 1290 || clockMinute(minute) < 360;
export const nightStrength = (minute: number): number => {
  const m = clockMinute(minute);
  return m >= 1200 ? Math.min(1, (m - 1200) / 90) : m < 360 ? Math.min(1, (360 - m) / 60) : 0;
};
const fraction = (seed: number): number => { let n = Math.imul(seed ^ 0x45d9f3b, 0x45d9f3b); n = Math.imul(n ^ n >>> 16, 0x45d9f3b); return ((n ^ n >>> 16) >>> 0) / 4294967296; };
export const paperStars = Array.from({ length: 42 }, (_, i) => ({ x: fraction(i * 3 + 1), y: fraction(i * 3 + 2) * .24, size: .65 + fraction(i * 3 + 3) * 1.3, phase: fraction(i + 100) * Math.PI * 2 }));
export function windowAwake(place: Pick<Place, 'kind' | 'rect'>, snapshot: WorldSnapshot): boolean {
  const m = clockMinute(snapshot.minuteOfDay);
  if (place.kind === 'inn' && m >= 30 && m < 360) return false;
  if (place.kind === 'home' && (m >= 1380 || m < 330)) return false;
  if (place.kind === 'bakery' && m >= 30 && m < 270) return false;
  const r = place.rect;
  return snapshot.villagers.some(v => v.activity !== 'sleep' && v.pos.x > r.x && v.pos.x < r.x + r.w - 1 && v.pos.y > r.y && v.pos.y < r.y + r.h - 1);
}
const waters = new WeakMap<VillageMap, { x: number; y: number }[]>();
function waterGlints(map: VillageMap) {
  let points = waters.get(map);
  if (!points) {
    points = [];
    for (let y = 0; y < map.height; y += 4) for (let x = 0; x < map.width; x++) if (map.tiles[y * map.width + x] === 'water' && fraction(y * map.width + x) < .18) points.push({ x: x + .5, y: y + .5 });
    waters.set(map, points);
  }
  return points;
}

/** Called before the existing window painter. Updates its occupancy set without touching map caches. */
export function drawNight(ctx: CanvasRenderingContext2D, map: VillageMap, snapshot: WorldSnapshot, camera: Camera, view: { ox: number; oy: number; zoom: number }, options: Pick<RenderOptions, 'reducedMotion' | 'alpha'>, occupied: Set<string>): void {
  const strength = nightStrength(snapshot.minuteOfDay);
  for (const p of map.places) if (!windowAwake(p, snapshot)) occupied.delete(p.id);
  if (strength <= 0) return;
  const z = view.zoom, minute = clockMinute(snapshot.minuteOfDay), time = snapshot.tick + (options.reducedMotion ? 0 : options.alpha);
  ctx.save();
  if (!options.reducedMotion) for (const s of paperStars) {
    ctx.fillStyle = `rgba(246,240,228,${strength * (.35 + .2 * Math.sin(time / 45 + s.phase))})`;
    const x = s.x * camera.width, y = s.y * camera.height;
    ctx.beginPath(); ctx.moveTo(x, y - s.size * 1.6); ctx.lineTo(x + s.size, y); ctx.lineTo(x, y + s.size * 1.6); ctx.lineTo(x - s.size, y); ctx.closePath(); ctx.fill();
  }
  const moonTime = (minute - 1260 + 1440) % 1440;
  if (moonTime < 480) {
    const t = moonTime / 480, x = camera.width * (.08 + .84 * t), y = camera.height * (.19 - .13 * Math.sin(t * Math.PI));
    ctx.fillStyle = `rgba(246,240,228,${strength * .85})`;
    ctx.beginPath(); ctx.moveTo(x + 4, y - 13); ctx.bezierCurveTo(x - 15, y - 8, x - 15, y + 13, x + 4, y + 13); ctx.bezierCurveTo(x - 5, y + 5, x - 5, y - 5, x + 4, y - 13); ctx.fill();
  }
  const lamps: { x: number; y: number }[] = [];
  for (const p of map.places) if (['inn', 'square', 'bridge'].includes(p.kind)) lamps.push({ x: p.door.x + .5, y: p.door.y + .5 });
  const watch = snapshot.villagers.find(v => v.id === 'dag' && v.activity !== 'sleep');
  if (watch && (minute >= 1320 || minute < 120)) lamps.push(watch.pos);
  ctx.globalCompositeOperation = 'lighter';
  for (const p of lamps) {
    const x = view.ox + p.x * z, y = view.oy + p.y * z;
    if (x < -3 * z || y < -3 * z || x > camera.width + 3 * z || y > camera.height + 3 * z) continue;
    const g = ctx.createRadialGradient(x, y - z * .4, 0, x, y - z * .4, z * 2.6);
    g.addColorStop(0, `rgba(255,191,89,${.32 * strength})`); g.addColorStop(.3, `rgba(255,176,74,${.12 * strength})`); g.addColorStop(1, 'rgba(255,176,74,0)');
    ctx.fillStyle = g; ctx.fillRect(x - z * 2.6, y - z * 3, z * 5.2, z * 5.2);
    ctx.fillStyle = '#F7CF83'; ctx.fillRect(x - z * .07, y - z * .65, z * .14, z * .22);
  }
  for (const v of snapshot.villagers) {
    if (v.activity === 'sleep' || !lamps.some(p => Math.hypot(p.x - v.pos.x, p.y - v.pos.y) < 2.6)) continue;
    const x = view.ox + v.pos.x * z, y = view.oy + (v.pos.y - .45) * z;
    ctx.strokeStyle = `rgba(255,204,123,${strength * .32})`; ctx.lineWidth = Math.max(.7, z * .035);
    ctx.beginPath(); ctx.ellipse(x, y, z * .23, z * .42, -.15, Math.PI * .65, Math.PI * 1.6); ctx.stroke();
  }
  ctx.strokeStyle = `rgba(194,210,244,${strength * .2})`; ctx.lineWidth = Math.max(.6, z * .035);
  for (const p of waterGlints(map)) {
    const x = view.ox + p.x * z, y = view.oy + p.y * z;
    if (x < 0 || y < 0 || x > camera.width || y > camera.height) continue;
    ctx.beginPath(); ctx.moveTo(x - z * .3, y); ctx.lineTo(x + z * .3, y); ctx.stroke();
  }
  ctx.restore();
}
