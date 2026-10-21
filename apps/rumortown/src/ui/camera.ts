/**
 * Two camera levels, per the spec: close (32 CSS px per tile, following the stranger) and far (the whole
 * village fitted clear of the top strip and the bottom controls). Levels switch at once: the renderer
 * caches its ground per zoom level, so the zoom never passes through in-between values.
 *
 * The centre is clamped the same way the renderer clamps it (map edge never shows when the map is larger
 * than the viewport; map centred when smaller), so DOM overlays and the canvas always agree.
 */
import { TILE, type Camera, type Vec2, type VillageMap } from '../sim/types.js';

export interface Insets {
  left?: number;
  right?: number;
  top: number;
  bottom: number;
  /** Extra cover from the bottom, such as an open sheet on a phone. */
  sheet: number;
}

export interface CameraRig {
  readonly camera: Camera;
  far: boolean;
  focusZoom?: number;
  resize(width: number, height: number): void;
  setInsets(insets: Insets): void;
  /** Move toward the focus point; `snap` jumps straight there. */
  update(focus: Vec2, dtSeconds: number, snap: boolean): void;
}

const clampAxis = (center: number, tiles: number, viewport: number, zoom: number): number => {
  if (tiles * zoom <= viewport) return tiles / 2;
  const half = viewport / 2 / zoom;
  return Math.min(Math.max(center, half), tiles - half);
};

export function createCameraRig(map: VillageMap): CameraRig {
  const camera: Camera = { center: { x: map.width / 2, y: map.height / 2 }, zoom: TILE, width: 1, height: 1 };
  let insets: Insets = { top: 0, bottom: 0, sheet: 0 };
  let sheetOffset = 0;

  /** The map is centred in the viewport, so it must clear the larger of the two insets on both sides. */
  const farZoom = (): number => {
    const margin = 12;
    const availW = Math.max(80, camera.width - (insets.left ?? 0) - margin * 2);
    const availH = Math.max(80, camera.height - insets.top - insets.bottom - margin * 2);
    const z = Math.min(availW / map.width, availH / map.height);
    return Math.max(2, Math.floor(z * 4) / 4);
  };

  const rig: CameraRig = {
    camera,
    far: false,
    resize(width, height) {
      camera.width = Math.max(1, width);
      camera.height = Math.max(1, height);
    },
    setInsets(next) {
      insets = next;
    },
    update(focus, dt, snap) {
      const k = snap ? 1 : 1 - Math.exp(-dt * 9);
      sheetOffset += (insets.sheet - sheetOffset) * k;
      if (rig.far) {
        camera.zoom = farZoom();
        camera.center = { x: map.width / 2, y: map.height / 2 };
        camera.offset = { x: (insets.left ?? 0) / 2, y: (insets.top - insets.bottom) / 2 };
        return;
      }
      camera.offset = { x: 0, y: 0 };
      camera.zoom = rig.focusZoom ?? TILE;
      // Put the stranger in the middle of the band that the strip and any sheet leave uncovered.
      const bandTop = insets.top;
      const targetY = (bandTop + (camera.height - sheetOffset)) / 2;
      const want = { x: focus.x + ((insets.right ?? 0) - (insets.left ?? 0)) / 2 / camera.zoom, y: focus.y - (targetY - camera.height / 2) / camera.zoom };
      const next = {
        x: camera.center.x + (want.x - camera.center.x) * k,
        y: camera.center.y + (want.y - camera.center.y) * k,
      };
      camera.center = {
        x: clampAxis(next.x, map.width, camera.width, camera.zoom),
        y: clampAxis(next.y, map.height, camera.height, camera.zoom),
      };
      if (rig.focusZoom !== undefined) {
        // When a wide pair fits the map inside the viewport, keep it in the uncovered band.
        if (map.width * camera.zoom <= camera.width) camera.offset.x = ((insets.left ?? 0) - (insets.right ?? 0)) / 2;
        if (map.height * camera.zoom <= camera.height) camera.offset.y = (bandTop - Math.max(sheetOffset, insets.bottom)) / 2;
      }
    },
  };
  return rig;
}
