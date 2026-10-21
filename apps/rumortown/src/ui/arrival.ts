/** One bounded arrival, independent of font and map-cache preparation. */
import { clockLook } from './night.js';
import { paperStars } from '../render/night.js';
import { SpriteCache } from '../render/sprites.js';
import { h } from './dom.js';
import type { Layers } from './layers.js';
export function createArrival(root: HTMLElement) {
  let finish: (() => void) | undefined, timer = 0, positionFrame = 0;
  let destination: (() => { x: number; y: number } | null) | undefined;
  let layers: Layers | undefined;
  let clock = () => 8 * 60;
  const sprite = new SpriteCache().stranger('s', 0, 32, Math.min(2, window.devicePixelRatio || 1));
  const figure = h('canvas', { class: 'arrival-stranger', width: sprite.img.width, height: sprite.img.height, 'aria-hidden': 'true' });
  figure.getContext('2d')?.drawImage(sprite.img, 0, 0);
  figure.style.width = `${sprite.w}px`; figure.style.height = `${sprite.h}px`;
  figure.style.translate = `${-sprite.ax}px ${-sprite.ay}px`;
  const skip = h('button', { class: 'button arrival-skip', type: 'button' }, 'Skip');
  const el = h('section', { class: 'arrival', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Arriving in Rumourtown', hidden: true },
    h('div', { class: 'arrival-sky' }),
    h('div', { class: 'arrival-stars', 'aria-hidden': 'true' }, ...paperStars.map(s => h('span', { style: `left:${s.x * 100}%;top:${s.y * 300}%;width:${s.size * 2}px;height:${s.size * 2}px` }))),
    ...[0, 1, 2, 3].map(i => h('div', { class: `felt-cloud cloud-${i}`, 'aria-hidden': 'true' })),
    h('div', { class: 'arrival-title' }, h('h1', null, 'Rumourtown'),
      h('p', null, 'Thirty-six villagers who think for themselves. You’re the stranger who came down from the sky.'),
      h('small', null, 'Made by ', h('a', { href: 'https://github.com/Maddy824', target: '_blank', rel: 'noopener noreferrer' }, 'Madhav'), ', who likes to hear gossip.')),
    figure, h('div', { class: 'arrival-puff', 'aria-hidden': 'true' }), skip);
  document.body.append(el);
  function end(): void {
    if (el.hidden) return;
    window.clearTimeout(timer);
    if (positionFrame) window.cancelAnimationFrame(positionFrame);
    positionFrame = 0; el.hidden = true; delete root.dataset.arriving;
    layers?.closed('arrival'); finish?.(); finish = undefined;
  }
  el.addEventListener('click', e => { if (!(e.target instanceof Element) || !e.target.closest('a')) end(); });
  el.addEventListener('keydown', e => { if (e.key === 'Escape') end(); });
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
      // Replaying restarts the single orchestrated animation.
      // Removing the animation class and flushing restarts it on a replay.
      el.classList.remove('arrival-playing'); void el.offsetWidth; el.classList.add('arrival-playing');
      if (destination) trackLanding();
      layers?.open({ id: 'arrival', el, modal: true, close: end }); skip.focus({ preventScroll: true });
      return new Promise(resolve => { finish = resolve; timer = window.setTimeout(end, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 350 : 2800); });
    },
    connect(locate: () => { x: number; y: number } | null, stack: Layers, minute?: () => number) { if (minute) clock = minute; clockLook(el, clock()); destination = locate; layers = stack; position(); if (!el.hidden) { trackLanding(); stack.open({ id: 'arrival', el, modal: true, close: end }); } },
    destroy() { end(); el.remove(); },
  };
}
export type Arrival = ReturnType<typeof createArrival>;
