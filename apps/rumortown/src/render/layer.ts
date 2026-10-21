/** Cooperative layer painting. A private surface is published only after every step completes. */
import type { VillageMap } from '../sim/types.js';
import { paintWallsSteps, type Building } from './buildings.js';
import type { Standing } from './felt.js';
import { makeCanvas } from './grain.js';
import { buildTreesSteps } from './landmarks.js';
import { buildRoofsSteps } from './roofs.js';
import { paintRoomsSteps } from './rooms.js';
import { LAYER_MARGIN, paintGroundSteps } from './tiles.js';

export interface Layer {
  zoom: number;
  dpr: number;
  /** Backing pixels per CSS pixel; capped for large canvases on phones. */
  scale: number;
  canvas: HTMLCanvasElement;
  standing: Standing[];
}

const MAX_LAYER_PIXELS = 12e6;

function* paintLayer(map: VillageMap, buildings: readonly Building[], zoom: number, dpr: number): Generator<void, Layer | undefined> {
  const cssW = (map.width + LAYER_MARGIN * 2) * zoom;
  const cssH = (map.height + LAYER_MARGIN * 2) * zoom;
  const scale = Math.min(dpr, Math.sqrt(MAX_LAYER_PIXELS / (cssW * cssH)));
  const { canvas, ctx } = makeCanvas(cssW * scale, cssH * scale);
  ctx.setTransform(scale, 0, 0, scale, LAYER_MARGIN * zoom * scale, LAYER_MARGIN * zoom * scale);
  yield;
  yield* paintGroundSteps(ctx, map, zoom, scale, () => paintRoomsSteps(ctx, map, buildings, zoom, scale));
  yield;
  yield* paintWallsSteps(ctx, map, zoom, scale);
  yield;
  const standing = yield* buildTreesSteps(map, zoom, dpr);
  const roofs = yield* buildRoofsSteps(buildings, zoom, dpr);
  standing.push(...roofs);
  yield;
  standing.sort((a, b) => a.sortY - b.sortY);
  return { zoom, dpr, scale, canvas, standing };
}

/** Check cancellation before every painting step, including within nested texture painters. */
export function* prepareLayer(map: VillageMap, buildings: readonly Building[], zoom: number, dpr: number, isCurrent = () => true): Generator<void, Layer | undefined> {
  const work = paintLayer(map, buildings, zoom, dpr);
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
