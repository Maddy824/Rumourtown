/** Quiet sewn district details, painted once into each zoom's ground cache. */
import type { VillageMap } from '../sim/types.js';
import { districtAt, districtTiles, districtViews, signposts } from '../content/map/wayfinding.js';
import { INK, MOSS, OAT, PAPER, darken, mix } from './palette.js';

export function* paintDistricts(ctx: CanvasRenderingContext2D, map: VillageMap, z: number): Generator<void> {
  const metadata = districtTiles(map);
  ctx.save();
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const id = metadata[y * map.width + x]!.district;
      if (id === 'old-village') continue;
      ctx.fillStyle = districtViews.find(d => d.id === id)!.ground;
      ctx.globalAlpha = .82;
      ctx.fillRect(x * z, y * z, z + .1, z + .1);
      ctx.globalAlpha = 1;
      if (id === 'woodland' && map.tiles[y * map.width + x] === 'tree') {
        // Extra felt crowns around existing trees; no new obstacles.
        ctx.fillStyle = darken(MOSS, .2);
        for (const dx of [-.28, .28]) {
          ctx.beginPath(); ctx.ellipse((x + .5 + dx) * z, (y + .38) * z, .4 * z, .52 * z, 0, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    yield;
  }
  ctx.globalAlpha = .65;
  ctx.lineWidth = Math.max(.7, z * .025); ctx.setLineDash([z * .13, z * .09]);
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const id = metadata[y * map.width + x]!.district;
      ctx.strokeStyle = districtViews.find(d => d.id === id)!.trim;
      ctx.beginPath();
      if (y > 0 && metadata[(y - 1) * map.width + x]!.district !== id) { ctx.moveTo(x * z, y * z); ctx.lineTo((x + 1) * z, y * z); }
      if (x > 0 && metadata[y * map.width + x - 1]!.district !== id) { ctx.moveTo(x * z, y * z); ctx.lineTo(x * z, (y + 1) * z); }
      ctx.stroke();
    }
    yield;
  }
  ctx.restore();
}

export function* paintWayfinding(ctx: CanvasRenderingContext2D, map: VillageMap, z: number): Generator<void> {
  ctx.save();
  ctx.lineWidth = Math.max(.7, z * .025);
  ctx.strokeStyle = mix(INK, OAT, .55);
  for (const p of map.places.filter(p => p.kind === 'field')) {
    // Short fence runs leave every door and path open.
    for (let x = p.rect.x + 1; x < p.rect.x + p.rect.w - 1; x += 2) {
      ctx.setLineDash([z * .12, z * .06]);
      ctx.strokeRect(x * z, (p.rect.y + .15) * z, z, z * .22);
    }
    yield;
  }
  if (z >= 24) for (const post of signposts) {
    ctx.setLineDash([]); ctx.fillStyle = INK;
    ctx.fillRect((post.x + .8) * z, (post.y - 1.9) * z, z * .07, z * 2.1);
    post.arms.forEach((name, i) => {
      const x = (post.x + (i % 2 ? -.9 : .8)) * z, y = (post.y - 1.9 + i * .48) * z;
      ctx.fillStyle = PAPER; ctx.fillRect(x, y, z * 2.5, z * .43);
      ctx.strokeStyle = mix(INK, PAPER, .5); ctx.setLineDash([2, 2]); ctx.strokeRect(x + 2, y + 2, z * 2.5 - 4, z * .43 - 4);
      ctx.fillStyle = INK; ctx.font = `600 ${z * .27}px 'Bricolage Grotesque', sans-serif`; ctx.textAlign = 'center';
      ctx.fillText(name, x + z * 1.25, y + z * .3);
    });
    yield;
  }
  if (z >= 24) for (const home of map.places.filter(p => p.kind === 'home')) {
    const text = home.name.replace(' home', '');
    ctx.font = "600 11px 'Bricolage Grotesque', sans-serif";
    const w = ctx.measureText(text).width + 10;
    const x = (home.door.x + 1.2) * z, y = (home.door.y - .9) * z;
    ctx.fillStyle = PAPER; ctx.fillRect(x, y, w, 16);
    ctx.strokeStyle = mix(INK, PAPER, .4); ctx.setLineDash([2, 2]); ctx.strokeRect(x + 1, y + 1, w - 2, 14);
    ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.fillText(text, x + 5, y + 12);
    yield;
  }
  // Two folded paper boats beside the eastern jetties.
  for (const y of [16, 35]) {
    ctx.fillStyle = OAT; ctx.strokeStyle = INK; ctx.setLineDash([2, 2]);
    ctx.beginPath(); ctx.moveTo(42.1 * z, y * z); ctx.lineTo(42.8 * z, y * z); ctx.lineTo(42.6 * z, (y + .22) * z); ctx.lineTo(42.3 * z, (y + .22) * z); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = PAPER; ctx.beginPath(); ctx.moveTo(42.45 * z, y * z); ctx.lineTo(42.45 * z, (y - .45) * z); ctx.lineTo(42.75 * z, y * z); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

export function oldVillagePath(x: number, y: number): boolean { return districtAt({ x, y }) === 'old-village'; }
