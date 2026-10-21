/**
 * The shell: a full-bleed village canvas with paper tags and pins on top, driven by a fixed-step loop.
 * The simulation steps at 2 game-minutes a second at 1× (4 at 2×, 16 at 8×, with readable rumor beats); the
 * renderer draws every animation frame, blending the previous and current snapshots.
 */
import { headAnchor, headLift } from './anchors.js';
import { localStartTick } from './local-clock.js';
import { createExchanges, followsExchange, longestChain, type StoryStats } from './exchanges.js';
import { createBeatPlayback, advanceToBeat } from './beat-playback.js';
import { createDialogue } from './dialogue.js';
import { clockLook, nightNow } from './night.js';
import type { Tuning, ClaimId } from 'rumormind';
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
import { createTrailHistory } from './rumor-trail.js';
import type { Arrival } from './arrival.js';
import type { PresentationOptions } from '../render/presentation.js';
import { createHint, createRumorFocus } from './focus.js';
import { createOpening, finishOpeningDay } from './opening.js';
import { createNameLabels } from './name-labels.js';
import { createDistrictTrigger } from './district-banner.js';
import { createBubbles } from './bubbles.js';
import { createCameraRig } from './camera.js';
import { createFieldGuide } from './field-guide.js';
import { createDayEnd } from './day-end.js';
import { evaluateDare, reflectionParagraphs, runReflection } from './debrief.js';
import { clamp, h, svg } from './dom.js';
import { clockText, tickLabel } from './format.js';
import { faceImg } from './faces.js';
import { nowSentence, storyBeat, storyTarget, storyZoom, type StoryBeat } from './story-beats.js';
import { dialArt, postboxArt } from './icons.js';
import { createLayers } from './layers.js';
import { advanceTicks } from './loop.js';
import { newVillageUrl } from './new-village.js';
import { createShare } from './share.js';
import { readShareFromLocation, writeShareToLocation } from './share-link.js';
import { createStory } from './story.js';
import { createStubRenderer } from './stub-renderer.js';
import { createTag } from './tag.js';
import { createTools } from './tools.js';
import { createTimeControls, type Speed } from './timebar.js';
import { createWhisperSheet, inReach } from './whisper.js';

export interface AppDeps {
  arrival?: Arrival;
  arrivalDone?: Promise<void>;
  /** Builds a fresh run. The timeline calls this again with the same seed and whispers to rewind. */
  createSim: (seed: number, interventions: Intervention[], tuning?: Partial<Tuning>, days?: number) => Simulation;
  createRenderer: (canvas: HTMLCanvasElement, map: VillageMap) => Renderer;
  map: VillageMap;
  /** Written into share links; a link made for another cast version starts fresh. Default 'v1'. */
  castVersion?: string;
  /** Where a fresh run opens, in ticks. Defaults to the visitor’s local clock; shared links retain their arrival. */
  startTick?: number;
  /** Length of the timeline ribbon in days. Default 3. */
  runDays?: number;
}

export interface AppHandle {
  readonly sim: Simulation;
  /** Where a villager (or 'stranger') stands on screen right now, in CSS pixels. For tests and tooling. */
  locate(id: VillagerId | 'stranger'): { x: number; y: number } | null;
  destroy(): void;
}

type DayEndEvent = Extract<SimEvent, { kind: 'day-end' }>;

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
  const durationTicks = Math.max(1, deps.runDays ?? 3) * MINUTES_PER_DAY;
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

  const startTick = Math.min(MINUTES_PER_DAY - 1, Math.max(0, Math.floor(deps.startTick ?? (link.state && link.state.cast === castVersion ? link.state.start ?? 0 : localStartTick()))));
  const runTicks = startTick + durationTicks;
  const makeSim = (items: Intervention[]): Simulation => deps.createSim(seed, items, undefined, Math.ceil(runTicks / MINUTES_PER_DAY));
  let sim: Simulation;
  try {
    sim = makeSim(interventions.slice());
  } catch {
    interventions = [];
    sim = makeSim([]);
  }
  const valid = interventions.filter((i) => sim.cast.has(i.listener) &&
    (sim.claims.has(i.claimId) || readRegisteredClaim(i.claimId, sim.cast) !== null));
  if (valid.length !== interventions.length) {
    interventions = valid;
    sim = makeSim(interventions.slice());
    arrivalNote = 'Some whispers in that link did not fit this village, so they were left out.';
  }
  if (interventions.length > 0 && !arrivalNote) {
    arrivalNote = interventions.length === 1
      ? 'You are watching a replay. The whisper happens again at the same moment.'
      : `You are watching a replay. All ${interventions.length} whispers happen again at the same moments.`;
  }
  const reflection = runReflection(seed);
  let trailHistory = createTrailHistory();
  trailHistory.record(sim.snapshot().threads);
  while (sim.tick < startTick) { const before = sim.tick; sim.step(); if (sim.tick === before) break; trailHistory.record(sim.snapshot().threads); }

  const shareState = (): ShareState => ({ v: 2, start: startTick, seed, cast: castVersion, interventions: interventions.slice() });
  let written = writeShareToLocation(shareState());

  /* ---------------- DOM ---------------- */

  root.replaceChildren();
  root.classList.add('rt');
  const layers = createLayers();

  const canvas = h('canvas', {
    class: 'rt-world',
    tabindex: '0',
    role: 'img',
    'aria-label': 'The village. Arrow keys or W, A, S and D walk you one tile at a time. Enter opens the tag of the nearest villager. Space pauses. Period steps to the next rumor beat.',
  });
  const focusFrame = h('div', { class: 'rt-focus-frame', 'aria-hidden': 'true' });
  const stringPath = svg('path', { class: 'tag-string', d: '' });
  const beatThread = svg('path', { class: 'beat-thread', d: '' });
  const strings = svg('svg', { class: 'rt-strings', 'aria-hidden': 'true', focusable: 'false' }, stringPath, beatThread);
  const bubbleLayer = h('div', { class: 'rt-bubbles' });
  const districtBanner = h('div', { class: 'district-banner', role: 'status', hidden: true });
  const districtEntry = createDistrictTrigger(performance.now());
  let bannerUntil = 0;
  const labelLayer = h('div', { class: 'rt-labels', 'aria-hidden': 'true' });
  const updateLabels = createNameLabels(labelLayer);
  const marker = h('div', { class: 'rt-marker', 'aria-hidden': 'true', hidden: true });
  const live = h('div', { class: 'sr-only', 'aria-live': 'polite' });
  const actionLive = h('div', { class: 'sr-only', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
  const villagers = h('details', { class: 'villager-index', 'aria-label': 'Villagers' },
    h('summary', null, 'Meet the villagers'),
    h('ul', null, [...sim.cast.values()].map(d => h('li', null,
      h('button', { type: 'button', class: 'button button-quiet', onclick: () => { villagers.open = false; openTag(d.id, true, villagers.querySelector('summary')); } }, `${d.name}, ${d.role}`)))));

  const dial = dialArt();
  const timeText = h('span', { class: 'clock-time' });
  const dayText = h('span', { class: 'clock-day' });
  const clock = h('div', { class: 'clock', role: 'group', 'aria-label': 'Clock. The village keeps your clock.', title: 'The village keeps your clock.' }, dial.root, h('span', { class: 'clock-text' }, timeText, dayText));
  const threadsBtn = h('button', { class: 'pin', 'data-pin': 'threads', type: 'button', 'aria-pressed': 'false', hidden: true }, 'Follow a rumor');
  const storyBtn = h('button', { class: 'pin', 'data-pin': 'story', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'rt-story' }, 'Story');
  const shareBtn = h('button', { class: 'pin', 'data-pin': 'share', type: 'button', 'aria-haspopup': 'dialog' }, 'Share this village');
  const exploreBtn = h('button', { class: 'pin', type: 'button', 'aria-haspopup': 'dialog' }, 'Explore');
  const researchBtn = h('button', { class: 'pin', type: 'button', 'aria-haspopup': 'dialog' }, 'Notebook');
  const moreBtn = h('button', { class: 'pin', type: 'button', 'aria-haspopup': 'dialog' }, 'More');
  const pins = h('nav', { class: 'pins', 'aria-label': 'Village tools' }, exploreBtn, storyBtn, moreBtn, threadsBtn);
  const top = h('header', { class: 'rt-top' }, clock, pins);
  const nowFaces = h('span', { class: 'now-faces', 'aria-hidden': 'true' });
  const nowText = h('span', { class: 'now-sentence' }, 'Whisper something and watch the agents react.');
  const nowAwake = h('small', { class: 'now-awake', hidden: true });
  const runningStory = h('button', { class: 'now-open', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'rt-story' }, h('span', { class: 'sr-only' }, 'Now: '), nowFaces, h('span', { class: 'now-copy' }, nowText, nowAwake), h('span', { class: 'now-chevron', 'aria-hidden': 'true' }, '⌃'));
  const resumeFollow = h('button', { class: 'following-paused', type: 'button', hidden: true }, 'Following paused. Tap to resume.');
  threadsBtn.className = 'follow-toggle';
  nowFaces.append(faceImg('stranger', 'stranger', 22), faceImg('mira', sim.cast.get('mira')?.look ?? 'stranger', 22));
  const nowBar = h('div', { class: 'now-bar' }, runningStory, threadsBtn, resumeFollow);
  let runningBeat: StoryBeat | null = null;
  let dragged = false;
  runningStory.addEventListener('click', () => {
    if (dragged) { dragged = false; return; }
    if (story.isOpen()) story.close();
    else { closeSheetsForPhone('story'); story.open(runningStory); }
  });
  let dragStart = 0;
  runningStory.addEventListener('pointerdown', e => { dragStart = e.clientY; dragged = false; runningStory.setPointerCapture(e.pointerId); });
  runningStory.addEventListener('pointermove', e => {
    if (!runningStory.hasPointerCapture(e.pointerId) || !phone || Math.abs(e.clientY - dragStart) < 24) return;
    dragged = true;
    if (!story.isOpen()) { closeSheetsForPhone('story'); story.open(runningStory); }
    story.setFull(e.clientY < dragStart);
  });
  runningStory.addEventListener('pointerup', () => measureInsets());

  const nearbyNote = h('small', { class: 'nearby-note', 'aria-hidden': 'true' }, 'Meet someone');
  const postbox = h('button', { class: 'quick-whisper', type: 'button', 'aria-label': 'Whisper', 'aria-haspopup': 'dialog' }, postboxArt(), h('span', { class: 'postbox-label' }, 'Whisper', nearbyNote));

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
  let watchBeats = true;
  let scrubFar = false;
  let rewinding = false;
  let rewindToken = 0;
  let cursor = { tick: 0, seen: 0 };
  let follow: { id: VillagerId; whisper: boolean } | null = null;
  const heldKeys = new Map<string, Vec2>();
  let keyTarget: { tile: Vec2; at: number } | null = null;
  let destination: { pos: Vec2; label: string } | null = null;
  let agentTour: { places: string[]; index: number; untilTick: number } | null = null;
  let markerAt: { pos: Vec2; until: number } | null = null;
  let insets = { top: 64, bottom: 96 };
  let lastPausedNote = 0;
  let lastMinute = -1;
  let lastTimeKey = '';
  let beats: StoryBeat[] = [];
  let exchanges = createExchanges(sim);
  const playback = createBeatPlayback();
  let searchingBeat = false;
  const storyStats = (): StoryStats => ({ beats: exchanges.all.filter(e => followsExchange(e, '', exchanges.introduced)).length, longestChain: longestChain(trailHistory.links) });
  const focus = createRumorFocus();
  const hint = createHint(performance.now());
  const dismissHint = (): void => hint.dismiss();
  root.addEventListener('pointerdown', dismissHint, { once: true });
  const rumorSpeech = new Map<string, { text: string; claimId?: string }>();
  let spotlight: { ids: readonly string[]; until: number } | null = null;
  let followedClaim = '';
  let followedCount = 0;
  let destroyed = false;
  let awaitingArrival = !!deps.arrivalDone;
  const stitching = h('p', { class: 'stitching', role: 'status' }, 'Stitching the village…');
  if (awaitingArrival) holds.add('arrival');
  const positions = new Map<VillagerId, Vec2>();

  const effectiveRate = (): number => (holds.size > 0 || rewinding || searchingBeat || sim.tick >= runTicks ? 0 : playback.rate(speed));
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
    onVisit: (id) => { tag.close(); walkToVillager(id); },
  });

  const closeSheetsForPhone = (except: string): void => {
    if (!phone) return;
    if (except !== 'tag') tag.close();
    if (except !== 'whisper') whisper.close();
    if (except !== 'story') story.close();
    if (except !== 'time') time.closeDrawer();
  };

  const whisper = createWhisperSheet({
    sim: () => sim,
    snapshot: () => cur,
    isPhone,
    reducedMotion,
    layers,
    whisper: (listener, claimId) => doWhisper(listener, claimId),
    walkTo: (id) => walkToVillager(id),
    onOpenChange: (open) => {
      if (open) {
        whisper.warm();
        hold('whisper');
        hideToast();
      } else release('whisper');
      syncScrim();
    },
  });

  const story = createStory({
    dare: reflection.dare.text,
    sim: () => sim,
    layers,
    reducedMotion,
    isPhone,
    history: () => trailHistory.links,
    exchanges: () => exchanges,
    onFollow: () => { playback.reset(); focus.resume(); },
    onShow: ids => {
      playback.reset();
      spotlight = { ids, until: performance.now() + 4000 };
      tag.close();
      story.setFull(false);
    },
    onOpenChange: (open) => {
      runningStory.setAttribute('aria-expanded', String(open));
      root.dataset.rail = String(open);
      if (!open && dayEnd.isOpen()) dayEnd.hide();
      storyBtn.setAttribute('aria-expanded', String(open));
      if (open) hideToast();
      measureInsets();
    },
  });
  story.el.id = 'rt-story';

  const time = createTimeControls({
    layers,
    reducedMotion,
    nameOf: (id) => sim.cast.get(id)?.name ?? id,
    onSpeed: (s) => setSpeed(s),
    onNextBeat: () => nextBeat(),
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
    stats: storyStats,
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
    onNewVillage: () => {
      const candidate = randomSeed();
      const nextSeed = candidate === seed ? (seed + 1) >>> 0 : candidate;
      window.history.pushState(null, '', newVillageUrl(window.location.href, nextSeed, castVersion));
      // A hash change alone leaves the existing app mounted; load the fresh run explicitly.
      window.location.reload();
    },
  });

  const guide = createFieldGuide({
    sim: () => sim, snapshot: () => cur, map, seed, castVersion, layers, make: deps.createSim,
    walkTo: point => walkTo(point), inspect: id => openTag(id, true),
    onOpenChange: (open, mode) => {
      heldKeys.clear();
      if (open && mode === 'research') hold('notebook'); else release('notebook');
      syncScrim();
    },
  });
  const tools = createTools({ layers, actions: [researchBtn, shareBtn], onAgent: startAgent,
    onReplayArrival: () => { void replayArrival(); }, onOpenChange: open => {
    heldKeys.clear();
    if (open) { hold('tools'); hideToast(); } else release('tools');
    syncScrim();
  } });
  for (const button of [researchBtn, shareBtn]) button.className = 'button button-quiet';
  const movementHint = h('p', { class: 'movement-hint', 'aria-live': 'polite' }, 'Tap a path to walk. Gold is you. Explore shows the whole town.');
  const agentText = h('span');
  const agentNotice = h('div', { class: 'agent-notice', hidden: true },
    h('span', { role: 'status', 'aria-live': 'polite' }, agentText),
    h('button', { type: 'button', class: 'button button-quiet', onclick: () => stopAgent() }, 'Take over'));
  const opening = createOpening(layers, () => walkToVillager('mira'), () => tools.showHelp(moreBtn), open => {
    if (open) hold('opening'); else release('opening');
  });
  async function replayArrival(): Promise<void> {
    if (!deps.arrival) { opening.show(true); return; }
    opening.close(); story.close(); whisper.close(); tag.close(); time.closeDrawer();
    hold('arrival'); awaitingArrival = true;
    await deps.arrival.start();
    if (destroyed) return;
    awaitingArrival = false; release('arrival'); opening.show(true);
  }
  const dialogue = createDialogue(() => sim, () => playback.next(speed), () => { playback.skip(speed); acc = 0; });
  const bottom = h('div', { class: 'rt-bottom' }, postbox, time.bar, time.tab);
  root.append(canvas, opening.el, dialogue.el, labelLayer, nowBar, districtBanner, focusFrame, strings, bubbleLayer, marker, top, bottom, villagers, tag.el, story.el, time.drawer, whisper.el, scrim, share.el, guide.el, tools.el, agentNotice, movementHint, rewind, toast, stitching, live, actionLive);
  story.endingSlot.append(dayEnd.el);
  story.setHandle(nowBar, root);
  const bubbles = createBubbles(bubbleLayer, live);

  function syncScrim(): void {
    scrim.hidden = !(whisper.isOpen() || share.isOpen() || guide.isOpen() || tools.isOpen());
    scrim.dataset.strong = dayEnd.isOpen() || share.isOpen() || guide.isOpen() || tools.isOpen() ? 'true' : 'false';
  }
  scrim.addEventListener('click', () => {
    if (tools.isOpen()) tools.close();
    else if (guide.isOpen()) guide.close();
    else if (share.isOpen()) share.close();
    else if (whisper.isOpen()) whisper.close();
  });

  /* ---------------- Actions ---------------- */

  function setSpeed(s: Speed): void {
    searchingBeat = false;
    speed = s;
    acc = 0;
    if (s !== 0) lastPlaying = s;
  }

  function nextBeat(): void {
    if (speed !== 0 || holds.size || rewinding || sim.tick >= runTicks) return;
    if (!exchanges.introduced.size) { say('Whisper a rumor first, then step through its story.'); return; }
    playback.reset(); playback.ignore(exchanges.all.filter(e => followsExchange(e, story.selectedClaim(), exchanges.introduced)));
    acc = 0; searchingBeat = true;
    time.closeDrawer(); story.close(); tag.close();
    actionLive.textContent = 'Looking for the next beat.';
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

  function resumeForWalk(): void {
    if (speed === 0 && sim.tick < runTicks) { setSpeed(1); say('Walking resumes time.', 1800); }
    if (effectiveRate() === 0) notePaused();
    if (threadsOn) showTrail(false);
  }

  function stopAgent(): void {
    if (!agentTour) return;
    agentTour = null; agentNotice.hidden = true; delete root.dataset.agent;
    sim.movePlayer(tileOf(cur.player.pos)); cur = sim.snapshot();
    destination = null;
    movementHint.textContent = 'You are in control. Tap a path to walk.';
    say('Local agent stopped. AI credits used: $0.');
  }

  function startAgent(): void {
    if (sim.tick >= runTicks || rewinding) { say('Start a new village to try the agent.'); return; }
    tag.close(); whisper.close(); showTrail(false);
    agentTour = { places: ['square', 'bridge', 'east-market', 'gardens'], index: 0, untilTick: Math.min(runTicks, sim.tick + 600) };
    agentNotice.hidden = false; root.dataset.agent = 'true';
    setSpeed(2);
    say('Local agent started. It uses $0 in AI credits.', 4000);
    agentNext();
  }

  function agentNext(): void {
    if (!agentTour) return;
    const nextId = agentTour.places[agentTour.index++];
    const place = map.places.find(p => p.id === nextId);
    if (!place || sim.tick >= agentTour.untilTick) { stopAgent(); return; }
    agentText.textContent = `Local agent: ${place.name}. $0 credits.`;
    walkTo(place.door, true);
  }

  function walkTo(point: Vec2, automated = false): void {
    if (rewinding) return;
    if (!automated) { stopAgent(); focus.move(); playback.reset(); spotlight = null; hint.dismiss(); }
    const requested = tileOf(point);
    const kind = map.tiles[requested.y * map.width + requested.x];
    if (kind === 'water') { say('The river is deep. Cross at the bridge.'); return; }
    const tile = nearestWalkable(requested);
    if (!tile) return;
    follow = null;
    heldKeys.clear();
    keyTarget = null;
    const place = map.places.find(p => p.door.x === tile.x && p.door.y === tile.y);
    destination = { pos: { x: tile.x + .5, y: tile.y + .5 }, label: place?.name ?? 'your chosen spot' };
    movementHint.textContent = `Walking to ${destination.label}.`;
    sim.movePlayer(tile);
    cur = sim.snapshot();
    markerAt = { pos: { x: tile.x + 0.5, y: tile.y + 0.5 }, until: performance.now() + 1400 };
    resumeForWalk();
  }

  function walkToVillager(id: VillagerId): void {
    focus.move(); playback.reset(); spotlight = null; hint.dismiss();
    stopAgent();

    const v = cur.villagers.find((x) => x.id === id);
    if (!v || rewinding) return;
    heldKeys.clear();
    destination = null;
    follow = { id, whisper: true };
    movementHint.textContent = `Walking to ${v.name}.`;
    keyTarget = null;
    sim.movePlayer(tileOf(v.pos));
    resumeForWalk();
  }

  function followStep(): void {
    if (!follow) return;
    const v = cur.villagers.find((x) => x.id === follow?.id);
    if (!v) {
      follow = null;
      return;
    }
    const p = cur.player.pos;
    if (Math.hypot(v.pos.x - p.x, v.pos.y - p.y) <= 2) {
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
    focus.move(); playback.reset(); spotlight = null; hint.dismiss();
    stopAgent();
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
    destination = null;

    keyTarget = { tile: next, at: now };
    follow = null;
    sim.movePlayer(next);
    resumeForWalk();
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
    actionLive.textContent = `You whispered to ${sim.cast.get(listener)?.name ?? listener}: ${sim.claims.get(claimId)?.text ?? 'a village story'}.`;
    interventions.push({ tick: sim.tick, listener, claimId });
    interventions.sort((a, b) => a.tick - b.tick);
    written = writeShareToLocation(shareState());
    cur = sim.snapshot();
    story.focus(claimId); showTrail(true);
    const fresh = consumeEvents();
    if (fresh.length) story.push(fresh);
    bubbles.boost(listener, 5000);
    tag.refresh(true);
    return true;
  }

  /* ---------------- Events ---------------- */

  function showTrail(open: boolean): void {
    threadsOn = open; watchBeats = open; focus.toggle(open);
    root.dataset.tracing = String(open);
    threadsBtn.setAttribute('aria-pressed', String(open));
    followedClaim = ''; followedCount = 0;
    if (open) { hideToast(); story.updateChain(); }
    else playback.reset();
    measureInsets();
  }
  resumeFollow.addEventListener('click', () => { focus.resume(); followedClaim = ''; followedCount = 0; });

  function consumeEvents(): SimEvent[] {
    trailHistory.record(cur.threads);
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
    recordBeats(out);
    const newWhisper = out.find((e): e is Extract<SimEvent, { kind: 'whisper' }> => e.kind === 'whisper');
    if (newWhisper && !exchanges.introduced.size) showTrail(true);
    const touched = exchanges.push(out);
    exchanges.expire(sim.tick);
    for (const exchange of touched) if (followsExchange(exchange, newWhisper?.claimId ?? story.selectedClaim(), exchanges.introduced)) {
      if (searchingBeat || (watchBeats && !focus.paused)) {
        if (!playback.offer(exchange)) continue;
        acc = 0;
        if (searchingBeat) { searchingBeat = false; showTrail(true); actionLive.textContent = exchange.beat.text; }
      }
    }
    return out;
  }

  function recordBeats(events: readonly SimEvent[]): void {
    const fresh = events.map(e => storyBeat(e, sim)).filter((b): b is StoryBeat => b !== null);
    beats.push(...fresh);
    for (const e of events) if (e.kind === 'line') {
      if (e.claimId || ['accuse', 'defend', 'apologize', 'deny', 'explain', 'doubt'].includes(e.act)) rumorSpeech.set(e.speaker, { text: e.text, claimId: e.claimId });
      else rumorSpeech.delete(e.speaker);
    }
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
    playback.reset(); exchanges = createExchanges(sim); exchanges.push(all); exchanges.expire(sim.tick);
    beats = []; rumorSpeech.clear(); followedClaim = ''; followedCount = 0; recordBeats(all);
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
    actionLive.textContent = `End of day ${ev.dayIndex + 1}. ${ev.summary}`;
    guide.close();
    finishOpeningDay(() => window.localStorage);
    opening.close();
    hold('dayend');
    hideToast();
    closeSheetsForPhone('');
    whisper.close();
    const whispered = interventions.some((i) => i.tick <= sim.tick);
    const dareResult = `${reflection.dare.text} ${evaluateDare(sim, reflection.dare, ev)}`;
    story.open();
    dayEnd.show(ev, whispered ? averageTrust() : null, {
      finished: sim.tick >= runTicks,
      stats: storyStats(),
      dare: dareResult,
      paragraphs: sim.tick >= runTicks ? reflectionParagraphs(sim, ev) : [],
      checks: reflection.checks,
    });
    story.showEnding();
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
    if (sim.tick >= runTicks && !end) {
      const lastEnd = sim.events(0).slice().reverse().find((e): e is DayEndEvent => e.kind === 'day-end');
      if (lastEnd) showDayEnd(lastEnd);
      setSpeed(0); return true;
    }
    if (end) {
      showDayEnd(end);
      return true;
    }
    return false;
  }

  /** Rebuild the run from the same seed and whispers, then step to the target minute. */
  async function seek(targetTick: number): Promise<void> {
    stopAgent(); searchingBeat = false; playback.reset();
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
      next = makeSim(interventions.slice());
      next.movePlayer(standAt);
    }
    const nextHistory = back ? createTrailHistory() : trailHistory;
    nextHistory.record(next.snapshot().threads);
    const from = next.tick;
    const span = Math.max(1, target - from);
    while (next.tick < target) {
      const until = performance.now() + 10;
      while (next.tick < target && performance.now() < until) { next.step(); nextHistory.record(next.snapshot().threads); }
      rewindThread.style.transform = `scaleX(${((next.tick - from) / span).toFixed(3)})`;
      await sleep(0);
      if (token !== rewindToken) return;
    }
    const wait = 500 - (performance.now() - shownAt);
    if (wait > 0) await sleep(wait);
    if (token !== rewindToken) return;
    sim = next;
    trailHistory = nextHistory;
    cur = sim.snapshot();
    prev = cur;
    acc = 0;
    follow = null;
    heldKeys.clear();
    destination = null;
    keyTarget = null;
    story.reset(resyncEvents());
    bubbles.clear();
    tag.refresh(true);
    rewind.hidden = true;
    rewinding = false;
  }

  /* ---------------- Input ---------------- */

  moreBtn.addEventListener('click', () => { closeSheetsForPhone(''); tools.open(moreBtn); });
  exploreBtn.addEventListener('click', () => { closeSheetsForPhone(''); guide.show('explore', exploreBtn); });
  researchBtn.addEventListener('click', () => { tools.close(); closeSheetsForPhone(''); guide.show('research', moreBtn); });
  threadsBtn.addEventListener('click', () => {
    showTrail(!threadsOn);
  });
  storyBtn.addEventListener('click', () => {
    tools.close();
    if (story.isOpen()) story.close();
    else {
      closeSheetsForPhone('story');
      story.open(storyBtn);
    }
  });
  shareBtn.addEventListener('click', () => {
    tools.close();
    closeSheetsForPhone('share');
    share.open(moreBtn);
  });
  postbox.addEventListener('click', () => {
    if (rewinding) return;
    stopAgent();
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
    if (awaitingArrival || layers.anyModal()) return;
    hint.dismiss();
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
      heldKeys.set(ev.key.toLowerCase(), dir);
      stepKey(dir);
      return;
    }
    if (ev.key === 'Enter') {
      ev.preventDefault();
      inspectNearest();
    } else if (ev.key === '.') {
      ev.preventDefault(); nextBeat();
    } else if (ev.key === ' ') {
      ev.preventDefault();
      setSpeed(speed === 0 ? lastPlaying : 0);
    }
  };
  const onKeyUp = (ev: KeyboardEvent): void => { heldKeys.delete(ev.key.toLowerCase()); };
  const clearKeys = (): void => { heldKeys.clear(); };
  document.addEventListener('keydown', onKey);
  document.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', clearKeys);

  const onHash = (): void => {
    if (window.location.hash.replace(/^#/, '') !== written) window.location.reload();
  };
  window.addEventListener('hashchange', onHash);

  /* ---------------- Layout ---------------- */

  const rig = createCameraRig(map);

  function measureInsets(): void {
    const height = root.clientHeight || window.innerHeight;
    const topBottom = Math.max(clock.getBoundingClientRect().bottom, pins.getBoundingClientRect().bottom);
    const bottomTop = Math.min(postbox.getBoundingClientRect().top, phone ? time.tab.getBoundingClientRect().top : time.bar.getBoundingClientRect().top, nowBar.parentElement === root ? nowBar.getBoundingClientRect().top : Infinity);
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
    story.layout();
    resize();
  }
  phoneQuery.addEventListener('change', applyLayout);
  const onResize = (): void => resize();
  window.addEventListener('resize', onResize);
  applyLayout();
  const geometryObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(measureInsets) : null;
  for (const element of [nowBar, clock, pins, bottom]) geometryObserver?.observe(element);

  /* ---------------- Frame ---------------- */

  function interpolatedSnapshot(): WorldSnapshot {
    return {
      ...cur,
      villagers: cur.villagers.map((v) => ({ ...v, pos: positions.get(v.id) ?? v.pos })),
    };
  }

  function sheetCover(): number {
    if (!phone) return 0;
    const sideRail = window.matchMedia('(orientation: landscape)').matches;
    const panels = [[tag.el, tag.selected() !== null], [whisper.el, whisper.isOpen()], [story.el, story.isOpen() && !sideRail], [time.drawer, time.isDrawerOpen()]] as const;
    return Math.max(0, ...panels.filter(([, open]) => open).map(([el]) => rig.camera.height - el.getBoundingClientRect().top));
  }

  function renderWorld(alpha: number): void {
    try {
      const options: PresentationOptions = {
        threads: threadsOn, selected: tag.selected() ?? undefined, alpha, reducedMotion: reducedMotion(), phone,
        spotlight: playback.active?.people ?? (spotlight && performance.now() < spotlight.until ? spotlight.ids : undefined),
        spotlightDim: playback.active ? .5 : undefined,
        arriving: awaitingArrival && !reducedMotion(),
        onReady: () => { stitching.hidden = true; },
      };
      const links = threadsOn ? trailHistory.links.filter(t => t.claimId === story.selectedClaim()) : cur.threads;
      renderer.render(prev, threadsOn ? { ...cur, threads: links } : cur, rig.camera, options);
      if (usingStub) stitching.hidden = true;
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
    dial.set(((cur.minuteOfDay - DAY_START_MINUTE + MINUTES_PER_DAY) % MINUTES_PER_DAY) / MINUTES_PER_DAY);
  }

  let rafId = 0;
  let lastNow = performance.now();
  let firstFrame = true;
  let framedBeat = '';

  function frame(now: number): void {
    rafId = window.requestAnimationFrame(frame);
    const elapsed = Math.max(0, (now - lastNow) / 1000);
    const dt = Math.min(0.25, elapsed);
    lastNow = now;

    playback.advance(dt * 1000, speed > 0 && holds.size === 0 && !rewinding, speed);
    if (searchingBeat) {
      advanceToBeat(() => { stepOnce(); }, () => !!playback.active, () => holds.size > 0 || sim.tick >= runTicks || !searchingBeat);
      if (holds.size || sim.tick >= runTicks) { searchingBeat = false; say('No further beat before this day ends.'); }
    }
    if (effectiveRate() > 0) {
      const budget = advanceTicks(acc, elapsed, effectiveRate(), MAX_STEPS_PER_FRAME);
      acc = budget.remaining + budget.steps;
      let steps = 0;
      while (steps < budget.steps && effectiveRate() > 0) {
        acc = Math.max(0, acc - 1);
        steps += 1;
        const beforeBeat = playback.active;
        if (stepOnce() || playback.active !== beforeBeat) break;
      }
    }
    if (heldKeys.size && !layers.anyModal() && effectiveRate() > 0) stepKey([...heldKeys.values()].at(-1)!);
    if (destination && !cur.player.moving) {
      const arrived = Math.hypot(cur.player.pos.x - destination.pos.x, cur.player.pos.y - destination.pos.y) < .7;
      movementHint.textContent = arrived ? `You have reached ${destination.label}. Enter meets someone nearby.` : 'Choose a path in Explore to keep travelling.';
      destination = null;

    }
    if (agentTour && effectiveRate() > 0 && !layers.anyModal()) {
      if (sim.tick >= agentTour.untilTick) stopAgent();
      else if (!cur.player.moving) agentNext();
    }
    guide.update();
    const alpha = clamp(acc, 0, 1);

    positions.clear();
    cur.villagers.forEach((v, i) => {
      const p = prev?.villagers[i]?.id === v.id ? prev.villagers[i] : prev?.villagers.find((o) => o.id === v.id);
      positions.set(v.id, p ? lerp(p.pos, v.pos, alpha) : v.pos);
    });
    const player = lerp(prev?.player.pos ?? cur.player.pos, cur.player.pos, alpha);

    const entered = districtEntry(player, now);
    clockLook(districtBanner, cur.minuteOfDay);
    if (entered) { districtBanner.textContent = entered; bannerUntil = now + 2500; districtBanner.hidden = false; }
    if (now >= bannerUntil) districtBanner.hidden = true;
    story.updateChain();
    dialogue.update(playback.active, playback.line, layers.anyModal() || awaitingArrival || rewinding || (phone && story.isOpen() && story.el.dataset.full === 'true'));
    root.dataset.beat = String(!dialogue.el.hidden);
    const panelHeight = dialogue.el.hidden ? 0 : dialogue.el.offsetHeight + 10;
    const baseCover = sheetCover();
    dialogue.el.style.bottom = `${Math.max(insets.bottom, baseCover) + 8}px`;
    const cover = Math.max(baseCover, panelHeight ? Math.max(insets.bottom, baseCover) + panelHeight : 0);
    const links = trailHistory.links.filter(t => t.claimId === story.selectedClaim());
    if (threadsOn && !focus.paused) {
      if (followedClaim !== story.selectedClaim()) {
        followedClaim = story.selectedClaim(); followedCount = Math.max(0, links.length - 1);
        focus.toggle(true);
      }
      for (const link of links.slice(followedCount)) focus.transmission([link.from, link.to], now);
      followedCount = links.length;
    }
    resumeFollow.hidden = !focus.paused || !threadsOn;
    movementHint.hidden = !hint.visible(now);
    rig.far = scrubFar;
    const sideRail = story.isOpen() && (!phone || window.matchMedia('(orientation: landscape)').matches);
    rig.setInsets({ top: insets.top, bottom: insets.bottom, left: 0, right: sideRail ? 332 : 0, sheet: cover });
    const beatPeople = playback.active?.people;
    if (playback.active && framedBeat !== playback.active.id) { framedBeat = playback.active.id; rig.glide(); }
    const highlight = beatPeople ? storyTarget(beatPeople, cur) : spotlight && now < spotlight.until ? storyTarget(spotlight.ids, cur) : null;
    const focusPeople = focus.target(now);
    const focusPoint = storyTarget(focusPeople, cur);
    rig.focusZoom = storyZoom(beatPeople ?? (highlight && spotlight ? spotlight.ids : focusPeople), cur, rig.camera.width - (sideRail ? 332 : 0), rig.camera.height - insets.top - Math.max(cover, insets.bottom));
    rig.update(highlight ?? focusPoint ?? player, dt, firstFrame || reducedMotion());
    firstFrame = false;
    renderWorld(alpha);

    const cam = rig.camera;
    const chainPeople = story.chainPeople();
    const project = (p: Vec2): { x: number; y: number } => renderer.project(p, cam);
    bubbles.update({
      cur,
      muted: layers.anyModal() || !!playback.active,
      rumorSpeech: threadsOn ? new Map([...rumorSpeech].filter(([id, speech]) => speech.claimId === story.selectedClaim() || (!speech.claimId && chainPeople.has(id))).map(([id, speech]) => [id, speech.text])) : undefined,
      spotlight: beatPeople ?? (spotlight && now < spotlight.until ? spotlight.ids : undefined),
      positions,
      player,
      camera: cam,
      project,
      selected: tag.selected(),
      far: rig.far,
      compact: phone,
      topLimit: phone ? Math.min(insets.top, 64) : insets.top,
      // Projected positions are canvas-relative; DOM rectangles use viewport coordinates.
      exclusions: (() => {
        const origin = canvas.getBoundingClientRect();
        return [clock, pins, districtBanner, nowBar, dialogue.el, ...(story.isOpen() ? [story.el] : [])].filter(control => !control.hidden).map((control) => {
          const r = control.getBoundingClientRect();
          return { x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height };
        });
      })(),
      bottomLimit: cam.height - (phone ? Math.max(cover, insets.bottom) : insets.bottom),
      now,
    });

    updateLabels(interpolatedSnapshot(), player, project, cam.width - (sideRail ? 332 : 0), insets.top, cam.height - Math.max(cover, insets.bottom), bubbles.visible(), layers.anyModal(), { phone, focus: threadsOn, chain: chainPeople, spotlight: beatPeople ?? (spotlight && now < spotlight.until ? spotlight.ids : undefined) });

    // The tag hangs beside its villager, tied on with a string.
    const sel = tag.selected();
    let tied = false;
    if (sel) {
      const vp = positions.get(sel);
      const head = vp ? headAnchor(vp, project, headLift(sim.cast.get(sel)?.tier === 'core')) : null;
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
    const pair = beatPeople?.map(id => id === 'stranger' ? player : positions.get(id));
    if (pair?.[0] && pair[1]) {
      const a = headAnchor(pair[0], project, .5), b = headAnchor(pair[1], project, .5);
      beatThread.setAttribute('d', `M${a.x} ${a.y} Q${(a.x + b.x) / 2} ${Math.max(a.y, b.y) + 20} ${b.x} ${b.y}`);
    } else beatThread.setAttribute('d', '');

    if (markerAt && now < markerAt.until) {
      const m = project(markerAt.pos);
      marker.hidden = false;
      marker.style.transform = `translate3d(${Math.round(m.x)}px, ${Math.round(m.y)}px, 0)`;
    } else if (!marker.hidden) {
      marker.hidden = true;
      markerAt = null;
    }

    const nextBeat = beats.at(-1) ?? null;
    const night = nightNow(cur, nextBeat?.event);
    const nowSentenceText = night.quiet ? 'The village sleeps' : nextBeat ? nowSentence(nextBeat, sim) : 'Whisper something and watch the agents react.';
    const awakeText = night.awake.length ? `Still awake: ${night.awake.join(', ')}` : '';
    if (nextBeat !== runningBeat || nowText.textContent !== nowSentenceText || nowAwake.textContent !== awakeText) {
      runningBeat = nextBeat;
      const faces = night.quiet ? cur.villagers.filter(v => v.activity !== 'sleep').slice(0, 3).map(v => v.id) : nextBeat?.faces ?? ['stranger', 'mira'];
      nowFaces.replaceChildren(...faces.map(id => faceImg(id, sim.cast.get(id)?.look ?? 'stranger', 22)));
      nowText.textContent = nowSentenceText;
      nowAwake.textContent = awakeText; nowAwake.hidden = !awakeText;
      nowAwake.title = awakeText;
      measureInsets();
    }
    const noWhisper = !beats.some(b => b.event.kind === 'whisper');
    if (threadsBtn.hidden !== noWhisper) { threadsBtn.hidden = noWhisper; measureInsets(); }
    updateClock();
    const nearby = inReach(cur).length;
    nearbyNote.textContent = nearby ? `${nearby} nearby` : 'Find someone';
    postbox.dataset.reach = String(nearby > 0);
    const held = holds.size > 0 || rewinding;
    const key = `${cur.tick}|${maxTick}|${speed}|${held}|${interventions.length}|${beats.length}`;
    if (key !== lastTimeKey) {
      lastTimeKey = key;
      time.update({ tick: cur.tick, maxTick, runTicks, marks: interventions, beats, speed, held });
    }
  }

  story.reset(resyncEvents());
  if (exchanges.introduced.size) {
    showTrail(true);
    for (const exchange of exchanges.all) if (exchange.beat.tick === sim.tick && followsExchange(exchange, story.selectedClaim(), exchanges.introduced)) playback.offer(exchange);
  }
  updateClock();
  deps.arrival?.connect(() => renderer.project(cur.player.pos, rig.camera), layers, () => cur.minuteOfDay);
  void (deps.arrivalDone ?? Promise.resolve()).then(() => {
    if (destroyed) return;
    awaitingArrival = false; release('arrival'); opening.show();
    if (arrivalNote) say(arrivalNote, 6500);
  });
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
      destroyed = true;
      deps.arrival?.destroy();
      geometryObserver?.disconnect();
      opening.close();
      tools.close();
      guide.destroy();
      whisper.destroy();
      window.cancelAnimationFrame(rafId);
      root.removeEventListener('pointerdown', dismissHint);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearKeys);
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('resize', onResize);
      phoneQuery.removeEventListener('change', applyLayout);
      root.replaceChildren();
    },
  };
}
