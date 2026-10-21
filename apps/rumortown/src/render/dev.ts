/**
 * Visual test page for the renderer (not part of the app). Mounts the renderer on
 * createFakeSimulation() by default, or on the real village map with a small wandering crowd.
 *
 * URL options: map=fake|real, zoom=close|far, threads=0|1, reduced=0|1, select=<id>,
 * ticks=<n> to run ahead, paused=1, speed=1|2|8, at=x,y to put the stranger somewhere, note=0,
 * px=<n> to magnify the close zoom, centre=x,y to point the camera somewhere fixed,
 * lineup=s|n|e|w|mixed to stand everyone in a grid (origin=x,y) for checking looks,
 * dpr=<n> to force the backing-store density.
 */
import { createFakeMap, createFakeSimulation } from '../sim/fake.js';
import { DAY_START_MINUTE, MINUTES_PER_DAY, type Camera, type Renderer, type ThreadLink, type Vec2, type VillageMap, type VillagerView, type WorldSnapshot } from '../sim/types.js';
import { CLOSE_ZOOM, createRenderer, fitZoom } from './index.js';
import { cast } from '../content/cast/index.js';
import { seeded } from './grain.js';

interface Driver {
  step(): void;
  snapshot(): WorldSnapshot;
  movePlayer(target: Vec2): void;
  whisper(listener: string, claimId: string): boolean;
}

const params = new URLSearchParams(location.search);
const flag = (name: string, fallback: boolean) => (params.has(name) ? params.get(name) !== '0' : fallback);

/** A light crowd that walks any VillageMap with breadth-first paths, for maps the fake sim cannot walk. */
function wanderDriver(map: VillageMap, seed: number, start: Vec2): Driver {
  const rnd = seeded(seed * 7 + 3);
  const W = map.width;
  const H = map.height;
  const ok = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    const t = map.tiles[y * W + x];
    return t === 'grass' || t === 'path' || t === 'bridge' || t === 'floor' || t === 'door' || t === 'field';
  };
  const prev = new Int32Array(W * H);
  const queue = new Int32Array(W * H);
  const bfs = (from: Vec2, to: Vec2): Vec2[] | null => {
    prev.fill(-1);
    const s = from.y * W + from.x;
    const g = to.y * W + to.x;
    let head = 0;
    let tail = 0;
    queue[tail++] = s;
    prev[s] = s;
    while (head < tail) {
      const c = queue[head++] as number;
      if (c === g) break;
      const x = c % W;
      const y = (c - x) / W;
      const next: [number, number][] = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
      for (const [nx, ny] of next) {
        if (!ok(nx, ny)) continue;
        const n = ny * W + nx;
        if (prev[n] !== -1) continue;
        prev[n] = c;
        queue[tail++] = n;
      }
    }
    if (prev[g] === -1) return null;
    const path: Vec2[] = [];
    for (let c = g; c !== s; c = prev[c] as number) path.push({ x: c % W, y: Math.floor(c / W) });
    return path.reverse();
  };
  const spots = map.places.flatMap((p) => p.spots).filter((p) => ok(p.x, p.y));
  const randomTile = (): Vec2 => {
    for (;;) {
      const p = { x: Math.floor(rnd() * W), y: Math.floor(rnd() * H) };
      if (ok(p.x, p.y)) return p;
    }
  };
  const target = (): Vec2 => (spots.length && rnd() < 0.75 ? (spots[Math.floor(rnd() * spots.length)] as Vec2) : randomTile());

  interface Walker {
    view: VillagerView;
    tile: Vec2;
    path: Vec2[];
    wait: number;
  }
  const walkers: Walker[] = cast.map((d) => {
    const t = target();
    return {
      view: { id: d.id, name: d.name, tier: d.tier, pos: { x: t.x + 0.5, y: t.y + 0.5 }, facing: 's', moving: false, activity: 'idle', look: d.look, mood: rnd() * 2 - 1 },
      tile: { ...t },
      path: [],
      wait: Math.floor(rnd() * 25),
    };
  });
  const player: Walker = {
    view: { id: 'stranger', name: 'Stranger', tier: 'core', pos: { x: start.x + 0.5, y: start.y + 0.5 }, facing: 's', moving: false, activity: 'idle', look: (walkers[0] as Walker).view.look, mood: 0 },
    tile: { ...start },
    path: [],
    wait: 0,
  };
  const threads: ThreadLink[] = [];
  let tick = 0;

  const advance = (w: Walker, speed: number) => {
    const next = w.path[0];
    if (!next) {
      w.view.moving = false;
      return;
    }
    const dx = next.x + 0.5 - w.view.pos.x;
    const dy = next.y + 0.5 - w.view.pos.y;
    const d = Math.hypot(dx, dy);
    if (d <= speed) {
      w.view.pos.x = next.x + 0.5;
      w.view.pos.y = next.y + 0.5;
      w.tile = { ...next };
      w.path.shift();
    } else {
      w.view.pos.x += (dx / d) * speed;
      w.view.pos.y += (dy / d) * speed;
    }
    w.view.moving = true;
    w.view.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'e' : 'w') : dy > 0 ? 's' : 'n';
  };

  return {
    step() {
      tick++;
      for (const w of walkers) {
        if (!w.path.length) {
          w.view.moving = false;
          if (w.wait > 0) w.wait--;
          else {
            w.path = bfs(w.tile, target()) ?? [];
            w.wait = 8 + Math.floor(rnd() * 40);
          }
        }
        advance(w, 0.55);
        if (rnd() < 0.004) w.view.mood = rnd() * 2 - 1;
      }
      advance(player, 0.9);
      if (rnd() < 0.08) {
        const a = walkers[Math.floor(rnd() * walkers.length)] as Walker;
        let best: Walker | null = null;
        let bestD = 3;
        for (const b of walkers) {
          if (b === a) continue;
          const d = Math.hypot(b.view.pos.x - a.view.pos.x, b.view.pos.y - a.view.pos.y);
          if (d < bestD) {
            bestD = d;
            best = b;
          }
        }
        if (best) threads.push({ from: a.view.id, to: best.view.id, claimId: 'stole', tick });
      }
    },
    snapshot(): WorldSnapshot {
      return {
        tick,
        dayIndex: Math.floor(tick / MINUTES_PER_DAY),
        minuteOfDay: DAY_START_MINUTE + (tick % MINUTES_PER_DAY),
        villagers: walkers.map((w) => ({ ...w.view, pos: { ...w.view.pos } })),
        player: { pos: { ...player.view.pos }, facing: player.view.facing, moving: player.view.moving },
        threads: threads.slice(-40),
      };
    },
    movePlayer(t: Vec2) {
      const goal = { x: Math.floor(t.x), y: Math.floor(t.y) };
      if (ok(goal.x, goal.y)) player.path = bfs(player.tile, goal) ?? [];
    },
    whisper(listener: string, claimId: string) {
      const w = walkers.find((x) => x.view.id === listener);
      if (!w) return false;
      threads.push({ from: 'stranger', to: listener, claimId, tick });
      return true;
    },
  };
}

async function loadMap(name: string): Promise<{ map: VillageMap; driver: Driver }> {
  const seed = Number(params.get('seed') ?? 1) || 1;
  const at = params.get('at')?.split(',').map(Number);
  if (name === 'real') {
    try {
      const mod = await import('../content/map/index.js');
      const map = mod.villageMap;
      const start = at && at.length === 2 ? { x: at[0] as number, y: at[1] as number } : { x: 21, y: 16 };
      return { map, driver: wanderDriver(map, seed, start) };
    } catch (err) {
      console.warn('The real map is not available yet; showing the fake map.', err);
    }
  }
  const sim = createFakeSimulation(seed);
  if (at && at.length === 2) {
    sim.movePlayer({ x: at[0] as number, y: at[1] as number });
    for (let i = 0; i < 60; i++) sim.step();
  }
  return { map: createFakeMap(), driver: sim };
}

const canvas = document.getElementById('board') as HTMLCanvasElement;
const statsEl = document.getElementById('stats') as HTMLParagraphElement;
const note = document.getElementById('note') as HTMLDivElement;
if (!flag('note', true)) note.hidden = true;

/** dpr=<n> forces the backing-store density, to measure retina cost on any screen. */
const ratio = () => Number(params.get('dpr')) || window.devicePixelRatio || 1;
/** px=<n> magnifies the close zoom for inspecting sprites; the close renderer uses 40. */
const closeZoom = Number(params.get('px') ?? CLOSE_ZOOM) || CLOSE_ZOOM;
let centre = params.get('centre')?.split(',').map(Number);

const state = {
  mapName: params.get('map') === 'real' ? 'real' : 'fake',
  far: params.get('zoom') === 'far',
  threads: flag('threads', true),
  reduced: flag('reduced', false),
  paused: flag('paused', false),
  speed: Number(params.get('speed') ?? 1) || 1,
  selected: params.get('select') ?? undefined,
};

let map: VillageMap;
let driver: Driver;
let renderer: Renderer;
let previous: WorldSnapshot | null = null;
let current: WorldSnapshot;
let accumulator = 0;
let last = performance.now();
const samples = new Float64Array(240);
let sampleCount = 0;
let frames = 0;

function camera(): Camera {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const a = state.paused ? 1 : Math.min(1, accumulator * (2.5 * state.speed));
  const p = current.player.pos;
  const q = previous?.player.pos ?? p;
  const follow = centre && centre.length === 2 ? { x: centre[0] as number, y: centre[1] as number } : { x: q.x + (p.x - q.x) * a, y: q.y + (p.y - q.y) * a - 0.5 };
  const center = state.far ? { x: map.width / 2, y: map.height / 2 } : follow;
  return { center, zoom: state.far ? fitZoom(map, w, h) : closeZoom, width: w, height: h };
}

async function mount(name: string): Promise<void> {
  const loaded = await loadMap(name);
  map = loaded.map;
  driver = loaded.driver;
  renderer = createRenderer(canvas, map);
  renderer.resize(window.innerWidth, window.innerHeight, ratio());
  const ahead = Number(params.get('ticks') ?? 0) || 0;
  for (let i = 0; i < ahead; i++) driver.step();
  previous = null;
  current = driver.snapshot();
  const lineup = params.get('lineup');
  if (lineup) {
    // Every villager in a grid, all facing one way, for checking looks: lineup=s|n|e|w|mixed.
    const [ox, oy] = (params.get('origin') ?? '17.5,14.2').split(',').map(Number) as [number, number];
    const facings = ['s', 'e', 'n', 'w'] as const;
    current = {
      ...current,
      threads: [],
      villagers: current.villagers.map((v, i) => ({
        ...v,
        pos: { x: ox + (i % 8) * 1.3, y: oy + Math.floor(i / 8) * 1.55 },
        facing: lineup === 'mixed' ? facings[i % 4] ?? 's' : (lineup as 's' | 'n' | 'e' | 'w'),
        moving: false,
        mood: i % 3 === 0 ? 0.8 : i % 3 === 1 ? 0 : -0.8,
      })),
    };
  }
}

function frame(now: number): void {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  const stepEvery = 1 / (2.5 * state.speed);
  if (!state.paused) {
    accumulator += dt;
    while (accumulator >= stepEvery) {
      accumulator -= stepEvery;
      driver.step();
      previous = current;
      current = driver.snapshot();
    }
  }
  const alpha = state.paused ? 1 : accumulator / stepEvery;
  const t0 = performance.now();
  renderer.render(previous, current, camera(), { threads: state.threads, selected: state.selected, alpha, reducedMotion: state.reduced });
  const spent = performance.now() - t0;
  samples[frames % samples.length] = spent;
  frames++;
  sampleCount = Math.min(samples.length, sampleCount + 1);
  if (frames % 30 === 0) {
    const sorted = Array.from(samples.subarray(0, sampleCount)).sort((a, b) => a - b);
    const avg = sorted.reduce((s, v) => s + v, 0) / sorted.length;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? avg;
    const max = sorted[sorted.length - 1] ?? avg;
    const stats = { avg, p95, max, villagers: current.villagers.length, zoom: state.far ? 'far' : 'close', map: state.mapName, frames };
    (window as unknown as { __renderStats: typeof stats }).__renderStats = stats;
    statsEl.textContent = `Frame ${avg.toFixed(2)} ms on average, ${p95.toFixed(2)} ms at the 95th percentile, ${max.toFixed(1)} ms at worst, with ${stats.villagers} villagers at the ${stats.zoom} zoom`;
  }
  requestAnimationFrame(frame);
}

function nearestVillager(): string | null {
  const p = current.player.pos;
  let best: string | null = null;
  let bestD = Infinity;
  for (const v of current.villagers) {
    const d = Math.hypot(v.pos.x - p.x, v.pos.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = v.id;
    }
  }
  return best;
}

window.addEventListener('resize', () => renderer.resize(window.innerWidth, window.innerHeight, ratio()));
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'z') state.far = !state.far;
  else if (k === 't') state.threads = !state.threads;
  else if (k === 'r') state.reduced = !state.reduced;
  else if (k === 'h') note.hidden = !note.hidden;
  else if (k === ' ') state.paused = !state.paused;
  else if (k === '1' || k === '2' || k === '8') state.speed = Number(k);
  else if (k === 'w') {
    const id = nearestVillager();
    if (id) driver.whisper(id, 'stole');
  } else if (k === 'm') {
    state.mapName = state.mapName === 'fake' ? 'real' : 'fake';
    void mount(state.mapName);
  } else return;
  e.preventDefault();
});
canvas.addEventListener('pointerdown', (e) => {
  const cam = camera();
  const hit = renderer.villagerAt(e.clientX, e.clientY, current, cam);
  if (hit) state.selected = state.selected === hit ? undefined : hit;
  else driver.movePlayer(renderer.unproject(e.clientX, e.clientY, cam));
});

const devApi = {
  snapshot() {
    return current;
  },
  get stats() {
    return (window as unknown as { __renderStats?: unknown }).__renderStats;
  },
  set(opts: Partial<typeof state>) {
    Object.assign(state, opts);
  },
  look(x: number, y: number) {
    centre = [x, y];
  },
  whisper(id?: string) {
    const who = id ?? nearestVillager();
    const ok = who ? driver.whisper(who, 'stole') : false;
    if (ok) current = driver.snapshot();
    return ok;
  },
  /**
   * Renders `n` frames, then reads one pixel back so every queued raster command finishes, and
   * returns the average per frame including that GPU work.
   */
  benchFlushed(n = 300, reduced = state.reduced) {
    const ctx = canvas.getContext('2d');
    ctx?.getImageData(0, 0, 1, 1);
    const t0 = performance.now();
    for (let i = 0; i < n; i++) renderer.render(previous, current, camera(), { threads: state.threads, selected: state.selected, alpha: (i % 10) / 10, reducedMotion: reduced });
    ctx?.getImageData(0, 0, 1, 1);
    return (performance.now() - t0) / n;
  },
  /** Freeze any clock light without advancing the driver or touching simulation state. */
  minute(value: number) {
    current = { ...current, minuteOfDay: Math.max(420, Math.min(1320, value)) };
    previous = current;
  },
  /** Hit-tests every villager at its body centre; returns the misses and what empty ground gives. */
  hitCheck() {
    const cam = camera();
    const misses: string[] = [];
    let hits = 0;
    for (const v of current.villagers) {
      const s = renderer.project({ x: v.pos.x, y: v.pos.y - 0.5 * (v.tier === 'core' ? 1.1 : 1) }, cam);
      if (s.x < 0 || s.y < 0 || s.x > cam.width || s.y > cam.height) continue;
      const got = renderer.villagerAt(s.x, s.y, current, cam);
      if (got === v.id) hits++;
      else misses.push(`${v.id} got ${got}`);
    }
    const corner = renderer.unproject(2, 2, cam);
    return { hits, misses, emptyGround: renderer.villagerAt(-500, -500, current, cam), corner };
  },
  /** Times painting a ground layer from scratch at the current zoom (a fresh renderer). */
  layerCost() {
    const fresh = createRenderer(document.createElement('canvas'), map);
    fresh.resize(window.innerWidth, window.innerHeight, ratio());
    const t0 = performance.now();
    fresh.render(null, current, camera(), { threads: false, alpha: 1, reducedMotion: true });
    return performance.now() - t0;
  },
  /** Renders `n` frames back to back and returns the timings, for a quick benchmark. */
  bench(n = 300, reduced = state.reduced) {
    const times: number[] = [];
    for (let i = 0; i < n; i++) {
      const t0 = performance.now();
      renderer.render(previous, current, camera(), { threads: state.threads, selected: state.selected, alpha: (i % 10) / 10, reducedMotion: reduced });
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    return { avg: times.reduce((s, v) => s + v, 0) / n, p50: times[Math.floor(n / 2)], p95: times[Math.floor(n * 0.95)], max: times[n - 1] };
  },
};
(window as unknown as { __dev: typeof devApi }).__dev = devApi;

void mount(state.mapName).then(() => requestAnimationFrame(frame));
