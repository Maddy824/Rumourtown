/**
 * Small felt portraits composed from a villager's Look, for tags, the whisper sheet and the share card.
 * Drawn once per (villager, size) into a data URL for the DOM; drawn directly for the share card canvas.
 */
import type { Look } from '../sim/types.js';

const OAT = '#E8DCC3';
const INK = '#2E2A22';
const PAPER = '#F6F0E4';
const STITCH = 'rgba(46, 42, 34, 0.32)';

export type FaceLook = Look | 'stranger';

export function drawFace(ctx: CanvasRenderingContext2D, look: FaceLook, cx: number, cy: number, r: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = look === 'stranger' ? '#C9BC9F' : OAT;
  ctx.fill();

  // Stitched edge of the felt badge, behind the figure.
  ctx.setLineDash([Math.max(1.5, r * 0.16), Math.max(1, r * 0.1)]);
  ctx.strokeStyle = STITCH;
  ctx.lineWidth = Math.max(0.75, r * 0.045);
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.84, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  if (look === 'stranger') drawStranger(ctx, cx, cy, r);
  else drawVillager(ctx, look, cx, cy, r);
  ctx.restore();

  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.strokeStyle = INK;
  ctx.beginPath();
  ctx.arc(cx, cy, r - ctx.lineWidth / 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function shade(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m || !m[1]) return hex;
  const n = parseInt(m[1], 16);
  const f = (c: number): number => Math.round(Math.min(255, Math.max(0, amount < 0 ? c * (1 + amount) : c + (255 - c) * amount)));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `rgb(${r}, ${g}, ${b})`;
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawVillager(ctx: CanvasRenderingContext2D, look: Look, cx: number, cy: number, r: number): void {
  const hx = cx;
  const hy = cy - r * 0.1;
  const hr = r * 0.34;

  // Shoulders and clothes.
  ellipse(ctx, cx, cy + r * 0.86, r * 0.66, r * 0.46, look.top);
  if (look.apron) {
    ctx.fillStyle = look.apron;
    ctx.beginPath();
    ctx.roundRect(cx - r * 0.2, cy + r * 0.5, r * 0.4, r * 0.6, r * 0.06);
    ctx.fill();
  }
  ctx.fillStyle = look.skin;
  ctx.fillRect(cx - r * 0.09, hy + hr * 0.7, r * 0.18, r * 0.2);

  // Hair that falls behind the head.
  const hair = look.hair.color;
  if (look.hair.style === 'long') {
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.roundRect(hx - hr * 1.12, hy - hr * 0.9, hr * 2.24, hr * 2.35, hr * 0.9);
    ctx.fill();
  }
  if (look.hat === 'hood') ellipse(ctx, hx, hy + hr * 0.1, hr * 1.45, hr * 1.5, shade(look.top, -0.25));
  if (look.hat === 'bonnet') ellipse(ctx, hx, hy - hr * 0.05, hr * 1.38, hr * 1.36, PAPER);

  // Head.
  ellipse(ctx, hx, hy, hr, hr * 1.04, look.skin);
  ctx.globalAlpha = 0.22;
  ellipse(ctx, hx - hr * 0.55, hy + hr * 0.32, hr * 0.17, hr * 0.12, '#A3323B');
  ellipse(ctx, hx + hr * 0.55, hy + hr * 0.32, hr * 0.17, hr * 0.12, '#A3323B');
  ctx.globalAlpha = 1;

  // Hair on top.
  ctx.fillStyle = hair;
  switch (look.hair.style) {
    case 'short':
    case 'long':
    case 'braid':
    case 'bun':
      ctx.beginPath();
      ctx.arc(hx, hy, hr * 1.06, Math.PI, Math.PI * 2);
      ctx.quadraticCurveTo(hx + hr * 0.5, hy - hr * 0.42, hx - hr * 0.1, hy - hr * 0.36);
      ctx.quadraticCurveTo(hx - hr * 0.7, hy - hr * 0.3, hx - hr * 1.06, hy + hr * 0.1);
      ctx.closePath();
      ctx.fill();
      break;
    case 'cropped':
      ctx.beginPath();
      ctx.arc(hx, hy, hr * 1.03, Math.PI * 1.08, Math.PI * 1.92);
      ctx.quadraticCurveTo(hx, hy - hr * 0.62, hx - hr * 0.98, hy - hr * 0.26);
      ctx.closePath();
      ctx.fill();
      break;
    case 'curly':
      for (let i = 0; i <= 6; i++) {
        const a = Math.PI * (1.02 + (i / 6) * 0.96);
        ellipse(ctx, hx + Math.cos(a) * hr * 0.92, hy + Math.sin(a) * hr * 0.92, hr * 0.34, hr * 0.34, hair);
      }
      break;
    case 'bald':
      ctx.globalAlpha = 0.25;
      ellipse(ctx, hx - hr * 0.3, hy - hr * 0.6, hr * 0.25, hr * 0.12, PAPER);
      ctx.globalAlpha = 1;
      break;
  }
  if (look.hair.style === 'bun') ellipse(ctx, hx, hy - hr * 1.12, hr * 0.38, hr * 0.34, hair);
  if (look.hair.style === 'braid') {
    for (let i = 0; i < 3; i++) ellipse(ctx, hx + hr * 1.0, hy + hr * (0.35 + i * 0.42), hr * 0.22, hr * 0.24, hair);
  }

  // Hats over the hair.
  switch (look.hat) {
    case 'straw': {
      const straw = '#D8B25B';
      ellipse(ctx, hx, hy - hr * 0.62, hr * 1.6, hr * 0.32, straw);
      ctx.fillStyle = straw;
      ctx.beginPath();
      ctx.roundRect(hx - hr * 0.72, hy - hr * 1.32, hr * 1.44, hr * 0.78, hr * 0.3);
      ctx.fill();
      ctx.fillStyle = '#A3323B';
      ctx.fillRect(hx - hr * 0.72, hy - hr * 0.8, hr * 1.44, hr * 0.16);
      break;
    }
    case 'wide': {
      const felt = '#5A4632';
      ellipse(ctx, hx, hy - hr * 0.6, hr * 1.85, hr * 0.28, felt);
      ctx.fillStyle = felt;
      ctx.beginPath();
      ctx.roundRect(hx - hr * 0.68, hy - hr * 1.38, hr * 1.36, hr * 0.86, hr * 0.22);
      ctx.fill();
      break;
    }
    case 'cap': {
      ctx.fillStyle = look.bottom;
      ctx.beginPath();
      ctx.arc(hx, hy - hr * 0.2, hr * 1.04, Math.PI, Math.PI * 2);
      ctx.closePath();
      ctx.fill();
      ellipse(ctx, hx + hr * 0.78, hy - hr * 0.22, hr * 0.62, hr * 0.16, shade(look.bottom, -0.25));
      break;
    }
    case 'headscarf': {
      ctx.fillStyle = look.bottom;
      ctx.beginPath();
      ctx.arc(hx, hy, hr * 1.1, Math.PI * 0.95, Math.PI * 2.05);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(hx + hr * 0.85, hy + hr * 0.1);
      ctx.lineTo(hx + hr * 1.45, hy + hr * 0.55);
      ctx.lineTo(hx + hr * 0.95, hy + hr * 0.7);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'bonnet': {
      ctx.strokeStyle = STITCH;
      ctx.lineWidth = Math.max(0.6, hr * 0.06);
      ctx.setLineDash([hr * 0.18, hr * 0.12]);
      ctx.beginPath();
      ctx.arc(hx, hy - hr * 0.05, hr * 1.2, Math.PI * 0.9, Math.PI * 2.1);
      ctx.stroke();
      ctx.setLineDash([]);
      break;
    }
    default:
      break;
  }

  // Eyes and a small stitched smile.
  const eye = Math.max(0.7, hr * 0.1);
  ellipse(ctx, hx - hr * 0.36, hy + hr * 0.06, eye, eye * 1.15, INK);
  ellipse(ctx, hx + hr * 0.36, hy + hr * 0.06, eye, eye * 1.15, INK);
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(0.7, hr * 0.08);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(hx, hy + hr * 0.28, hr * 0.26, Math.PI * 0.2, Math.PI * 0.8);
  ctx.stroke();
}

function drawStranger(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  // Cloak and hood in ink, with an empty face.
  ellipse(ctx, cx, cy + r * 0.9, r * 0.72, r * 0.5, INK);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.66);
  ctx.bezierCurveTo(cx + r * 0.55, cy - r * 0.6, cx + r * 0.62, cy + r * 0.05, cx + r * 0.5, cy + r * 0.48);
  ctx.lineTo(cx - r * 0.5, cy + r * 0.48);
  ctx.bezierCurveTo(cx - r * 0.62, cy + r * 0.05, cx - r * 0.55, cy - r * 0.6, cx, cy - r * 0.66);
  ctx.fill();
  ellipse(ctx, cx, cy + r * 0.02, r * 0.23, r * 0.29, '#1E1B16');
  ctx.strokeStyle = 'rgba(246, 240, 228, 0.28)';
  ctx.lineWidth = Math.max(0.6, r * 0.035);
  ctx.setLineDash([Math.max(1, r * 0.1), Math.max(1, r * 0.08)]);
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.56);
  ctx.bezierCurveTo(cx + r * 0.46, cy - r * 0.5, cx + r * 0.52, cy, cx + r * 0.42, cy + r * 0.4);
  ctx.stroke();
  ctx.setLineDash([]);
}

const cache = new Map<string, string>();

/** A data URL of the face at `size` CSS pixels, cached per key and size. */
export function faceUrl(key: string, look: FaceLook, size: number): string {
  const ratio = Math.min(3, Math.max(2, Math.ceil(window.devicePixelRatio || 1)));
  const cacheKey = `${key}@${size}x${ratio}`;
  const hit = cache.get(cacheKey);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.round(size * ratio);
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.scale(ratio, ratio);
  drawFace(ctx, look, size / 2, size / 2, size / 2 - 0.5);
  const url = canvas.toDataURL('image/png');
  cache.set(cacheKey, url);
  return url;
}

export function faceImg(key: string, look: FaceLook, size: number, className = 'face'): HTMLImageElement {
  const img = document.createElement('img');
  img.className = className;
  img.width = size;
  img.height = size;
  img.alt = '';
  img.decoding = 'async';
  img.src = faceUrl(key, look, size);
  return img;
}
