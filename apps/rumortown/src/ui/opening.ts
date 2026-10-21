import { h } from './dom.js';
import { RULES_URL } from './how-it-works.js';
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
  { glyph: '♧', title: 'What you do', text: 'Rumourtown is an agentic game. Its 36 villagers think for themselves, with goals, routines, memory, beliefs and decisions. Walk, whisper, follow the thread and read their tags. Nothing they do is scripted. Read the ending when a day finishes.' },
  { glyph: '✉', title: 'How villagers think', text: 'Villagers remember what they believe and who told them. Trust and repetition matter. Corrections leave a residue. Seeing beats hearing. They take sides and make up. Every social rule draws on published research.' },
  { glyph: '〰', title: 'Sharing and your typed whisper', text: 'Shared links replay the same days. Your typed words never travel. One small AI call turns your words into a village rumor, then discards them. It never writes the villagers’ lines. When the fixed budget runs out, choose a ready-made rumor or set its meaning yourself.' },
] as const;
export function createOpening(layers: Layers, showMe: () => void, showGuide: () => void, onChange: (open: boolean) => void) {
  let page = 0;
  const close = (): void => { el.hidden = true; layers.closed('opening'); onChange(false); };
  const title = h('h1', { id: 'rt-opening-title', tabindex: '-1' });
  const glyph = h('span', { class: 'opening-glyph', 'aria-hidden': 'true' });
  const text = h('p');
  const progress = h('p', { class: 'opening-progress', role: 'status' });
  const show = h('button', { class: 'button button-quiet', type: 'button', onclick: () => { close(); showMe(); } }, 'Show me');
  const next = h('button', { class: 'button button-primary', type: 'button', onclick: () => { if (page === 2) close(); else { page++; render(); title.focus(); } } }, 'Next');
  const back = h('button', { class: 'button button-quiet', type: 'button', onclick: () => { page = Math.max(0, page - 1); render(); title.focus(); } }, 'Back');
  const research = h('a', { href: RULES_URL, target: '_blank', rel: 'noopener noreferrer' }, 'Read the research');
  const el = h('section', { class: 'opening', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'rt-opening-title', hidden: true },
    h('div', { class: 'opening-paper' }, progress, glyph, title, text, research,
      h('div', { class: 'card-actions' }, back, next, show,
        h('button', { class: 'button button-quiet', type: 'button', onclick: close }, 'Skip')),
      h('button', { class: 'text-button', type: 'button', onclick: () => { close(); showGuide(); } }, 'How it works'),
      h('p', null, h('a', { href: '/about', target: '_blank', rel: 'noopener noreferrer' }, 'Read about Rumourtown'))));
  function render(): void {
    const content = OPENING_CARDS[page]!;
    progress.textContent = `How it works, ${page + 1} of 3`;
    glyph.textContent = content.glyph;
    title.textContent = content.title;
    text.textContent = content.text;
    back.hidden = page === 0; show.hidden = page !== 2; research.hidden = page !== 1;
    next.textContent = page === 2 ? 'Walk in' : 'Next';
  }
  let startX = 0;
  el.addEventListener('pointerdown', e => { startX = e.clientX; });
  el.addEventListener('pointerup', e => { if (Math.abs(e.clientX - startX) < 55) return; page = Math.max(0, Math.min(2, page + (e.clientX < startX ? 1 : -1))); render(); });
  return { el, close, show(force = false) {
    if (!force && !claimOpening(() => window.localStorage)) return;
    page = 0; render(); el.hidden = false;
    layers.open({ id: 'opening', el, modal: true, close }); onChange(true); next.focus({ preventScroll: true });
  } };
}
