/**
 * The shell: a full-bleed village canvas with paper tags and pins on top, driven by a fixed-step loop.
 * The simulation steps at 2.5 game-minutes a second at 1× (5 at 2×, 20 at 8×, none when paused); the
 * renderer draws every animation frame, blending the previous and current snapshots.
 */
import type { ClaimId } from 'rumormind';
import { readRegisteredClaim } from '../sim/registered-claim.js';
import {
  DAY_START_MINUTE,
  MINUTES_PER_DAY,
  type Intervention,
  type Renderer,
  type ShareState,
  type SimEvent,
  type Simulation,
  type TileKind,
  type Vec2,
  type VillageMap,
  type VillagerId,
  type WorldSnapshot,
} from '../sim/types.js';
import { createBubbles } from './bubbles.js';
import { createCameraRig } from './camera.js';
import { createDayEnd } from './day-end.js';
import { evaluateDare, reflectionParagraphs, runReflection } from './debrief.js';
import { clamp, h, svg } from './dom.js';
import { clockText, tickLabel } from './format.js';
import { dialArt, postboxArt } from './icons.js';
import { createLayers } from './layers.js';
import { advanceTicks } from './loop.js';
import { createShare } from './share.js';
import { readShareFromLocation, writeShareToLocation } from './share-link.js';
import { createStory } from './story.js';
import { createStubRenderer } from './stub-renderer.js';
import { createTag } from './tag.js';
import { createTimeControls, type Speed } from './timebar.js';
import { createWhisperSheet, inReach } from './whisper.js';

export interface AppDeps {
  /** Builds a fresh run. The timeline calls this again with the same seed and whispers to rewind. */
  createSim: (seed: number, interventions: Intervention[]) => Simulation;
  createRenderer: (canvas: HTMLCanvasElement, map: VillageMap) => Renderer;
  map: VillageMap;
  /** Written into share links; a link made for another cast version starts fresh. Default 'v1'. */
  castVersion?: string;
  /** Where a fresh run opens, in ticks. Default 130 (09:10), so the village is already mid-morning. */
  startTick?: number;
  /** Length of the timeline ribbon in days. Default 3. */
  runDays?: number;
  /** Typed whispers are available only when both deployment settings exist. */
  whisperClient?: { baseUrl: string; siteKey: string };
}

export interface AppHandle {
  readonly sim: Simulation;
  /** Where a villager (or 'stranger') stands on screen right now, in CSS pixels. For tests and tooling. */
  locate(id: VillagerId | 'stranger'): { x: number; y: number } | null;
  destroy(): void;
}

type DayEndEvent = Extract<SimEvent, { kind: 'day-end' }>;

const RATE: Record<Speed, number> = { 0: 0, 1: 2.5, 2: 5, 8: 20 };
const MAX_STEPS_PER_FRAME = 8;
const WALKABLE: ReadonlySet<TileKind> = new Set<TileKind>(['grass', 'path', 'bridge', 'floor', 'door', 'field']);
const KEY_DIRS: Record<string, Vec2> = {
  ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 }, ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 },
  w: { x: 0, y: -1 }, s: { x: 0, y: 1 }, a: { x: -1, y: 0 }, d: { x: 1, y: 0 },
  W: { x: 0, y: -1 }, S: { x: 0, y: 1 }, A: { x: -1, y: 0 }, D: { x: 1, y: 0 },
};

const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const tileOf = (p: Vec2): Vec2 => ({ x: Math.floor(p.x), y: Math.floor(p.y) });
const sleep = (ms: number): Promise<void> => new Promise((r) => window.setTimeout(r, ms));

function randomSeed(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] ?? 1;
}

export function mountApp(root: HTMLElement, deps: AppDeps): AppHandle {
  const map = deps.map;
  const castVersion = deps.castVersion ?? 'v1';
  const runTicks = Math.max(1, deps.runDays ?? 3) * MINUTES_PER_DAY;
  const phoneQuery = window.matchMedia('(max-width: 759px), (max-height: 500px)');
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let phone = phoneQuery.matches;
  const isPhone = (): boolean => phone;
  const reducedMotion = (): boolean => motionQuery.matches;

  /* ---------------- The run: seed and whispers, from the link if there is one ---------------- */

  const link = readShareFromLocation();
  let seed: number;
  let interventions: Intervention[] = [];
  let arrivalNote: string | null = null;
  if (link.state && link.state.cast === castVersion) {
    seed = link.state.seed;
    interventions = link.state.interventions.slice();
  } else if (link.state) {
    seed = link.state.seed;
    arrivalNote = 'That link was made for an older village, so its whispers are left out.';
  } else {
    seed = randomSeed();
    if (link.present) arrivalNote = 'That link could not be read, so this is a fresh village.';
  }

  let sim: Simulation;
  try {
    sim = deps.createSim(seed, interventions.slice());
  } catch {
    interventions = [];
    sim = deps.createSim(seed, []);
  }
  const valid = interventions.filter((i) => sim.cast.has(i.listener) &&
    (sim.claims.has(i.claimId) || readRegisteredClaim(i.claimId, sim.cast) !== null));
  if (valid.length !== interventions.length) {
    interventions = valid;
    sim = deps.createSim(seed, interventions.slice());
    arrivalNote = 'Some whispers in that link did not fit this village, so they were left out.';
  }
  if (interventions.length > 0 && !arrivalNote) {
    arrivalNote = interventions.length === 1
      ? 'You are watching a replay. The whisper happens again at the same moment.'
      : `You are watching a replay. All ${interventions.length} whispers happen again at the same moments.`;
  }
  const reflection = runReflection(seed);
  const startTick = Math.min(runTicks, Math.max(0, deps.startTick ?? 130));
  while (sim.tick < startTick) sim.step();

  const shareState = (): ShareState => ({ v: 1, seed, cast: castVersion, interventions: interventions.slice() });
  let written = writeShareToLocation(shareState());

  /* ---------------- DOM ---------------- */

  root.replaceChildren();
  root.classList.add('rt');
  const layers = createLayers();

  const canvas = h('canvas', {
    class: 'rt-world',
    tabindex: '0',
    role: 'application',
    'aria-label': 'The village. Arrow keys or W, A, S and D walk you one tile at a time. Enter opens the tag of the nearest villager. Space pauses.',
  });
  const focusFrame = h('div', { class: 'rt-focus-frame', 'aria-hidden': 'true' });
  const stringPath = svg('path', { class: 'tag-string', d: '' });
  const strings = svg('svg', { class: 'rt-strings', 'aria-hidden': 'true', focusable: 'false' }, stringPath);
  const bubbleLayer = h('div', { class: 'rt-bubbles', 'aria-hidden': 'true' });
  const marker = h('div', { class: 'rt-marker', 'aria-hidden': 'true', hidden: true });
  const live = h('div', { class: 'sr-only', 'aria-live': 'polite' });

  const dial = dialArt();
  const timeText = h('span', { class: 'clock-time' });
  const dayText = h('span', { class: 'clock-day' });
  const clock = h('div', { class: 'clock', role: 'group', 'aria-label': 'Clock' }, dial.root, h('span', { class: 'clock-text' }, timeText, dayText));
  const threadsBtn = h('button', { class: 'pin', 'data-pin': 'threads', type: 'button', 'aria-pressed': 'false' }, 'Who told whom');
  const storyBtn = h('button', { class: 'pin', 'data-pin': 'story', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'rt-story' }, 'Story so far');
  const shareBtn = h('button', { class: 'pin', 'data-pin': 'share', type: 'button', 'aria-haspopup': 'dialog' }, 'Pin to the board');
  const pins = h('nav', { class: 'pins', 'aria-label': 'Board' }, threadsBtn, storyBtn, shareBtn);
  const threadsNote = h('p', { class: 'threads-note', hidden: true }, 'Each red thread is one telling.');
  const dareNote = h('details', { class: 'dare-note', open: true },
    h('summary', null, 'Your dare'), h('p', null, reflection.dare.text));
  const top = h('header', { class: 'rt-top' }, clock, pins, threadsNote, dareNote);

  const postbox = h('button', { class: 'postbox', type: 'button', 'aria-haspopup': 'dialog' }, postboxArt(), h('span', { class: 'postbox-label' }, 'Whisper'));
  const prompt = h('p', { class: 'prompt', hidden: interventions.length > 0 }, 'Whisper something to someone.');

  const toast = h('p', { class: 'toast', role: 'status', hidden: true });
  const rewindText = h('span', { class: 'rewind-text' });
  const rewindThread = h('span', { class: 'rewind-thread' });
  const rewind = h('div', { class: 'rewind', role: 'status', hidden: true }, rewindText, h('span', { class: 'rewind-track', 'aria-hidden': 'true' }, rewindThread));
  const scrim = h('div', { class: 'scrim', hidden: true });

  /* ---------------- State ---------------- */

  let prev: WorldSnapshot | null = null;
  let cur: WorldSnapshot = sim.snapshot();
  let speed: Speed = 1;
  let lastPlaying: Exclude<Speed, 0> = 1;
  const holds = new Set<string>();
  let acc = 0;
  let maxTick = sim.tick;
  let threadsOn = false;
  let scrubFar = false;
  let rewinding = false;
  let rewindToken = 0;
  let cursor = { tick: 0, seen: 0 };
  let follow: { id: VillagerId; whisper: boolean } | null = null;
  let keyTarget: { tile: Vec2; at: number } | null = null;
  let markerAt: { pos: Vec2; until: number } | null = null;
  let insets = { top: 64, bottom: 96 };
  let lastPausedNote = 0;
  let lastMinute = -1;
  let lastTimeKey = '';
  const positions = new Map<VillagerId, Vec2>();

  const effectiveRate = (): number => (holds.size > 0 || rewinding ? 0 : RATE[speed]);
  const hold = (reason: string): void => {
    holds.add(reason);
  };
  const release = (reason: string): void => {
    holds.delete(reason);
  };

  /* ---------------- Renderer, with the plain one as a fallback ---------------- */

  let usingStub = false;
  let renderer: Renderer;
  try {
    renderer = deps.createRenderer(canvas, map);
  } catch (err) {
    console.warn('The village renderer could not start; using the plain one.', err);
    renderer = createStubRenderer(canvas, map);
    usingStub = true;
  }
  let renderFailures = 0;

  /* ---------------- Panels ---------------- */

  const say = (() => {
    let timer = 0;
    return (text: string, ms = 2800): void => {
      toast.textContent = text;
      toast.hidden = false;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        toast.hidden = true;
      }, ms);
    };
  })();

  /** A note is about the moment it was said; anything opening over the village retires it. */
  const hideToast = (): void => {
    toast.hidden = true;
  };

  const notePaused = (): void => {
    const now = performance.now();
    if (now - lastPausedNote < 4000) return;
    lastPausedNote = now;
    say(speed === 0 ? 'Time is paused. Pick a speed to walk.' : 'Time is held for a moment.');
  };

  const tag = createTag({
    sim: () => sim,
    snapshot: () => cur,
    isPhone,
    reducedMotion,
    layers,
    onClosed: () => undefined,
    onSelect: (id) => openTag(id, true),
  });

  const closeSheetsForPhone = (except: string): void => {
    if (!phone) return;
    if (except !== 'tag') tag.close();
    if (except !== 'whisper') whisper.close();
    if (except !== 'story') story.close();
    if (except !== 'time') time.closeDrawer();
  };

  const whisper = createWhisperSheet({
    client: deps.whisperClient ? { ...deps.whisperClient, castVersion } : undefined,
    sim: () => sim,
    snapshot: () => cur,
    isPhone,
    reducedMotion,
    layers,
    whisper: (listener, claimId) => doWhisper(listener, claimId),
    walkTo: (id) => walkToVillager(id),
    onOpenChange: (open) => {
      if (open) {
        hold('whisper');
        hideToast();
      } else release('whisper');
      syncScrim();
    },
  });

  const story = createStory({
    sim: () => sim,
    layers,
    reducedMotion,
    isPhone,
    onSelect: (id) => openTag(id, true),
    onOpenChange: (open) => {
      storyBtn.setAttribute('aria-expanded', String(open));
      if (open) hideToast();
    },
  });
  story.el.id = 'rt-story';

  const time = createTimeControls({
    layers,
    reducedMotion,
    nameOf: (id) => sim.cast.get(id)?.name ?? id,
    onSpeed: (s) => setSpeed(s),
    onScrubStart: () => {
      scrubFar = true;
      hold('scrub');
    },
    onScrubPreview: () => undefined,
    onScrub: (t) => void seek(t),
    onScrubEnd: () => {
      scrubFar = false;
      release('scrub');
    },
    onDrawerChange: (open) => {
      if (open) hideToast();
    },
  });

  const share = createShare({
    sim: () => sim,
    snapshot: () => cur,
    map,
    layers,
    reducedMotion,
    shareState,
    interventions: () => interventions,
    onOpenChange: (open) => {
      if (open) {
        hold('share');
        hideToast();
      } else release('share');
      syncScrim();
    },
  });

  const dayEnd = createDayEnd({
    layers,
    reducedMotion,
    onContinue: () => {
      release('dayend');
      if (sim.tick >= runTicks) setSpeed(0);
      syncScrim();
    },
    onShare: (opener) => share.open(opener),
  });

  const bottom = h('div', { class: 'rt-bottom' }, postbox, prompt, time.bar, time.tab);
  root.append(canvas, focusFrame, strings, bubbleLayer, marker, top, bottom, tag.el, story.el, time.drawer, whisper.el, scrim, dayEnd.el, share.el, rewind, toast, live);
  const bubbles = createBubbles(bubbleLayer, live);

  function syncScrim(): void {
    scrim.hidden = !(whisper.isOpen() || share.isOpen() || dayEnd.isOpen());
    scrim.dataset.strong = dayEnd.isOpen() || share.isOpen() ? 'true' : 'false';
  }
  scrim.addEventListener('click', () => {
    if (share.isOpen()) share.close();
    else if (whisper.isOpen()) whisper.close();
  });

  /* ---------------- Actions ---------------- */

  function setSpeed(s: Speed): void {
    speed = s;
    if (s !== 0) lastPlaying = s;
  }

  function openTag(id: VillagerId, focus: boolean, opener?: Element | null): void {
    closeSheetsForPhone('tag');
    if (phone) hideToast();
    tag.open(id, { focus, opener: opener ?? document.activeElement });
  }

  function walkable(t: Vec2): boolean {
    if (t.x < 0 || t.y < 0 || t.x >= map.width || t.y >= map.height) return false;
    const k = map.tiles[t.y * map.width + t.x];
    return k !== undefined && WALKABLE.has(k);
  }

  function nearestWalkable(t: Vec2): Vec2 | null {
    if (walkable(t)) return t;
    for (let r = 1; r <= 3; r++) {
      let best: Vec2 | null = null;
      let bestD = Infinity;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const c = { x: t.x + dx, y: t.y + dy };
          const d = dx * dx + dy * dy;
          if (walkable(c) && d < bestD) {
            best = c;
            bestD = d;
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  function walkTo(point: Vec2): void {
    if (rewinding) return;
    const tile = nearestWalkable(tileOf(point));
    if (!tile) return;
    follow = null;
    keyTarget = null;
    sim.movePlayer(tile);
    markerAt = { pos: { x: tile.x + 0.5, y: tile.y + 0.5 }, until: performance.now() + 1400 };
    if (effectiveRate() === 0) notePaused();
  }

  function walkToVillager(id: VillagerId): void {
    const v = cur.villagers.find((x) => x.id === id);
    if (!v || rewinding) return;
    follow = { id, whisper: true };
    keyTarget = null;
    sim.movePlayer(tileOf(v.pos));
    if (effectiveRate() === 0) notePaused();
    else say(`Walking to ${v.name}.`, 1800);
  }

  function followStep(): void {
    if (!follow) return;
    const v = cur.villagers.find((x) => x.id === follow?.id);
    if (!v) {
      follow = null;
      return;
    }
    const p = cur.player.pos;
    if (Math.hypot(v.pos.x - p.x, v.pos.y - p.y) <= 1.5) {
      const done = follow;
      follow = null;
      sim.movePlayer(tileOf(p));
      if (done.whisper && !whisper.isOpen() && !layers.anyModal()) {
        closeSheetsForPhone('whisper');
        whisper.open({ listener: done.id, opener: postbox });
      }
      return;
    }
    if (sim.tick % 3 === 0) sim.movePlayer(tileOf(v.pos));
  }

  function stepKey(dir: Vec2): void {
    if (rewinding) return;
    const p = cur.player.pos;
    const now = performance.now();
    let base: Vec2 | null = tileOf(p);
    if (keyTarget) {
      const d = Math.hypot(p.x - (keyTarget.tile.x + 0.5), p.y - (keyTarget.tile.y + 0.5));
      const stale = now - keyTarget.at > 1200;
      base = d <= 0.55 ? keyTarget.tile : stale ? tileOf(p) : null;
    }
    if (!base) return;
    const next = { x: base.x + dir.x, y: base.y + dir.y };
    if (!walkable(next)) return;
    keyTarget = { tile: next, at: now };
    follow = null;
    sim.movePlayer(next);
    if (effectiveRate() === 0) notePaused();
  }

  function inspectNearest(): void {
    const p = cur.player.pos;
    let best: VillagerId | null = null;
    let bestD = 6;
    for (const v of cur.villagers) {
      const d = Math.hypot(v.pos.x - p.x, v.pos.y - p.y);
      if (d < bestD) {
        bestD = d;
        best = v.id;
      }
    }
    if (best) openTag(best, true, canvas);
    else say('Nobody is close by. Walk nearer to someone.');
  }

  function doWhisper(listener: VillagerId, claimId: ClaimId): boolean {
    if (rewinding) return false;
    if (!sim.whisper(listener, claimId)) return false;
    interventions.push({ tick: sim.tick, listener, claimId });
    interventions.sort((a, b) => a.tick - b.tick);
    written = writeShareToLocation(shareState());
    cur = sim.snapshot();
    const fresh = consumeEvents();
    if (fresh.length) story.push(fresh);
    bubbles.boost(listener, 5000);
    prompt.hidden = true;
    tag.refresh(true);
    return true;
  }

  /* ---------------- Events ---------------- */

  function consumeEvents(): SimEvent[] {
    const fresh = sim.events(cursor.tick);
    const out: SimEvent[] = [];
    let skip = cursor.seen;
    for (const e of fresh) {
      if (e.tick === cursor.tick && skip > 0) {
        skip -= 1;
        continue;
      }
      out.push(e);
    }
    const last = out[out.length - 1];
    if (last) {
      let n = 0;
      for (const e of fresh) if (e.tick === last.tick) n += 1;
      cursor = { tick: last.tick, seen: n };
    }
    return out;
  }

  function resyncEvents(): SimEvent[] {
    const all = sim.events(0);
    const last = all[all.length - 1];
    if (last) {
      let n = 0;
      for (const e of all) if (e.tick === last.tick) n += 1;
      cursor = { tick: last.tick, seen: n };
    } else {
      cursor = { tick: 0, seen: 0 };
    }
    return all;
  }

  function averageTrust(): number | null {
    let sum = 0;
    let n = 0;
    for (const v of cur.villagers) {
      try {
        sum += sim.inspect(v.id).trustInStranger;
        n += 1;
      } catch {
        /* skip */
      }
    }
    return n ? sum / n : null;
  }

  function showDayEnd(ev: DayEndEvent): void {
    hold('dayend');
    hideToast();
    closeSheetsForPhone('');
    whisper.close();
    const whispered = interventions.some((i) => i.tick <= sim.tick);
    const dareResult = `${reflection.dare.text} ${evaluateDare(sim, reflection.dare, ev)}`;
    dareNote.querySelector('p')!.textContent = dareResult;
    dayEnd.show(ev, whispered ? averageTrust() : null, {
      dare: dareResult,
      paragraphs: ev.dayIndex === 2 ? reflectionParagraphs(sim, ev) : [],
      checks: reflection.checks,
    });
    syncScrim();
  }

  /** One game-minute. Returns true when a day ended, so the loop stops there. */
  function stepOnce(): boolean {
    prev = cur;
    sim.step();
    if (sim.tick === cur.tick) { setSpeed(0); return true; }
    cur = sim.snapshot();
    if (sim.tick > maxTick) maxTick = sim.tick;
    const fresh = consumeEvents();
    if (fresh.length) story.push(fresh);
    followStep();
    tag.refresh();
    const end = fresh.find((e): e is DayEndEvent => e.kind === 'day-end');
    if (end) {
      showDayEnd(end);
      return true;
    }
    return false;
  }

  /** Rebuild the run from the same seed and whispers, then step to the target minute. */
  async function seek(targetTick: number): Promise<void> {
    const token = ++rewindToken;
    const target = Math.round(clamp(targetTick, 0, maxTick));
    if (target === sim.tick && !rewinding) return;
    rewinding = true;
    const back = target < sim.tick;
    rewindText.textContent = `${back ? 'Rewinding to' : 'Skipping ahead to'} ${tickLabel(target).replace(/^Day/, 'day')}`;
    rewindThread.style.transform = 'scaleX(0)';
    rewind.hidden = false;
    const shownAt = performance.now();
    const standAt = tileOf(cur.player.pos);
    let next = sim;
    if (back) {
      next = deps.createSim(seed, interventions.slice());
      next.movePlayer(standAt);
    }
    const from = next.tick;
    const span = Math.max(1, target - from);
    while (next.tick < target) {
      const until = performance.now() + 10;
      while (next.tick < target && performance.now() < until) next.step();
      rewindThread.style.transform = `scaleX(${((next.tick - from) / span).toFixed(3)})`;
      await sleep(0);
      if (token !== rewindToken) return;
    }
    const wait = 500 - (performance.now() - shownAt);
    if (wait > 0) await sleep(wait);
    if (token !== rewindToken) return;
    sim = next;
    cur = sim.snapshot();
    prev = cur;
    acc = 0;
    follow = null;
    keyTarget = null;
    story.reset(resyncEvents());
    bubbles.clear();
    tag.refresh(true);
    rewind.hidden = true;
    rewinding = false;
  }

  /* ---------------- Input ---------------- */

  threadsBtn.addEventListener('click', () => {
    threadsOn = !threadsOn;
    threadsBtn.setAttribute('aria-pressed', String(threadsOn));
    threadsNote.hidden = !threadsOn;
  });
  storyBtn.addEventListener('click', () => {
    if (story.isOpen()) story.close();
    else {
      closeSheetsForPhone('story');
      story.open(storyBtn);
    }
  });
  shareBtn.addEventListener('click', () => {
    closeSheetsForPhone('share');
    share.open(shareBtn);
  });
  postbox.addEventListener('click', () => {
    if (rewinding) return;
    closeSheetsForPhone('whisper');
    whisper.open({ opener: postbox });
  });
  time.tab.addEventListener('click', () => {
    if (time.isDrawerOpen()) closeSheetsForPhone('time');
  });

  let down: { x: number; y: number; id: number } | null = null;
  const canvasPoint = (ev: PointerEvent): { x: number; y: number } => {
    const r = canvas.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  };
  canvas.addEventListener('pointerdown', (ev) => {
    down = { ...canvasPoint(ev), id: ev.pointerId };
  });
  canvas.addEventListener('pointerup', (ev) => {
    if (!down || ev.pointerId !== down.id) return;
    const p = canvasPoint(ev);
    const moved = Math.hypot(p.x - down.x, p.y - down.y);
    down = null;
    if (moved > 14) return;
    const hit = renderer.villagerAt(p.x, p.y, interpolatedSnapshot(), rig.camera);
    if (hit) {
      if (tag.selected() === hit) tag.close();
      else openTag(hit, false, canvas);
      return;
    }
    walkTo(renderer.unproject(p.x, p.y, rig.camera));
  });
  canvas.addEventListener('pointercancel', () => {
    down = null;
  });

  const onKey = (ev: KeyboardEvent): void => {
    if (ev.defaultPrevented || ev.altKey || ev.ctrlKey || ev.metaKey) return;
    const target = ev.target;
    const onWorld = target === canvas || target === document.body || target === root || target === document.documentElement;
    if (!onWorld || layers.anyModal()) return;
    const dir = KEY_DIRS[ev.key];
    if (dir) {
      ev.preventDefault();
      stepKey(dir);
      return;
    }
    if (ev.key === 'Enter') {
      ev.preventDefault();
      inspectNearest();
    } else if (ev.key === ' ') {
      ev.preventDefault();
      setSpeed(speed === 0 ? lastPlaying : 0);
    }
  };
  document.addEventListener('keydown', onKey);

  const onHash = (): void => {
    if (window.location.hash.replace(/^#/, '') !== written) window.location.reload();
  };
  window.addEventListener('hashchange', onHash);

  /* ---------------- Layout ---------------- */

  const rig = createCameraRig(map);

  function measureInsets(): void {
    const height = root.clientHeight || window.innerHeight;
    const topBottom = Math.max(clock.getBoundingClientRect().bottom, pins.getBoundingClientRect().bottom, dareNote.getBoundingClientRect().bottom);
    const bottomTop = Math.min(postbox.getBoundingClientRect().top, phone ? time.tab.getBoundingClientRect().top : time.bar.getBoundingClientRect().top);
    insets = { top: Math.round(topBottom + 6), bottom: Math.round(Math.max(0, height - bottomTop + 6)) };
  }

  function resize(): void {
    const w = root.clientWidth || window.innerWidth;
    const hgt = root.clientHeight || window.innerHeight;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    renderer.resize(w, hgt, dpr);
    rig.resize(w, hgt);
    strings.setAttribute('viewBox', `0 0 ${w} ${hgt}`);
    measureInsets();
  }

  function applyLayout(): void {
    phone = phoneQuery.matches;
    root.dataset.layout = phone ? 'phone' : 'desk';
    if (phone) time.drawerBody.appendChild(time.bar);
    else {
      time.closeDrawer();
      bottom.insertBefore(time.bar, time.tab);
    }
    resize();
  }
  phoneQuery.addEventListener('change', applyLayout);
  const onResize = (): void => resize();
  window.addEventListener('resize', onResize);
  dareNote.addEventListener('toggle', onResize);
  applyLayout();

  /* ---------------- Frame ---------------- */

  function interpolatedSnapshot(): WorldSnapshot {
    return {
      ...cur,
      villagers: cur.villagers.map((v) => ({ ...v, pos: positions.get(v.id) ?? v.pos })),
    };
  }

  function sheetCover(): number {
    if (!phone) return 0;
    return Math.max(tag.cover(), whisper.cover(), story.cover(), time.cover(true));
  }

  function renderWorld(alpha: number): void {
    try {
      renderer.render(prev, cur, rig.camera, { threads: threadsOn, selected: tag.selected() ?? undefined, alpha, reducedMotion: reducedMotion() });
      renderFailures = 0;
    } catch (err) {
      renderFailures += 1;
      if (renderFailures >= 3 && !usingStub) {
        console.warn('The village renderer failed; switching to the plain one.', err);
        renderer = createStubRenderer(canvas, map);
        usingStub = true;
        resize();
      }
    }
  }

  function updateClock(): void {
    if (cur.minuteOfDay === lastMinute) return;
    lastMinute = cur.minuteOfDay;
    timeText.textContent = clockText(cur.minuteOfDay);
    dayText.textContent = `Day ${cur.dayIndex + 1}`;
    dial.set((cur.minuteOfDay - DAY_START_MINUTE) / MINUTES_PER_DAY);
  }

  let rafId = 0;
  let lastNow = performance.now();
  let firstFrame = true;

  function frame(now: number): void {
    rafId = window.requestAnimationFrame(frame);
    const elapsed = Math.max(0, (now - lastNow) / 1000);
    const dt = Math.min(0.25, elapsed);
    lastNow = now;

    if (effectiveRate() > 0) {
      const budget = advanceTicks(acc, elapsed, effectiveRate(), MAX_STEPS_PER_FRAME);
      acc = budget.remaining + budget.steps;
      let steps = 0;
      while (steps < budget.steps && effectiveRate() > 0) {
        acc = Math.max(0, acc - 1);
        steps += 1;
        if (stepOnce()) break;
      }
    }
    const alpha = clamp(acc, 0, 1);

    positions.clear();
    cur.villagers.forEach((v, i) => {
      const p = prev?.villagers[i]?.id === v.id ? prev.villagers[i] : prev?.villagers.find((o) => o.id === v.id);
      positions.set(v.id, p ? lerp(p.pos, v.pos, alpha) : v.pos);
    });
    const player = lerp(prev?.player.pos ?? cur.player.pos, cur.player.pos, alpha);

    const cover = sheetCover();
    rig.far = threadsOn || scrubFar;
    rig.setInsets({ top: insets.top, bottom: insets.bottom, sheet: cover });
    rig.update(player, dt, firstFrame || reducedMotion());
    firstFrame = false;
    renderWorld(alpha);

    const cam = rig.camera;
    const project = (p: Vec2): { x: number; y: number } => renderer.project(p, cam);
    bubbles.update({
      cur,
      positions,
      player,
      camera: cam,
      project,
      selected: tag.selected(),
      far: rig.far,
      compact: phone,
      topLimit: phone ? Math.min(insets.top, 64) : insets.top,
      // Projected positions are canvas-relative; DOM rectangles use viewport coordinates.
      exclusions: phone ? (() => {
        const origin = canvas.getBoundingClientRect();
        return [clock, pins, threadsBtn, storyBtn, shareBtn, dareNote].map((control) => {
          const r = control.getBoundingClientRect();
          return { x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height };
        });
      })() : [],
      bottomLimit: cam.height - (phone ? Math.max(cover, insets.bottom) : insets.bottom),
      now,
    });

    // The tag hangs beside its villager, tied on with a string.
    const sel = tag.selected();
    let tied = false;
    if (sel) {
      const vp = positions.get(sel);
      const foot = vp ? project(vp) : null;
      const head = foot ? { x: foot.x, y: foot.y - cam.zoom * 0.75 } : null;
      const visible = head !== null && head.x > -10 && head.x < cam.width + 10 && head.y > 0 && head.y < cam.height - (phone ? cover : 0) - 8;
      const near = head !== null && head.x > -120 && head.x < cam.width + 120 && head.y > -120 && head.y < cam.height + 120;
      const eyelet = tag.place({ anchor: near ? head : null, width: cam.width, height: cam.height, top: insets.top, bottom: cam.height - insets.bottom, dt });
      if (visible && head && eyelet) {
        const midX = (head.x + eyelet.x) / 2;
        const sag = Math.min(40, Math.hypot(eyelet.x - head.x, eyelet.y - head.y) * 0.18);
        stringPath.setAttribute('d', `M${head.x.toFixed(1)} ${head.y.toFixed(1)}Q${midX.toFixed(1)} ${(Math.max(head.y, eyelet.y) + sag).toFixed(1)} ${eyelet.x.toFixed(1)} ${eyelet.y.toFixed(1)}`);
        tied = true;
      }
    }
    if (!tied) stringPath.setAttribute('d', '');

    if (markerAt && now < markerAt.until) {
      const m = project(markerAt.pos);
      marker.hidden = false;
      marker.style.transform = `translate3d(${Math.round(m.x)}px, ${Math.round(m.y)}px, 0)`;
    } else if (!marker.hidden) {
      marker.hidden = true;
      markerAt = null;
    }

    updateClock();
    postbox.dataset.reach = inReach(cur).length > 0 ? 'true' : 'false';
    const held = holds.size > 0 || rewinding;
    const key = `${cur.tick}|${maxTick}|${speed}|${held}|${interventions.length}`;
    if (key !== lastTimeKey) {
      lastTimeKey = key;
      time.update({ tick: cur.tick, maxTick, runTicks: Math.max(runTicks, Math.ceil((maxTick + 1) / MINUTES_PER_DAY) * MINUTES_PER_DAY), marks: interventions, speed, held });
    }
  }

  story.reset(resyncEvents());
  updateClock();
  if (arrivalNote) window.setTimeout(() => say(arrivalNote ?? '', 6500), 400);
  rafId = window.requestAnimationFrame(frame);

  return {
    get sim() {
      return sim;
    },
    locate(id) {
      const p = id === 'stranger' ? lerp(prev?.player.pos ?? cur.player.pos, cur.player.pos, clamp(acc, 0, 1)) : positions.get(id);
      return p ? renderer.project(p, rig.camera) : null;
    },
    destroy() {
      whisper.destroy();
      window.cancelAnimationFrame(rafId);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('resize', onResize);
      phoneQuery.removeEventListener('change', applyLayout);
      root.replaceChildren();
    },
  };
}
