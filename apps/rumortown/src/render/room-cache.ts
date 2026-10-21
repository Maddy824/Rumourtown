/** Small reusable floor patches: occupancy never invalidates a whole village layer. */
import type { Building } from './buildings.js';
import { makeCanvas } from './grain.js';
import { drawInterior, type RoomContext, type RoomRect } from './interiors.js';

export interface RoomPatch {
  building: Building;
  rect: RoomRect;
  base: HTMLCanvasElement;
  paint: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  occupied: boolean;
  glow: number;
}

export const roomRect = (b: Building, z: number): RoomRect => ({ x: (b.x + .75) * z, y: (b.y + .75) * z, w: (b.w - 1.5) * z, h: (b.h - 1.5) * z });

export function paintInterior(ctx: CanvasRenderingContext2D, b: Building, rect: RoomRect, z: number, glow: number, occupied: boolean): void {
  ctx.save();
  ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
  // Compact rooms retain all furniture without spilling across walls or neighbouring paths.
  drawInterior(ctx as CanvasRenderingContext2D & RoomContext, b.kind, rect, { tile: Math.min(z, rect.w / 3.3, rect.h / 2.7), glow: occupied ? glow : 0, occupied });
  ctx.restore();
}

export function captureRoom(source: HTMLCanvasElement, b: Building, z: number, scale: number, margin: number): RoomPatch {
  const rect = roomRect(b, z);
  const base = makeCanvas(Math.ceil(rect.w * scale), Math.ceil(rect.h * scale));
  base.ctx.drawImage(source, (rect.x + margin * z) * scale, (rect.y + margin * z) * scale, rect.w * scale, rect.h * scale, 0, 0, base.canvas.width, base.canvas.height);
  const paint = makeCanvas(base.canvas.width, base.canvas.height);
  return { building: b, rect, base: base.canvas, paint: paint.canvas, ctx: paint.ctx, occupied: false, glow: 0 };
}

export const glowStep = (glow: number): number => Math.floor(Math.max(0, Math.min(1, glow)) * 20 + 1e-6) / 20;

export function* refreshRooms(layer: { canvas: HTMLCanvasElement; rooms: RoomPatch[]; zoom: number; scale: number }, state: () => { glow: number; occupied: ReadonlySet<string> }, margin: number): Generator<void> {
  for (const room of layer.rooms) {
    const next = state();
    const occupied = next.occupied.has(room.building.id);
    const glow = occupied ? glowStep(next.glow) : 0;
    if (room.occupied === occupied && room.glow === glow) continue;
    const ctx = room.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, room.paint.width, room.paint.height);
    ctx.drawImage(room.base, 0, 0);
    ctx.setTransform(layer.scale, 0, 0, layer.scale, 0, 0);
    paintInterior(ctx, room.building, { ...room.rect, x: 0, y: 0 }, layer.zoom, glow, occupied);
    const target = layer.canvas.getContext('2d')!;
    target.save(); target.setTransform(1, 0, 0, 1, 0, 0);
    target.drawImage(room.paint, 0, 0, room.paint.width, room.paint.height, (room.rect.x + margin * layer.zoom) * layer.scale, (room.rect.y + margin * layer.zoom) * layer.scale, room.rect.w * layer.scale, room.rect.h * layer.scale);
    target.restore();
    room.occupied = occupied; room.glow = glow;
    yield;
  }
}
