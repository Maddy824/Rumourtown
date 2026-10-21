import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Camera, Look, RenderOptions, VillageMap, VillagerView, WorldSnapshot } from '../sim/types.js';
import { CLOSE_ZOOM, createRenderer, fitZoom } from './index.js';
import * as roofPainter from './roofs.js';
import { SpriteCache } from './sprites.js';

interface Blit { image: unknown; alpha: number; args: number[] }

/** A command-recording canvas; these tests need neither a DOM nor a browser rasterizer. */
function canvasStub(): HTMLCanvasElement & { blits: Blit[] } {
  const blits: Blit[] = [];
  const alphas: number[] = [];
  const noop = () => {};
  const gradient = { addColorStop: noop };
  const state = {
    globalAlpha: 1,
    drawImage(image: unknown, ...args: number[]) { blits.push({ image, args, alpha: state.globalAlpha }); },
    save() { alphas.push(state.globalAlpha); },
    restore() { state.globalAlpha = alphas.pop() ?? 1; },
    createPattern: () => ({}),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    getTransform: () => ({ a: 1 }),
  };
  const context = new Proxy(state, { get: (target, key) => Reflect.get(target, key) ?? noop });
  return { width: 360, height: 640, clientWidth: 360, clientHeight: 640, style: {}, blits, getContext: () => context } as unknown as HTMLCanvasElement & { blits: Blit[] };
}

const look: Look = { body: 'round', skin: '#C98F69', hair: { style: 'short', color: '#604532' }, hat: 'cap', top: '#6B8E4E', bottom: '#3F5E8A', prop: 'none' };
function villager(id: string, x = 13.5, y = 11.5): VillagerView {
  return { id, name: id, tier: 'regular', pos: { x, y }, facing: 's', moving: false, activity: 'idle', look, mood: 0 };
}
function snapshot(villagers: VillagerView[] = []): WorldSnapshot {
  return { tick: 10, dayIndex: 0, minuteOfDay: 430, villagers, player: { pos: { x: 25, y: 20 }, facing: 's', moving: false }, threads: [] };
}
function village(): VillageMap {
  const map: VillageMap = { width: 48, height: 32, tiles: new Array(48 * 32).fill('grass'), places: [] };
  for (let y = 12; y <= 16; y++) for (let x = 12; x <= 17; x++) {
    map.tiles[y * map.width + x] = x === 12 || x === 17 || y === 12 || y === 16 ? 'wall' : 'floor';
  }
  map.tiles[20 * map.width + 30] = 'tree';
  return map;
}
const options: RenderOptions = { threads: false, alpha: 1, reducedMotion: true };
const camera = (zoom = CLOSE_ZOOM, width = 360, height = 640): Camera => ({ center: { x: 15, y: 12 }, zoom, width, height });

let canvases: HTMLCanvasElement[];
let callbacks: IdleRequestCallback[];

function drainIdle(): void {
  let steps = 0;
  while (callbacks.length) {
    if (++steps > 5000) throw new Error('Idle preparation did not finish');
    callbacks.shift()?.({ didTimeout: false, timeRemaining: () => 50 });
  }
}

function setup(cur: WorldSnapshot, cam = camera(), opts = options) {
  const canvas = canvasStub();
  const map = village();
  const renderer = createRenderer(canvas, map);
  renderer.resize(cam.width, cam.height, 1);
  renderer.render(null, cur, cam, opts);
  drainIdle();
  canvas.blits.length = 0;
  renderer.render(null, cur, cam, opts);
  return { renderer, canvas, map };
}

beforeEach(() => {
  canvases = [];
  callbacks = [];
  vi.stubGlobal('document', { createElement: () => { const canvas = canvasStub(); canvases.push(canvas); return canvas; } });
  vi.stubGlobal('window', {
    devicePixelRatio: 1,
    requestIdleCallback: (callback: IdleRequestCallback) => { callbacks.push(callback); return callbacks.length; },
    setTimeout: (callback: () => void) => { callbacks.push(callback); return callbacks.length; },
  });
  vi.stubGlobal('Path2D', class { constructor() { return new Proxy(this, { get: () => () => {} }); } });
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('villager hit testing', () => {
  it('selects the later drawn of two overlapping villagers at equal depth', () => {
    const cur = snapshot([villager('mira'), villager('tom')]);
    const { renderer } = setup(cur);
    const p = renderer.project({ x: 13.5, y: 11 }, camera());
    expect(renderer.villagerAt(p.x, p.y, cur, camera())).toBe('tom');
  });

  it('reverses the retained drawing permutation when depths become equal', () => {
    const first = snapshot([villager('mira', 13.5, 11.7), villager('tom')]);
    const { renderer } = setup(first);
    const tied = snapshot([villager('mira'), villager('tom')]);
    renderer.render(first, tied, camera(), options);
    const p = renderer.project({ x: 13.5, y: 11 }, camera());
    // The insertion sort retains Tom, Mira from the preceding frame.
    expect(renderer.villagerAt(p.x, p.y, tied, camera())).toBe('mira');
  });

  it('selects the deeper body using the interpolated positions that were drawn', () => {
    const previous = snapshot([villager('mira', 13.5, 11.8), villager('tom', 13.5, 11.4)]);
    const cur = snapshot([villager('mira', 13.5, 11.2), villager('tom', 13.5, 11.6)]);
    const { renderer } = setup(cur);
    renderer.render(previous, cur, camera(), { ...options, alpha: 0.25 });
    const p = renderer.project({ x: 13.5, y: 11 }, camera());
    expect(renderer.villagerAt(p.x, p.y, cur, camera())).toBe('mira');
  });

  it('breaks equal-depth ties in reverse snapshot order before any drawing', () => {
    const renderer = createRenderer(canvasStub(), village());
    const cur = snapshot([villager('mira'), villager('tom')]);
    const p = renderer.project({ x: 13.5, y: 11 }, camera());
    expect(renderer.villagerAt(p.x, p.y, cur, camera())).toBe('tom');
    expect(renderer.villagerAt(-1000, -1000, cur, camera())).toBeNull();
  });
});

describe('local roof transparency', () => {
  it.each(['stranger', 'selected', 'speaking'] as const)('fades a roof overlapping the %s and restores opacity for later drawing', (kind) => {
    const roofs = vi.spyOn(roofPainter, 'buildRoofs');
    const v = villager('mira');
    if (kind === 'speaking') v.bubble = { text: 'Hello', untilTick: 11 };
    const cur = snapshot(kind === 'stranger' ? [] : [v]);
    if (kind === 'stranger') cur.player.pos = { x: 13.5, y: 11.5 };
    const opts = { ...options, selected: kind === 'selected' ? v.id : undefined };
    const { renderer, canvas } = setup(cur, camera(), opts);
    const roof = roofs.mock.results.flatMap((r) => r.value ?? []).find((r) => r.w > 200);
    expect(roof).toBeDefined();
    expect(canvas.blits.find((b) => b.image === roof?.img)?.alpha).toBe(0.35);
    expect(canvas.getContext('2d')?.globalAlpha).toBe(1);

    cur.player.pos = { x: 25, y: 20 };
    v.pos = { x: 25, y: 20 };
    canvas.blits.length = 0;
    renderer.render(null, cur, camera(), opts);
    expect(canvas.blits.find((b) => b.image === roof?.img)?.alpha).toBe(1);
  });

  it.each(['ordinary', 'expired', 'empty'] as const)('keeps full opacity for an overlapping %s villager', (kind) => {
    const roofs = vi.spyOn(roofPainter, 'buildRoofs');
    const v = villager('mira');
    if (kind !== 'ordinary') v.bubble = { text: kind === 'empty' ? '' : 'Hello', untilTick: kind === 'expired' ? 10 : 11 };
    const { canvas } = setup(snapshot([v]));
    const roof = roofs.mock.results.flatMap((r) => r.value ?? []).find((r) => r.w > 200);
    expect(canvas.blits.find((b) => b.image === roof?.img)?.alpha).toBe(1);
  });

  it('uses the interpolated position and fades at the far zoom too', () => {
    const roofs = vi.spyOn(roofPainter, 'buildRoofs');
    const cur = snapshot([villager('mira', 13.5, 13)]);
    const cam = camera(fitZoom(village(), 360, 640));
    const opts = { ...options, selected: 'mira', alpha: 0 };
    const { renderer, canvas } = setup(cur, cam, opts);
    const previous = snapshot([villager('mira')]);
    canvas.blits.length = 0;
    renderer.render(previous, cur, cam, opts);
    const roof = roofs.mock.results.at(-1)?.value[0];
    expect(canvas.blits.find((b) => b.image === roof?.img)?.alpha).toBe(0.35);
  });
});

describe('prepared zoom and sprite caches', () => {
  it('never creates canvases or composes sprites in cold, switched or intermediate zoom frames', () => {
    const compose = vi.spyOn(SpriteCache.prototype, 'villager');
    const stranger = vi.spyOn(SpriteCache.prototype, 'stranger');
    const cur = snapshot([villager('mira'), { ...villager('tom'), tier: 'core' }]);
    const canvas = canvasStub();
    const map = village();
    const renderer = createRenderer(canvas, map);
    renderer.resize(360, 640, 1);
    const before = canvases.length;
    renderer.render(null, cur, camera(), options);
    expect(canvases).toHaveLength(before);
    expect(compose).not.toHaveBeenCalled();
    drainIdle();
    expect(compose).toHaveBeenCalled();
    const prepared = canvases.length;
    compose.mockClear();
    stranger.mockClear();
    const cached = vi.spyOn(SpriteCache.prototype, 'cachedVillager');
    const cachedStranger = vi.spyOn(SpriteCache.prototype, 'cachedStranger');
    const clock = vi.spyOn(performance, 'now');
    for (const zoom of [CLOSE_ZOOM, fitZoom(map, 360, 640), 19, 19, 19, CLOSE_ZOOM]) {
      for (const facing of ['s', 'n', 'e', 'w'] as const) for (const mood of [-1, 0, 1]) {
        cur.villagers.forEach((v) => { v.facing = facing; v.mood = mood; v.moving = true; });
        cur.player.facing = facing;
        cur.player.moving = true;
        for (const now of [0, 170]) {
          clock.mockReturnValue(now);
          renderer.render(null, cur, camera(zoom), options);
        }
      }
    }
    expect(canvases).toHaveLength(prepared);
    expect(compose).not.toHaveBeenCalled();
    expect(stranger).not.toHaveBeenCalled();
    expect(cached).toHaveBeenCalledTimes(288);
    expect(cached.mock.results.every((r) => r.value !== undefined)).toBe(true);
    expect(cachedStranger).toHaveBeenCalledTimes(144);
    expect(cachedStranger.mock.results.every((r) => r.value !== undefined)).toBe(true);
    expect(callbacks).toHaveLength(0);
    expect(canvas.blits.length).toBeGreaterThan(0);
  });

  it('rebuilds both caches outside rendering after viewport and DPR changes, including interrupted preparation', () => {
    const cur = snapshot([villager('mira')]);
    const { renderer, map } = setup(cur);
    renderer.resize(1440, 900, 2);
    // Supersede the queued DPR-2 wardrobe before it completes.
    renderer.resize(360, 640, 3);
    drainIdle();
    const prepared = canvases.length;
    for (const zoom of [CLOSE_ZOOM, fitZoom(map, 360, 640)]) renderer.render(null, cur, camera(zoom), options);
    expect(canvases).toHaveLength(prepared);
    expect(callbacks).toHaveLength(0);
  });

  it('defers implicit first sizing and new Looks instead of doing cache work in render', () => {
    const canvas = canvasStub();
    const renderer = createRenderer(canvas, village());
    const cur = snapshot([villager('mira')]);
    const cam = camera(CLOSE_ZOOM, 1440, 900);
    const before = canvases.length;
    renderer.render(null, cur, cam, options);
    expect(canvases).toHaveLength(before);
    drainIdle();
    renderer.render(null, cur, cam, options);
    const prepared = canvases.length;
    const changed = snapshot([{ ...villager('mira'), look: { ...look, top: '#A3323B' } }]);
    renderer.render(null, changed, cam, options);
    expect(canvases).toHaveLength(prepared);
    drainIdle();
    const next = canvases.length;
    renderer.render(null, changed, cam, options);
    expect(canvases).toHaveLength(next);
  });
});
