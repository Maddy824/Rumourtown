/**
 * Hair, hats and props for the felt villagers, drawn for three views: front ('s'), back ('n')
 * and right profile ('e'; west is the mirror). Pieces that sit behind the head draw in the
 * `behind` pass; everything else in the front pass.
 */
import type { Hat, Look, Prop } from '../sim/types.js';
import { BERRY, DENIM, FELT, INK, MOSS, MUSTARD, OAT, PAPER, darken, lighten, mix, rgba } from './palette.js';
import { ellipsePath, piece, rrectPath, type Metrics, type Pen } from './figure.js';
import { hashString } from './grain.js';

export type View = 's' | 'n' | 'e';

const SCARVES = [BERRY, MUSTARD, DENIM, mix(MOSS, PAPER, 0.15), mix(BERRY, MUSTARD, 0.5)];

export function hatColour(look: Look): string {
  switch (look.hat) {
    case 'straw':
      return MUSTARD;
    case 'cap':
      return darken(look.bottom, 0.3);
    case 'bonnet':
      return mix(OAT, PAPER, 0.55);
    case 'headscarf': {
      const options = SCARVES.filter((c) => c.toLowerCase() !== look.top.toLowerCase());
      return options[Math.floor(hashString(look.top + look.skin + look.hair.color) * options.length)] ?? BERRY;
    }
    case 'hood':
      return darken(look.top, 0.32);
    case 'wide':
      return mix(INK, BERRY, 0.22);
    default:
      return INK;
  }
}

/* ---------------- Hair ---------------- */

function capPath(m: Metrics, view: View, style: Look['hair']['style'], k: number): Path2D | null {
  const R = m.headR;
  const cy = m.headY;
  const p = new Path2D();
  if (style === 'bald') return null;
  const tight = style === 'cropped' || style === 'bun';
  const rr = R + (tight ? 0.012 : 0.026) - k;
  if (view === 's') {
    if (tight) {
      p.arc(0, cy, rr, Math.PI, Math.PI * 2);
      p.quadraticCurveTo(0, cy - R * 0.72 + k, -rr, cy);
    } else {
      const a0 = Math.PI * 0.93;
      p.arc(0, cy, rr, a0, Math.PI * 2.07);
      p.quadraticCurveTo(R * 0.4, cy - R * 0.18 + k, 0, cy - R * 0.38 + k);
      p.quadraticCurveTo(-R * 0.45, cy - R * 0.1 + k, rr * Math.cos(a0), cy + rr * Math.sin(a0));
    }
  } else if (view === 'n') {
    const a0 = tight ? Math.PI * 0.88 : Math.PI * 0.78;
    p.arc(0, cy, rr, a0, Math.PI * 3 - a0);
    p.quadraticCurveTo(0, cy + R * (tight ? 0.55 : 1.05) - k, rr * Math.cos(a0), cy + rr * Math.sin(a0));
  } else {
    const a0 = Math.PI * (tight ? 0.75 : 0.62);
    p.arc(0, cy, rr, a0, Math.PI * 1.93);
    p.quadraticCurveTo(R * 0.45, cy - R * 0.5 + k, R * 0.12, cy - R * 0.22 + k);
    p.quadraticCurveTo(-R * 0.2, cy + R * 0.1, -R * 0.22 + k, cy + R * 0.62 - k);
    p.lineTo(rr * Math.cos(a0), cy + rr * Math.sin(a0));
  }
  p.closePath();
  return p;
}

function curls(m: Metrics, view: View): Path2D {
  const R = m.headR;
  const cy = m.headY;
  const p = new Path2D();
  const [a0, a1] = view === 's' ? [0.92, 2.08] : view === 'n' ? [0.75, 2.25] : [0.6, 1.95];
  const n = view === 'n' ? 9 : 7;
  for (let i = 0; i < n; i++) {
    const a = Math.PI * (a0 + ((a1 - a0) * i) / (n - 1));
    const x = Math.cos(a) * R * 0.95;
    const y = cy + Math.sin(a) * R * 0.95;
    p.moveTo(x + 0.078, y);
    p.arc(x, y, 0.078, 0, Math.PI * 2);
  }
  return p;
}

/** Hair that hangs behind the head and body: long hair in front and profile views. */
export function hairBehind(p: Pen, look: Look, m: Metrics, view: View): void {
  if (look.hair.style !== 'long' || look.hat === 'hood' || view === 'n') return;
  const R = m.headR;
  const c = look.hair.color;
  const shape = view === 's' ? rrectPath(-R - 0.035, m.headY - 0.04, (R + 0.035) * 2, R + 0.27, 0.09) : rrectPath(-R - 0.04, m.headY - 0.03, R * 1.05, R + 0.29, 0.09);
  piece(p, shape, c);
}

export function hairFront(p: Pen, look: Look, m: Metrics, view: View): void {
  const style = look.hair.style;
  const c = look.hair.color;
  const R = m.headR;
  const cy = m.headY;
  if (style === 'bald') {
    if (look.hat === 'none' && view !== 'e') {
      p.ctx.strokeStyle = rgba(PAPER, 0.4);
      p.ctx.lineWidth = 1.1 * p.px;
      p.ctx.beginPath();
      p.ctx.arc(view === 'n' ? 0 : -R * 0.05, cy, R * 0.72, Math.PI * 1.15, Math.PI * 1.45);
      p.ctx.stroke();
    }
    return;
  }
  if (style === 'long' && view === 'n' && look.hat !== 'hood') {
    piece(p, rrectPath(-R - 0.03, cy - 0.02, (R + 0.03) * 2, R + 0.29, 0.09), c, rrectPath(-R + 0.0, cy + 0.02, R * 2, R + 0.21, 0.07));
  }
  const cap = capPath(m, view, style, 0);
  if (cap) {
    if (style === 'curly') {
      const all = new Path2D();
      all.addPath(cap);
      all.addPath(curls(m, view));
      piece(p, all, c);
    } else {
      piece(p, cap, c, capPath(m, view, style, 0.035) ?? undefined);
    }
  }
  if (style === 'bun' && look.hat === 'none') {
    const [bx, by] = view === 's' ? [0, cy - R - 0.035] : view === 'n' ? [0, cy - R * 0.55] : [-R * 0.78, cy - R * 0.62];
    piece(p, ellipsePath(bx, by, 0.088, 0.082), c, ellipsePath(bx, by, 0.05, 0.045));
  }
  if (style === 'braid') {
    const [x0, y0, dx] = view === 's' ? [R * 0.78, cy + R * 0.45, 0.02] : view === 'n' ? [0, cy + R * 0.85, 0] : [-R * 0.85, cy + R * 0.4, -0.01];
    const braid = new Path2D();
    for (let i = 0; i < 3; i++) {
      braid.moveTo(x0 + dx * i + 0.045, y0 + i * 0.085);
      braid.ellipse(x0 + dx * i, y0 + i * 0.085, 0.045, 0.052, 0, 0, Math.PI * 2);
    }
    piece(p, braid, c);
    p.ctx.fillStyle = mix(PAPER, BERRY, 0.25);
    p.ctx.beginPath();
    p.ctx.arc(x0 + dx * 3, y0 + 0.235, 0.022, 0, Math.PI * 2);
    p.ctx.fill();
  }
}

/* ---------------- Hats ---------------- */

/** Hat parts behind the head: bonnet backs and hoods. */
export function hatBehind(p: Pen, look: Look, m: Metrics, view: View): void {
  const R = m.headR;
  const cy = m.headY;
  const c = hatColour(look);
  if (look.hat === 'bonnet' && view === 's') piece(p, ellipsePath(0, cy + 0.005, R + 0.075, R + 0.065), c);
  if (look.hat === 'hood' && view !== 'n') {
    const shape = view === 's' ? rrectPath(-(R + 0.08), cy - R - 0.075, (R + 0.08) * 2, R * 2 + 0.24, R + 0.08) : rrectPath(-(R + 0.085), cy - R - 0.075, R * 1.75 + 0.1, R * 2 + 0.25, R + 0.06);
    piece(p, shape, c);
  }
}

export function hatFront(p: Pen, look: Look, m: Metrics, view: View): void {
  const hat: Hat = look.hat;
  if (hat === 'none') return;
  const R = m.headR;
  const cy = m.headY;
  const top = cy - R;
  const c = hatColour(look);
  const side = view === 'e' ? 0.02 : 0;
  switch (hat) {
    case 'straw':
    case 'wide': {
      const wide = hat === 'wide';
      const brimRx = wide ? 0.37 : 0.33;
      const brimRy = view === 'e' ? 0.055 : wide ? 0.085 : 0.08;
      const by = top + (wide ? 0.085 : 0.075);
      piece(p, ellipsePath(side, by, brimRx, brimRy), c, ellipsePath(side, by, brimRx - 0.045, brimRy - 0.03));
      let crown: Path2D;
      if (wide) {
        crown = rrectPath(-0.155 + side * 0.5, top - 0.135, 0.31, 0.225, 0.065);
      } else {
        crown = new Path2D();
        crown.ellipse(side * 0.5, by - 0.005, 0.165, 0.16, 0, Math.PI, Math.PI * 2);
        crown.closePath();
      }
      piece(p, crown, c);
      const band = wide ? rrectPath(-0.155 + side * 0.5, by - 0.06, 0.31, 0.045, 0.02) : rrectPath(-0.163 + side * 0.5, by - 0.055, 0.326, 0.045, 0.02);
      p.ctx.fillStyle = wide ? MUSTARD : BERRY;
      p.ctx.fill(band);
      return;
    }
    case 'cap': {
      const dome = new Path2D();
      dome.arc(0, cy, R + 0.03, Math.PI, Math.PI * 2);
      dome.quadraticCurveTo(0, cy - R * 0.08, -(R + 0.03), cy);
      dome.closePath();
      piece(p, dome, c, undefined);
      if (view === 's') piece(p, ellipsePath(0, cy - R * 0.1, R * 0.74, 0.047), darken(c, 0.2));
      if (view === 'e') piece(p, ellipsePath(R * 0.98, cy - R * 0.14, 0.115, 0.036), darken(c, 0.2));
      p.ctx.fillStyle = lighten(c, 0.3);
      p.ctx.beginPath();
      p.ctx.arc(0, cy - R - 0.02, 0.022, 0, Math.PI * 2);
      p.ctx.fill();
      return;
    }
    case 'bonnet': {
      if (view === 's') {
        const band = new Path2D();
        band.arc(0, cy, R + 0.075, Math.PI * 0.98, Math.PI * 2.02);
        band.ellipse(0, cy + 0.035, R - 0.025, R - 0.075, 0, Math.PI * 2.02, Math.PI * 0.98, true);
        band.closePath();
        piece(p, band, c, undefined);
      } else if (view === 'n') {
        piece(p, ellipsePath(0, cy - 0.005, R + 0.07, R + 0.06), c, ellipsePath(0, cy - 0.005, R + 0.03, R + 0.02));
      } else {
        const b = new Path2D();
        b.arc(-0.01, cy, R + 0.07, Math.PI * 0.55, Math.PI * 1.9);
        b.quadraticCurveTo(R * 0.3, cy - R * 0.25, R * 0.05, cy + R * 0.2);
        b.quadraticCurveTo(-R * 0.1, cy + R * 0.6, -0.01 + (R + 0.07) * Math.cos(Math.PI * 0.55), cy + (R + 0.07) * Math.sin(Math.PI * 0.55));
        b.closePath();
        piece(p, b, c, undefined);
      }
      bow(p, view === 'n' ? 0 : view === 'e' ? R * 0.15 : 0, cy + R + (view === 'n' ? -0.02 : 0.015), mix(BERRY, PAPER, 0.3));
      return;
    }
    case 'headscarf': {
      const s = new Path2D();
      if (view === 's') {
        s.arc(0, cy, R + 0.032, Math.PI * 0.9, Math.PI * 2.1);
        s.quadraticCurveTo(0, cy - R * 0.32, (R + 0.032) * Math.cos(Math.PI * 0.9), cy + (R + 0.032) * Math.sin(Math.PI * 0.9));
      } else if (view === 'n') {
        s.arc(0, cy, R + 0.032, Math.PI * 0.75, Math.PI * 2.25);
        s.quadraticCurveTo(0, cy + R * 1.15, (R + 0.032) * Math.cos(Math.PI * 0.75), cy + (R + 0.032) * Math.sin(Math.PI * 0.75));
      } else {
        s.arc(0, cy, R + 0.032, Math.PI * 0.6, Math.PI * 1.92);
        s.quadraticCurveTo(R * 0.25, cy - R * 0.3, -R * 0.1, cy + R * 0.5);
        s.closePath();
      }
      s.closePath();
      piece(p, s, c);
      if (p.detail) {
        p.ctx.save();
        p.ctx.clip(s);
        p.ctx.fillStyle = rgba(PAPER, 0.55);
        for (let i = -3; i <= 3; i++) for (let j = -3; j <= 1; j++) {
          p.ctx.beginPath();
          p.ctx.arc(i * 0.065 + (j % 2) * 0.032, cy + j * 0.06, 0.012, 0, Math.PI * 2);
          p.ctx.fill();
        }
        p.ctx.restore();
      }
      const [kx, ky] = view === 's' ? [R * 0.86, cy + R * 0.52] : view === 'n' ? [0, cy + R * 0.95] : [-R * 0.95, cy + R * 0.35];
      piece(p, ellipsePath(kx, ky, 0.042, 0.038), c);
      tails(p, kx, ky, c, view === 'e' ? -1 : 1);
      return;
    }
    case 'hood': {
      if (view === 'n') {
        const h = rrectPath(-(R + 0.08), cy - R - 0.08, (R + 0.08) * 2, R * 2 + 0.26, R + 0.08);
        piece(p, h, c, rrectPath(-(R + 0.04), cy - R - 0.04, (R + 0.04) * 2, R * 2 + 0.18, R + 0.04));
        return;
      }
      const rim = new Path2D();
      if (view === 's') {
        rim.arc(0, cy, R + 0.08, Math.PI * 0.95, Math.PI * 2.05);
        rim.ellipse(0, cy + 0.03, R - 0.015, R - 0.06, 0, Math.PI * 2.05, Math.PI * 0.95, true);
      } else {
        rim.arc(-0.02, cy, R + 0.08, Math.PI * 0.5, Math.PI * 1.85);
        rim.quadraticCurveTo(R * 0.3, cy - R * 0.2, R * 0.05, cy + R * 0.15);
        rim.quadraticCurveTo(-R * 0.15, cy + R * 0.55, -0.02, cy + R + 0.08);
      }
      rim.closePath();
      piece(p, rim, c, undefined);
      return;
    }
    default:
      return;
  }
}

function bow(p: Pen, x: number, y: number, c: string): void {
  const b = new Path2D();
  b.moveTo(x, y);
  b.lineTo(x - 0.06, y - 0.03);
  b.lineTo(x - 0.06, y + 0.035);
  b.closePath();
  b.moveTo(x, y);
  b.lineTo(x + 0.06, y - 0.03);
  b.lineTo(x + 0.06, y + 0.035);
  b.closePath();
  piece(p, b, c);
}

function tails(p: Pen, x: number, y: number, c: string, dir: number): void {
  const t = new Path2D();
  t.moveTo(x, y);
  t.lineTo(x + 0.02 * dir, y + 0.11);
  t.lineTo(x + 0.06 * dir, y + 0.09);
  t.closePath();
  t.moveTo(x, y);
  t.lineTo(x - 0.03 * dir, y + 0.1);
  t.lineTo(x + 0.01 * dir, y + 0.11);
  t.closePath();
  piece(p, t, c);
}

/* ---------------- Props ---------------- */

/** Draws the prop held at (hx, hy). `flip` mirrors it for the left hand. */
export function prop(p: Pen, kind: Prop, hx: number, hy: number, flip: boolean): void {
  if (kind === 'none') return;
  const { ctx } = p;
  ctx.save();
  ctx.translate(hx, hy);
  if (flip) ctx.scale(-1, 1);
  switch (kind) {
    case 'basket': {
      ctx.strokeStyle = FELT.wood;
      ctx.lineWidth = 0.022;
      ctx.beginPath();
      ctx.arc(0.01, 0.05, 0.075, Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();
      const b = new Path2D();
      b.moveTo(-0.1, 0.045);
      b.lineTo(0.12, 0.045);
      b.lineTo(0.095, 0.155);
      b.quadraticCurveTo(0.01, 0.185, -0.075, 0.155);
      b.closePath();
      piece(p, b, mix(MUSTARD, INK, 0.12));
      if (p.detail) {
        ctx.strokeStyle = rgba(darken(MUSTARD, 0.45), 0.7);
        ctx.lineWidth = 0.6 * p.px;
        ctx.beginPath();
        for (let x = -0.07; x < 0.1; x += 0.035) {
          ctx.moveTo(x, 0.06);
          ctx.lineTo(x + 0.012, 0.15);
        }
        ctx.moveTo(-0.09, 0.1);
        ctx.lineTo(0.11, 0.1);
        ctx.stroke();
      }
      break;
    }
    case 'tool':
      piece(p, rrectPath(-0.016, -0.16, 0.032, 0.25, 0.012), FELT.wood);
      piece(p, rrectPath(-0.075, -0.205, 0.15, 0.062, 0.018), FELT.stoneDark);
      break;
    case 'book':
      piece(p, rrectPath(-0.05, -0.03, 0.11, 0.145, 0.015), DENIM);
      ctx.fillStyle = PAPER;
      ctx.fillRect(0.045, -0.02, 0.012, 0.125);
      break;
    case 'ledger':
      piece(p, rrectPath(-0.06, -0.05, 0.13, 0.175, 0.015), mix(BERRY, INK, 0.35), rrectPath(-0.04, -0.03, 0.09, 0.135, 0.01));
      ctx.fillStyle = PAPER;
      ctx.fillRect(0.06, -0.04, 0.012, 0.155);
      break;
    case 'loaf': {
      const l = ellipsePath(0.025, 0.035, 0.105, 0.06, -0.3);
      piece(p, l, mix(MUSTARD, BERRY, 0.3));
      if (p.detail) {
        ctx.strokeStyle = rgba(PAPER, 0.85);
        ctx.lineWidth = 0.8 * p.px;
        ctx.beginPath();
        for (const dx of [-0.04, 0.0, 0.04]) {
          ctx.moveTo(0.025 + dx - 0.012, 0.012 + dx * 0.3);
          ctx.lineTo(0.025 + dx + 0.016, 0.048 + dx * 0.3);
        }
        ctx.stroke();
      }
      break;
    }
    case 'bucket': {
      ctx.strokeStyle = FELT.stoneDark;
      ctx.lineWidth = 0.016;
      ctx.beginPath();
      ctx.arc(0, 0.07, 0.07, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      const b = new Path2D();
      b.moveTo(-0.075, 0.07);
      b.lineTo(0.075, 0.07);
      b.lineTo(0.06, 0.2);
      b.lineTo(-0.06, 0.2);
      b.closePath();
      piece(p, b, mix(DENIM, OAT, 0.35));
      piece(p, ellipsePath(0, 0.07, 0.075, 0.022), mix(DENIM, INK, 0.3));
      break;
    }
    case 'broom': {
      piece(p, rrectPath(-0.014, -0.3, 0.028, 0.52, 0.012), FELT.wood);
      const br = new Path2D();
      br.moveTo(-0.025, 0.18);
      br.lineTo(0.025, 0.18);
      br.lineTo(0.09, 0.33);
      br.lineTo(-0.07, 0.33);
      br.closePath();
      piece(p, br, MUSTARD);
      if (p.detail) {
        ctx.strokeStyle = rgba(darken(MUSTARD, 0.4), 0.8);
        ctx.lineWidth = 0.6 * p.px;
        ctx.beginPath();
        for (let x = -0.05; x <= 0.07; x += 0.03) {
          ctx.moveTo(x * 0.4, 0.2);
          ctx.lineTo(x, 0.32);
        }
        ctx.stroke();
      }
      break;
    }
    case 'sack': {
      const s = new Path2D();
      s.moveTo(-0.02, 0.02);
      s.quadraticCurveTo(-0.12, 0.09, -0.09, 0.19);
      s.quadraticCurveTo(0.02, 0.24, 0.11, 0.18);
      s.quadraticCurveTo(0.12, 0.08, 0.03, 0.02);
      s.closePath();
      piece(p, s, mix(OAT, MUSTARD, 0.2));
      ctx.fillStyle = FELT.wood;
      ctx.fillRect(-0.03, 0.01, 0.065, 0.022);
      break;
    }
    default:
      break;
  }
  ctx.restore();
}
