import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { villageMap } from '../content/map/index.js';
import { findBuildings } from './buildings.js';
import { IDLE_BUDGET_MS, IdleQueue } from './idle.js';
import { prepareLayer, type Layer } from './layer.js';

let now: number;
let callbacks: IdleRequestCallback[];
let commands: number;

beforeEach(() => {
  now = 0;
  commands = 0;
  callbacks = [];
  // Charge each actual canvas/path command 1 us. Pure iterator overhead is charged
  // separately below. A whole-map texture pass would exceed the 3 ms slice by far.
  const command = () => { now += 0.001; commands++; };
  const gradient = { addColorStop: command };
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('window', { requestIdleCallback: (callback: IdleRequestCallback) => callbacks.push(callback) });
  vi.stubGlobal('Path2D', class { constructor() { return new Proxy(this, { get: () => command }); } });
  vi.stubGlobal('document', { createElement: () => {
    const context = new Proxy({
      createLinearGradient: () => { command(); return gradient; },
      createRadialGradient: () => { command(); return gradient; },
      getTransform: () => ({ a: 1 }),
      measureText: (text: string) => { command(); return { width: text.length * 7 }; },
    }, { get: (target, key) => Reflect.get(target, key) ?? command });
    return { width: 0, height: 0, getContext: () => context };
  } });
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('cooperative real-map layer construction', () => {
  it('keeps every close-zoom painting step and idle slice within budget and yields while painting', () => {
    const work = prepareLayer(villageMap, findBuildings(villageMap), 40, 1);
    const steps: number[] = [];
    let layer: Layer | undefined;
    function* measured(): Generator<void> {
      for (;;) {
        const start = now;
        now += 0.005;
        const step = work.next();
        steps.push(now - start);
        if (step.done) { layer = step.value; return; }
        yield;
      }
    }
    new IdleQueue().add(measured());
    const slices: number[] = [];
    const paintingAtYield: number[] = [];
    while (callbacks.length) {
      const start = now;
      callbacks.shift()?.({ didTimeout: false, timeRemaining: () => 50 });
      slices.push(now - start);
      if (!layer) paintingAtYield.push(commands);
    }
    expect(layer).toBeDefined();
    expect(layer?.standing.some((s) => s.roof)).toBe(true);
    expect(layer?.standing.some((s) => !s.roof)).toBe(true);
    expect(Math.max(...steps)).toBeLessThanOrEqual(1);
    expect(Math.max(...slices)).toBeLessThanOrEqual(IDLE_BUDGET_MS);
    expect(slices.length).toBeGreaterThan(1);
    expect(paintingAtYield.some((n, i) => i > 0 && n > (paintingAtYield[i - 1] ?? n))).toBe(true);
  });

  it('cancels inside a ground texture pass before any more canvas commands run', () => {
    let current = true;
    const work = prepareLayer(villageMap, findBuildings(villageMap), 40, 1, () => current);
    // Advance beyond surface setup into tile-by-tile ground painting.
    for (let i = 0; i < 20; i++) expect(work.next().done).toBe(false);
    const before = commands;
    current = false;
    expect(work.next()).toEqual({ done: true, value: undefined });
    expect(commands).toBe(before);
    expect(work.next().done).toBe(true);
    expect(commands).toBe(before);
  });
});
