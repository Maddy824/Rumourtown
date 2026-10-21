/**
 * The 1200×630 share card, drawn in the browser: the village silhouette, the lie as its claim-kind glyph,
 * a mini-map of the threads, three faces with their verdicts, and the stranger's credibility.
 * Built only from glyphs, names and fixed words; typed text never appears on it.
 */
import { statsText, type StoryStats } from './exchanges.js';
import type { ClaimKind, ThreadLink, Vec2, VillageMap, VillagerId, WorldSnapshot } from '../sim/types.js';
import { drawFace, type FaceLook } from './faces.js';
import { KIND_LABEL } from './format.js';
import { drawGlyph } from './glyphs.js';

export const CARD_W = 1200;
export const CARD_H = 630;

export interface ShareFace {
  look: FaceLook;
  name: string;
  verdict: string;
}

export interface ShareCardData {
  map: VillageMap;
  snapshot: WorldSnapshot;
  claim: { kind: ClaimKind; valence: number; about: string } | null;
  threads: readonly ThreadLink[];
  faces: readonly ShareFace[];
  strangerTrust: number | null;
  day: number;
  stats?: StoryStats;
}

const C = {
  moss: '#6B8E4E',
  mossDeep: '#4F6637',
  oat: '#E8DCC3',
  berry: '#A3323B',
  denim: '#3F5E8A',
  mustard: '#D9A531',
  ink: '#2E2A22',
  paper: '#F6F0E4',
};
const FONT = '"Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif';

/** A small fixed sequence for felt speckle, so the same link draws the same card. */
function speckle(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function feltTexture(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number, dark: string, light: string): void {
  const r = speckle(seed);
  const count = Math.round((w * h) / 90);
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = r() < 0.5 ? dark : light;
    const len = 2 + r() * 5;
    const a = r() * Math.PI;
    const px = x + r() * w;
    const py = y + r() * h;
    ctx.fillRect(px, py, Math.cos(a) * len + 0.8, Math.sin(a) * len * 0.3 + 0.8);
  }
}

function stitchedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, inset: number, color: string): void {
  ctx.save();
  ctx.setLineDash([7, 5]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.strokeRect(x + inset, y + inset, w - inset * 2, h - inset * 2);
  ctx.restore();
}

function paperPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number): void {
  ctx.save();
  ctx.shadowColor = 'rgba(46, 42, 34, 0.45)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = C.paper;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  feltTexture(ctx, x, y, w, h, seed, 'rgba(46,42,34,0.035)', 'rgba(255,255,255,0.3)');
  ctx.restore();
  stitchedRect(ctx, x, y, w, h, 12, 'rgba(46, 42, 34, 0.28)');
}

function pin(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, r = 11): void {
  ctx.save();
  ctx.fillStyle = 'rgba(46, 42, 34, 0.35)';
  ctx.beginPath();
  ctx.ellipse(x + 3, y + 5, r, r * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.beginPath();
  ctx.arc(x - r * 0.32, y - r * 0.35, r * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

const BUILDINGS = new Set(['home', 'bakery', 'inn', 'mill', 'chapel', 'school', 'shop', 'smithy']);

function silhouette(ctx: CanvasRenderingContext2D, map: VillageMap): void {
  const places = map.places.filter((p) => BUILDINGS.has(p.kind));
  const base = CARD_H;
  const rows: { color: string; baseline: number; scale: number; filter: (y: number) => boolean }[] = [
    { color: '#3E5230', baseline: base - 70, scale: 0.85, filter: (y) => y < map.height / 2 },
    { color: '#2F3D25', baseline: base - 8, scale: 1, filter: (y) => y >= map.height / 2 },
  ];
  // Rolling hills behind the houses.
  ctx.fillStyle = '#5A7A40';
  ctx.beginPath();
  ctx.moveTo(0, base);
  ctx.lineTo(0, base - 120);
  for (let x = 0; x <= CARD_W; x += 40) ctx.lineTo(x, base - 118 - Math.sin(x / 170) * 16 - Math.sin(x / 61) * 5);
  ctx.lineTo(CARD_W, base);
  ctx.fill();
  for (const row of rows) {
    ctx.fillStyle = row.color;
    ctx.fillRect(0, row.baseline - 4, CARD_W, base - row.baseline + 4);
    for (const p of places.filter((q) => row.filter(q.rect.y))) {
      const cx = ((p.rect.x + p.rect.w / 2) / map.width) * CARD_W;
      const w = Math.max(46, Math.min(110, p.rect.w * 13)) * row.scale;
      const wallH = (p.kind === 'home' ? 34 : p.kind === 'inn' ? 52 : 44) * row.scale;
      const roofH = (p.kind === 'chapel' ? 30 : 26) * row.scale;
      const left = cx - w / 2;
      const top = row.baseline - wallH;
      ctx.fillStyle = row.color;
      ctx.beginPath();
      ctx.moveTo(left, row.baseline);
      ctx.lineTo(left, top);
      ctx.lineTo(cx, top - roofH);
      ctx.lineTo(left + w, top);
      ctx.lineTo(left + w, row.baseline);
      ctx.closePath();
      ctx.fill();
      if (p.kind === 'chapel') {
        ctx.fillRect(cx - 7 * row.scale, top - roofH - 46 * row.scale, 14 * row.scale, 50 * row.scale);
        ctx.beginPath();
        ctx.moveTo(cx - 11 * row.scale, top - roofH - 44 * row.scale);
        ctx.lineTo(cx, top - roofH - 72 * row.scale);
        ctx.lineTo(cx + 11 * row.scale, top - roofH - 44 * row.scale);
        ctx.fill();
      } else if (p.kind === 'mill') {
        ctx.save();
        ctx.translate(cx, top - roofH * 0.4);
        ctx.strokeStyle = row.color;
        ctx.lineWidth = 7 * row.scale;
        for (let i = 0; i < 4; i++) {
          ctx.rotate(Math.PI / 2);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(0, -46 * row.scale);
          ctx.stroke();
        }
        ctx.restore();
      } else if (p.kind === 'bakery' || p.kind === 'smithy' || p.kind === 'home') {
        ctx.fillRect(left + w * 0.68, top - roofH * 0.9, 9 * row.scale, roofH * 0.8);
      }
      ctx.fillStyle = C.mustard;
      ctx.globalAlpha = row.scale < 1 ? 0.55 : 0.85;
      const winY = top + wallH * 0.34;
      const ww = 8 * row.scale;
      ctx.fillRect(cx - w * 0.24 - ww / 2, winY, ww, ww * 1.2);
      ctx.fillRect(cx + w * 0.24 - ww / 2, winY, ww, ww * 1.2);
      ctx.globalAlpha = 1;
    }
  }
}

function miniMap(ctx: CanvasRenderingContext2D, data: ShareCardData, x: number, y: number, w: number, h: number): void {
  const { map, snapshot } = data;
  const s = Math.min(w / map.width, h / map.height);
  const ox = x + (w - map.width * s) / 2;
  const oy = y + (h - map.height * s) / 2;
  const colors: Record<string, string> = {
    grass: C.moss, path: C.oat, water: C.denim, bridge: '#B48C5E', floor: '#EFE5CF', wall: '#8C5E4A', door: '#4A3A2C', field: '#C9A54A', tree: '#4C6B37', well: '#9A9488',
  };
  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = 0; tx < map.width; tx++) {
      const k = map.tiles[ty * map.width + tx] ?? 'grass';
      ctx.fillStyle = colors[k] ?? C.moss;
      ctx.fillRect(ox + tx * s, oy + ty * s, Math.ceil(s) + 0.5, Math.ceil(s) + 0.5);
    }
  }
  for (const p of map.places) {
    if (!BUILDINGS.has(p.kind)) continue;
    ctx.fillStyle = C.berry;
    ctx.fillRect(ox + p.rect.x * s, oy + p.rect.y * s, p.rect.w * s, Math.max(2, s * 0.9));
  }
  const positions = new Map<VillagerId | 'stranger', Vec2>();
  for (const v of snapshot.villagers) positions.set(v.id, v.pos);
  positions.set('stranger', snapshot.player.pos);
  const at = (p: Vec2): Vec2 => ({ x: ox + p.x * s, y: oy + p.y * s });
  // Everyone as a small felt dot, the threads over them.
  for (const v of snapshot.villagers) {
    const p = at(v.pos);
    ctx.fillStyle = v.look.top;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(2.5, s * 0.32), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  const threads = data.threads.slice(-30);
  threads.forEach((t, i) => {
    const a = positions.get(t.from);
    const b = positions.get(t.to);
    if (!a || !b) return;
    const pa = at(a);
    const pb = at(b);
    const sag = Math.min(26, Math.hypot(pb.x - pa.x, pb.y - pa.y) * 0.2);
    ctx.strokeStyle = C.berry;
    ctx.globalAlpha = 0.45 + 0.55 * ((i + 1) / threads.length);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.quadraticCurveTo((pa.x + pb.x) / 2, (pa.y + pb.y) / 2 + sag, pb.x, pb.y);
    ctx.stroke();
  });
  ctx.globalAlpha = 1;
  const pinned = new Set<string>();
  for (const t of threads) {
    for (const id of [t.from, t.to]) {
      if (pinned.has(id)) continue;
      const p = positions.get(id);
      if (!p) continue;
      pinned.add(id);
      const q = at(p);
      pin(ctx, q.x, q.y, id === 'stranger' ? C.ink : C.mustard, 5.5);
    }
  }
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2;
  ctx.strokeRect(ox, oy, map.width * s, map.height * s);
}

function trustBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, value: number): void {
  ctx.fillStyle = 'rgba(46, 42, 34, 0.12)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, 14, 7);
  ctx.fill();
  ctx.fillStyle = C.denim;
  ctx.beginPath();
  ctx.roundRect(x, y, Math.max(14, w * Math.min(1, Math.max(0, value))), 14, 7);
  ctx.fill();
  ctx.save();
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = 'rgba(246, 240, 228, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + 6, y + 7);
  ctx.lineTo(x + Math.max(8, w * value) - 6, y + 7);
  ctx.stroke();
  ctx.restore();
}

export function drawShareCard(canvas: HTMLCanvasElement, data: ShareCardData): void {
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.textBaseline = 'alphabetic';

  // The felt board.
  ctx.fillStyle = C.moss;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  feltTexture(ctx, 0, 0, CARD_W, CARD_H, 7, 'rgba(46,42,34,0.07)', 'rgba(246,240,228,0.07)');
  silhouette(ctx, data.map);

  // Left: the map card with the threads.
  ctx.save();
  ctx.translate(70, 54);
  ctx.rotate(-0.025);
  paperPanel(ctx, 0, 0, 560, 400, 11);
  miniMap(ctx, data, 34, 30, 492, 300);
  ctx.fillStyle = C.ink;
  ctx.font = `700 26px ${FONT}`;
  ctx.fillText('Who told whom', 34, 372);
  ctx.restore();
  pin(ctx, 352, 50, C.berry, 12);

  // Right: the tag with the glyph, the faces and the stranger's word.
  ctx.save();
  ctx.translate(676, 40);
  ctx.rotate(0.02);
  paperPanel(ctx, 0, 0, 470, 430, 23);
  ctx.fillStyle = C.ink;
  if (data.claim) {
    const harmful = data.claim.valence < 0;
    ctx.fillStyle = harmful ? 'rgba(163, 50, 59, 0.12)' : 'rgba(107, 142, 78, 0.16)';
    ctx.beginPath();
    ctx.arc(80, 88, 48, 0, Math.PI * 2);
    ctx.fill();
    drawGlyph(ctx, data.claim.kind, 80, 88, 62, harmful ? C.berry : '#4C6B37');
    ctx.fillStyle = C.ink;
    ctx.font = `760 34px ${FONT}`;
    ctx.fillText(`${data.claim.valence === 0 ? 'A story' : harmful ? 'A rumor' : 'A good word'} about ${data.claim.about}`, 146, 82, 300);
    ctx.font = `500 24px ${FONT}`;
    ctx.fillStyle = 'rgba(46, 42, 34, 0.74)';
    ctx.fillText(KIND_LABEL[data.claim.kind] ?? 'A rumor', 146, 116, 300);
  } else {
    ctx.font = `760 34px ${FONT}`;
    ctx.fillText('A quiet village', 40, 90, 390);
    ctx.font = `500 24px ${FONT}`;
    ctx.fillStyle = 'rgba(46, 42, 34, 0.74)';
    ctx.fillText('Nothing whispered yet', 40, 124, 390);
  }
  const faces = data.faces.slice(0, 3);
  const slot = 470 / 3;
  faces.forEach((f, i) => {
    const cx = slot * i + slot / 2;
    drawFace(ctx, f.look, cx, 222, 46);
    ctx.textAlign = 'center';
    ctx.fillStyle = C.ink;
    ctx.font = `700 24px ${FONT}`;
    ctx.fillText(f.name, cx, 300, slot - 16);
    ctx.font = `500 20px ${FONT}`;
    ctx.fillStyle = 'rgba(46, 42, 34, 0.78)';
    ctx.fillText(f.verdict, cx, 328, slot - 12);
    ctx.textAlign = 'left';
  });
  if (data.strangerTrust !== null) {
    ctx.fillStyle = C.ink;
    ctx.font = `600 21px ${FONT}`;
    ctx.fillText('The stranger’s word', 40, 384);
    trustBar(ctx, 244, 368, 120, data.strangerTrust);
    ctx.font = `760 26px ${FONT}`;
    ctx.fillText(`${Math.round(data.strangerTrust * 100)}%`, 380, 386);
  }
  ctx.restore();
  pin(ctx, 912, 38, C.mustard, 12);

  // The name and the day, on the hills.
  ctx.fillStyle = C.paper;
  ctx.font = `800 60px ${FONT}`;
  ctx.fillText('Rumourtown', 64, 596);
  if (data.stats) { ctx.font = `500 18px ${FONT}`; ctx.fillText(statsText(data.stats), 480, 592, 520); }
  ctx.font = `600 26px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText(`Day ${data.day}`, CARD_W - 64, 592);
  ctx.textAlign = 'left';
}
