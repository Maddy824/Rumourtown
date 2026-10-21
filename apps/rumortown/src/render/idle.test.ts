import { afterEach, describe, expect, it, vi } from 'vitest';
import { IdleQueue } from './idle.js';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('idle cache preparation', () => {
  it('yields after a small time slice and resumes the remaining work', () => {
    const callbacks: IdleRequestCallback[] = [];
    vi.stubGlobal('window', { requestIdleCallback: (callback: IdleRequestCallback) => callbacks.push(callback) });
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const steps: number[] = [];
    function* work() { for (let i = 0; i < 5; i++) { steps.push(i); now += 2; yield; } }
    const queue = new IdleQueue();
    queue.add(work());
    expect(steps).toEqual([]);
    callbacks.shift()?.({ didTimeout: false, timeRemaining: () => 50 });
    expect(steps).toEqual([0]);
    while (callbacks.length) callbacks.shift()?.({ didTimeout: false, timeRemaining: () => 50 });
    expect(steps).toEqual([0, 1, 2, 3, 4]);
  });

  it('makes one step on timeout without consuming a busy frame', () => {
    const callbacks: IdleRequestCallback[] = [];
    vi.stubGlobal('window', { requestIdleCallback: (callback: IdleRequestCallback) => callbacks.push(callback) });
    const step = vi.fn();
    function* work() { for (let i = 0; i < 3; i++) { step(); yield; } }
    new IdleQueue().add(work());
    callbacks.shift()?.({ didTimeout: true, timeRemaining: () => 0 });
    expect(step).toHaveBeenCalledTimes(1);
    expect(callbacks).toHaveLength(1);
  });

  it('uses a deferred timer when idle callbacks are unavailable', () => {
    const callbacks: (() => void)[] = [];
    vi.stubGlobal('window', { setTimeout: (callback: () => void) => callbacks.push(callback) });
    const step = vi.fn();
    function* work() { step(); yield; }
    new IdleQueue().add(work());
    expect(step).not.toHaveBeenCalled();
    callbacks.shift()?.();
    expect(step).toHaveBeenCalledOnce();
  });

  it('discards obsolete resize jobs while keeping the scheduled callback usable', () => {
    const callbacks: IdleRequestCallback[] = [];
    vi.stubGlobal('window', { requestIdleCallback: (callback: IdleRequestCallback) => callbacks.push(callback) });
    const obsolete = vi.fn();
    const fresh = vi.fn();
    function* work(step: () => void) { step(); yield; }
    const queue = new IdleQueue();
    queue.add(work(obsolete));
    queue.clear();
    queue.add(work(fresh));
    expect(callbacks).toHaveLength(1);
    callbacks.shift()?.({ didTimeout: false, timeRemaining: () => 50 });
    expect(obsolete).not.toHaveBeenCalled();
    expect(fresh).toHaveBeenCalledOnce();
  });
});
