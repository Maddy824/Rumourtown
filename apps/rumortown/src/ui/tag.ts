/**
 * A villager's tag: what they believe and who told them, how they feel about others, their moods and
 * their last decisions, in their own voice. On a desk it hangs beside them on a string; on a phone it
 * rises as a sheet.
 */
import type { BeliefView, Inspection, Simulation, VillagerId, WorldSnapshot } from '../sim/types.js';
import { clamp, h } from './dom.js';
import { faceImg, type FaceLook } from './faces.js';
import {
  actionText,
  activityText,
  moodWord,
  parseChainLine,
  percent,
  sentence,
  tickClock,
  untilText,
  type ChainActor,
} from './format.js';
import { glyphSvg } from './glyphs.js';
import { closeIcon, toldArrow } from './icons.js';
import type { Layers } from './layers.js';

export interface TagContext {
  sim: () => Simulation;
  snapshot: () => WorldSnapshot;
  isPhone: () => boolean;
  reducedMotion: () => boolean;
  layers: Layers;
  /** Called after the tag closes, so the app can clear the selection ring. */
  onClosed: () => void;
  /** Open another villager's tag, from a face in a chain or a relation. */
  onSelect: (id: VillagerId) => void;
}

export interface TagPlacement {
  /** The villager's head on screen, or null when off screen. */
  anchor: { x: number; y: number } | null;
  width: number;
  height: number;
  top: number;
  bottom: number;
  dt: number;
}

export interface Tag {
  readonly el: HTMLElement;
  open(id: VillagerId, opts?: { focus?: boolean; opener?: Element | null }): void;
  close(): void;
  selected(): VillagerId | null;
  /** Re-reads the inspection; rebuilds the body only when something changed. */
  refresh(force?: boolean): void;
  /** Positions the tag and returns where its string ties on, in screen pixels. */
  place(p: TagPlacement): { x: number; y: number } | null;
  /** How much of the bottom of the screen the tag covers (phones). */
  cover(): number;
}

const SECTION_LIMIT = 5;

export function createTag(ctx: TagContext): Tag {
  const nameEl = h('h2', { class: 'tag-name', id: 'rt-tag-name', tabindex: '-1' });
  const roleEl = h('p', { class: 'tag-role' });
  const faceSlot = h('span', { class: 'tag-face' });
  const closeBtn = h('button', { class: 'close', type: 'button', 'aria-label': 'Close tag', onclick: () => api.close() }, closeIcon());
  const status = h('div', { class: 'tag-status' });
  const body = h('div', { class: 'tag-body' });
  const paper = h('div', { class: 'tag-paper' },
    h('span', { class: 'tag-eyelet', 'aria-hidden': 'true' }),
    h('header', { class: 'tag-head' }, faceSlot, h('div', { class: 'tag-title' }, nameEl, roleEl), closeBtn),
    status,
    body);
  const el = h('section', { class: 'tag', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'rt-tag-name', hidden: true }, paper);

  let current: VillagerId | null = null;
  let lastKey = '';
  let lastRefresh = 0;
  let showAll = false;
  let pos: { x: number; y: number } | null = null;
  let side: 'left' | 'right' = 'right';

  const sim = (): Simulation => ctx.sim();
  const lookOf = (id: VillagerId): FaceLook => {
    const v = ctx.snapshot().villagers.find((x) => x.id === id);
    return v?.look ?? sim().cast.get(id)?.look ?? 'stranger';
  };
  const nameToId = (): Map<string, string> => {
    const m = new Map<string, string>();
    for (const d of sim().cast.values()) m.set(d.name.toLowerCase(), d.id);
    return m;
  };

  const actorEl = (actor: ChainActor): HTMLElement => {
    if (actor.kind === 'stranger') {
      return h('span', { class: 'chain-actor' }, faceImg('stranger', 'stranger', 26), h('span', null, 'Stranger'));
    }
    if (actor.kind === 'unknown') {
      return h('span', { class: 'chain-actor' }, h('span', { class: 'face face-blank', 'aria-hidden': 'true' }, actor.name.charAt(0)), h('span', null, actor.name));
    }
    return h('button', { class: 'chain-actor', type: 'button', 'aria-label': `${actor.name}: open their tag`, onclick: () => ctx.onSelect(actor.id) },
      faceImg(actor.id, lookOf(actor.id), 26), h('span', null, actor.name));
  };

  const chainEl = (belief: BeliefView): HTMLElement | null => {
    if (belief.chain.length === 0) return null;
    const names = nameToId();
    const list = h('ol', { class: 'chain', 'aria-label': 'How I came to hear it' });
    let lastActor: string | null = null;
    for (const line of belief.chain) {
      const link = parseChainLine(line, names);
      if (link.kind === 'text') {
        list.appendChild(h('li', { class: 'chain-text' }, sentence(link.text)));
        lastActor = null;
        continue;
      }
      const from = link.kind === 'told' ? link.from : link.who;
      const key = from.kind === 'villager' ? from.id : from.kind === 'stranger' ? 'stranger' : from.name;
      if (key !== lastActor) {
        if (lastActor !== null) list.appendChild(h('li', { class: 'chain-break', 'aria-hidden': 'true' }));
        list.appendChild(h('li', null, actorEl(from)));
      }
      if (link.kind === 'told') {
        list.appendChild(h('li', { class: 'chain-told' }, h('span', { class: 'chain-verb' }, 'told'), toldArrow(), link.time ? h('time', null, link.time) : null));
        list.appendChild(h('li', null, actorEl(link.to)));
        lastActor = link.to.kind === 'villager' ? link.to.id : link.to.kind === 'stranger' ? 'stranger' : link.to.name;
      } else {
        list.appendChild(h('li', { class: 'chain-told chain-saw' }, h('span', { class: 'chain-verb' }, 'saw it'), link.time ? h('time', null, link.time) : null));
        lastActor = null;
      }
    }
    return list;
  };

  const beliefsEl = (ins: Inspection): HTMLElement => {
    const sorted = [...ins.beliefs].sort((a, b) => b.confidence - a.confidence);
    const items = sorted.map((b) => {
      const claim = sim().claims.get(b.claimId);
      const valence = claim?.valence ?? 0;
      const sources = b.independentSources === 1 ? 'one source' : b.independentSources > 1 ? `${b.independentSources} separate sources` : 'no one I can name';
      return h('li', { class: 'belief', 'data-valence': String(valence) },
        h('p', { class: 'belief-claim' }, claim ? glyphSvg(claim.kind, 18) : null, h('span', null, sentence(b.text))),
        h('p', { class: 'belief-meta' }, h('strong', { class: 'belief-conf' }, percent(b.confidence)), ` sure, from ${sources}`),
        chainEl(b));
    });
    return section('What I believe', items.length ? h('ul', { class: 'beliefs' }, items) : empty('Nothing worth repeating yet.'));
  };

  const likingWord = (a: number): string => (a <= -0.5 ? 'Dislikes' : a < -0.15 ? 'Cool' : a < 0.15 ? 'Neutral' : a < 0.5 ? 'Fond' : 'Close');

  const relationsEl = (ins: Inspection): HTMLElement => {
    const ranked = [...ins.relations].sort((a, b) => {
      const wa = (a.why ? 1 : 0) + Math.abs(a.affinity) + Math.abs(a.trust - 0.5);
      const wb = (b.why ? 1 : 0) + Math.abs(b.affinity) + Math.abs(b.trust - 0.5);
      return wb - wa;
    });
    const shown = showAll ? ranked : ranked.slice(0, SECTION_LIMIT);
    const items = shown.map((r) =>
      h('li', { class: 'rel' },
        h('button', { class: 'rel-who', type: 'button', 'aria-label': `${r.name}: open their tag`, onclick: () => ctx.onSelect(r.to) }, faceImg(r.to, lookOf(r.to), 28), h('span', null, r.name)),
        h('div', { class: 'rel-bars' },
          h('span', { class: 'bar-label' }, 'Trust'),
          h('span', { class: 'bar bar-trust', role: 'img', 'aria-label': `Trust ${percent(r.trust)}`, style: `--v: ${clamp(r.trust, 0, 1).toFixed(3)}` }),
          h('span', { class: 'bar-label' }, 'Liking'),
          h('span', { class: 'bar bar-like', role: 'img', 'aria-label': `Liking: ${likingWord(r.affinity).toLowerCase()}`, style: `--v: ${clamp(r.affinity, -1, 1).toFixed(3)}` })),
        r.why ? h('p', { class: 'rel-why' }, sentence(r.why)) : null));
    const more = ranked.length > SECTION_LIMIT
      ? h('button', { class: 'text-button', type: 'button', onclick: () => { showAll = !showAll; api.refresh(true); } }, showAll ? 'Show fewer' : `Show all ${ranked.length}`)
      : null;
    return section('How I feel about people', items.length ? [h('ul', { class: 'rels' }, items), more] : empty('Nobody on my mind.'));
  };

  const moodsEl = (ins: Inspection, now: number): HTMLElement => {
    const items = ins.moods.map((m) =>
      h('li', { class: 'mood', 'data-sign': m.delta >= 0 ? 'up' : 'down' },
        h('span', { class: 'mood-sign', 'aria-hidden': 'true' }, m.delta >= 0 ? '+' : '−'),
        h('span', { class: 'mood-label' }, h('span', { class: 'sr-only' }, m.delta >= 0 ? 'Lifted: ' : 'Weighed down: '), sentence(m.label).replace(/\.$/, '')),
        h('span', { class: 'mood-until' }, untilText(m.untilTick, now))));
    return section('How I feel', items.length ? h('ul', { class: 'moods' }, items) : empty('Nothing much, today.'));
  };

  const decisionsEl = (ins: Inspection): HTMLElement => {
    const items = [...ins.decisions].sort((a, b) => b.tick - a.tick).slice(0, SECTION_LIMIT).map((d) =>
      h('li', { class: 'decision' },
        h('time', null, tickClock(d.tick)),
        h('div', null, h('strong', null, actionText(d.action)), h('p', null, sentence(d.why)))));
    return section('Why I did that', items.length ? h('ol', { class: 'decisions' }, items) : empty('Nothing yet. Ask me later.'));
  };

  const render = (ins: Inspection): void => {
    const now = ctx.snapshot().tick;
    nameEl.textContent = ins.name;
    closeBtn.setAttribute('aria-label', `Close ${ins.name}’s tag`);
    const role = ins.role ? ins.role.charAt(0).toUpperCase() + ins.role.slice(1) : '';
    roleEl.textContent = `${role}${role ? ', ' : ''}${activityText(ins.activity)}`;
    faceSlot.replaceChildren(faceImg(ins.id, lookOf(ins.id), 46));
    status.replaceChildren(
      h('span', { class: 'chip', 'data-mood': ins.mood < -0.2 ? 'low' : ins.mood > 0.2 ? 'high' : 'mid' }, moodWord(ins.mood)),
      h('span', { class: 'tag-trust' },
        h('span', { class: 'bar-label' }, 'Trusts you'),
        h('span', { class: 'bar bar-trust', role: 'img', 'aria-label': `Trusts you ${percent(ins.trustInStranger)}`, style: `--v: ${clamp(ins.trustInStranger, 0, 1).toFixed(3)}` }),
        h('span', { class: 'tag-trust-n' }, percent(ins.trustInStranger))));
    body.replaceChildren(beliefsEl(ins), relationsEl(ins), moodsEl(ins, now), decisionsEl(ins));
  };

  const api: Tag = {
    el,
    open(id, opts = {}) {
      const changed = current !== id;
      current = id;
      if (changed) {
        showAll = false;
        paper.scrollTop = 0;
        pos = null;
      }
      api.refresh(true);
      if (el.hidden) {
        el.hidden = false;
        void el.offsetWidth;
        el.dataset.open = 'true';
      }
      el.dataset.mode = ctx.isPhone() ? 'sheet' : 'pinned';
      ctx.layers.open({ id: 'tag', el, modal: false, close: () => api.close() }, opts.opener);
      if (opts.focus) nameEl.focus({ preventScroll: true });
    },
    close() {
      if (current === null) return;
      current = null;
      delete el.dataset.open;
      const finish = (): void => {
        if (el.dataset.open) return;
        el.hidden = true;
      };
      if (ctx.reducedMotion()) finish();
      else window.setTimeout(finish, 180);
      ctx.layers.closed('tag');
      ctx.onClosed();
    },
    selected: () => current,
    refresh(force = false) {
      if (current === null) return;
      const now = performance.now();
      if (!force && now - lastRefresh < 400) return;
      lastRefresh = now;
      let ins: Inspection;
      try {
        ins = sim().inspect(current);
      } catch {
        api.close();
        return;
      }
      const key = `${current}|${showAll}|${JSON.stringify(ins)}|${Math.floor(ctx.snapshot().tick / 60)}`;
      if (!force && key === lastKey) return;
      lastKey = key;
      render(ins);
    },
    place(p) {
      if (current === null || el.hidden) return null;
      const phone = ctx.isPhone();
      el.dataset.mode = phone ? 'sheet' : 'pinned';
      if (phone) {
        el.style.transform = '';
        const r = paper.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + 13 };
      }
      const w = el.offsetWidth;
      const hgt = el.offsetHeight;
      if (p.anchor) {
        const roomRight = p.width - (p.anchor.x + 36) - 12;
        const wantSide: 'left' | 'right' = roomRight >= w ? 'right' : p.anchor.x - 36 - w >= 12 ? 'left' : roomRight >= p.anchor.x - 36 - w ? 'right' : 'left';
        side = wantSide;
        const x = side === 'right' ? p.anchor.x + 36 : p.anchor.x - 36 - w;
        const target = {
          x: clamp(x, 12, p.width - 12 - w),
          y: clamp(p.anchor.y - 40, p.top + 8, Math.max(p.top + 8, p.bottom - hgt - 8)),
        };
        if (!pos || ctx.reducedMotion()) pos = target;
        else {
          const k = 1 - Math.exp(-p.dt * 10);
          pos = { x: pos.x + (target.x - pos.x) * k, y: pos.y + (target.y - pos.y) * k };
        }
      }
      if (!pos) return null;
      el.dataset.side = side;
      el.style.transform = `translate3d(${Math.round(pos.x)}px, ${Math.round(pos.y)}px, 0)`;
      return { x: side === 'right' ? pos.x + 17 : pos.x + w - 17, y: pos.y + 32 };
    },
    cover() {
      if (current === null || el.hidden || !ctx.isPhone()) return 0;
      return el.offsetHeight;
    },
  };
  return api;
}

function section(title: string, content: HTMLElement | (HTMLElement | null)[]): HTMLElement {
  return h('section', { class: 'tag-sec' }, h('h3', null, title), content);
}

function empty(text: string): HTMLElement {
  return h('p', { class: 'empty' }, text);
}
