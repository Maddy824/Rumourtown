/**
 * The felt diorama renderer. Ground, walls and doors are painted once per zoom level into an
 * offscreen layer; trees, roof façades and villagers are depth-sorted standing pieces; threads
 * and a paper-grain overlay go on top. A frame is a handful of blits and a few strokes.
 */
import type { Camera, Renderer, Vec2, VillageMap, VillagerId, WorldSnapshot } from '../sim/types.js';
import { CLOSE_ZOOM, computeView, fitZoom, makeView, project as projectWith, unproject as unprojectWith } from './camera.js';
import { findBuildings } from './buildings.js';
import { roofOverlaps } from './roofs.js';
import { LAYER_MARGIN } from './tiles.js';
import { prepareLayer, type Layer } from './layer.js';
import type { Standing } from './felt.js';
import { BODY, CORE_SCALE, SpriteCache } from './sprites.js';
import { ThreadPainter } from './threads.js';
import { hashString, makeCork, makeGrain } from './grain.js';
import { BERRY, DENIM, INK, MOSS, MUSTARD, OAT, PAPER, mix, rgba } from './palette.js';
import { conversationGroups } from './conversations.js';
import { drawCurrent } from './water.js';
import { IdleQueue } from './idle.js';
import { signVisible, type PresentationOptions } from './presentation.js';
import { daylight, drawDaylight, drawShadow, type TintContext } from './daylight.js';
import { drawNight } from './night.js'; // 22: night wiring, applied last.
import { drawBuildingLight, drawOccupiedSmoke, occupiedBuildings } from './lighting.js';
import { paperTag, type PaperTag } from './paper.js';
import { BOARD_PAD } from './board.js';
import { windOffset } from './wind.js';
import { glowStep, refreshRooms } from './room-cache.js';
import { idleFacing, idlePose, walkFrame } from './poses.js';
import { buildingSignText, signposts } from '../content/map/wayfinding.js';

export { fitZoom } from './camera.js';
/** The close camera: CSS pixels per tile. */
export { CLOSE_ZOOM } from './camera.js';

const GRAIN_ALPHA = 0.06;
const RECENT_SPEECH_MS = 2000;
const MAX_LAYERS = 3;
/** Positions further apart than this between snapshots are a jump, not a walk. */
const TELEPORT = 3;

export function createRenderer(canvas: HTMLCanvasElement, map: VillageMap): Renderer {
  const maybe = canvas.getContext('2d', { alpha: false });
  if (!maybe) throw new Error('Canvas 2D is not available');
  const ctx: CanvasRenderingContext2D = maybe;
  // Controller painters accept only string/gradient fills; they never read canvas patterns.
  const lightCtx = ctx as CanvasRenderingContext2D & TintContext;

  let dpr = Math.max(1, window.devicePixelRatio || 1);
  let sized = false;
  const buildings = findBuildings(map);
  let light = daylight(720);
  let occupied = new Set<string>();
  let lightSnapshot: WorldSnapshot | null = null;
  const layers: Layer[] = [];
  const idle = new IdleQueue();
  const bootstrapZooms = new Set<number>();
  let preparingSprites = false;
  let preparingZoom = false;
  let requestedZoom = CLOSE_ZOOM;
  let resizePending = false;
  const sprites = new SpriteCache();
  const threads = new ThreadPainter();
  const grainTile = makeGrain(256);
  let grain: CanvasPattern | null = null;
  const tags = new Map<string, PaperTag>();
  let cork: CanvasPattern | null = null;
  let corkDpr = 0;
  const view = makeView();
  const hitView = makeView();

  // Per-frame state in preallocated arrays.
  let capacity = 0;
  let fx = new Float64Array(0);
  let fy = new Float64Array(0);
  let order = new Int32Array(0);
  let count = 0;
  let playerX = 0;
  let playerY = 0;
  let lastCurrent: WorldSnapshot | null = null;
  let current: WorldSnapshot | null = null;
  const prevIndex = new Map<VillagerId, number>();
  const curIndex = new Map<VillagerId, number>();
  let prevRef: WorldSnapshot | null = null;
  let curRef: WorldSnapshot | null = null;
  const phases = new Map<VillagerId, number>();
  const recentlySpoke = new Map<VillagerId, number>();
  const ringDash = [0, 0];

  function ensureCapacity(n: number): void {
    if (n <= capacity) return;
    capacity = Math.max(n, capacity * 2, 32);
    fx = new Float64Array(capacity);
    fy = new Float64Array(capacity);
    order = new Int32Array(capacity);
    for (let i = 0; i < capacity; i++) order[i] = i;
  }

  function setSize(width: number, height: number, ratio: number): void {
    dpr = Math.max(1, ratio || 1);
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    if (corkDpr !== dpr) {
      cork = null;
      tags.clear();
      for (const place of map.places) {
        const name = buildingSignText(place, 40);
        const icon = buildingSignText(place, 10);
        tags.set(`12:${name}`, paperTag(name, 12, dpr, grainTile));
        tags.set(`10:${icon}`, paperTag(icon, 10, dpr, grainTile));
      }
      for (const post of signposts) for (const name of post.arms) tags.set(`post:${name}`, paperTag(name, 12, dpr, grainTile, 80));
      tags.set('you', paperTag('You', 10, dpr, grainTile));
    }
    // Layers painted for another pixel density are useless now; free them.
    for (let i = layers.length - 1; i >= 0; i--) if ((layers[i] as Layer).dpr !== dpr) layers.splice(i, 1);
    // Only called during creation/resize, never by the frame's drawing path.
    const far = fitZoom(map, width, height);
    for (let i = layers.length - 1; i >= 0; i--) {
      const z = (layers[i] as Layer).zoom;
      if (z !== CLOSE_ZOOM && z !== far) layers.splice(i, 1);
    }
    idle.clear();
    bootstrapZooms.clear();
    preparingSprites = false;
    preparingZoom = false;
    requestedZoom = CLOSE_ZOOM;
    sprites.retain([CLOSE_ZOOM, far], dpr);
    for (const zoom of far === CLOSE_ZOOM ? [CLOSE_ZOOM] : [CLOSE_ZOOM, far]) {
      if (!layers.some(l => l.zoom === zoom)) {
        bootstrapZooms.add(zoom);
        idle.add((function* () {
          const layer = yield* prepareLayer(map, buildings, zoom, dpr);
          if (current) for (const v of current.villagers) yield* sprites.prepare(v.look, v.tier === 'core', zoom, dpr);
          if (layer) yield* refreshRooms(layer, () => ({ glow: light.windows, occupied }), LAYER_MARGIN);
          if (layer && !layers.some(l => l.zoom === zoom)) layers.push(layer);
          bootstrapZooms.delete(zoom);
        })());
      }
      for (const facing of ['s', 'n', 'e', 'w'] as const) for (const frame of [0, 1, 2] as const) sprites.stranger(facing, frame, zoom, dpr);
    }
    cork = ctx.createPattern(makeCork(Math.round(256 * dpr)), 'repeat');
    corkDpr = dpr;
    if (current) requestSprites(current);
  }

  /** Keep drawing the nearest complete layer while the exact requested zoom is prepared. */
  function requestLayer(zoom: number): void {
    requestedZoom = zoom;
    if (preparingZoom || bootstrapZooms.has(zoom) || layers.some((l) => l.zoom === zoom)) return;
    preparingZoom = true;
    idle.add(prepareRequestedLayer());
  }

  function* prepareRequestedLayer(): Generator<void> {
    while (!layers.some((l) => l.zoom === requestedZoom)) {
      const zoom = requestedZoom;
      // The iterator runs only from IdleQueue, never synchronously from render().
      // Keep the layer private until its complete sprite wardrobe is ready too.
      const layer = yield* prepareLayer(map, buildings, zoom, dpr, () => zoom === requestedZoom);
      if (!layer) {
        sprites.retain(layers.map((l) => l.zoom), dpr);
        continue;
      }
      for (const facing of ['s', 'n', 'e', 'w'] as const) for (const frame of [0, 1, 2] as const) {
        if (zoom !== requestedZoom) break;
        sprites.stranger(facing, frame, zoom, dpr);
        yield;
      }
      while (zoom === requestedZoom && current && !spritesReadyAt(current, zoom)) {
        const snapshot = current;
        for (const v of snapshot.villagers) {
          if (zoom !== requestedZoom) break;
          yield* sprites.prepare(v.look, v.tier === 'core', zoom, dpr);
        }
      }
      if (zoom === requestedZoom) {
        yield* refreshRooms(layer, () => ({ glow: light.windows, occupied }), LAYER_MARGIN);
        layers.push(layer);
        // Retain close plus the two most recently prepared overview/intermediate zooms.
        if (layers.length > MAX_LAYERS) layers.splice(layers.findIndex((l) => l.zoom !== CLOSE_ZOOM), 1);
      }
      sprites.retain(layers.map((l) => l.zoom), dpr);
    }
    preparingZoom = false;
  }

  /** How much the chosen layer is stretched this frame: 1 unless the zoom is still moving. */
  let stretch = 1;

  /** Read-only cache lookup. A missing zoom stretches the nearest prepared layer. */
  function layerFor(zoom: number): Layer {
    let nearest = layers[0] as Layer;
    let nearestGap = Infinity;
    stretch = 1;
    for (const l of layers) {
      if (l.dpr !== dpr) continue;
      if (l.zoom === zoom) return l;
      const gap = Math.abs(Math.log(l.zoom / zoom));
      if (gap < nearestGap) {
        nearestGap = gap;
        nearest = l;
      }
    }
    stretch = zoom / nearest.zoom;
    return nearest;
  }

  function spritesReadyAt(cur: WorldSnapshot, zoom: number): boolean {
    for (const v of cur.villagers) {
      if (!sprites.ready(v.look, v.tier === 'core', zoom, dpr)) return false;
    }
    return true;
  }

  function spritesReady(cur: WorldSnapshot): boolean {
    return layers.every((layer) => spritesReadyAt(cur, layer.zoom));
  }

  function* prepareSprites(): Generator<void> {
    // The contract supplies Looks only with the first snapshot. Defer their composition,
    // then retain the complete wardrobe at each published zoom for subsequent frames.
    while (current && !spritesReady(current)) {
      const snapshot = current;
      for (const layer of layers) for (const v of snapshot.villagers) {
        yield* sprites.prepare(v.look, v.tier === 'core', layer.zoom, dpr);
      }
    }
    preparingSprites = false;
  }

  function requestSprites(cur: WorldSnapshot): boolean {
    if (spritesReady(cur)) return true;
    if (!preparingSprites) {
      preparingSprites = true;
      idle.add(prepareSprites());
    }
    return false;
  }

  function phaseOf(id: VillagerId): number {
    let p = phases.get(id);
    if (p === undefined) {
      p = hashString(id) * 3;
      phases.set(id, p);
    }
    return p;
  }

  function index(snapshot: WorldSnapshot, into: Map<VillagerId, number>): void {
    into.clear();
    const vs = snapshot.villagers;
    for (let i = 0; i < vs.length; i++) into.set((vs[i] as WorldSnapshot['villagers'][number]).id, i);
  }

  /** Interpolated feet positions for this frame, written into fx/fy and the player. */
  function interpolate(previous: WorldSnapshot | null, cur: WorldSnapshot, alpha: number): void {
    const a = Math.min(1, Math.max(0, Number.isFinite(alpha) ? alpha : 1));
    if (previous && previous !== prevRef) {
      index(previous, prevIndex);
      prevRef = previous;
    }
    if (cur !== curRef) {
      index(cur, curIndex);
      curRef = cur;
    }
    const vs = cur.villagers;
    count = vs.length;
    ensureCapacity(count);
    for (let i = 0; i < count; i++) {
      const v = vs[i] as (typeof vs)[number];
      let x = v.pos.x;
      let y = v.pos.y;
      if (previous) {
        const pvs = previous.villagers;
        const same = pvs[i];
        const j = same && same.id === v.id ? i : (prevIndex.get(v.id) ?? -1);
        const pv = j >= 0 ? pvs[j] : undefined;
        if (pv && Math.abs(x - pv.pos.x) < TELEPORT && Math.abs(y - pv.pos.y) < TELEPORT) {
          x = pv.pos.x + (x - pv.pos.x) * a;
          y = pv.pos.y + (y - pv.pos.y) * a;
        }
      }
      fx[i] = x;
      fy[i] = y;
    }
    playerX = cur.player.pos.x;
    playerY = cur.player.pos.y;
    if (previous) {
      const pp = previous.player.pos;
      if (Math.abs(playerX - pp.x) < TELEPORT && Math.abs(playerY - pp.y) < TELEPORT) {
        playerX = pp.x + (playerX - pp.x) * a;
        playerY = pp.y + (playerY - pp.y) * a;
      }
    }
    // Depth order: insertion sort, nearly sorted from the last frame.
    for (let i = 0; i < count; i++) if ((order[i] as number) >= count) order[i] = i;
    for (let i = 1; i < count; i++) {
      const o = order[i] as number;
      const y = fy[o] as number;
      let j = i - 1;
      while (j >= 0 && (fy[order[j] as number] as number) > y) {
        order[j + 1] = order[j] as number;
        j--;
      }
      order[j + 1] = o;
    }
  }

  function crisp(v: number, stretch: number): number {
    return stretch === 1 ? Math.round(v * dpr) / dpr : v;
  }

  function drawTable(camera: Camera): void {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = cork ?? mix(MUSTARD, INK, 0.4);
    ctx.fillRect(0, 0, Math.ceil(camera.width * dpr), Math.ceil(camera.height * dpr));
    ctx.restore();
  }

  function drawGround(layer: Layer, stretch: number, camera: Camera): void {
    const zoom = view.zoom;
    const m = LAYER_MARGIN * zoom;
    const gx = crisp(view.ox - m, stretch);
    const gy = crisp(view.oy - m, stretch);
    const gw = (map.width + LAYER_MARGIN * 2) * zoom;
    const gh = (map.height + LAYER_MARGIN * 2) * zoom;
    const x0 = Math.max(gx, 0);
    const y0 = Math.max(gy, 0);
    const x1 = Math.min(gx + gw, camera.width);
    const y1 = Math.min(gy + gh, camera.height);
    if (x1 <= x0 || y1 <= y0) return;
    const kx = layer.canvas.width / gw;
    const ky = layer.canvas.height / gh;
    ctx.drawImage(layer.canvas, (x0 - gx) * kx, (y0 - gy) * ky, (x1 - x0) * kx, (y1 - y0) * ky, x0, y0, x1 - x0, y1 - y0);
  }

  function drawSelection(cur: WorldSnapshot, selected: VillagerId): void {
    const i = curIndex.get(selected);
    if (i === undefined || i >= count) return;
    const v = cur.villagers[i];
    if (!v) return;
    const zoom = view.zoom;
    const sc = (v.tier === 'core' ? CORE_SCALE : 1) * zoom;
    const x = view.ox + (fx[i] as number) * zoom;
    const y = view.oy + (fy[i] as number) * zoom;
    const rx = 0.5 * sc;
    const ry = 0.21 * sc;
    const band = Math.max(2.5, 0.15 * sc);
    const ring = new Path2D();
    ring.ellipse(x, y, rx + band / 2, ry + band / 2, 0, 0, Math.PI * 2);
    ring.ellipse(x, y, rx - band / 2, Math.max(1, ry - band / 2), 0, 0, Math.PI * 2);
    // A cut paper ring lying on the board: hard little shadow, crisp edge, a mustard running stitch.
    ctx.save();
    ctx.shadowColor = rgba(INK, 0.55);
    ctx.shadowBlur = Math.max(1, 0.08 * sc) * dpr;
    ctx.shadowOffsetX = 0.03 * sc * dpr;
    ctx.shadowOffsetY = 0.07 * sc * dpr;
    ctx.fillStyle = PAPER;
    ctx.fill(ring, 'evenodd');
    ctx.restore();
    ctx.lineWidth = Math.max(0.8, 0.03 * sc);
    ctx.strokeStyle = rgba(INK, 0.55);
    ctx.stroke(ring);
    ctx.save();
    ringDash[0] = Math.max(1.5, 0.1 * sc);
    ringDash[1] = Math.max(1.2, 0.07 * sc);
    ctx.setLineDash(ringDash);
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, 0.05 * sc);
    ctx.strokeStyle = mix(MUSTARD, INK, 0.12);
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function roofAlpha(s: Standing, cur: WorldSnapshot, selected: VillagerId | undefined, zoom: number): number {
    if (!s.roof) return 1;
    // Only figures standing behind the house (feet above the façade's bottom edge) are hidden by
    // its roof; people inside the room already show through the cut-away, so the roof stays solid.
    const behind = (footY: number): boolean => footY < s.y + s.h - 0.2 * zoom;
    if (behind(playerY) && roofOverlaps(s, playerX, playerY, zoom)) return 0.55;
    for (let i = 0; i < count; i++) {
      const v = cur.villagers[i] as WorldSnapshot['villagers'][number];
      if (v.id !== selected && !recentlySpoke.has(v.id)) continue;
      const footY = fy[i] as number;
      if (behind(footY) && roofOverlaps(s, fx[i] as number, footY, zoom, v.tier === 'core' ? CORE_SCALE : 1)) return 0.55;
    }
    return 1;
  }

  function drawStanding(s: Standing, stretch: number, camera: Camera, cur: WorldSnapshot, selected: VillagerId | undefined, zoom: number, reducedMotion = false, alphaTick = 1): void {
    const x = view.ox + s.x * stretch;
    const y = view.oy + s.y * stretch;
    const w = s.w * stretch;
    const h = s.h * stretch;
    if (x > camera.width || y > camera.height || x + w < 0 || y + h < 0) return;
    const alpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha * roofAlpha(s, cur, selected, zoom);
    const offset = s.wind === undefined ? 0 : windOffset(s.wind, cur.tick, alphaTick, reducedMotion) * Math.min(1, view.zoom / CLOSE_ZOOM);
    if (offset) {
      const shear = offset / Math.max(1, h);
      const pivotY = view.oy + s.sortY * view.zoom;
      ctx.setTransform(dpr, 0, shear * dpr, dpr, -shear * pivotY * dpr, 0);
    }
    ctx.drawImage(s.img, crisp(x, stretch), crisp(y, stretch), w, h);
    if (offset) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = alpha;
  }

  function drawVillager(cur: WorldSnapshot, i: number, layerZoom: number, stretch: number, _now: number, camera: Camera, reducedMotion = false, alpha = 1): void {
    const v = cur.villagers[i];
    if (!v) return;
    const zoom = view.zoom;
    const x = view.ox + (fx[i] as number) * zoom;
    const y = view.oy + (fy[i] as number) * zoom;
    if (x < -zoom * 2 || y < -zoom || x > camera.width + zoom * 2 || y > camera.height + zoom * 2) return;
    const pose = idlePose(v.id, cur.tick, reducedMotion || v.moving);
    const frame = v.moving && !reducedMotion ? walkFrame(cur.tick, alpha, phaseOf(v.id)) : 0;
    const sp = sprites.cachedVillager(v.look, idleFacing(v.facing, pose.turn), frame, v.mood, v.tier === 'core', layerZoom, dpr);
    if (!sp) return;
    drawShadow(lightCtx, x, y, zoom * .3, zoom * .09, zoom, light);
    ctx.drawImage(sp.img, crisp(x + pose.lean * zoom - sp.ax * stretch, stretch), crisp(y - sp.ay * stretch, stretch), sp.w * stretch, sp.h * stretch);
  }

  function drawPlayer(cur: WorldSnapshot, layerZoom: number, stretch: number, now: number, reducedMotion: boolean): void {
    const zoom = view.zoom;
    const x = view.ox + playerX * zoom;
    const y = view.oy + playerY * zoom;
    const frame = cur.player.moving && !reducedMotion ? walkFrame(cur.tick, 1) : 0;
    const sp = sprites.cachedStranger(cur.player.facing, frame, layerZoom, dpr);
    if (!sp) return;
    // A persistent gold footprint makes the controllable traveller easy to find.
    ctx.save();
    const pulse = reducedMotion ? 1 : 1 + .06 * Math.sin(now / 700);
    ctx.fillStyle = rgba(MUSTARD, .25);
    ctx.strokeStyle = MUSTARD;
    ctx.setLineDash([Math.max(1, zoom * .1), Math.max(1, zoom * .065)]);
    ctx.lineWidth = Math.max(1, zoom * .045);
    ctx.beginPath();
    ctx.ellipse(x, y, zoom * .48 * pulse, zoom * .23 * pulse, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    drawShadow(lightCtx, x, y, zoom * .3, zoom * .09, zoom, light);
    ctx.drawImage(sp.img, crisp(x - sp.ax * stretch, stretch), crisp(y - sp.ay * stretch, stretch), sp.w * stretch, sp.h * stretch);
  }

  /** Thread ends pin to the middle of the body. */
  const resolveEnd = (id: string, out: { x: number; y: number }): boolean => {
    const zoom = view.zoom;
    if (id === 'stranger') {
      out.x = view.ox + playerX * zoom;
      out.y = view.oy + (playerY - 0.72) * zoom;
      return true;
    }
    const i = curIndex.get(id);
    if (i === undefined || i >= count || !current) return false;
    const v = current.villagers[i];
    const lift = v && v.tier === 'core' ? 0.72 * CORE_SCALE : 0.72;
    out.x = view.ox + (fx[i] as number) * zoom;
    out.y = view.oy + ((fy[i] as number) - lift) * zoom;
    return true;
  };

  function drawGrain(camera: Camera): void {
    if (!grain) grain = ctx.createPattern(grainTile, 'repeat');
    if (!grain) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = GRAIN_ALPHA;
    ctx.fillStyle = grain;
    ctx.fillRect(0, 0, Math.ceil(camera.width * dpr), Math.ceil(camera.height * dpr));
    ctx.restore();
  }

  function drawSigns(camera: Camera, phone: boolean): void {
    const zoom = view.zoom;
    ctx.save();
    ctx.font = `650 ${zoom >= 24 ? 12 : 10}px 'Bricolage Grotesque', sans-serif`;
    ctx.textAlign = 'center';
    for (const place of map.places) {
      if (!['home', 'bakery', 'inn', 'smithy', 'shop', 'chapel', 'school', 'mill'].includes(place.kind)) continue;
      if (!signVisible(place.kind, Math.hypot(place.door.x - playerX, place.door.y - playerY), phone)) continue;
      if (place.kind === 'home' && zoom < 24) continue;
      const text = buildingSignText(place, zoom);
      const x = view.ox + (place.door.x + .5) * zoom, y = view.oy + (place.door.y - .5) * zoom;
      if (x < -80 || x > camera.width + 80 || y < 0 || y > camera.height) continue;
      const tag = tags.get(`${zoom < 24 ? 10 : 12}:${text}`);
      if (tag) ctx.drawImage(tag.img, x - tag.w / 2, y, tag.w, tag.h);
    }
    if (!phone && zoom >= 24) for (const post of signposts) {
      const x = view.ox + post.x * zoom, y = view.oy + (post.y - 1.5) * zoom;
      if (x < -100 || x > camera.width + 100 || y < -80 || y > camera.height) continue;
      post.arms.forEach((name, i) => { const tag = tags.get(`post:${name}`); if (tag) ctx.drawImage(tag.img, x - tag.w / 2, y + i * 23, tag.w, tag.h); });
    }
    ctx.restore();
  }

  function render(previous: WorldSnapshot | null, cur: WorldSnapshot, camera: Camera, options: PresentationOptions): void {
    current = cur;
    if (lightSnapshot !== cur) {
      light = daylight(cur.minuteOfDay);
      occupied = occupiedBuildings(buildings, cur);
      lightSnapshot = cur;
    }
    const now = performance.now();
    for (const v of cur.villagers) {
      if (v.bubble?.text && v.bubble.untilTick > cur.tick) recentlySpoke.set(v.id, now);
    }
    // DOM bubbles can outlive snapshot speech. Remember the last sighting by id,
    // even while cache preparation delays drawing, and expire using wall time.
    for (const [id, lastSeen] of recentlySpoke) if (now - lastSeen >= RECENT_SPEECH_MS) recentlySpoke.delete(id);
    if (!sized) {
      // Preserve the no-explicit-resize fallback without preparing layers inside render().
      if (!resizePending) {
        resizePending = true;
        window.setTimeout(() => {
          if (!sized) {
            setSize(camera.width, camera.height, window.devicePixelRatio || 1);
            sized = true;
          }
          resizePending = false;
        }, 0);
      }
      return;
    }
    computeView(map, camera, view);
    const zoom = view.zoom;
    // Keep the last complete frame while a newly introduced Look is prepared in idle time.
    const ready = requestSprites(cur);
    requestLayer(zoom);
    if (!layers.length) {
      interpolate(previous, cur, options.alpha);
      // Paint actual map tiles while felt textures are stitched in idle slices.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = PAPER; ctx.fillRect(0, 0, camera.width, camera.height);
      const colors: Record<string, string> = { water: DENIM, path: OAT, floor: OAT, wall: BERRY, bridge: MUSTARD, field: MUSTARD };
      for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
        ctx.fillStyle = colors[map.tiles[y * map.width + x]!] ?? MOSS;
        ctx.fillRect(view.ox + x * zoom, view.oy + y * zoom, zoom + .2, zoom + .2);
      }
      if (!options.arriving) drawPlayer(cur, CLOSE_ZOOM, zoom / CLOSE_ZOOM, now, true);
      return;
    }
    if (!ready) return;
    const layer = layerFor(zoom);
    for (const cached of layers) if (!cached.roomsPending && cached.rooms.some(room => room.occupied !== occupied.has(room.building.id) || room.glow !== (occupied.has(room.building.id) ? glowStep(light.windows) : 0))) {
      cached.roomsPending = true;
      idle.add((function* () {
        try { yield* refreshRooms(cached, () => ({ glow: light.windows, occupied }), LAYER_MARGIN); }
        finally { cached.roomsPending = false; }
      })());
    }
    interpolate(previous, cur, options.alpha);
    lastCurrent = cur;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = stretch === 1 ? 'low' : 'medium';
    const mapRight = view.ox + map.width * zoom;
    const mapBottom = view.oy + map.height * zoom;
    if (view.ox > 0.5 || view.oy > 0.5 || mapRight < camera.width - 0.5 || mapBottom < camera.height - 0.5) drawTable(camera);
    if (layer.board && zoom < CLOSE_ZOOM) {
      ctx.drawImage(layer.board, view.ox - BOARD_PAD * stretch, view.oy - BOARD_PAD * stretch, (map.width * layer.zoom + BOARD_PAD * 2) * stretch, (map.height * layer.zoom + BOARD_PAD * 2) * stretch);
    }
    drawGround(layer, stretch, camera);
    for (const crop of layer.crops) drawStanding(crop, stretch, camera, cur, undefined, layer.zoom, options.reducedMotion, options.alpha);
    // Contact shadows live on the moving frame, so their direction follows the clock.
    for (const b of buildings) {
      const x = view.ox + (b.x + b.w / 2) * zoom, y = view.oy + (b.y + b.h - .15) * zoom;
      if (x + b.w * zoom / 2 < 0 || x - b.w * zoom / 2 > camera.width || y < -zoom || y > camera.height + zoom) continue;
      drawShadow(lightCtx, x, y, b.w * zoom * .49, zoom * .16, zoom, light);
    }
    for (const s of layer.standing) if (!s.roof) {
      const x = view.ox + (s.x + s.w / 2) * stretch, y = view.oy + s.sortY * zoom;
      if (x < -zoom || x > camera.width + zoom || y < -zoom || y > camera.height + zoom) continue;
      drawShadow(lightCtx, x, y, zoom * .5, zoom * .15, zoom, light);
    }
    for (const post of signposts) {
      const x = view.ox + post.x * zoom, y = view.oy + post.y * zoom;
      if (x < 0 || x > camera.width || y < 0 || y > camera.height) continue;
      drawShadow(lightCtx, x, y, zoom * .25, zoom * .08, zoom, light);
      ctx.fillStyle = mix(OAT, INK, .55); ctx.fillRect(x - zoom * .04, y - zoom * 1.6, zoom * .08, zoom * 1.6);
    }
    drawCurrent(ctx, map, { ...camera, zoom }, view.ox, view.oy, options.reducedMotion ? 0 : now / 1000);
    const groups = conversationGroups(cur, { x: playerX, y: playerY });
    groups.forEach((g, rank) => {
      ctx.save(); ctx.fillStyle = PAPER; ctx.globalAlpha = rank < 3 ? .25 : .125;
      for (const id of g.ids) {
        const i = curIndex.get(id); if (i === undefined) continue;
        ctx.beginPath(); ctx.ellipse(view.ox + fx[i]! * zoom, view.oy + fy[i]! * zoom, zoom * .65, zoom * .28, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    });
    if (options.selected) drawSelection(cur, options.selected);

    // Depth-sorted pass: trees and roofs from the layer, villagers and the stranger.
    const standing = layer.standing;
    let si = 0;
    let vi = 0;
    let playerDone = false;
    for (;;) {
      const sY = si < standing.length ? (standing[si] as Standing).sortY : Infinity;
      const vY = vi < count ? (fy[order[vi] as number] as number) : Infinity;
      const pY = playerDone ? Infinity : playerY;
      if (sY === Infinity && vY === Infinity && pY === Infinity) break;
      if (sY <= vY && sY <= pY) drawStanding(standing[si++] as Standing, stretch, camera, cur, options.selected, layer.zoom, options.reducedMotion, options.alpha);
      else if (vY <= pY) drawVillager(cur, order[vi++] as number, layer.zoom, stretch, now, camera, options.reducedMotion, options.alpha);
      else {
        if (!options.arriving) drawPlayer(cur, layer.zoom, stretch, now, options.reducedMotion);
        playerDone = true;
      }
    }

    drawNight(ctx, map, cur, camera, view, options, occupied); // 22: night wiring, applied last.
    drawOccupiedSmoke(ctx, buildings, occupied, view, camera);
    drawBuildingLight(ctx, buildings, map, occupied, view, light, camera);
    drawDaylight(lightCtx, camera.width, camera.height, { ...light, vignette: zoom >= CLOSE_ZOOM ? .06 : Math.max(.12, light.vignette) });
    drawSigns(camera, !!options.phone);
    if (!options.arriving) {
      const tag = tags.get('you');
      const x = view.ox + playerX * zoom, y = view.oy + playerY * zoom;
      if (tag) ctx.drawImage(tag.img, x - tag.w / 2, y + BODY.top * zoom - tag.h - 3, tag.w, tag.h);
    }
    if (options.spotlight?.length) {
      // Leave the whole scene at 40%, then redraw the people and their paper rings.
      ctx.save(); ctx.globalAlpha = options.spotlightDim ?? .6; ctx.fillStyle = INK;
      ctx.fillRect(0, 0, camera.width, camera.height); ctx.restore();
      for (const id of options.spotlight) {
        if (id === 'stranger') {
          drawPlayer(cur, layer.zoom, stretch, now, true);
          const x = view.ox + playerX * zoom, y = view.oy + playerY * zoom;
          ctx.strokeStyle = PAPER; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y, zoom * .6, zoom * .28, 0, 0, Math.PI * 2); ctx.stroke();
        } else {
          drawSelection(cur, id);
          const i = curIndex.get(id); if (i !== undefined) drawVillager(cur, i, layer.zoom, stretch, now, camera, true);
        }
      }
    }
    if (ready) options.onReady?.();
    threads.track(cur.threads, now);
    if (options.threads && cur.threads.length) threads.draw(ctx, cur.threads, resolveEnd, zoom, options.reducedMotion, now);
    drawGrain(camera);
  }

  function villagerAt(px: number, py: number, snapshot: WorldSnapshot, camera: Camera): VillagerId | null {
    const v = computeView(map, camera, hitView);
    const rendered = snapshot === lastCurrent && snapshot.villagers.length === count;
    let best: VillagerId | null = null;
    let bestDepth = -Infinity;
    let near: VillagerId | null = null;
    let nearDist = Infinity;
    const vs = snapshot.villagers;
    // Reverse the actual draw permutation, including equal-depth ties retained by the sort.
    for (let j = vs.length - 1; j >= 0; j--) {
      const i = rendered ? order[j] as number : j;
      const vil = vs[i] as (typeof vs)[number];
      const x = rendered ? (fx[i] as number) : vil.pos.x;
      const y = rendered ? (fy[i] as number) : vil.pos.y;
      const sc = (vil.tier === 'core' ? CORE_SCALE : 1) * v.zoom;
      const sx = v.ox + x * v.zoom;
      const sy = v.oy + y * v.zoom;
      if (px >= sx + BODY.left * sc && px <= sx + BODY.right * sc && py >= sy + BODY.top * sc && py <= sy + BODY.bottom * sc) {
        if (rendered) return vil.id;
        // Before the first frame, use depth with later snapshot entries winning ties.
        if (y > bestDepth) {
          bestDepth = y;
          best = vil.id;
        }
        continue;
      }
      // Fingers are wider than small sprites: accept a 44 px target around each body.
      const cx = sx;
      const cy = sy + ((BODY.top + BODY.bottom) / 2) * sc;
      const halfW = Math.max(((BODY.right - BODY.left) * sc) / 2, 22);
      const halfH = Math.max(((BODY.bottom - BODY.top) * sc) / 2, 22);
      if (Math.abs(px - cx) <= halfW && Math.abs(py - cy) <= halfH) {
        const d = Math.hypot(px - cx, py - cy);
        if (d < nearDist) {
          nearDist = d;
          near = vil.id;
        }
      }
    }
    return best ?? near;
  }

  // Queue map layers between frames; only the small stranger wardrobe is prepared immediately.
  setSize(canvas.clientWidth || canvas.width / dpr, canvas.clientHeight || canvas.height / dpr, dpr);

  return {
    resize(width: number, height: number, ratio: number): void {
      setSize(width, height, ratio);
      sized = true;
    },
    render,
    project(pos: Vec2, camera: Camera): { x: number; y: number } {
      return projectWith(map, pos, camera);
    },
    unproject(px: number, py: number, camera: Camera): Vec2 {
      return unprojectWith(map, px, py, camera);
    },
    villagerAt,
  };
}
