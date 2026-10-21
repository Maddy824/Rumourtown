/**
 * Speech bubbles as DOM paper tags, positioned every frame from world coordinates. At most six are shown,
 * chosen by nearness to the stranger and by tier. New lines are mirrored, throttled, to a polite live region.
 */
import type { Camera, Vec2, VillagerId, WorldSnapshot } from '../sim/types.js';
import { clamp, h } from './dom.js';

export interface BubbleFrame {
  cur: WorldSnapshot;
  positions: ReadonlyMap<VillagerId, Vec2>;
  player: Vec2;
  camera: Camera;
  project: (pos: Vec2) => { x: number; y: number };
  selected: VillagerId | null;
  far: boolean;
  compact: boolean;
  /** Bubbles may not rise above this line (the top strip) or sit below this one (the bottom controls). */
  topLimit: number;
  bottomLimit: number;
  now: number;
}

interface Bubble {
  id: VillagerId;
  el: HTMLDivElement;
  name: HTMLElement;
  text: HTMLElement;
  current: string;
  w: number;
  h: number;
  shownAt: number;
}

const MAX_BUBBLES = 6;
/** A bubble stays up at least this long, so fast speeds stay readable. */
const MIN_SHOW_MS = 1600;
const ANNOUNCE_EVERY_MS = 3500;

export interface BubbleLayer {
  update(frame: BubbleFrame): void;
  /** Give one villager's bubble top priority for a while, such as the reply to a whisper. */
  boost(id: VillagerId, ms: number): void;
  clear(): void;
}

export function createBubbles(layer: HTMLElement, live: HTMLElement): BubbleLayer {
  const shown = new Map<VillagerId, Bubble>();
  const lastText = new Map<VillagerId, string>();
  let boostId: VillagerId | null = null;
  let boostUntil = 0;
  let pending: { text: string; score: number; at: number } | null = null;
  let lastAnnounce = 0;

  const make = (id: VillagerId, speaker: string, text: string, now: number): Bubble => {
    const name = h('b', { class: 'bubble-name' }, speaker);
    const body = h('span', { class: 'bubble-text' }, text);
    const el = h('div', { class: 'bubble' }, h('div', { class: 'bubble-body' }, name, ' ', body, h('i', { class: 'bubble-tail' })));
    layer.appendChild(el);
    return { id, el, name, text: body, current: text, w: el.offsetWidth, h: el.offsetHeight, shownAt: now };
  };

  return {
    boost(id, ms) {
      boostId = id;
      boostUntil = performance.now() + ms;
    },
    clear() {
      for (const b of shown.values()) b.el.remove();
      shown.clear();
    },
    update(f) {
      layer.dataset.far = f.far ? 'true' : 'false';
      const candidates: { id: VillagerId; name: string; text: string; x: number; y: number; score: number }[] = [];
      for (const v of f.cur.villagers) {
        const existing = shown.get(v.id);
        let text = v.bubble?.text ?? null;
        if (!text && existing && f.now - existing.shownAt < MIN_SHOW_MS) text = existing.current;
        if (!text) continue;
        const pos = f.positions.get(v.id) ?? v.pos;
        const p = f.project(pos);
        const headY = p.y - f.camera.zoom * (f.far ? 0.7 : 0.95) - 3;
        if (p.x < -20 || p.x > f.camera.width + 20 || headY < f.topLimit + 24 || headY > f.bottomLimit) continue;
        let score = Math.hypot(pos.x - f.player.x, pos.y - f.player.y);
        score -= v.tier === 'core' ? 3 : v.tier === 'regular' ? 1 : 0;
        if (v.id === f.selected) score -= 50;
        if (v.id === boostId && f.now < boostUntil) score -= 100;
        if (existing) score -= 1.5;
        candidates.push({ id: v.id, name: v.name, text, x: p.x, y: headY, score });
      }
      candidates.sort((a, b) => a.score - b.score);
      const cap = f.far ? (f.compact ? 2 : 4) : MAX_BUBBLES;
      const chosen = candidates.slice(0, cap);
      const keep = new Set(chosen.map((c) => c.id));
      for (const [id, b] of shown) {
        if (!keep.has(id)) {
          b.el.remove();
          shown.delete(id);
        }
      }

      // Place the most important first; later ones step up out of the way, or drop out.
      const placed: { x: number; y: number; w: number; h: number }[] = [];
      for (const c of chosen) {
        let b = shown.get(c.id);
        if (!b) {
          b = make(c.id, c.name, c.text, f.now);
          shown.set(c.id, b);
        } else if (b.current !== c.text) {
          b.text.textContent = c.text;
          b.current = c.text;
          b.shownAt = f.now;
          b.w = b.el.offsetWidth;
          b.h = b.el.offsetHeight;
        }
        if (lastText.get(c.id) !== c.text) {
          lastText.set(c.id, c.text);
          if (!pending || c.score < pending.score || f.now - pending.at > 6000) pending = { text: `${c.name}: ${c.text}`, score: c.score, at: f.now };
        }
        const w = b.w;
        const hgt = b.h;
        let left = clamp(c.x - w / 2, 8, f.camera.width - 8 - w);
        let top = c.y - hgt - 7;
        for (let tries = 0; tries < 4; tries++) {
          const hit = placed.find((r) => left < r.x + r.w + 4 && left + w + 4 > r.x && top < r.y + r.h + 4 && top + hgt + 4 > r.y);
          if (!hit) break;
          top = hit.y - hgt - 6;
        }
        if (top < f.topLimit) {
          b.el.style.visibility = 'hidden';
          continue;
        }
        b.el.style.visibility = '';
        const detached = top + hgt + 7 < c.y - 2;
        b.el.dataset.detached = detached ? 'true' : 'false';
        placed.push({ x: left, y: top, w, h: hgt });
        left = Math.round(left);
        top = Math.round(top);
        b.el.style.transform = `translate3d(${left}px, ${top}px, 0)`;
        b.el.style.setProperty('--tail-x', `${Math.round(clamp(c.x - left, 10, w - 10))}px`);
      }

      if (pending && f.now - lastAnnounce > ANNOUNCE_EVERY_MS) {
        live.textContent = pending.text;
        lastAnnounce = f.now;
        pending = null;
      }
    },
  };
}
