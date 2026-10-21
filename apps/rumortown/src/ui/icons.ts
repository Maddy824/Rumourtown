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

/**
 * The sun-dial, drawn as a little paper dial plate seen at an angle: a gnomon stands on it, its shadow
 * swings from the west rim at 07:00, through north at midday, to the east rim at 22:00, and the sun
 * crosses the sky opposite the shadow.
 */
export function dialArt(): { root: SVGSVGElement; set: (fraction: number) => void } {
  const cx = 22;
  const cy = 19.5;
  const rx = 19;
  const ry = 7.4;
  const at = (a: number, k: number): string => `${(cx + Math.cos(a) * rx * k).toFixed(2)} ${(cy + Math.sin(a) * ry * k).toFixed(2)}`;
  const ticks = [];
  for (let i = 0; i <= 6; i++) {
    const a = Math.PI + (i / 6) * Math.PI;
    ticks.push(svg('path', { d: `M${at(a, 0.74)}L${at(a, 0.93)}`, stroke: '#2E2A22', 'stroke-width': 1, 'stroke-linecap': 'round' }));
  }
  const shadow = svg('path', { d: '', fill: 'rgba(46,42,34,.5)' });
  const sun = svg('circle', { cx: 40, cy: 14, r: 2.7, fill: '#D9A531', stroke: '#2E2A22', 'stroke-width': 0.9 });
  const root = svg('svg', { class: 'dial', width: 44, height: 28, viewBox: '0 0 44 28', 'aria-hidden': 'true', focusable: 'false' },
    svg('ellipse', { cx, cy: cy + 1.6, rx: rx + 0.6, ry: ry + 0.4, fill: 'rgba(46,42,34,.22)' }),
    svg('ellipse', { cx, cy, rx, ry, fill: '#F6F0E4', stroke: '#2E2A22', 'stroke-width': 1.2 }),
    svg('ellipse', { cx, cy, rx: rx - 2.6, ry: ry - 1.4, fill: 'none', stroke: 'rgba(46,42,34,.32)', 'stroke-width': 0.8, 'stroke-dasharray': '1.8 1.4' }),
    ...ticks,
    shadow,
    svg('path', { d: `M${cx} ${cy + 0.3}L${cx} ${cy - 10.5}L${cx + 5.2} ${cy + 0.3}Z`, fill: '#2E2A22' }),
    sun);
  const set = (fraction: number): void => {
    const f = Math.min(1, Math.max(0, fraction));
    const a = Math.PI + f * Math.PI;
    shadow.setAttribute('d', `M${cx} ${cy}L${at(a - 0.13, 0.9)}L${at(a + 0.13, 0.9)}Z`);
    const s = 0.4 + f * (Math.PI - 0.8);
    sun.setAttribute('cx', (cx + Math.cos(s) * 19.5).toFixed(2));
    sun.setAttribute('cy', (cy - 1 - Math.sin(s) * 15.5).toFixed(2));
  };
  set(0);
  return { root, set };
}
