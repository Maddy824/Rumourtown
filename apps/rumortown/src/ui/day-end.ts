/**
 * The evening card over the village: how the day ended, in one sentence, and what the stranger's word is
 * worth now. Time holds until "Keep going".
 */
import type { SimEvent } from '../sim/types.js';
import { debriefAgeNotice, type CheckItem } from '../content/debrief/index.js';
import { conceal, h, reveal } from './dom.js';
import { ENDING_TITLE, percent, sentence } from './format.js';
import type { Layers } from './layers.js';

type DayEndEvent = Extract<SimEvent, { kind: 'day-end' }>;

export interface DayEndContext {
  layers: Layers;
  reducedMotion: () => boolean;
  onContinue: () => void;
  onShare: (opener: Element | null) => void;
  onNewVillage: () => void;
}

export interface DayEndCard {
  readonly el: HTMLElement;
  show(ev: DayEndEvent, trust: number | null, reflection?: { dare: string; paragraphs: string[]; checks: CheckItem[]; finished?: boolean }): void;
  hide(): void;
  isOpen(): boolean;
}

export function createDayEnd(ctx: DayEndContext): DayEndCard {
  const title = h('h2', { class: 'dayend-title', id: 'rt-dayend-title' });
  const ending = h('p', { class: 'dayend-ending' });
  const summary = h('p', { class: 'dayend-summary' });
  const reflection = h('div', { class: 'dayend-reflection' });
  const trustBar = h('span', { class: 'bar bar-trust bar-wide', role: 'img' });
  const trustN = h('strong', { class: 'dayend-trust-n' });
  const trust = h('p', { class: 'dayend-trust' }, h('span', null, 'The stranger’s word, on average'), trustBar, trustN);
  const keepGoing = h('button', { class: 'button button-primary', type: 'button', onclick: () => api.hide() }, 'Keep going');
  const share = h('button', { class: 'button button-quiet', type: 'button', onclick: () => ctx.onShare(share) }, 'Pin to the board');
  const newVillage = h('button', { class: 'button button-primary', type: 'button', hidden: true, onclick: () => ctx.onNewVillage() }, 'New village');
  const el = h('section', { class: 'card dayend', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'rt-dayend-title', hidden: true },
    h('div', { class: 'card-paper card-index' }, title, ending, summary, trust, reflection, h('div', { class: 'card-actions' }, keepGoing, share, newVillage)));

  let open = false;

  const api: DayEndCard = {
    el,
    show(ev, avgTrust, content) {
      const finished = content?.finished ?? false;
      newVillage.hidden = !finished;
      keepGoing.textContent = finished ? 'Back to the village' : 'Keep going';
      keepGoing.className = `button ${finished ? 'button-quiet' : 'button-primary'}`;
      title.textContent = `End of day ${ev.dayIndex + 1}`;
      ending.textContent = ENDING_TITLE[ev.ending] ?? 'The day is done';
      ending.dataset.ending = ev.ending;
      summary.textContent = sentence(ev.summary);
      reflection.replaceChildren();
      if (content) {
        reflection.appendChild(h('p', null, content.dare));
        if (ev.dayIndex === 2) {
          reflection.appendChild(h('h3', null, 'What travelled through the village'));
          for (const paragraph of content.paragraphs) reflection.appendChild(h('p', null, paragraph));
          reflection.appendChild(h('h3', null, 'Check what you noticed'));
          content.checks.forEach((item) => {
            const answer = h('p', { role: 'status', hidden: true });
            const choices = [true, false].map((value) => h('button', {
              type: 'button', class: 'button button-quiet',
              onclick: () => {
                answer.hidden = false;
                answer.textContent = `${value === item.answer ? 'Yes.' : 'Not quite.'} ${item.explanation}`;
              },
            }, value ? 'True' : 'False'));
            reflection.appendChild(h('fieldset', { class: 'debrief-check' },
              h('legend', null, item.statement), h('div', { class: 'card-actions' }, choices), answer));
          });
          reflection.appendChild(h('p', null, debriefAgeNotice));
        }
      }
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
      (finished ? newVillage : keepGoing).focus({ preventScroll: true });
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
