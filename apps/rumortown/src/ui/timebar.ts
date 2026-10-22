/**
 * Speed (pause, 1×, 2×, 8×) and the timeline ribbon. Along the bottom edge on a desk; in a drawer on a
 * phone, opened from the time tab. Scrubbing asks the app to rebuild the run up to the chosen minute.
 */
import { MINUTES_PER_DAY, type Intervention } from '../sim/types.js';
import { mergeBeatPins, type StoryBeat } from './story-beats.js';
import { clamp, conceal, h, reveal } from './dom.js';
import { tickClock, tickLabel } from './format.js';
import { closeIcon } from './icons.js';
import type { Layers } from './layers.js';

export type Speed = 0 | 0.5 | 1 | 2 | 8;
export const SPEEDS: readonly Speed[] = [0, 0.5, 1, 2, 8];
export const speedLabel = (s: Speed): string => (s === 0 ? 'Paused' : s === .5 ? 'Slow' : s === 1 ? 'Normal' : `${s}×`);

export interface TimeContext {
  layers: Layers;
  reducedMotion: () => boolean;
  onSpeed: (s: Speed) => void;
  onNextBeat?: () => void;
  onScrubStart: () => void;
  onScrubPreview: (tick: number) => void;
  onScrub: (tick: number) => void;
  onScrubEnd: () => void;
  onDrawerChange: (open: boolean) => void;
  nameOf: (id: string) => string;
}

export interface TimeState {
  tick: number;
  maxTick: number;
  runTicks: number;
  marks: readonly Intervention[];
  beats?: readonly StoryBeat[];
  speed: Speed;
  /** True while something else holds time, such as an open whisper sheet. */
  held: boolean;
  pauseReason?: string;
}

export interface TimeControls {
  readonly bar: HTMLElement;
  readonly tab: HTMLButtonElement;
  readonly drawer: HTMLElement;
  readonly drawerBody: HTMLElement;
  update(state: TimeState): void;
  openDrawer(opener?: Element | null): void;
  closeDrawer(): void;
  isDrawerOpen(): boolean;
  scrubbing(): boolean;
  cover(phone: boolean): number;
}

export function createTimeControls(ctx: TimeContext): TimeControls {
  const radios = new Map<Speed, HTMLInputElement>();
  const speed = h('fieldset', { class: 'speed' },
    h('legend', { class: 'sr-only' }, 'Speed'),
    SPEEDS.map((s) => {
      const input = h('input', { type: 'radio', name: 'rt-speed', value: String(s), class: 'sr-only', 'aria-label': s === 0 ? 'Pause' : s === .5 ? 'Play slowly' : `Play at ${s}×` });
      input.addEventListener('change', () => {
        if (input.checked) ctx.onSpeed(s);
      });
      radios.set(s, input);
      return h('label', { class: 'speed-option', 'data-speed': String(s) }, input, h('span', { 'aria-hidden': 'true' }, speedLabel(s)));
    }));

  const reached = h('div', { class: 'ribbon-reached' });
  const days = h('div', { class: 'ribbon-days' });
  const marks = h('div', { class: 'ribbon-marks' });
  const readout = h('output', { class: 'ribbon-readout', hidden: true });
  const input = h('input', { type: 'range', class: 'ribbon-input', min: '0', max: String(3 * MINUTES_PER_DAY), step: '1', value: '0', 'aria-label': 'Timeline, 24 hours per day, night from 21:30 to 06:00' });
  const ribbon = h('div', { class: 'ribbon' }, h('div', { class: 'ribbon-track', 'aria-hidden': 'true' }, reached, days), input, marks, readout);
  const clock = h('span', { class: 'strip-clock' });
  const nextBeat = h('button', { class: 'text-button next-beat', type: 'button', hidden: true, title: 'Next beat (period key)', onclick: () => ctx.onNextBeat?.() }, 'Next beat');
  const bar = h('div', { class: 'timebar' }, clock, speed, nextBeat, ribbon);
  const reason = h('p', { class: 'time-reason', role: 'status', hidden: true });
  bar.appendChild(reason);

  const tabSpeed = h('span', { class: 'time-tab-speed' }, '1×');
  const tab = h('button', { class: 'time-tab', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'rt-time-drawer' },
    h('span', { class: 'time-tab-label' }, 'Time'), tabSpeed);
  const drawerReadout = h('p', { class: 'drawer-sub' });
  const drawerBody = h('div', { class: 'timedrawer-body' });
  const drawer = h('section', { class: 'drawer timedrawer', id: 'rt-time-drawer', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'rt-time-title', hidden: true },
    h('div', { class: 'drawer-paper' },
      h('header', { class: 'drawer-head' },
        h('div', null, h('h2', { id: 'rt-time-title', class: 'drawer-title' }, 'Time'), drawerReadout),
        h('button', { class: 'close', type: 'button', 'aria-label': 'Close time controls', onclick: () => api.closeDrawer() }, closeIcon())),
      drawerBody));

  let maxTick = 0;
  let dragging = false;
  let interacting = false;
  let commitTimer = 0;
  let endTimer = 0;
  let drawerOpen = false;
  let lastValueText = '';
  let lastSpan = 0;
  let lastMarksKey = '';
  let runTicks = 3 * MINUTES_PER_DAY;

  const begin = (): void => {
    window.clearTimeout(endTimer);
    if (!interacting) {
      interacting = true;
      ctx.onScrubStart();
    }
  };
  const finishSoon = (): void => {
    window.clearTimeout(endTimer);
    endTimer = window.setTimeout(() => {
      if (dragging) return;
      interacting = false;
      readout.hidden = true;
      ctx.onScrubEnd();
    }, 700);
  };
  const showReadout = (v: number): void => {
    readout.hidden = false;
    readout.textContent = tickClock(v);
    readout.style.left = `${(v / runTicks) * 100}%`;
    input.setAttribute('aria-valuetext', tickLabel(v));
  };

  input.addEventListener('pointerdown', () => {
    dragging = true;
    begin();
  });
  const release = (): void => {
    if (!dragging) return;
    dragging = false;
    finishSoon();
  };
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  input.addEventListener('keydown', (ev) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(ev.key)) begin();
  });
  input.addEventListener('input', () => {
    begin();
    const raw = Number(input.value);
    const v = clamp(raw, 0, maxTick);
    if (v !== raw) input.value = String(v);
    showReadout(v);
    ctx.onScrubPreview(v);
  });
  input.addEventListener('change', () => {
    const v = clamp(Number(input.value), 0, maxTick);
    window.clearTimeout(commitTimer);
    commitTimer = window.setTimeout(() => {
      ctx.onScrub(v);
      finishSoon();
    }, dragging ? 0 : 260);
  });

  tab.addEventListener('click', () => (drawerOpen ? api.closeDrawer() : api.openDrawer(tab)));

  const api: TimeControls = {
    bar,
    tab,
    drawer,
    drawerBody,
    update(s) {
      nextBeat.hidden = s.speed !== 0;
      nextBeat.disabled = s.held || s.tick >= s.runTicks;
      maxTick = Math.max(0, s.maxTick);
      runTicks = Math.max(MINUTES_PER_DAY, s.runTicks);
      input.max = String(runTicks);
      const radio = radios.get(s.speed);
      if (radio && !radio.checked) radio.checked = true;
      bar.dataset.held = s.held ? 'true' : 'false';
      const explanation = s.pauseReason ?? (s.held ? 'Paused while a panel is open.' : s.speed === 0 ? 'You paused the village. Choose a speed to resume.' : '');
      tabSpeed.textContent = s.held ? 'Paused' : speedLabel(s.speed);
      tab.setAttribute('aria-label', `Time controls. ${explanation || `Playing at ${s.speed}×`}`);
      tab.title = explanation;
      reason.textContent = explanation; reason.hidden = !explanation;
      reached.style.width = `${(maxTick / runTicks) * 100}%`;
      const dayCount = Math.ceil(runTicks / MINUTES_PER_DAY);
      if (runTicks !== lastSpan) {
        lastSpan = runTicks;
        days.replaceChildren(...Array.from({ length: dayCount }, (_, i) =>
          h('span', { class: 'ribbon-day', style: `left: ${(i * MINUTES_PER_DAY / runTicks) * 100}%; width: ${MINUTES_PER_DAY / runTicks * 100}%` }, h('span', { class: 'ribbon-night' }), h('span', { class: 'ribbon-day-label' }, `Day ${i + 1}`))));
      }
      clock.textContent = tickLabel(s.tick);
      const pins = mergeBeatPins(s.beats ?? []);
      const key = pins.map(p => `${p.tick}:${p.kind}:${p.count}`).join(',') + s.marks.map((m) => `${m.tick}:${m.listener}`).join(',') + `/${runTicks}`;
      if (key !== lastMarksKey) {
        lastMarksKey = key;
        marks.replaceChildren(...pins.map(p => h('button', {
          type: 'button', class: 'beat-pin', 'data-kind': p.kind,
          style: `left: ${(p.tick / runTicks) * 100}%`,
          title: `${p.text}. ${tickLabel(p.tick)}${p.count > 1 ? `, ${p.count} story beats` : ''}`,
          'aria-label': `${p.text}. ${tickLabel(p.tick)}`,
          onclick: () => { begin(); ctx.onScrub(p.tick); finishSoon(); },
        })));

      }
      if (!interacting) {
        input.value = String(s.tick);
        const text = tickLabel(Math.floor(s.tick / 15) * 15);
        if (text !== lastValueText) {
          lastValueText = text;
          input.setAttribute('aria-valuetext', tickLabel(s.tick));
        }
      }
      drawerReadout.textContent = `${tickLabel(s.tick)}. ${explanation}`;
    },
    openDrawer(opener) {
      if (drawerOpen) return;
      drawerOpen = true;
      tab.setAttribute('aria-expanded', 'true');
      reveal(drawer);
      ctx.layers.open({ id: 'time', el: drawer, modal: false, close: () => api.closeDrawer() }, opener);
      ctx.onDrawerChange(true);
      drawer.querySelector<HTMLInputElement>('.speed input:checked')?.focus({ preventScroll: true });
    },
    closeDrawer() {
      if (!drawerOpen) return;
      drawerOpen = false;
      tab.setAttribute('aria-expanded', 'false');
      conceal(drawer, ctx.reducedMotion());
      ctx.layers.closed('time');
      ctx.onDrawerChange(false);
    },
    isDrawerOpen: () => drawerOpen,
    scrubbing: () => interacting,
    cover: (phone) => (phone ? (drawerOpen ? drawer.offsetHeight : 0) : 0),
  };
  return api;
}
