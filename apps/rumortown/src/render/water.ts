/** A recessed river bed with flowing highlights, rather than a raised piece of felt. */
import type { Camera, VillageMap } from '../sim/types.js';
import { hash } from './grain.js';

export function* paintRiver(ctx: CanvasRenderingContext2D, map: VillageMap, zoom: number): Generator<void> {
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const kind = map.tiles[y * map.width + x];
      if (kind !== 'water' && kind !== 'bridge') continue;
      const px = x * zoom, py = y * zoom;
      const wet = (col: number): boolean => ['water', 'bridge'].includes(map.tiles[y * map.width + col] ?? '');
      ctx.fillStyle = '#27616b';
      ctx.fillRect(px, py, zoom, zoom + .5);
      const gradient = ctx.createLinearGradient(px, py, px + zoom, py);
      gradient.addColorStop(0, wet(x - 1) ? '#337e88' : '#173f47');
      gradient.addColorStop(.5, '#438e96');
      gradient.addColorStop(1, wet(x + 1) ? '#337e88' : '#173f47');
      ctx.fillStyle = gradient;
      ctx.fillRect(px, py, zoom + .3, zoom + .5);
      // Earth lips cast their shadow into the channel. No stitches across the water.
      for (const side of [-1, 1]) {
        if (wet(x + side)) continue;
        const bank = side < 0 ? px : px + zoom;
        ctx.fillStyle = '#6b7250';
        ctx.fillRect(bank - zoom * .06, py, zoom * .12, zoom + .3);
        ctx.fillStyle = 'rgba(15,42,41,.45)';
        ctx.fillRect(bank + (side < 0 ? zoom * .06 : -zoom * .15), py, zoom * .09, zoom + .3);
        // Reeds follow the bank, never the bridge deck.
        if (kind === 'water' && hash(x, y, 208) < .6) {
          ctx.strokeStyle = '#b1b67a';
          ctx.lineWidth = Math.max(.6, zoom * .035);
          ctx.beginPath();
          for (let i = 0; i < 3; i++) {
            const a = bank + side * zoom * .03 + i * zoom * .04;
            ctx.moveTo(a, py + zoom * .8);
            ctx.lineTo(a + side * zoom * .08, py + zoom * (.5 - i * .08));
          }
          ctx.stroke();
        }
      }
    }
    yield;
  }
}

/** Presentation only: time never enters the simulation or its random stream. */
export function drawCurrent(ctx: CanvasRenderingContext2D, map: VillageMap, camera: Camera, ox: number, oy: number, seconds: number): void {
  const z = camera.zoom;
  if (z < 7) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(204,236,221,.48)';
  ctx.lineWidth = Math.max(.7, z * .027);
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
    if (map.tiles[y * map.width + x] !== 'water') continue;
    const px = ox + x * z, py = oy + y * z;
    if (px + z < 0 || px > camera.width || py + z < 0 || py > camera.height) continue;
    const phase = (seconds * .18 + hash(x, y, 212)) % 1;
    const cx = px + z * (.25 + .5 * hash(x, y, 213));
    const cy = py + z * (.15 + phase * .65);
    ctx.moveTo(cx - z * .13, cy);
    ctx.quadraticCurveTo(cx, cy + z * .035, cx + z * .13, cy);
  }
  ctx.stroke();
  ctx.restore();
}
