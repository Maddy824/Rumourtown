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
  { glyph: '♧', title: 'Make yourself at home', text: 'Tap a path to walk. Tap Talk or act to speak with someone nearby, ask a question, or choose where to go. Spread a rumor and watch who carries it. More lets you switch rumor lines and conversation reading on or off.' },
] as const;
export function createOpening(layers: Layers, showMe: () => void, showGuide: () => void, onChange: (open: boolean) => void) {
  const close = (): void => { el.hidden = true; layers.closed('opening'); onChange(false); };
  const next = h('button', { class: 'button button-primary', type: 'button', onclick: close }, 'Start exploring');
  const el = h('section', { class: 'opening', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'rt-opening-title', hidden: true },
    h('div', { class: 'opening-paper' },
      h('span', { class: 'opening-glyph', 'aria-hidden': 'true' }, OPENING_CARDS[0].glyph),
      h('h1', { id: 'rt-opening-title' }, OPENING_CARDS[0].title), h('p', null, OPENING_CARDS[0].text),
      h('div', { class: 'card-actions' }, next,
        h('button', { class: 'button button-quiet', type: 'button', onclick: () => { close(); showMe(); } }, 'Meet Mira')),
      h('button', { class: 'text-button', type: 'button', onclick: () => { close(); showGuide(); } }, 'How it works')));
  return { el, close, show(force = false) {
    if (!force && !claimOpening(() => window.localStorage)) return;
    el.hidden = false;
    layers.open({ id: 'opening', el, modal: true, close }); onChange(true); next.focus({ preventScroll: true });
  } };
}
