/**
 * The evening card over the village: how the day ended, in one sentence, and what the stranger's word is
 * worth now. Time holds until "Keep going".
 */
import type { SimEvent } from '../sim/types.js';
import { conceal, h, reveal } from './dom.js';
import { ENDING_TITLE, percent, sentence } from './format.js';
import type { Layers } from './layers.js';

type DayEndEvent = Extract<SimEvent, { kind: 'day-end' }>;

export interface DayEndContext {
  layers: Layers;
  reducedMotion: () => boolean;
  onContinue: () => void;
  onShare: (opener: Element | null) => void;
}

export interface DayEndCard {
  readonly el: HTMLElement;
  show(ev: DayEndEvent, trust: number | null): void;
  hide(): void;
  isOpen(): boolean;
}

export function createDayEnd(ctx: DayEndContext): DayEndCard {
  const title = h('h2', { class: 'dayend-title', id: 'rt-dayend-title' });
  const ending = h('p', { class: 'dayend-ending' });
  const summary = h('p', { class: 'dayend-summary' });
  const trustBar = h('span', { class: 'bar bar-trust bar-wide', role: 'img' });
  const trustN = h('strong', { class: 'dayend-trust-n' });
  const trust = h('p', { class: 'dayend-trust' }, h('span', null, 'The stranger’s word, on average'), trustBar, trustN);
  const keepGoing = h('button', { class: 'button button-primary', type: 'button', onclick: () => api.hide() }, 'Keep going');
  const share = h('button', { class: 'button button-quiet', type: 'button', onclick: () => ctx.onShare(share) }, 'Pin to the board');
  const el = h('section', { class: 'card dayend', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'rt-dayend-title', hidden: true },
    h('div', { class: 'card-paper card-index' }, title, ending, summary, trust, h('div', { class: 'card-actions' }, keepGoing, share)));

  let open = false;

  const api: DayEndCard = {
    el,
    show(ev, avgTrust) {
      title.textContent = `End of day ${ev.dayIndex + 1}`;
      ending.textContent = ENDING_TITLE[ev.ending] ?? 'The day is done';
      ending.dataset.ending = ev.ending;
      summary.textContent = sentence(ev.summary);
      trust.hidden = avgTrust === null;
      if (avgTrust !== null) {
        trustBar.setAttribute('style', `--v: ${Math.min(1, Math.max(0, avgTrust)).toFixed(3)}`);
        trustBar.setAttribute('aria-label', `The stranger’s word is worth ${percent(avgTrust)}`);
        trustN.textContent = percent(avgTrust);
      }
      if (!open) {
        open = true;
        reveal(el);
        ctx.layers.open({ id: 'dayend', el, modal: true, close: () => api.hide() });
      }
      keepGoing.focus({ preventScroll: true });
    },
    hide() {
      if (!open) return;
      open = false;
      conceal(el, ctx.reducedMotion());
      ctx.layers.closed('dayend');
      ctx.onContinue();
    },
    isOpen: () => open,
  };
  return api;
}
