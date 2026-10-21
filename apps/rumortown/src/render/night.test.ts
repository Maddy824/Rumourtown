import { describe, expect, it } from 'vitest';
import { daylight } from './daylight.js';
import { drawNight, isNight, nightStrength, paperStars, windowAwake } from './night.js';
import type { WorldSnapshot, Place, VillageMap, Camera } from '../sim/types.js';

describe('night light', () => {
  it('joins midnight continuously and preserves the authored daytime keys', () => {
    expect(daylight(1410)).toMatchObject({ multiply: { r: 30, g: 42, b: 74 }, multiplyAlpha: .62, softLightAlpha: .14, vignette: .3, windows: 1 });
    expect(daylight(180).multiplyAlpha).toBe(.7);
    expect(daylight(360)).toMatchObject({ multiplyAlpha: .2, softLight: { r: 242, g: 185, b: 160 }, softLightAlpha: .22 });
    expect(daylight(1440)).toEqual(daylight(0));
    expect(Math.abs(daylight(1439.99).multiplyAlpha - daylight(.01).multiplyAlpha)).toBeLessThan(.0001);
    expect(daylight(960).multiplyAlpha).toBe(0);
  });
  it('uses a bounded repeatable star scatter and the exact night interval', () => {
    expect(paperStars).toHaveLength(42);
    expect(paperStars.every(s => s.x >= 0 && s.x < 1 && s.y >= 0 && s.y < .24)).toBe(true);
    expect([1289, 1290, 1439, 0, 359, 360].map(isNight)).toEqual([false, true, true, true, true, false]);
    expect(nightStrength(0)).toBe(1); expect(nightStrength(720)).toBe(0);
  });
  it('lights only occupied awake rooms within opening hours', () => {
    const place = { kind: 'home', rect: { x: 0, y: 0, w: 6, h: 6 } } as Place;
    const snapshot = { minuteOfDay: 1350, villagers: [{ pos: { x: 2, y: 2 }, activity: 'rest' }] } as WorldSnapshot;
    expect(windowAwake(place, snapshot)).toBe(true);
    expect(windowAwake(place, { ...snapshot, villagers: [{ ...snapshot.villagers[0]!, activity: 'sleep' }] })).toBe(false);
    expect(windowAwake(place, { ...snapshot, minuteOfDay: 1380 })).toBe(false);
    expect(windowAwake({ ...place, kind: 'inn' }, { ...snapshot, minuteOfDay: 29 })).toBe(true);
    expect(windowAwake({ ...place, kind: 'inn' }, { ...snapshot, minuteOfDay: 30 })).toBe(false);
    expect(windowAwake({ ...place, kind: 'bakery' }, { ...snapshot, minuteOfDay: 270 })).toBe(true);
  });
  it('draws no paper stars under reduced motion and restores the canvas', () => {
    let stars = 0, saves = 0, restores = 0;
    const ctx = { save() { saves++; }, restore() { restores++; }, closePath() { stars++; }, beginPath() {}, moveTo() {}, lineTo() {}, bezierCurveTo() {}, fill() {}, stroke() {}, fillRect() {} } as unknown as CanvasRenderingContext2D;
    const map = { width: 1, height: 1, tiles: ['grass'], places: [] } as VillageMap;
    const snapshot = { minuteOfDay: 0, tick: 1080, villagers: [] } as unknown as WorldSnapshot;
    const camera = { width: 360, height: 640 } as Camera;
    const view = { ox: 0, oy: 0, zoom: 32 };
    drawNight(ctx, map, snapshot, camera, view, { reducedMotion: true, alpha: 1 }, new Set());
    expect(stars).toBe(0);
    drawNight(ctx, map, snapshot, camera, view, { reducedMotion: false, alpha: 1 }, new Set());
    expect(stars).toBe(42); expect(saves).toBe(2); expect(restores).toBe(2);
  });

  it('keeps a sleeping home dark at dawn when the night drawing has faded out', () => {
    const home = { id: 'home', kind: 'home', rect: { x: 0, y: 0, w: 6, h: 6 } } as Place;
    const map = { places: [home] } as VillageMap;
    const snapshot = { minuteOfDay: 360, villagers: [{ pos: { x: 2, y: 2 }, activity: 'sleep' }] } as WorldSnapshot;
    const occupied = new Set(['home']);
    drawNight({} as CanvasRenderingContext2D, map, snapshot, {} as Camera, { ox: 0, oy: 0, zoom: 40 }, { reducedMotion: false, alpha: 1 }, occupied);
    expect(daylight(360).windows).toBeGreaterThan(0);
    expect(occupied.has('home')).toBe(false);
  });

});
