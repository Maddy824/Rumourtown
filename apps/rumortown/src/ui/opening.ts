import { h } from './dom.js';
import type { Layers } from './layers.js';
export const OPENING_KEY = 'rumortown.opening.14';
type StorageAccess = () => Pick<Storage, 'getItem' | 'setItem'>;
/** Claim the one-time card at display, not at dismissal. Storage may be unavailable. */
export function claimOpening(storage: StorageAccess): boolean {
  try {
    const store = storage();
    if (store.getItem(OPENING_KEY) === 'seen') return false;
    store.setItem(OPENING_KEY, 'seen');
  } catch { /* Private or restricted browsers can still play. */ }
  return true;
}
export function createOpening(layers: Layers, dare: string, showMe: () => void) {
  const close = (): void => { el.hidden = true; layers.closed('opening'); };
  const show = h('button', { class: 'button button-primary', type: 'button', onclick: () => { close(); showMe(); } }, 'Show me');
  const el = h('section', { class: 'opening', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'rt-opening-title', hidden: true },
    h('div', { class: 'opening-paper' },
      h('p', { class: 'sheet-note' }, 'Rumourtown'),
      h('h1', { id: 'rt-opening-title' }, 'A story starts with you'),
      h('p', null, h('span', { 'aria-hidden': 'true' }, '♧'), 'Walk to someone.'),
      h('p', null, h('span', { 'aria-hidden': 'true' }, '✉'), 'Whisper a rumor.'),
      h('p', null, h('span', { 'aria-hidden': 'true' }, '〰'), 'Follow the red thread.'),
      h('div', { class: 'card-actions' }, show,
        h('button', { class: 'button button-quiet', type: 'button', onclick: close }, 'Let me look around')),
      h('footer', null, `Your dare: ${dare}`)));
  return {
    el,
    show() {
      if (!claimOpening(() => window.localStorage)) return;
      el.hidden = false;
      layers.open({ id: 'opening', el, modal: true, close });
      show.focus({ preventScroll: true });
    },
    close,
  };
}
