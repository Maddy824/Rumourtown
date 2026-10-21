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
  { title: 'Walk', text: 'Tap a path to walk. Use Talk or act to meet someone nearby.' },
  { title: 'Whisper', text: 'Choose Spread a rumor and tell someone a story. The villagers think for themselves and decide what to believe.' },
  { title: 'Follow the thread', text: 'Open Story to see who passes your whisper on and how people react.' },
] as const;
export function createOpening(layers: Layers, showMe: () => void, showGuide: () => void, onChange: (open: boolean) => void, meetName: () => string | undefined = () => 'Mira') {
  const close = (): void => { el.hidden = true; layers.closed('opening'); onChange(false); };
  const next = h('button', { class: 'button button-primary', type: 'button', onclick: close }, 'Start exploring');
  const meet = h('button', { class: 'button button-quiet', type: 'button', onclick: () => { close(); showMe(); } });
  const el = h('section', { class: 'opening', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'rt-opening-title', hidden: true },
    h('div', { class: 'opening-paper' },
      h('span', { class: 'opening-glyph', 'aria-hidden': 'true' }, '♧'),
      h('h1', { id: 'rt-opening-title' }, 'Make yourself at home'),
      h('ol', { class: 'opening-steps' }, OPENING_CARDS.map(step => h('li', null, h('strong', null, step.title), h('p', null, step.text)))),
      h('div', { class: 'card-actions' }, next,
        meet),
      h('button', { class: 'text-button', type: 'button', onclick: () => { close(); showGuide(); } }, 'How it works')));
  return { el, close, show(force = false) {
    if (!force && !claimOpening(() => window.localStorage)) return;
    const name = meetName(); meet.textContent = name ? `Meet ${name}` : 'Explore the village';
    el.hidden = false;
    layers.open({ id: 'opening', el, modal: true, close }); onChange(true); next.focus({ preventScroll: true });
  } };
}
