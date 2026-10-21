import { describe, expect, it } from 'vitest';
import { TILE, type Camera, type VillageMap } from '../sim/types.js';
import { computeView, fitZoom, makeView, project, unproject } from './camera.js';

const map: VillageMap = { width: 48, height: 32, tiles: new Array(48 * 32).fill('grass'), places: [] };
const cam = (x: number, y: number, zoom = TILE, width = 360, height = 640): Camera => ({ center: { x, y }, zoom, width, height });

describe('camera', () => {
  it('puts the centre tile in the middle of the viewport', () => {
    const p = project(map, { x: 20, y: 15 }, cam(20, 15));
    expect(p.x).toBeCloseTo(180);
    expect(p.y).toBeCloseTo(320);
  });

  it('unproject inverts project at both zooms', () => {
    for (const zoom of [TILE, fitZoom(map, 1440, 900), 7.5]) {
      const c = cam(30.3, 9.7, zoom, 1440, 900);
      const world = { x: 12.25, y: 21.75 };
      const s = project(map, world, c);
      const back = unproject(map, s.x, s.y, c);
      expect(back.x).toBeCloseTo(world.x, 6);
      expect(back.y).toBeCloseTo(world.y, 6);
    }
  });

  it('clamps the close camera so the map edge never shows', () => {
    for (const [x, y] of [[0, 0], [48, 32], [-5, 40], [47.9, 0.1]] as const) {
      const v = computeView(map, cam(x, y), makeView());
      expect(v.ox).toBeLessThanOrEqual(0);
      expect(v.oy).toBeLessThanOrEqual(0);
      expect(v.ox + map.width * v.zoom).toBeGreaterThanOrEqual(360);
      expect(v.oy + map.height * v.zoom).toBeGreaterThanOrEqual(640);
    }
  });

  it('centres the whole map at the far zoom', () => {
    const zoom = fitZoom(map, 1440, 900);
    expect(map.width * zoom).toBeLessThanOrEqual(1440);
    expect(map.height * zoom).toBeLessThanOrEqual(900);
    const v = computeView(map, cam(3, 3, zoom, 1440, 900), makeView());
    expect(v.ox + (map.width * zoom) / 2).toBeCloseTo(720);
    expect(v.oy + (map.height * zoom) / 2).toBeCloseTo(450);
  });

  it('falls back to the close zoom for a bad zoom value', () => {
    expect(computeView(map, cam(20, 15, Number.NaN), makeView()).zoom).toBe(TILE);
  });
});
