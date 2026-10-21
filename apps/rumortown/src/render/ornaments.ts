/**
 * Paper ornaments for roof façades: shingle texture, chimneys, bell towers, the mill wheel,
 * gables, dormers, the shop awning, hanging signs and doorways.
 */
import { BERRY, DENIM, FELT, INK, MUSTARD, PAPER, darken, lighten, mix, rgba } from './palette.js';
import { roundRectPath } from './felt.js';

export interface RoofStyle {
  paper: string;
  shingle: 'scallop' | 'thatch' | 'slate';
}

export function shingles(ctx: CanvasRenderingContext2D, style: RoofStyle, x0: number, x1: number, band: number, z: number, seed: number): void {
  const u = z / 32;
  const row = 0.19 * z;
  const dark = rgba(darken(style.paper, 0.42), 0.55);
  const light = rgba(lighten(style.paper, 0.5), 0.35);
  ctx.lineCap = 'round';
  if (style.shingle === 'thatch') {
    ctx.lineWidth = 0.9 * u;
    for (let y = -band + 0.12 * z, r = 0; y < 0; y += row, r++) {
      ctx.strokeStyle = r % 2 ? dark : light;
      ctx.beginPath();
      for (let x = x0 + ((seed + r * 3) % 5) * u; x < x1; x += 2.6 * u) {
        ctx.moveTo(x, y);
        ctx.lineTo(x + 0.8 * u, y + row * 0.85);
      }
      ctx.stroke();
    }
    return;
  }
  const scallop = style.shingle === 'slate' ? 0.24 * z : 0.21 * z;
  ctx.lineWidth = 0.9 * u;
  for (let y = -band + 0.1 * z + row, r = 0; y < 0.01 * z; y += row, r++) {
    const off = r % 2 ? scallop / 2 : 0;
    ctx.strokeStyle = dark;
    ctx.beginPath();
    for (let x = x0 - scallop + off; x < x1 + scallop; x += scallop) {
      if (style.shingle === 'slate') {
        ctx.moveTo(x, y);
        ctx.lineTo(x + scallop, y);
        ctx.moveTo(x, y);
        ctx.lineTo(x, y - row * 0.95);
      } else {
        ctx.moveTo(x + scallop, y - row * 0.45);
        ctx.arc(x + scallop / 2, y - row * 0.45, scallop / 2, 0, Math.PI);
      }
    }
    ctx.stroke();
    ctx.strokeStyle = light;
    ctx.beginPath();
    for (let x = x0 - scallop + off; x < x1 + scallop; x += scallop) {
      ctx.moveTo(x + scallop * 0.25, y - row * 0.82);
      ctx.lineTo(x + scallop * 0.62, y - row * 0.82);
    }
    ctx.stroke();
  }
}

export function chimney(ctx: CanvasRenderingContext2D, x: number, y: number, height: number, z: number, s: number): void {
  const u = z / 32;
  const w = 0.3 * z;
  const h = height * z;
  const p = new Path2D();
  roundRectPath(p, x, y - h, w, h, 1.2 * u);
  ctx.save();
  ctx.shadowColor = rgba(INK, 0.45);
  ctx.shadowBlur = 2.5 * u * s;
  ctx.shadowOffsetX = 1 * u * s;
  ctx.shadowOffsetY = 1.5 * u * s;
  ctx.fillStyle = FELT.stone;
  ctx.fill(p);
  ctx.restore();
  ctx.fillStyle = FELT.stoneLight;
  ctx.fillRect(x + w * 0.12, y - h + 0.08 * z, w * 0.3, h - 0.12 * z);
  ctx.fillStyle = FELT.stoneDark;
  ctx.fillRect(x - 1 * u, y - h - 0.02 * z, w + 2 * u, 0.09 * z);
  ctx.strokeStyle = rgba(INK, 0.4);
  ctx.lineWidth = 0.7 * u;
  ctx.stroke(p);
}

/** A small paper bell tower standing behind the roof band. */
export function tower(ctx: CanvasRenderingContext2D, cx: number, y: number, height: number, paper: string, z: number, s: number): void {
  const u = z / 32;
  const w = 0.62 * z;
  const h = height * z;
  const body = new Path2D();
  roundRectPath(body, cx - w / 2, y - h + 0.15 * z, w, h, 1.2 * u);
  ctx.save();
  ctx.shadowColor = rgba(INK, 0.45);
  ctx.shadowBlur = 3 * u * s;
  ctx.shadowOffsetX = 1 * u * s;
  ctx.shadowOffsetY = 2 * u * s;
  ctx.fillStyle = PAPER;
  ctx.fill(body);
  ctx.restore();
  ctx.strokeStyle = rgba(INK, 0.4);
  ctx.lineWidth = 0.8 * u;
  ctx.stroke(body);
  // Arched opening with a mustard bell.
  const oy = y - h + 0.35 * z;
  ctx.fillStyle = mix(INK, DENIM, 0.2);
  ctx.beginPath();
  ctx.moveTo(cx - 0.13 * z, oy + 0.3 * z);
  ctx.lineTo(cx - 0.13 * z, oy + 0.1 * z);
  ctx.arc(cx, oy + 0.1 * z, 0.13 * z, Math.PI, 0);
  ctx.lineTo(cx + 0.13 * z, oy + 0.3 * z);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = MUSTARD;
  ctx.beginPath();
  ctx.arc(cx, oy + 0.17 * z, 0.075 * z, Math.PI, 0);
  ctx.lineTo(cx + 0.09 * z, oy + 0.24 * z);
  ctx.lineTo(cx - 0.09 * z, oy + 0.24 * z);
  ctx.closePath();
  ctx.fill();
  // Pointed cap.
  const cap = new Path2D();
  cap.moveTo(cx - w / 2 - 0.06 * z, y - h + 0.17 * z);
  cap.lineTo(cx, y - h - 0.32 * z);
  cap.lineTo(cx + w / 2 + 0.06 * z, y - h + 0.17 * z);
  cap.closePath();
  ctx.fillStyle = paper;
  ctx.fill(cap);
  ctx.strokeStyle = rgba(INK, 0.45);
  ctx.stroke(cap);
}

/** The mill's water wheel, a felt ring with spokes, half behind the façade. */
export function wheel(ctx: CanvasRenderingContext2D, cx: number, cy: number, z: number, s: number): void {
  const u = z / 32;
  const r = 0.62 * z;
  ctx.save();
  ctx.shadowColor = rgba(INK, 0.45);
  ctx.shadowBlur = 3 * u * s;
  ctx.shadowOffsetY = 2 * u * s;
  ctx.strokeStyle = FELT.wood;
  ctx.lineWidth = 0.13 * z;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = FELT.woodDark;
  ctx.lineWidth = 0.06 * z;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.stroke();
  ctx.fillStyle = FELT.woodLight;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0.06 * z, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = FELT.woodDark;
  ctx.beginPath();
  ctx.arc(cx, cy, 0.1 * z, 0, Math.PI * 2);
  ctx.fill();
}

/** A front gable: a paper triangle rising from the roof with a round window, the house shape. */
export function gable(ctx: CanvasRenderingContext2D, cx: number, top: number, w: number, h: number, style: RoofStyle, z: number, s: number): void {
  const u = z / 32;
  const base = top + 0.42 * z;
  const p = new Path2D();
  p.moveTo(cx - w / 2, base);
  p.lineTo(cx, top - h);
  p.lineTo(cx + w / 2, base);
  p.closePath();
  ctx.save();
  ctx.shadowColor = rgba(INK, 0.45);
  ctx.shadowBlur = 3 * u * s;
  ctx.shadowOffsetX = 1 * u * s;
  ctx.shadowOffsetY = 2 * u * s;
  ctx.fillStyle = lighten(style.paper, 0.05);
  ctx.fill(p);
  ctx.restore();
  ctx.save();
  ctx.clip(p);
  shingles(ctx, style, cx - w / 2, cx + w / 2, h + 0.42 * z, z, Math.floor(cx));
  const g = ctx.createLinearGradient(cx - w / 2, top - h, cx + w / 2, base);
  g.addColorStop(0, rgba(PAPER, 0.16));
  g.addColorStop(1, rgba(INK, 0.14));
  ctx.fillStyle = g;
  ctx.fill(p);
  ctx.restore();
  // Bargeboards: the cut paper edges catch the light.
  ctx.lineCap = 'round';
  ctx.strokeStyle = rgba(lighten(style.paper, 0.75), 0.95);
  ctx.lineWidth = 1.6 * u;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2 + 1.5 * u, base - 0.5 * u);
  ctx.lineTo(cx, top - h + 1.6 * u);
  ctx.lineTo(cx + w / 2 - 1.5 * u, base - 0.5 * u);
  ctx.stroke();
  ctx.strokeStyle = rgba(INK, 0.45);
  ctx.lineWidth = 0.8 * u;
  ctx.stroke(p);
  // Round window: paper, ink cross, a warm glow.
  const r = Math.min(0.17 * z, h * 0.26);
  const wy = top - h * 0.18;
  ctx.fillStyle = darken(style.paper, 0.35);
  ctx.beginPath();
  ctx.arc(cx, wy, r + 1.4 * u, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = mix(PAPER, MUSTARD, 0.4);
  ctx.beginPath();
  ctx.arc(cx, wy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = mix(INK, BERRY, 0.15);
  ctx.lineWidth = 0.9 * u;
  ctx.beginPath();
  ctx.moveTo(cx - r, wy);
  ctx.lineTo(cx + r, wy);
  ctx.moveTo(cx, wy - r);
  ctx.lineTo(cx, wy + r);
  ctx.stroke();
}

/** A small gable dormer with a paper window, rising out of the band's top edge. */
export function dormer(ctx: CanvasRenderingContext2D, cx: number, top: number, style: RoofStyle, z: number, s: number): void {
  const u = z / 32;
  const w = 0.62 * z;
  const h = 0.62 * z;
  const y = top + 0.36 * z;
  const p = new Path2D();
  p.moveTo(cx - w / 2, y);
  p.lineTo(cx - w / 2, y - h * 0.45);
  p.lineTo(cx, y - h);
  p.lineTo(cx + w / 2, y - h * 0.45);
  p.lineTo(cx + w / 2, y);
  p.closePath();
  ctx.save();
  ctx.shadowColor = rgba(INK, 0.45);
  ctx.shadowBlur = 2.5 * u * s;
  ctx.shadowOffsetX = 0.8 * u * s;
  ctx.shadowOffsetY = 1.6 * u * s;
  ctx.fillStyle = darken(style.paper, 0.08);
  ctx.fill(p);
  ctx.restore();
  ctx.strokeStyle = rgba(lighten(style.paper, 0.7), 0.9);
  ctx.lineWidth = 0.9 * u;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2 + 0.8 * u, y - h * 0.45);
  ctx.lineTo(cx, y - h + 1 * u);
  ctx.stroke();
  ctx.strokeStyle = rgba(INK, 0.45);
  ctx.lineWidth = 0.8 * u;
  ctx.stroke(p);
  // Window: paper pane with an ink cross, lit faintly mustard.
  const ww = 0.26 * z;
  const wh = 0.24 * z;
  const wx = cx - ww / 2;
  const wy = y - h * 0.5;
  const win = new Path2D();
  roundRectPath(win, wx, wy, ww, wh, 1 * u);
  ctx.fillStyle = mix(PAPER, MUSTARD, 0.35);
  ctx.fill(win);
  ctx.strokeStyle = mix(INK, BERRY, 0.15);
  ctx.lineWidth = 0.9 * u;
  ctx.stroke(win);
  ctx.beginPath();
  ctx.moveTo(cx, wy);
  ctx.lineTo(cx, wy + wh);
  ctx.moveTo(wx, wy + wh / 2);
  ctx.lineTo(wx + ww, wy + wh / 2);
  ctx.stroke();
}

/** Shop awning: berry and paper stripes along the eave. */
export function awning(ctx: CanvasRenderingContext2D, x0: number, x1: number, z: number): void {
  const u = z / 32;
  const y = -0.3 * z;
  const h = 0.3 * z;
  const n = Math.max(4, Math.round((x1 - x0) / (0.28 * z)));
  const sw = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i % 2 ? PAPER : mix(BERRY, PAPER, 0.08);
    ctx.beginPath();
    ctx.moveTo(x0 + i * sw, y);
    ctx.lineTo(x0 + (i + 1) * sw, y);
    ctx.lineTo(x0 + (i + 1) * sw, y + h * 0.75);
    ctx.quadraticCurveTo(x0 + (i + 0.5) * sw, y + h * 1.15, x0 + i * sw, y + h * 0.75);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = rgba(INK, 0.4);
  ctx.lineWidth = 0.8 * u;
  ctx.strokeRect(x0, y, x1 - x0, h * 0.75);
}

/** A round paper sign hanging off the roof, with a tiny felt emblem. */
export function sign(ctx: CanvasRenderingContext2D, cx: number, cy: number, emblem: 'loaf' | 'mug' | 'anvil', z: number, s: number): void {
  const u = z / 32;
  const r = 0.2 * z;
  ctx.save();
  ctx.shadowColor = rgba(INK, 0.45);
  ctx.shadowBlur = 2 * u * s;
  ctx.shadowOffsetY = 1.5 * u * s;
  ctx.fillStyle = PAPER;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = rgba(INK, 0.5);
  ctx.lineWidth = 0.8 * u;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  if (emblem === 'loaf') {
    ctx.fillStyle = mix(MUSTARD, BERRY, 0.3);
    ctx.beginPath();
    ctx.ellipse(cx, cy + 0.02 * z, r * 0.62, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PAPER;
    ctx.lineWidth = 0.8 * u;
    ctx.beginPath();
    for (const dx of [-0.25, 0, 0.25]) {
      ctx.moveTo(cx + (dx - 0.06) * r * 2, cy - 0.05 * z);
      ctx.lineTo(cx + (dx + 0.06) * r * 2, cy + 0.06 * z);
    }
    ctx.stroke();
  } else if (emblem === 'mug') {
    ctx.fillStyle = MUSTARD;
    ctx.fillRect(cx - r * 0.42, cy - r * 0.4, r * 0.62, r * 0.85);
    ctx.fillStyle = PAPER;
    ctx.fillRect(cx - r * 0.42, cy - r * 0.5, r * 0.62, r * 0.22);
    ctx.strokeStyle = MUSTARD;
    ctx.lineWidth = 1.2 * u;
    ctx.beginPath();
    ctx.arc(cx + r * 0.25, cy, r * 0.22, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = mix(INK, DENIM, 0.2);
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.6, cy - r * 0.25);
    ctx.lineTo(cx + r * 0.6, cy - r * 0.25);
    ctx.lineTo(cx + r * 0.25, cy + r * 0.05);
    ctx.lineTo(cx + r * 0.2, cy + r * 0.45);
    ctx.lineTo(cx - r * 0.2, cy + r * 0.45);
    ctx.lineTo(cx - r * 0.25, cy + r * 0.05);
    ctx.closePath();
    ctx.fill();
  }
}

/** When the door is in the top wall, the façade gets an arched opening so the door stays visible. */
export function doorway(ctx: CanvasRenderingContext2D, cx: number, z: number): void {
  const w = 0.56 * z;
  const h = 0.62 * z;
  ctx.fillStyle = darken(FELT.door, 0.2);
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, 0);
  ctx.lineTo(cx - w / 2, -h + w / 2);
  ctx.arc(cx, -h + w / 2, w / 2, Math.PI, 0);
  ctx.lineTo(cx + w / 2, 0);
  ctx.closePath();
  ctx.fill();
}
