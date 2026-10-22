import { h } from './dom.js';
import type { Layers } from './layers.js';
export const OPENING_KEY = 'rumortown.finished-day';
type StorageAccess = () => Pick<Storage, 'getItem' | 'setItem'>;
/** Visits keep showing the guide until a day actually ends. Never claim it on display. */
export function claimOpening(storage: StorageAccess): boolean {
  try { return storage().getItem(OPENING_KEY) !== 'yes'; } catch { return true; }
}
export function finishOpeningDay(storage: StorageAccess): void {
  try { storage().setItem(OPENING_KEY, 'yes'); } catch { /* Storage is optional. */ }
}
export const OPENING_CARDS = [
  { title: 'Make yourself at home', text: 'Everyone here remembers who told them what. Start a rumor and see what people think.' },
] as const;
export function createOpening(layers: Layers, startRumor: () => void, showGuide: () => void, onChange: (open: boolean) => void) {
  const close = (): void => { el.hidden = true; layers.closed('opening'); onChange(false); };
  const next = h('button', { class: 'button button-primary', type: 'button', onclick: () => { close(); startRumor(); } }, 'Start a rumor');
  const el = h('section', { class: 'opening', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'rt-opening-title', hidden: true },
    h('div', { class: 'opening-paper' },
      h('span', { class: 'opening-glyph', 'aria-hidden': 'true' }, '♧'),
      h('h1', { id: 'rt-opening-title' }, 'Make yourself at home'),
      h('p', null, OPENING_CARDS[0].text),
      h('div', { class: 'card-actions' }, next),
      h('div', { class: 'opening-links' },
        h('button', { class: 'text-button', type: 'button', onclick: close }, 'Explore on my own'),
        h('button', { class: 'text-button', type: 'button', onclick: () => { close(); showGuide(); } }, 'How to play'))));
  return { el, close, show(force = false) {
    if (!force && !claimOpening(() => window.localStorage)) return;
    el.hidden = false;
    layers.open({ id: 'opening', el, modal: true, close }); onChange(true); next.focus({ preventScroll: true });
  } };
}
