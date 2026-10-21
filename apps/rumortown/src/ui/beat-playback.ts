import type { Exchange, ScriptLine } from './exchanges.js';
import type { Speed } from './timebar.js';

export const PLAY_RATES: Record<Speed, number> = { 0: 0, .5: 1, 1: 2, 2: 4, 8: 16 };
/** Real-time presentation only. A pause also freezes the line-reading clock. */
export function createBeatPlayback(script: (exchange: Exchange) => ScriptLine[] = exchange => exchange.lines) {
  let active: Exchange | null = null, index = 0, shownAt = 0, endedAt: number | null = null;
  let releaseAt = -Infinity, releaseRate = 0, released = '';
  const queue: Exchange[] = [];
  const seen = new Set<string>();
  let clock = 0;
  function begin(exchange: Exchange): void { active = exchange; index = 0; shownAt = clock; endedAt = null; released = ''; }
  function release(speed: Speed): void {
    if (!active || released === active.id) return;
    released = active.id; releaseAt = clock; releaseRate = speed === 8 ? 1 / .6 : 1 / 1.2;
  }
  function finish(speed: Speed): void { release(speed); active = null; }
  return {
    get active() { return active; },
    get line(): ScriptLine | undefined { return active ? script(active)[index] : undefined; },
    get pending() { return queue.length; },
    ignore(exchanges: readonly Exchange[]) { for (const exchange of exchanges) seen.add(exchange.id); },
    offer(exchange: Exchange): boolean { if (seen.has(exchange.id)) return false; seen.add(exchange.id); if (!active) begin(exchange); else queue.push(exchange); return true; },
    advance(milliseconds: number, playing: boolean, speed: Speed) {
      if (!playing) return;
      clock += Math.max(0, milliseconds);
      if (!active && queue.length) begin(queue.shift()!);
      if (!active) return;
      const lines = script(active);
      if (index < lines.length - 1 && clock - shownAt >= 3500) { index++; shownAt = clock; }
      if (active.closed && index >= lines.length - 1 && clock - shownAt >= 3500) {
        endedAt ??= clock;
        if (clock - endedAt >= 2000) finish(speed);
      }
    },
    next(speed: Speed) {
      if (!active) return;
      if (index < script(active).length - 1) { index++; shownAt = clock; endedAt = null; }
      else if (active.closed) finish(speed);
    },
    skip(speed: Speed) { if (active) finish(speed); },
    reset() { active = null; queue.length = 0; seen.clear(); releaseAt = -Infinity; },
    rate(speed: Speed): number {
      if (!speed) return 0;
      if (active && !active.closed) return speed === 8 ? 1 / .6 : 1 / 1.2;
      if (active?.closed) release(speed);
      const t = Math.min(1, (clock - releaseAt) / 2000);
      const ease = t * t * (3 - 2 * t);
      return releaseRate + (PLAY_RATES[speed] - releaseRate) * ease;
    },
  };
}

/** Bounded chunks keep the browser responsive; test the exact tick at which searching stops. */
export function advanceToBeat(step: () => void, found: () => boolean, finished: () => boolean, limit = 120): boolean {
  for (let i = 0; i < limit && !finished(); i++) { step(); if (found()) return true; }
  return false;
}
