/**
 * Speech bubbles as DOM paper tags, positioned every frame from world coordinates. At most two are shown,
 * chosen by nearness to the stranger and by tier. New lines are mirrored, throttled, to a polite live region.
 */
import type { Camera, Vec2, VillagerId, WorldSnapshot } from '../sim/types.js';
import { clamp, h, svg } from './dom.js';

export interface BubbleFrame {
  cur: WorldSnapshot;
  positions: ReadonlyMap<VillagerId, Vec2>;
  player: Vec2;
  camera: Camera;
  project: (pos: Vec2) => { x: number; y: number };
  selected: VillagerId | null;
  far: boolean;
  compact: boolean;
  muted?: boolean;
  rumorSpeech?: ReadonlyMap<string, string>;
  spotlight?: readonly string[];
  /** Bubbles may not rise above this line (the top strip) or sit below this one (the bottom controls). */
  topLimit: number;
  bottomLimit: number;
  /** Canvas-relative control rectangles, including the taller phone pin stack. */
  exclusions: readonly BubbleRect[];
  now: number;
}

export interface BubbleRect { x: number; y: number; w: number; h: number }

/** Try above the speaker, then below, keeping the paper and tail clear of controls and other bubbles. */
export function placeBubble(
  anchor: { x: number; y: number; foot: number },
  size: { w: number; h: number },
  bounds: { width: number; top: number; bottom: number },
  obstacles: readonly BubbleRect[],
): (BubbleRect & { flip: boolean }) | null {
  const { w, h: height } = size;
  const x = Math.round(clamp(anchor.x - w / 2, 8, bounds.width - 8 - w));
  const overlaps = (y: number): BubbleRect | undefined => obstacles.find((r) =>
    x < r.x + r.w + 6 && x + w + 6 > r.x && y < r.y + r.h + 6 && y + height + 6 > r.y);
  let y = Math.floor(anchor.y - height - 7);
  for (let tries = 0; tries <= obstacles.length; tries++) {
    const hit = overlaps(y);
    if (!hit) break;
    y = Math.floor(hit.y - height - 7);
  }
  if (y >= bounds.top && y + height <= bounds.bottom && !overlaps(y)) return { x, y, w, h: height, flip: false };
  y = Math.ceil(Math.max(anchor.foot + 7, bounds.top));
  for (let tries = 0; tries <= obstacles.length; tries++) {
    const hit = overlaps(y);
    if (!hit) break;
    y = Math.ceil(hit.y + hit.h + 7);
  }
  if (y < bounds.top || y + height > bounds.bottom || overlaps(y)) return null;
  return { x, y, w, h: height, flip: true };
}

interface Bubble {
  id: VillagerId;
  el: HTMLDivElement;
  copy: HTMLElement;
  text: HTMLElement;
  current: string;
  w: number;
  h: number;
  shownAt: number;
  tail: SVGPathElement;
}

/** CSS owns the two-line measure; expansion keeps the same paper width. */
function fit(b: Bubble): void {
  b.w = b.el.offsetWidth;
  b.h = b.el.offsetHeight;
}

const MAX_BUBBLES = 2;
/** A bubble stays up at least this long, so fast speeds stay readable. */
const MIN_SHOW_MS = 3200;
const ANNOUNCE_EVERY_MS = 3500;

export interface BubbleLayer {
  update(frame: BubbleFrame): void;
  /** Give one villager's bubble top priority for a while, such as the reply to a whisper. */
  boost(id: VillagerId, ms: number): void;
  clear(): void;
  visible(): ReadonlyMap<string, BubbleRect>;
}

export function createBubbles(layer: HTMLElement, live: HTMLElement): BubbleLayer {
  const visible = new Map<string, BubbleRect>();
  const shown = new Map<VillagerId, Bubble>();
  const lastText = new Map<VillagerId, string>();
  let boostId: VillagerId | null = null;
  let boostUntil = 0;
  let pending: { text: string; score: number; at: number } | null = null;
  let lastAnnounce = 0;

  const make = (id: VillagerId, speaker: string, text: string, now: number): Bubble => {
    const name = h('b', { class: 'bubble-name' }, speaker);
    const body = h('span', { class: 'bubble-text' }, text);
    const tail = svg('path');
    const el = h('div', { class: 'bubble', tabindex: '0', role: 'button', 'aria-label': `${speaker}: ${text}`, 'aria-expanded': 'false' },
      h('div', { class: 'bubble-body' }, h('span', { class: 'bubble-copy' }, name, ' ', body), svg('svg', { class: 'speaker-tail', 'aria-hidden': 'true' }, tail)));
    layer.appendChild(el);
    const copy = el.querySelector<HTMLElement>('.bubble-copy') ?? el;
    const b: Bubble = { id, el, copy, text: body, current: text, w: 0, h: 0, shownAt: now, tail };
    const expand = (expanded: boolean): void => { el.dataset.expanded = String(expanded); el.setAttribute('aria-expanded', String(expanded)); fit(b); };
    el.addEventListener('click', () => expand(el.dataset.expanded !== 'true'));
    el.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch') expand(true); });
    el.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch') expand(false); });
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); expand(el.dataset.expanded !== 'true'); } });
    fit(b);
    return b;
  };
  let lastFar: boolean | null = null;

  return {
    visible: () => visible,
    boost(id, ms) {
      boostId = id;
      boostUntil = performance.now() + ms;
    },
    clear() {
      visible.clear();
      for (const b of shown.values()) b.el.remove();
      shown.clear();
    },
    update(f) {
      visible.clear();
      if (f.muted) {
        for (const b of shown.values()) b.el.remove();
        shown.clear();
        pending = null;
        return;
      }
      layer.dataset.far = f.far ? 'true' : 'false';
      if (lastFar !== f.far) {
        lastFar = f.far;
        for (const b of shown.values()) fit(b);
      }
      const candidates: { id: VillagerId; name: string; text: string; x: number; y: number; foot: number; score: number }[] = [];
      for (const v of f.cur.villagers) {
        const existing = shown.get(v.id);
        if (f.rumorSpeech && (!v.bubble || f.rumorSpeech.get(v.id) !== v.bubble.text)) continue;
        const text = existing && f.now - existing.shownAt < MIN_SHOW_MS ? existing.current : v.bubble?.text ?? null;
        if (!text) continue;
        const pos = f.positions.get(v.id) ?? v.pos;
        const p = f.project(pos);
        const headY = p.y - f.camera.zoom * (f.far ? 0.7 : 0.95) - 3;
        const foot = p.y + f.camera.zoom * (f.far ? 0.2 : 0.3) + 3;
        if (p.x < 0 || p.x > f.camera.width || p.y < 0 || headY < 0 || p.y > f.camera.height) continue;
        let score = Math.hypot(pos.x - f.player.x, pos.y - f.player.y);
        score -= v.tier === 'core' ? 3 : v.tier === 'regular' ? 1 : 0;
        if (v.id === f.selected) score -= 50;
        if (v.id === boostId && f.now < boostUntil) score -= 100;
        if (existing) score -= 1.5;
        candidates.push({ id: v.id, name: v.name, text, x: p.x, y: headY, foot, score });
      }
      candidates.sort((a, b) => a.score - b.score);
      const cap = f.compact || f.selected ? 1 : MAX_BUBBLES;
      const chosen = candidates.slice(0, cap);
      const keep = new Set(chosen.map((c) => c.id));
      for (const [id, b] of shown) {
        if (!keep.has(id)) {
          b.el.remove();
          shown.delete(id);
        }
      }

      // Place the most important first; later ones step up out of the way, or drop out.
      const placed: BubbleRect[] = [...f.exclusions];
      for (const c of chosen) {
        let b = shown.get(c.id);
        if (!b) {
          b = make(c.id, c.name, c.text, f.now);
          shown.set(c.id, b);
        } else if (b.current !== c.text) {
          b.text.textContent = c.text;
          b.current = c.text;
          b.el.setAttribute('aria-label', `${c.name}: ${c.text}`);
          b.shownAt = f.now;
          fit(b);
        }
        if (lastText.get(c.id) !== c.text) {
          lastText.set(c.id, c.text);
          if (!pending || c.score < pending.score || f.now - pending.at > 6000) pending = { text: `${c.name}: ${c.text}`, score: c.score, at: f.now };
        }
        const w = b.w;
        const hgt = b.h;
        const placement = placeBubble(c, { w, h: hgt },
          { width: f.camera.width, top: f.topLimit, bottom: f.bottomLimit }, placed);
        const gap = placement ? placement.flip ? placement.y - c.y : c.y - placement.y - hgt : Infinity;
        if (!placement || Math.hypot(gap, c.x - clamp(c.x, placement.x + 4, placement.x + w - 4)) > f.camera.zoom * 1.5) {
          b.el.style.visibility = 'hidden';
          continue;
        }
        const { x: left, y: top, flip } = placement;
        b.el.style.visibility = '';
        b.el.style.opacity = f.spotlight?.length && !f.spotlight.includes(c.id) ? '.4' : '1';
        b.el.dataset.flip = flip ? 'true' : 'false';
        const tx = clamp(c.x - left, 4, w - 4), edge = flip ? 0 : hgt;
        b.tail.setAttribute('d', `M${tx - 4} ${edge} L${c.x - left} ${c.y - top} L${tx + 4} ${edge}Z`);
        visible.set(c.id, { x: left, y: top, w, h: hgt });
        placed.push({ x: left, y: top, w, h: hgt });
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
