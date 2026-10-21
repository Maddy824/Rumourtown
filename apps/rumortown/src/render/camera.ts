/**
 * Camera maths shared by render, project, unproject and hit-testing, so a tap lands exactly
 * where the frame was drawn. The centre is clamped so the map edge never shows when the map
 * is larger than the viewport (the close zoom), and the map is centred when it is smaller
 * (the far zoom).
 */
import { TILE, type Camera, type Vec2, type VillageMap } from '../sim/types.js';

/** Where tile (0, 0) lands on screen, in CSS pixels, and the pixels per tile. */
export interface View {
  ox: number;
  oy: number;
  zoom: number;
}

export function makeView(): View {
  return { ox: 0, oy: 0, zoom: TILE };
}

function clampAxis(center: number, tiles: number, viewport: number, zoom: number): number {
  const extent = tiles * zoom;
  if (extent <= viewport) return tiles / 2;
  const half = viewport / 2 / zoom;
  return Math.min(Math.max(center, half), tiles - half);
}

/** Fills `out` with the clamped view for this camera. Allocation-free. */
export function computeView(map: VillageMap, camera: Camera, out: View): View {
  const zoom = camera.zoom > 0 && Number.isFinite(camera.zoom) ? camera.zoom : TILE;
  const cx = clampAxis(Number.isFinite(camera.center.x) ? camera.center.x : map.width / 2, map.width, camera.width, zoom);
  const cy = clampAxis(Number.isFinite(camera.center.y) ? camera.center.y : map.height / 2, map.height, camera.height, zoom);
  out.ox = camera.width / 2 - cx * zoom;
  out.oy = camera.height / 2 - cy * zoom;
  out.zoom = zoom;
  return out;
}

const scratch = makeView();

export function project(map: VillageMap, pos: Vec2, camera: Camera): { x: number; y: number } {
  const v = computeView(map, camera, scratch);
  return { x: v.ox + pos.x * v.zoom, y: v.oy + pos.y * v.zoom };
}

export function unproject(map: VillageMap, px: number, py: number, camera: Camera): Vec2 {
  const v = computeView(map, camera, scratch);
  return { x: (px - v.ox) / v.zoom, y: (py - v.oy) / v.zoom };
}

/**
 * The far zoom: pixels per tile that fit the whole map in the viewport, leaving `margin`
 * CSS pixels on each side so the stitched edge of the village sheet shows.
 */
export function fitZoom(map: VillageMap, width: number, height: number, margin = 12): number {
  const w = Math.max(1, width - margin * 2);
  const h = Math.max(1, height - margin * 2);
  return Math.max(1, Math.min(w / map.width, h / map.height));
}
