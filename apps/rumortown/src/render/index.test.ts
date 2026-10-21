import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Camera, Look, RenderOptions, VillageMap, VillagerView, WorldSnapshot } from '../sim/types.js';
import { CLOSE_ZOOM, createRenderer, fitZoom } from './index.js';
import { SpriteCache } from './sprites.js';
import { cast } from '../content/cast/index.js';
import * as daylightPainter from './daylight.js';
import * as interiors from './interiors.js';
import * as tiles from './tiles.js';

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
    measureText: (text: string) => ({ width: text.length * 7 }),
    createPattern: () => ({}),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    getTransform: () => ({ a: 1 }),
  };
  const context = new Proxy(state, { get: (target, key) => Reflect.get(target, key) ?? noop });
  return { width: 360, height: 640, clientWidth: 360, clientHeight: 640, style: {}, blits, getContext: () => context } as unknown as HTMLCanvasElement & { blits: Blit[] };
}

function roofImage(canvas: HTMLCanvasElement & { blits: Blit[] }): unknown {
  return canvas.blits.find((b) => b.args.length === 4 && (b.args[2] ?? 0) > (b.args[3] ?? 0) * 2)?.image;
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
  it('keeps a vanished snapshot speaker faded for two seconds after its last sighting', () => {
    const clock = vi.spyOn(performance, 'now').mockReturnValue(100);
    const speaking = snapshot([{ ...villager('mira'), bubble: { text: 'Hello', untilTick: 11 } }]);
    const { renderer, canvas } = setup(speaking);
    const roof = roofImage(canvas);
    expect(roof).toBeDefined();
    const quiet = snapshot([villager('mira')]);
    const opacityAt = (now: number, cur: WorldSnapshot) => {
      clock.mockReturnValue(now);
      canvas.blits.length = 0;
      renderer.render(null, cur, camera(), options);
      return canvas.blits.find((b) => b.image === roof)?.alpha;
    };
    // Refresh the last sighting even if the simulation has not emitted a new snapshot.
    expect(opacityAt(500, speaking)).toBe(0.35);
    expect(opacityAt(501, quiet)).toBe(0.35);
    expect(opacityAt(2100, quiet)).toBe(0.35); // UI's 1.6 second tail.
    expect(opacityAt(2499, quiet)).toBe(0.35);
    expect(opacityAt(2500, quiet)).toBe(1);
  });

  it('tracks recent speakers by id across reordering and refreshes their grace period', () => {
    const clock = vi.spyOn(performance, 'now').mockReturnValue(0);
    const speaking = snapshot([{ ...villager('mira', 25, 20), bubble: { text: 'Hello', untilTick: 11 } }, villager('tom', 25, 20)]);
    const { renderer, canvas } = setup(speaking);
    const roof = roofImage(canvas);
    const quiet = snapshot([villager('tom', 25, 20), villager('mira')]);
    clock.mockReturnValue(1600);
    canvas.blits.length = 0;
    renderer.render(null, quiet, camera(), options);
    expect(canvas.blits.find((b) => b.image === roof)?.alpha).toBe(0.35);
    quiet.villagers[1]!.bubble = { text: 'Again', untilTick: 11 };
    clock.mockReturnValue(1700);
    renderer.render(null, quiet, camera(), options);
    delete quiet.villagers[1]!.bubble;
    clock.mockReturnValue(3600);
    canvas.blits.length = 0;
    renderer.render(null, quiet, camera(), options);
    expect(canvas.blits.find((b) => b.image === roof)?.alpha).toBe(0.35);
    clock.mockReturnValue(3700);
    canvas.blits.length = 0;
    renderer.render(null, quiet, camera(), options);
    expect(canvas.blits.find((b) => b.image === roof)?.alpha).toBe(1);
  });

  it.each(['stranger', 'selected', 'speaking'] as const)('fades a roof overlapping the %s and restores opacity for later drawing', (kind) => {
    const v = villager('mira');
    if (kind === 'speaking') v.bubble = { text: 'Hello', untilTick: 11 };
    const cur = snapshot(kind === 'stranger' ? [] : [v]);
    if (kind === 'stranger') cur.player.pos = { x: 13.5, y: 11.5 };
    const opts = { ...options, selected: kind === 'selected' ? v.id : undefined };
    const { renderer, canvas } = setup(cur, camera(), opts);
    const roof = roofImage(canvas);
    expect(roof).toBeDefined();
    expect(canvas.blits.find((b) => b.image === roof)?.alpha).toBe(0.35);
    expect(canvas.getContext('2d')?.globalAlpha).toBe(1);

    cur.player.pos = { x: 25, y: 20 };
    v.pos = { x: 25, y: 20 };
    canvas.blits.length = 0;
    renderer.render(null, cur, camera(), opts);
    expect(canvas.blits.find((b) => b.image === roof)?.alpha).toBe(1);
  });

  it.each(['ordinary', 'expired', 'empty'] as const)('keeps full opacity for an overlapping %s villager', (kind) => {
    const v = villager('mira');
    if (kind !== 'ordinary') v.bubble = { text: kind === 'empty' ? '' : 'Hello', untilTick: kind === 'expired' ? 10 : 11 };
    const { canvas } = setup(snapshot([v]));
    const roof = roofImage(canvas);
    expect(canvas.blits.find((b) => b.image === roof)?.alpha).toBe(1);
  });

  it('uses the interpolated position and fades at the far zoom too', () => {
    const cur = snapshot([villager('mira', 13.5, 13)]);
    const cam = camera(fitZoom(village(), 360, 640));
    const opts = { ...options, selected: 'mira', alpha: 0 };
    const { renderer, canvas } = setup(cur, cam, opts);
    const previous = snapshot([villager('mira')]);
    canvas.blits.length = 0;
    renderer.render(previous, cur, cam, opts);
    const roof = roofImage(canvas);
    expect(canvas.blits.find((b) => b.image === roof)?.alpha).toBe(0.35);
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
    // The unprepared intermediate zoom queued work, superseded by the final close frame.
    expect(callbacks).toHaveLength(1);
    drainIdle();
    expect(callbacks).toHaveLength(0);
    expect(canvas.blits.length).toBeGreaterThan(0);
  });

  it('renders an unprepared inset far zoom within 4 ms, then switches to its exact layer and sprites', () => {
    const cur = snapshot(Array.from({ length: 24 }, (_, i) => villager(`villager-${i}`, 13 + i % 6, 11 + Math.floor(i / 6))));
    const { renderer, canvas, map } = setup(cur);
    const paint = vi.spyOn(tiles, 'paintGroundSteps');
    const cached = vi.spyOn(SpriteCache.prototype, 'cachedVillager');
    const stranger = vi.spyOn(SpriteCache.prototype, 'cachedStranger');
    // The UI derives its far zoom from space left over after its controls.
    const zoom = fitZoom(map, 360 - 32, 640 - 144);
    const cam = camera(zoom);
    const prepared = canvases.length;
    canvas.blits.length = 0;
    const start = performance.now();
    renderer.render(null, cur, cam, options);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(4);
    expect(canvases).toHaveLength(prepared);
    expect(paint).not.toHaveBeenCalled();
    const fallback = canvas.blits.find(b => b.args.length === 8)?.image;
    expect(fallback).toBeDefined();
    expect(callbacks).toHaveLength(1);
    renderer.render(null, cur, cam, options);
    expect(callbacks).toHaveLength(1); // Same zoom does not enqueue duplicate work.
    callbacks.shift()?.({ didTimeout: true, timeRemaining: () => 0 });
    canvas.blits.length = 0;
    renderer.render(null, cur, cam, options);
    expect(canvas.blits.find(b => b.args.length === 8)?.image).toBe(fallback); // Private layer is not published without sprites.
    drainIdle();
    expect(paint).toHaveBeenCalledTimes(1);
    expect(paint.mock.calls[0]?.[2]).toBe(zoom);
    const complete = canvases.length;
    canvas.blits.length = 0;
    cached.mockClear();
    stranger.mockClear();
    renderer.render(null, cur, cam, options);
    expect(canvases).toHaveLength(complete);
    const exact = canvas.blits.find(b => b.args.length === 8)?.image as HTMLCanvasElement;
    expect(exact).not.toBe(fallback);
    expect(exact.width).toBe(Math.ceil((map.width + tiles.LAYER_MARGIN * 2) * zoom));
    expect(canvas.getContext('2d')?.imageSmoothingQuality).toBe('low');
    expect(cached).toHaveBeenCalledTimes(24);
    expect(cached.mock.calls.every((args) => args[5] === zoom)).toBe(true);
    expect(cached.mock.results.every((r) => r.value !== undefined)).toBe(true);
    expect(stranger.mock.calls[0]?.[2]).toBe(zoom);
    expect(stranger.mock.results[0]?.value).toBeDefined();
    expect(callbacks).toHaveLength(0);
  });

  it('abandons a superseded zoom and discards pending preparation on resize', () => {
    const cur = snapshot([villager('mira')]);
    const { renderer, canvas, map } = setup(cur);
    const paint = vi.spyOn(tiles, 'paintGroundSteps');
    renderer.render(null, cur, camera(6.1), options);
    renderer.render(null, cur, camera(6.2), options);
    drainIdle();
    expect(paint.mock.calls.map((args) => args[2])).toEqual([6.2]);
    renderer.render(null, cur, camera(6.3), options);
    // Begin the private ground layer, leaving its sprite preparation pending.
    callbacks.shift()?.({ didTimeout: true, timeRemaining: () => 0 });
    renderer.resize(360, 640, 2);
    drainIdle();
    const zoom = fitZoom(map, 328, 496);
    renderer.render(null, cur, camera(zoom), options);
    drainIdle();
    canvas.blits.length = 0;
    renderer.render(null, cur, camera(zoom), options);
    const exact = canvas.blits.find(b => b.args.length === 8)?.image as HTMLCanvasElement;
    expect(exact.width).toBe(Math.ceil((map.width + tiles.LAYER_MARGIN * 2) * zoom * 2));
    expect(canvas.getContext('2d')?.imageSmoothingQuality).toBe('low');
  });

  it.each(['newer zoom', 'resize'] as const)('cancels an in-progress texture pass on %s', (cause) => {
    const cur = snapshot([villager('mira')]);
    const { renderer, canvas, map } = setup(cur);
    const before = canvases.length;
    renderer.render(null, cur, camera(31), options);
    // One iterator step per callback: enter the ground texture pass, then interrupt it.
    for (let i = 0; i < 30; i++) callbacks.shift()?.({ didTimeout: true, timeRemaining: () => 0 });
    const discarded = canvases[before] as ReturnType<typeof canvasStub>;
    expect(discarded.blits.length).toBeGreaterThan(0);
    const painted = discarded.blits.length;
    if (cause === 'resize') renderer.resize(360, 640, 2);
    renderer.render(null, cur, camera(30), options);
    drainIdle();
    expect(discarded.blits).toHaveLength(painted);
    canvas.blits.length = 0;
    renderer.render(null, cur, camera(30), options);
    const exact = canvas.blits.find(b => b.args.length === 8)?.image as HTMLCanvasElement;
    expect(exact).not.toBe(discarded);
    expect(exact.width).toBe(Math.ceil((map.width + tiles.LAYER_MARGIN * 2) * 30 * (cause === 'resize' ? 2 : 1)));
    expect(canvas.getContext('2d')?.imageSmoothingQuality).toBe('low');
  });

  it('bounds the cache while retaining close and the two most recent exact zooms', () => {
    const cur = snapshot();
    const { renderer } = setup(cur);
    const paint = vi.spyOn(tiles, 'paintGroundSteps');
    for (const zoom of [6.1, 6.2, 6.3, 6.4]) {
      renderer.render(null, cur, camera(zoom), options);
      drainIdle();
    }
    expect(paint).toHaveBeenCalledTimes(4);
    for (const zoom of [CLOSE_ZOOM, 6.3, 6.4]) renderer.render(null, cur, camera(zoom), options);
    expect(callbacks).toHaveLength(0);
    renderer.render(null, cur, camera(6.1), options);
    expect(callbacks).toHaveLength(1);
    drainIdle();
    expect(paint).toHaveBeenCalledTimes(5);
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

it('prepares the map in idle slices and signals readiness only after it can draw the felt village', () => {
  const paint = vi.spyOn(tiles, 'paintGroundSteps');
  const ready = vi.fn();
  const renderer = createRenderer(canvasStub(), village());
  renderer.resize(360, 640, 1);
  expect(paint).not.toHaveBeenCalled();
  const opts = { ...options, onReady: ready };
  renderer.render(null, snapshot([villager('mira')]), camera(), opts);
  expect(paint).not.toHaveBeenCalled();
  expect(ready).not.toHaveBeenCalled();
  drainIdle();
  expect(paint).toHaveBeenCalled();
  renderer.render(null, snapshot([villager('mira')]), camera(), opts);
  expect(ready).toHaveBeenCalledOnce();
});
it('redraws both Show me participants over the dimmed village', () => {
  const cur = snapshot([villager('mira'), villager('ben')]);
  const { renderer } = setup(cur);
  const cached = vi.spyOn(SpriteCache.prototype, 'cachedVillager');
  const opts = { ...options, spotlight: ['mira', 'ben'] };
  renderer.render(null, cur, camera(), opts);
  expect(cached).toHaveBeenCalledTimes(4);
});


describe('small cached interiors', () => {
  it('repaints only room patches after occupancy or a 0.05 glow step changes', () => {
    const cur = snapshot([villager('mira', 14, 14)]);
    const { renderer } = setup(cur);
    const ground = vi.spyOn(tiles, 'paintGroundSteps');
    const furniture = vi.spyOn(interiors, 'drawInterior');
    const canvasCount = canvases.length;
    for (let i = 0; i < 10; i++) renderer.render(null, cur, camera(), options);
    drainIdle();
    expect(furniture).not.toHaveBeenCalled();
    const dusk = { ...cur, minuteOfDay: 1200 };
    renderer.render(cur, dusk, camera(), options);
    expect(furniture).not.toHaveBeenCalled();
    drainIdle();
    expect(furniture).toHaveBeenCalled();
    expect(furniture.mock.calls.some(call => call[3].glow === 1 && call[3].occupied)).toBe(true);
    expect(ground).not.toHaveBeenCalled();
    expect(canvases).toHaveLength(canvasCount);
    furniture.mockClear();
    const empty = { ...dusk, villagers: [] };
    renderer.render(dusk, empty, camera(), options);
    drainIdle();
    expect(furniture.mock.calls.some(call => call[3].glow === 0 && !call[3].occupied)).toBe(true);
    expect(ground).not.toHaveBeenCalled();
  });
});


describe('finished world light and the expanded cast', () => {
  it('applies the controller tint once per frame without rebuilding cached ground', () => {
    const cur = snapshot();
    const { renderer } = setup(cur);
    const tint = vi.spyOn(daylightPainter, 'drawDaylight');
    const ground = vi.spyOn(tiles, 'paintGroundSteps');
    const count = canvases.length;
    for (const minuteOfDay of [420, 720, 1080, 1290]) renderer.render(null, { ...cur, minuteOfDay }, camera(), options);
    expect(tint).toHaveBeenCalledTimes(4);
    expect(tint.mock.calls.map(call => call[3].windows)).toEqual([.3, 0, .5, 1]);
    expect(ground).not.toHaveBeenCalled();
    expect(canvases).toHaveLength(count);
  });

  it('draws all 36 prepared appearances across three walk frames without composing canvases', () => {
    const cur = snapshot(cast.map((d, i) => ({ ...villager(d.id, 9 + i % 9 * 1.6, 8 + Math.floor(i / 9) * 2), look: d.look, tier: d.tier, moving: true })));
    const cam = camera(CLOSE_ZOOM, 1440, 900);
    const { renderer } = setup(cur, cam);
    const cached = vi.spyOn(SpriteCache.prototype, 'cachedVillager');
    const count = canvases.length;
    for (let tick = 10; tick < 20; tick++) renderer.render(null, { ...cur, tick }, cam, { ...options, reducedMotion: false });
    expect(cached).toHaveBeenCalledTimes(360);
    expect(new Set(cached.mock.calls.map(call => call[2])).size).toBe(3);
    expect(cached.mock.results.every(result => result.value !== undefined)).toBe(true);
    expect(canvases).toHaveLength(count);
  });
});
