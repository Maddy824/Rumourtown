/** Cooperative layer painting. A private surface is published only after every step completes. */
import type { VillageMap } from '../sim/types.js';
import { paintWallsSteps, type Building } from './buildings.js';
import type { Standing } from './felt.js';
import { makeCanvas } from './grain.js';
import { buildTreesSteps } from './landmarks.js';
import { buildRoofsSteps } from './roofs.js';
import { paintRoomsSteps } from './rooms.js';
import { prepareBoard } from './board.js';
import { CLOSE_ZOOM } from './camera.js';
import { captureRoom, type RoomPatch } from './room-cache.js';
import { LAYER_MARGIN, paintGroundSteps, buildCropsSteps } from './tiles.js';

export interface Layer {
  zoom: number;
  dpr: number;
  /** Backing pixels per CSS pixel; capped for large canvases on phones. */
  scale: number;
  canvas: HTMLCanvasElement;
  board?: HTMLCanvasElement;
  standing: Standing[];
  rooms: RoomPatch[];
  crops: Standing[];
  roomsPending: boolean;
  /** Includes surfaces still being painted, so cancellation releases them too. */
  surfaces: Set<HTMLCanvasElement>;
}

/** Release backing stores now; mobile browsers need not wait for garbage collection. */
export function disposeLayer(layer: Layer): void {
  for (const canvas of layer.surfaces) { canvas.width = 0; canvas.height = 0; }
  layer.surfaces.clear();
}

function* paintLayer(map: VillageMap, buildings: readonly Building[], zoom: number, dpr: number, maxPixels: number): Generator<void, Layer | undefined> {
  const cssW = (map.width + LAYER_MARGIN * 2) * zoom;
  const cssH = (map.height + LAYER_MARGIN * 2) * zoom;
  const scale = Math.min(dpr, Math.sqrt(maxPixels / (Math.ceil(cssW) * Math.ceil(cssH))));
  const { canvas, ctx } = makeCanvas(cssW * scale, cssH * scale);
  ctx.setTransform(scale, 0, 0, scale, LAYER_MARGIN * zoom * scale, LAYER_MARGIN * zoom * scale);
  const layer: Layer = { zoom, dpr, scale, canvas, standing: [], crops: [], rooms: [], roomsPending: false, surfaces: new Set([canvas]) };
  const own = (surface: HTMLCanvasElement): void => { layer.surfaces.add(surface); };
  let complete = false;
  try {
    yield;
    const rooms = layer.rooms;
    yield* paintGroundSteps(ctx, map, zoom, scale, () => paintRoomsSteps(ctx, map, buildings, zoom, scale, b => { const room = captureRoom(canvas, b, zoom, scale, LAYER_MARGIN); rooms.push(room); own(room.base); own(room.paint); }));
    yield;
    yield* paintWallsSteps(ctx, map, zoom, scale);
    yield;
    layer.crops = yield* buildCropsSteps(map, zoom, scale, own);
    const standing = layer.standing = yield* buildTreesSteps(map, zoom, dpr, own);
    const roofs = yield* buildRoofsSteps(buildings, zoom, dpr, own);
    standing.push(...roofs);
    yield;
    standing.sort((a, b) => a.sortY - b.sortY);
    const board = zoom < CLOSE_ZOOM ? yield* prepareBoard(map, zoom, scale, own) : undefined;
    layer.board = board;
    complete = true;
    return layer;
  } finally { if (!complete) disposeLayer(layer); }
}

/** Check cancellation before every painting step, including within nested texture painters. */
export function* prepareLayer(map: VillageMap, buildings: readonly Building[], zoom: number, dpr: number, isCurrent = () => true, maxPixels = 12e6): Generator<void, Layer | undefined> {
  const work = paintLayer(map, buildings, zoom, dpr, maxPixels);
  try {
    while (isCurrent()) {
      const step = work.next();
      if (step.done) return step.value;
      yield;
    }
  } finally {
    // All canvas state belongs to the discarded private surface; no partial layer is published.
    work.return(undefined);
  }
}
