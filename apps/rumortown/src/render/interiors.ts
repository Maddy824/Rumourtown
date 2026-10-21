/**
 * Furniture for the cut-away rooms, as a few felt shapes with stitched edges per building kind.
 * Pure drawing against a minimal context; the renderer decides where rooms are and caches the result.
 */
import type { PlaceKind } from '../sim/types.js';

export interface RoomContext {
  fillStyle: string | CanvasGradient;
  strokeStyle: string;
  lineWidth: number;
  globalAlpha: number;
  setLineDash(segments: number[]): void;
  beginPath(): void;
  rect(x: number, y: number, w: number, h: number): void;
  ellipse(x: number, y: number, rx: number, ry: number, rot: number, a: number, b: number): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  fill(): void;
  stroke(): void;
  save(): void;
  restore(): void;
}

export interface RoomRect { x: number; y: number; w: number; h: number }

export interface InteriorOptions {
  /** CSS px per tile at the current zoom. */
  tile: number;
  /** 0..1 from daylight(): hearths, ovens and the forge glow when it is high. */
  glow: number;
  /** Someone is inside; candles and hearths are lit only then. */
  occupied: boolean;
}

const INK = '#2E2A22';
const PAPER = '#F6F0E4';
const WOOD = '#B07A4A';
const WOOD_DARK = '#8A5A3C';
const CLOTH = '#D9A531';
const STONE = '#A9A49A';
const EMBER = '#E2742C';

const KINDS_WITH_ROOMS: ReadonlySet<PlaceKind> = new Set(['home', 'bakery', 'inn', 'mill', 'chapel', 'school', 'shop', 'smithy']);

export function hasInterior(kind: PlaceKind): boolean {
  return KINDS_WITH_ROOMS.has(kind);
}

/** Draw the furniture for `kind` inside `rect` (CSS px). At most twelve shapes; nothing for kinds without rooms. */
export function drawInterior(ctx: RoomContext, kind: PlaceKind, rect: RoomRect, opts: InteriorOptions): void {
  if (!hasInterior(kind)) return;
  const t = opts.tile;
  const s = (v: number): number => v * t; // shape sizes in tile units
  const x = rect.x, y = rect.y, w = rect.w, h = rect.h;
  const pad = Math.max(2, t * 0.18);
  ctx.save();
  ctx.setLineDash([Math.max(1.5, t * 0.07), Math.max(1.5, t * 0.07)]);
  ctx.lineWidth = Math.max(1, t * 0.045);
  ctx.strokeStyle = INK;
  const piece = (fill: string, px: number, py: number, pw: number, ph: number, round = false): void => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    if (round) ctx.ellipse(px + pw / 2, py + ph / 2, pw / 2, ph / 2, 0, 0, Math.PI * 2);
    else ctx.rect(px, py, pw, ph);
    ctx.fill();
    ctx.stroke();
  };
  const glowPatch = (px: number, py: number, pw: number, ph: number): void => {
    const g = Math.max(0, Math.min(1, opts.glow)) * (opts.occupied ? 1 : 0.35);
    if (g <= 0.02) return;
    ctx.save();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.25 + 0.45 * g;
    ctx.fillStyle = EMBER;
    ctx.beginPath();
    ctx.ellipse(px + pw / 2, py + ph / 2, pw * 0.9, ph * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  const rug = (): void => piece(CLOTH, x + w * 0.32, y + h * 0.42, w * 0.36, h * 0.3, true);
  switch (kind) {
    case 'home': {
      piece(WOOD, x + pad, y + pad, s(1.2), s(0.9)); // bed frame
      piece(PAPER, x + pad + s(0.1), y + pad + s(0.1), s(1.0), s(0.5)); // pillow and sheet
      rug();
      piece(WOOD_DARK, x + w - pad - s(1.1), y + pad, s(1.1), s(0.7)); // table
      piece(WOOD, x + w - pad - s(1.35), y + pad + s(0.1), s(0.25), s(0.45)); // chair
      piece(WOOD, x + w - pad + s(0.0), y + pad + s(0.1), s(0.25), s(0.45)); // chair
      piece(STONE, x + w - pad - s(0.9), y + h - pad - s(0.6), s(0.9), s(0.6)); // hearth
      glowPatch(x + w - pad - s(0.75), y + h - pad - s(0.5), s(0.6), s(0.4));
      break;
    }
    case 'bakery': {
      piece(STONE, x + pad, y + pad, s(1.3), s(0.9)); // oven
      glowPatch(x + pad + s(0.3), y + pad + s(0.3), s(0.7), s(0.4));
      piece(WOOD_DARK, x + pad, y + h - pad - s(0.6), w - pad * 2, s(0.6)); // counter
      for (let i = 0; i < 3; i++) piece(CLOTH, x + w - pad - s(1.2) + s(0.4) * i, y + pad + s(0.2), s(0.3), s(0.2), true); // loaves on a shelf
      piece(WOOD, x + w - pad - s(1.3), y + pad + s(0.5), s(1.3), s(0.12)); // shelf
      break;
    }
    case 'inn': {
      piece(WOOD_DARK, x + pad, y + pad + s(0.4), s(1.0), s(0.7)); // table
      piece(WOOD_DARK, x + w - pad - s(1.0), y + pad + s(0.4), s(1.0), s(0.7)); // table
      piece(WOOD, x + pad + s(1.2), y + h - pad - s(0.7), s(0.5), s(0.7), true); // barrel
      piece(WOOD, x + pad + s(1.8), y + h - pad - s(0.7), s(0.5), s(0.7), true); // barrel
      piece(STONE, x + w / 2 - s(0.5), y + pad, s(1.0), s(0.6)); // hearth
      glowPatch(x + w / 2 - s(0.35), y + pad + s(0.1), s(0.7), s(0.4));
      break;
    }
    case 'chapel': {
      for (let i = 0; i < 3; i++) piece(WOOD, x + pad, y + pad + s(0.4) + s(0.55) * i, w * 0.55, s(0.3)); // pews
      piece(PAPER, x + w - pad - s(0.9), y + pad + s(0.2), s(0.9), s(0.6)); // altar
      piece(CLOTH, x + w - pad - s(0.75), y + pad + s(0.05), s(0.6), s(0.15)); // cloth
      glowPatch(x + w - pad - s(0.7), y + pad + s(0.25), s(0.5), s(0.3)); // candles
      break;
    }
    case 'school': {
      for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) piece(WOOD, x + pad + s(0.8) * c, y + pad + s(0.7) + s(0.7) * r, s(0.55), s(0.4)); // desks
      piece(INK, x + pad, y + pad, w - pad * 2, s(0.35)); // board
      break;
    }
    case 'shop': {
      for (let i = 0; i < 2; i++) piece(WOOD, x + pad + s(0.7) * i, y + h - pad - s(0.6), s(0.55), s(0.6)); // crates
      piece(WOOD_DARK, x + w - pad - s(1.4), y + pad, s(1.4), s(0.12)); // shelf
      piece(WOOD_DARK, x + w - pad - s(1.4), y + pad + s(0.5), s(1.4), s(0.12)); // shelf
      piece(WOOD_DARK, x + pad, y + pad + s(0.3), s(1.2), s(0.5)); // counter
      break;
    }
    case 'smithy': {
      piece(STONE, x + pad, y + pad, s(1.2), s(0.9)); // forge
      glowPatch(x + pad + s(0.25), y + pad + s(0.3), s(0.7), s(0.4));
      piece(INK, x + w - pad - s(0.9), y + h / 2, s(0.9), s(0.35)); // anvil
      piece(WOOD, x + w - pad - s(0.6), y + h / 2 + s(0.35), s(0.3), s(0.35)); // anvil block
      break;
    }
    case 'mill': {
      piece(STONE, x + w / 2 - s(0.75), y + h / 2 - s(0.75), s(1.5), s(1.5), true); // millstone
      piece(INK, x + w / 2 - s(0.12), y + h / 2 - s(0.12), s(0.24), s(0.24), true); // its eye
      for (let i = 0; i < 3; i++) piece(CLOTH, x + pad + s(0.5) * i, y + h - pad - s(0.6), s(0.42), s(0.6), true); // sacks
      break;
    }
    default:
      break;
  }
  ctx.restore();
}
