/**
 * Spec §11 colour tokens and the colour arithmetic the felt look is built from.
 * Every shade is a mix toward ink (shadow) or toward paper (light), never toward black
 * or white, so shading stays warm and on-palette.
 */
export const MOSS = '#6B8E4E';
export const OAT = '#E8DCC3';
export const BERRY = '#A3323B';
export const DENIM = '#3F5E8A';
export const MUSTARD = '#D9A531';
export const INK = '#2E2A22';
export const PAPER = '#F6F0E4';

interface Rgb {
  r: number;
  g: number;
  b: number;
}

const parsed = new Map<string, Rgb>();
const FALLBACK: Rgb = { r: 46, g: 42, b: 34 };

export function rgbOf(hex: string): Rgb {
  const hit = parsed.get(hex);
  if (hit) return hit;
  let h = hex.trim().replace('#', '');
  if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split('').map((c) => c + c).join('');
  const n = Number.parseInt(h.slice(0, 6), 16);
  const rgb = h.length >= 6 && Number.isFinite(n) ? { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 } : FALLBACK;
  parsed.set(hex, rgb);
  return rgb;
}

const byte = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');

/** Linear mix of two hex colours, t = 0 gives a, t = 1 gives b. */
export function mix(a: string, b: string, t: number): string {
  const x = rgbOf(a);
  const y = rgbOf(b);
  return `#${byte(x.r + (y.r - x.r) * t)}${byte(x.g + (y.g - x.g) * t)}${byte(x.b + (y.b - x.b) * t)}`;
}

export const darken = (c: string, t: number) => mix(c, INK, t);
export const lighten = (c: string, t: number) => mix(c, PAPER, t);

export function rgba(c: string, alpha: number): string {
  const { r, g, b } = rgbOf(c);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Relative luminance 0..1, for picking a thread that shows on a given felt. */
export function luma(c: string): number {
  const { r, g, b } = rgbOf(c);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** Derived felts, papers and threads. Named by material, not by use. */
export const FELT = {
  grass: MOSS,
  grassLight: mix(MOSS, '#C9D68A', 0.22),
  grassDark: darken(MOSS, 0.24),
  grassThread: darken(MOSS, 0.42),

  path: OAT,
  pathLight: lighten(OAT, 0.45),
  pathDark: darken(OAT, 0.1),
  pathThread: mix(OAT, INK, 0.42),

  water: DENIM,
  waterLight: mix(DENIM, '#8FB0D6', 0.3),
  waterDark: darken(DENIM, 0.28),
  waterThread: mix(DENIM, PAPER, 0.58),

  soil: mix(mix(MUSTARD, BERRY, 0.25), INK, 0.52),
  soilThread: mix(MUSTARD, INK, 0.25),
  wheat: MUSTARD,
  wheatDark: mix(MUSTARD, INK, 0.3),
  greens: mix(MOSS, '#B5CC6E', 0.35),
  greensDark: darken(MOSS, 0.18),

  floor: mix(OAT, MUSTARD, 0.22),
  floorLine: mix(mix(OAT, MUSTARD, 0.22), INK, 0.2),

  wood: mix(MUSTARD, INK, 0.48),
  woodLight: mix(MUSTARD, INK, 0.36),
  woodDark: mix(MUSTARD, INK, 0.64),

  stone: mix(OAT, INK, 0.32),
  stoneLight: mix(OAT, INK, 0.18),
  stoneDark: mix(OAT, INK, 0.46),

  leafDark: mix(darken(MOSS, 0.34), DENIM, 0.08),
  leaf: darken(MOSS, 0.12),
  leafLight: mix(MOSS, '#B9C96A', 0.3),
  leafThread: mix(MOSS, PAPER, 0.42),
  trunk: mix(mix(MUSTARD, BERRY, 0.3), INK, 0.58),

  /** Paper of walls and roofs. */
  wallTop: PAPER,
  wallEdge: mix(OAT, MUSTARD, 0.28),
  wallLine: mix(PAPER, INK, 0.55),
  door: mix(BERRY, INK, 0.55),

  /** The craft table the village sheet lies on, seen only at the far zoom. */
  cork: mix(mix(MUSTARD, BERRY, 0.18), INK, 0.3),
  corkLight: mix(mix(MUSTARD, BERRY, 0.12), PAPER, 0.08),
  corkDark: mix(mix(MUSTARD, BERRY, 0.2), INK, 0.52),

  thread: BERRY,
  threadLight: mix(BERRY, PAPER, 0.45),
  pin: MUSTARD,
} as const;
