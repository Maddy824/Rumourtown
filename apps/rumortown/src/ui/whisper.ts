/**
 * The whisper sheet, opened from the postbox: who is within two tiles, a menu of ready-made claims grouped
 * by who they are about, and a place for typed claims that is not open yet. Time holds while it is open.
 */
import type { ClaimId } from 'rumormind';
import type { GameClaim, Simulation, VillagerId, VillagerView, WorldSnapshot } from '../sim/types.js';
import { conceal, h, reveal } from './dom.js';
import { faceImg } from './faces.js';
import { glyphSvg } from './glyphs.js';
import { closeIcon } from './icons.js';
import type { Layers } from './layers.js';

export const WHISPER_RANGE = 2;

export interface WhisperContext {
  sim: () => Simulation;
  snapshot: () => WorldSnapshot;
  isPhone: () => boolean;
  reducedMotion: () => boolean;
  layers: Layers;
  /** Returns false when the listener is no longer in reach. */
  whisper: (listener: VillagerId, claimId: ClaimId) => boolean;
  walkTo: (id: VillagerId) => void;
  onOpenChange: (open: boolean) => void;
}

export interface WhisperSheet {
  readonly el: HTMLElement;
  open(opts?: { listener?: VillagerId; opener?: Element | null }): void;
  close(): void;
  isOpen(): boolean;
  cover(): number;
}

export function inReach(snap: WorldSnapshot): VillagerView[] {
  const p = snap.player.pos;
  return snap.villagers
    .map((v) => ({ v, d: Math.hypot(v.pos.x - p.x, v.pos.y - p.y) }))
    .filter((x) => x.d <= WHISPER_RANGE)
    .sort((a, b) => a.d - b.d)
    .map((x) => x.v);
}

export function createWhisperSheet(ctx: WhisperContext): WhisperSheet {
  const content = h('div', { class: 'whisper-content' });
  const feedback = h('p', { class: 'whisper-feedback', role: 'status' });
  const sendBtn = h('button', { class: 'button button-primary', type: 'submit', disabled: true }, 'Whisper');
  const form = h('form', { class: 'whisper-form', novalidate: true }, content, h('div', { class: 'whisper-actions' }, feedback, sendBtn));
  const el = h('section', { class: 'sheet whisper', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'rt-whisper-title', hidden: true },
    h('div', { class: 'sheet-paper' },
      h('header', { class: 'sheet-head' },
        h('div', null,
          h('h2', { id: 'rt-whisper-title', class: 'sheet-title' }, 'Whisper'),
          h('p', { class: 'sheet-note' }, 'Time holds while you choose.')),
        h('button', { class: 'close', type: 'button', 'aria-label': 'Close the whisper sheet', onclick: () => api.close() }, closeIcon())),
      form));

  let open = false;
  let listener: VillagerId | null = null;
  let claimId: ClaimId | null = null;

  const update = (): void => {
    sendBtn.disabled = !(listener && claimId);
  };

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    if (!listener || !claimId) return;
    const name = ctx.sim().cast.get(listener)?.name ?? 'They';
    if (ctx.whisper(listener, claimId)) {
      api.close();
    } else {
      feedback.textContent = `${name} is out of reach now. Walk closer and try again.`;
    }
  });

  const suggest = (near: VillagerView[], to: VillagerId | null, claims: GameClaim[]): ClaimId | null => {
    const nearIds = new Set(near.map((v) => v.id));
    const harmful = claims.filter((c) => c.valence < 0 && c.about !== to);
    const pick = harmful.find((c) => nearIds.has(c.about))
      ?? harmful.find((c) => ctx.sim().cast.get(c.about)?.tier === 'core')
      ?? harmful[0]
      ?? claims.find((c) => c.about !== to)
      ?? claims[0];
    return pick ? pick.id : null;
  };

  const build = (preferred?: VillagerId): void => {
    const sim = ctx.sim();
    const snap = ctx.snapshot();
    const near = inReach(snap);
    feedback.textContent = '';
    listener = preferred && near.some((v) => v.id === preferred) ? preferred : near[0]?.id ?? null;

    if (near.length === 0) {
      const p = snap.player.pos;
      const nearest = [...snap.villagers]
        .sort((a, b) => Math.hypot(a.pos.x - p.x, a.pos.y - p.y) - Math.hypot(b.pos.x - p.x, b.pos.y - p.y))
        .slice(0, 3);
      content.replaceChildren(
        h('div', { class: 'whisper-empty' },
          h('p', { class: 'whisper-empty-lead' }, 'Walk closer to someone first.'),
          h('p', null, ctx.isPhone() ? 'Tap the village to walk there, or go to someone nearby:' : 'Click the village or use the arrow keys to walk, or go to someone nearby:'),
          h('div', { class: 'walk-list' },
            nearest.map((v) =>
              h('button', { class: 'button button-quiet walk-to', type: 'button', onclick: () => { api.close(); ctx.walkTo(v.id); } },
                faceImg(v.id, v.look, 24), `Walk to ${v.name}`)))),
        h('label', { class: 'own-claim' }, h('span', null, 'Type your own (coming later)'), h('input', { type: 'text', disabled: true })));
      claimId = null;
      update();
      return;
    }

    const who = h('fieldset', { class: 'whisper-who' },
      h('legend', null, 'To'),
      h('div', { class: 'who-list' },
        near.map((v) => {
          const d = sim.cast.get(v.id);
          const input = h('input', { type: 'radio', name: 'rt-listener', value: v.id, class: 'sr-only', checked: v.id === listener });
          input.addEventListener('change', () => {
            listener = v.id;
            update();
          });
          return h('label', { class: 'who' }, input,
            h('span', { class: 'who-card' }, faceImg(v.id, v.look, 34),
              h('span', { class: 'who-text' }, h('span', { class: 'who-name' }, v.name), d ? h('span', { class: 'who-role' }, d.role) : null)));
        })));

    const claims = [...sim.claims.values()];
    claimId = suggest(near, listener, claims);
    const order = new Map<string, number>();
    near.forEach((v, i) => order.set(v.id, i));
    let i = near.length;
    for (const d of sim.cast.values()) if (!order.has(d.id)) order.set(d.id, i++);
    const groups = new Map<VillagerId, GameClaim[]>();
    for (const c of claims) {
      const list = groups.get(c.about) ?? [];
      list.push(c);
      groups.set(c.about, list);
    }
    const subjects = [...groups.keys()].sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999));
    const what = h('fieldset', { class: 'whisper-what' },
      h('legend', null, 'Say that'),
      subjects.map((about) => {
        const d = sim.cast.get(about);
        const name = d?.name ?? about;
        const object = d?.pronouns.object ?? 'them';
        const look = snap.villagers.find((v) => v.id === about)?.look ?? d?.look;
        return h('div', { class: 'claim-group', role: 'group', 'aria-label': `About ${name}` },
          h('p', { class: 'claim-about', 'aria-hidden': 'true' }, look ? faceImg(about, look, 22) : null, `About ${name}`),
          (groups.get(about) ?? []).map((c) => {
            const input = h('input', { type: 'radio', name: 'rt-claim', value: c.id, class: 'sr-only', checked: c.id === claimId });
            input.addEventListener('change', () => {
              claimId = c.id;
              update();
            });
            const effect = c.valence < 0 ? `Hurts ${object}` : c.valence > 0 ? `Helps ${object}` : null;
            return h('label', { class: 'claim', 'data-valence': String(c.valence) }, input,
              h('span', { class: 'claim-card' },
                glyphSvg(c.kind, 20),
                h('span', { class: 'claim-text' }, c.text),
                h('span', { class: 'claim-tags' },
                  c.id === claimId ? h('span', { class: 'claim-suggested' }, 'Suggested') : null,
                  effect ? h('span', { class: 'claim-effect' }, effect) : null)));
          }));
      }));

    content.replaceChildren(who, what, h('label', { class: 'own-claim' }, h('span', null, 'Type your own (coming later)'), h('input', { type: 'text', disabled: true })));
    update();
  };

  const api: WhisperSheet = {
    el,
    open(opts = {}) {
      build(opts.listener);
      if (!open) {
        open = true;
        reveal(el);
        ctx.layers.open({ id: 'whisper', el, modal: true, close: () => api.close() }, opts.opener);
        ctx.onOpenChange(true);
      }
      const target = el.querySelector<HTMLElement>('.claim input:checked, .who input:checked, .walk-to, .close');
      target?.focus({ preventScroll: true });
      el.querySelector('.claim input:checked')?.closest('.claim')?.scrollIntoView({ block: 'nearest' });
    },
    close() {
      if (!open) return;
      open = false;
      conceal(el, ctx.reducedMotion());
      ctx.layers.closed('whisper');
      ctx.onOpenChange(false);
    },
    isOpen: () => open,
    cover: () => (open && ctx.isPhone() ? el.offsetHeight : 0),
  };
  return api;
}
