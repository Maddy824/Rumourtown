/**
 * One glyph per claim kind, drawn as stitched outlines on a 24-unit grid. Shared by the whisper sheet,
 * tags, and the share card (which shows the lie only as its glyph, never as text).
 */
import type { ClaimKind } from '../sim/types.js';
import { svg } from './dom.js';

export const GLYPHS: Record<ClaimKind, string> = {
  story: 'M4 5h16v11H10l-5 4v-4H4zM8 9h8M8 12h5',
  // A tied sack.
  theft: 'M8.5 9.5C5.5 11.5 4.5 14.5 5 17c.6 2.6 3 3.5 7 3.5s6.4-.9 7-3.5c.5-2.5-.5-5.5-3.5-7.5M8.5 9.5h7M9.5 9.5 8 5.5c1.4-.9 2.6-.9 4 0 1.4-.9 2.6-.9 4 0l-1.5 4',
  // Tipped scales.
  cheating: 'M12 4.5V20M8 20h8M4.5 9.5 19.5 6M4.5 9.5 2.5 15h4l-2-5.5M19.5 6l-2 5.5h4l-2-5.5',
  // A heart.
  romance: 'M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.4a4.2 4.2 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z',
  // A speech tag with crooked words.
  lying: 'M4 5.5h16v10.5H11l-4.5 3.5V16H4zM7 11.5l2-2 2 2 2-2 2 2 2-2',
  // A broken chain link.
  'broken-promise': 'M10.5 8H7a4 4 0 0 0 0 8h3.5M13.5 8H17a4 4 0 0 1 0 8h-3.5M11 4.5l1 2M13 19.5l-1-2',
  // A burst.
  insult: 'M12 3.5l1.9 4 4.3-1.4-1.4 4.3 4 1.9-4 1.9 1.4 4.3-4.3-1.4-1.9 4-1.9-4-4.3 1.4 1.4-4.3-4-1.9 4-1.9-1.4-4.3 4.3 1.4z',
  // A stack of coins.
  hoarding: 'M6 7.5a6 2.4 0 1 0 12 0 6 2.4 0 1 0-12 0M6 7.5v4a6 2.4 0 0 0 12 0v-4M6 11.5v4a6 2.4 0 0 0 12 0v-4',
  // A hammock between posts.
  shirking: 'M3.5 6v14M20.5 6v14M3.5 10c3 6 14 6 17 0M14 3.5h3.5L14 7h3.5',
  // A horn.
  boasting: 'M4 10v4.5h3l9 5V5L7 10zM18.5 9c1.4 1.4 1.4 5.1 0 6.5',
  // A basket with a handle.
  kindness: 'M4 11.5h16L18 19.5H6zM8 11.5a4 4 0 0 1 8 0M9.5 14.5v2.5M14.5 14.5v2.5',
  // A coin with a tick.
  'paid-debt': 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM8 12.2l2.8 2.8 5.2-5.8',
  // A steaming bowl.
  nursed: 'M4.5 11.5h13v2a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6zM17.5 12.5h1.2a2.1 2.1 0 0 1 0 4.2H16.5M9 3.5c-1.2 1.6 1.2 2.6 0 4.5M13 3.5c-1.2 1.6 1.2 2.6 0 4.5',
};

export function glyphSvg(kind: ClaimKind, size = 20, className = 'glyph'): SVGSVGElement {
  return svg(
    'svg',
    { class: className, width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' },
    svg('path', { d: GLYPHS[kind] ?? GLYPHS.lying, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
  );
}

/** Draws the glyph centred at (x, y), `size` pixels across, with a felt fill and a stitched outline. */
export function drawGlyph(ctx: CanvasRenderingContext2D, kind: ClaimKind, x: number, y: number, size: number, color: string): void {
  const path = new Path2D(GLYPHS[kind] ?? GLYPHS.lying);
  const s = size / 24;
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(s, s);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.1;
  ctx.stroke(path);
  ctx.restore();
}
