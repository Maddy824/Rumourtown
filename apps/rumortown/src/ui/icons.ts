/**
 * The few drawn icons the shell needs. Each is decorative; buttons carry their own labels.
 */
import { svg } from './dom.js';

const stroke = { fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };

export function closeIcon(): SVGSVGElement {
  return svg('svg', { class: 'icon', width: 18, height: 18, viewBox: '0 0 18 18', 'aria-hidden': 'true', focusable: 'false' },
    svg('path', { d: 'M4.5 4.5l9 9M13.5 4.5l-9 9', ...stroke }));
}

/** The "told" arrow in a belief chain: a short stitched run with a small head. */
export function toldArrow(): SVGSVGElement {
  return svg('svg', { class: 'told-arrow', width: 34, height: 10, viewBox: '0 0 34 10', 'aria-hidden': 'true', focusable: 'false' },
    svg('path', { d: 'M2 5h26', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-dasharray': '3.5 2.5', 'stroke-linecap': 'round' }),
    svg('path', { d: 'M26 1.8 31.5 5 26 8.2', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
}

export function pauseIcon(): SVGSVGElement {
  return svg('svg', { class: 'icon', width: 14, height: 14, viewBox: '0 0 14 14', 'aria-hidden': 'true', focusable: 'false' },
    svg('path', { d: 'M4.5 2.5v9M9.5 2.5v9', ...stroke, 'stroke-width': 2.4 }));
}

/** The pillar postbox. The letter in the slot shows when someone is close enough to whisper to. */
export function postboxArt(): SVGSVGElement {
  return svg('svg', { class: 'postbox-art', viewBox: '0 0 80 104', 'aria-hidden': 'true', focusable: 'false' },
    svg('defs', null, svg('clipPath', { id: 'rt-slot-clip' }, svg('rect', { x: 0, y: 0, width: 80, height: 44.5 }))),
    svg('ellipse', { cx: 40, cy: 99, rx: 34, ry: 4.5, fill: 'rgba(46,42,34,.28)' }),
    svg('rect', { x: 9, y: 90, width: 62, height: 9, rx: 2, fill: '#4A3A2C' }),
    svg('rect', { x: 13, y: 30, width: 54, height: 62, rx: 3, fill: '#A3323B' }),
    svg('path', { d: 'M9 31a31 25 0 0 1 62 0z', fill: '#8E2832' }),
    svg('rect', { x: 7, y: 28, width: 66, height: 6, rx: 2, fill: '#7A222B' }),
    svg('circle', { cx: 40, cy: 5.5, r: 3, fill: '#7A222B' }),
    svg('g', { 'clip-path': 'url(#rt-slot-clip)' },
      svg('g', { class: 'postbox-letter' },
        svg('rect', { x: 28, y: 33, width: 24, height: 15, rx: 1, fill: '#F6F0E4', stroke: '#2E2A22', 'stroke-width': 1 }),
        svg('path', { d: 'M28.5 33.5 40 41l11.5-7.5', fill: 'none', stroke: '#2E2A22', 'stroke-width': 1 }))),
    svg('rect', { x: 23, y: 42, width: 34, height: 5, rx: 2.5, fill: '#2E2A22' }),
    svg('rect', { x: 16.5, y: 37, width: 47, height: 51.5, rx: 2, fill: 'none', stroke: 'rgba(246,240,228,.42)', 'stroke-width': 1.2, 'stroke-dasharray': '3 2.5' }),
    svg('path', { d: 'M13.5 36a27 22 0 0 1 53 0', fill: 'none', stroke: 'rgba(246,240,228,.32)', 'stroke-width': 1.1, 'stroke-dasharray': '3 2.5' }));
}

/** The sun-dial: a paper half-disc whose shadow swings from 07:00 on the left to 22:00 on the right. */
export function dialArt(): { root: SVGSVGElement; set: (fraction: number) => void } {
  const ticks = [];
  for (let i = 0; i <= 5; i++) {
    const a = Math.PI + (i / 5) * Math.PI;
    ticks.push(svg('path', {
      d: `M${20 + Math.cos(a) * 14.5} ${21 + Math.sin(a) * 14.5}L${20 + Math.cos(a) * 17} ${21 + Math.sin(a) * 17}`,
      stroke: '#2E2A22', 'stroke-width': 1.2, 'stroke-linecap': 'round',
    }));
  }
  const shadow = svg('path', { d: 'M20 21L4.5 21', stroke: '#2E2A22', 'stroke-width': 2.4, 'stroke-linecap': 'round', opacity: 0.8 });
  const sun = svg('circle', { cx: 20, cy: 3, r: 3, fill: '#D9A531', stroke: '#2E2A22', 'stroke-width': 0.9 });
  const root = svg('svg', { class: 'dial', width: 40, height: 26, viewBox: '0 0 40 26', 'aria-hidden': 'true', focusable: 'false' },
    svg('path', { d: 'M1.5 22.5a18.5 18.5 0 0 1 37 0z', fill: '#F6F0E4', stroke: '#2E2A22', 'stroke-width': 1.2 }),
    svg('path', { d: 'M5 22.5a15 15 0 0 1 30 0', fill: 'none', stroke: 'rgba(46,42,34,.35)', 'stroke-width': 0.9, 'stroke-dasharray': '2 1.6' }),
    ...ticks,
    shadow,
    sun,
    svg('circle', { cx: 20, cy: 21, r: 1.8, fill: '#2E2A22' }));
  const set = (fraction: number): void => {
    const f = Math.min(1, Math.max(0, fraction));
    // The sun climbs over the rim from the left; the gnomon's shadow swings the other way across the plate.
    const sunA = Math.PI + f * Math.PI;
    const shadowA = 2 * Math.PI - f * Math.PI;
    const len = 13;
    const sx = 20 + Math.cos(shadowA) * len;
    const sy = 21 + Math.sin(shadowA) * len;
    shadow.setAttribute('d', `M20 21L${sx.toFixed(2)} ${sy.toFixed(2)}`);
    sun.setAttribute('cx', (20 + Math.cos(sunA) * 17.5).toFixed(2));
    sun.setAttribute('cy', (21 + Math.sin(sunA) * 17.5).toFixed(2));
  };
  set(0);
  return { root, set };
}
