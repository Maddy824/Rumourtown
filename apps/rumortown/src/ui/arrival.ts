/** A manual welcome gate, followed by a bounded arrival animation. */
import { clockLook } from './night.js';
import { paperStars } from '../render/night.js';
import { SpriteCache } from '../render/sprites.js';
import { h } from './dom.js';
import type { Layers } from './layers.js';
export function createArrival(root: HTMLElement) {
  let finish: (() => void) | undefined, timer = 0, positionFrame = 0, playing = false;
  let destination: (() => { x: number; y: number } | null) | undefined;
  let layers: Layers | undefined;
  let clock = () => 8 * 60;
  const sprite = new SpriteCache().stranger('s', 0, 32, Math.min(2, window.devicePixelRatio || 1));
  const figure = h('canvas', { class: 'arrival-stranger', width: sprite.img.width, height: sprite.img.height, 'aria-hidden': 'true' });
  figure.getContext('2d')?.drawImage(sprite.img, 0, 0);
  figure.style.width = `${sprite.w}px`; figure.style.height = `${sprite.h}px`;
  figure.style.translate = `${-sprite.ax}px ${-sprite.ay}px`;
  const skip = h('button', { class: 'button arrival-skip', type: 'button' }, 'Enter village');
  const hint = h('p', { class: 'arrival-hint' }, 'Click anywhere or press any key to enter.');
  const el = h('section', { class: 'arrival', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Welcome to Rumourtown', hidden: true },
    h('div', { class: 'arrival-sky' }),
    h('div', { class: 'arrival-stars', 'aria-hidden': 'true' }, ...paperStars.map(s => h('span', { style: `left:${s.x * 100}%;top:${s.y * 300}%;width:${s.size * 2}px;height:${s.size * 2}px` }))),
    ...[0, 1, 2, 3].map(i => h('div', { class: `felt-cloud cloud-${i}`, 'aria-hidden': 'true' })),
    h('div', { class: 'arrival-title' }, h('h1', null, 'Rumourtown'),
      h('p', null, 'Thirty-six villagers who think for themselves. You’re the stranger who came down from the sky.'),
      h('small', null, 'Made by ', h('a', { href: 'https://github.com/Maddy824', target: '_blank', rel: 'noopener noreferrer' }, 'Madhav'), ', who likes to hear gossip.')),
    figure, h('div', { class: 'arrival-puff', 'aria-hidden': 'true' }), skip, hint);
  document.body.append(el);
  function end(): void {
    if (el.hidden) return;
    window.clearTimeout(timer);
    if (positionFrame) window.cancelAnimationFrame(positionFrame);
    positionFrame = 0; el.hidden = true; playing = false; delete root.dataset.arriving; delete root.dataset.arrivalPlaying;
    layers?.closed('arrival'); finish?.(); finish = undefined;
  }
  function enter(): void {
    if (el.hidden) return;
    if (playing) { end(); return; }
    playing = true; root.dataset.arrivalPlaying = 'true';
    el.classList.add('arrival-playing'); skip.textContent = 'Skip intro'; hint.hidden = true;
    timer = window.setTimeout(end, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 350 : 2800);
  }
  el.addEventListener('click', e => { if (!(e.target instanceof Element) || !e.target.closest('a')) enter(); });
  el.addEventListener('keydown', e => {
    // Tab and shortcuts remain available, including keyboard access to the author link.
    if (e.key === 'Tab' || e.repeat || e.isComposing || e.ctrlKey || e.altKey || e.metaKey || ['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
    if (e.key === 'Enter' && e.target instanceof Element && e.target.closest('a')) return;
    e.preventDefault(); e.stopPropagation(); enter();
  });
  function position(): void {
    const point = destination?.() ?? { x: window.innerWidth / 2, y: window.innerHeight * .65 };
    el.style.setProperty('--landing-x', `${point.x}px`); el.style.setProperty('--landing-y', `${point.y}px`);
  }
  function trackLanding(): void {
    position();
    if (!el.hidden) positionFrame = window.requestAnimationFrame(trackLanding);
  }
  return {
    start(): Promise<void> {
      end(); position(); clockLook(el, clock()); el.hidden = false; root.dataset.arriving = 'true';
      // A replay returns to the same welcome gate; no timer runs before a deliberate input.
      el.classList.remove('arrival-playing'); void el.offsetWidth;
      skip.textContent = 'Enter village'; hint.hidden = false;
      if (destination) trackLanding();
      layers?.open({ id: 'arrival', el, modal: true, close: enter }); skip.focus({ preventScroll: true });
      return new Promise(resolve => { finish = resolve; });
    },
    connect(locate: () => { x: number; y: number } | null, stack: Layers, minute?: () => number) { if (minute) clock = minute; clockLook(el, clock()); destination = locate; layers = stack; position(); if (!el.hidden) { trackLanding(); stack.open({ id: 'arrival', el, modal: true, close: enter }); } },
    destroy() { end(); el.remove(); },
  };
}
export type Arrival = ReturnType<typeof createArrival>;
