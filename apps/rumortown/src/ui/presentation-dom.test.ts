/** Event checks use the existing small sheet DOM; they do not assert browser layout. */
import { afterEach, expect, it, vi } from 'vitest';
import { TestElement } from './whisper-dom.fixture.js';
import { createFakeSimulation } from '../sim/fake.js';
import { createStory } from './story.js';
import { createExchanges } from './exchanges.js';
import { createTimeControls } from './timebar.js';
import { createArrival } from './arrival.js';
import { createPlay } from './play.js';
import { villageMap } from '../content/map/index.js';
import { createOpening } from './opening.js';
import type { Layers } from './layers.js';
import type { SimEvent } from '../sim/types.js';

vi.mock('./faces.js', () => ({ faceImg: () => document.createElement('img') }));
vi.mock('../render/sprites.js', () => ({ SpriteCache: class {
  stranger() { return { img: { width: 48, height: 64 }, w: 48, h: 64, ax: 24, ay: 56 }; }
} }));
class PaperElement extends TestElement {
  style = { width: '', height: '', translate: '', setProperty: vi.fn() };
  classList = { add: vi.fn(), remove: vi.fn() };
  scrollTop = 0;
  get firstElementChild() { return this.children[0]; }
  get childElementCount() { return this.children.length; }
  override setAttribute(name: string, value: string) {
    super.setAttribute(name, value);
    if (name.startsWith('data-')) this.dataset[name.slice(5)] = value;
  }
  override matches(selector: string) { return selector === '[data-event]' ? this.attrs.has('data-event') : super.matches(selector); }
  override appendChild(child: TestElement) {
    if (child.parent) child.parent.children = child.parent.children.filter(c => c !== child);
    return super.appendChild(child);
  }
  append(...children: TestElement[]) { children.forEach(child => this.appendChild(child)); }
  prepend(child: TestElement) { this.appendChild(child); this.children = [child, ...this.children.filter(c => c !== child)]; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); }
  contains(element: TestElement | null) { for (let p = element; p; p = p.parent) if (p === this) return true; return false; }
  getBoundingClientRect() { return { top: 0 }; }
  getContext() { return { drawImage() {} }; }
  override focus() { Object.assign(document, { activeElement: this }); }
}
function paperDocument(reduced = false) {
  vi.stubGlobal('HTMLElement', PaperElement); vi.stubGlobal('Element', PaperElement);
  const body = new PaperElement('body');
  vi.stubGlobal('document', {
    body, activeElement: null,
    createElement: (tag: string) => new PaperElement(tag),
    createElementNS: (_ns: string, tag: string) => new PaperElement(tag),
    createTextNode: (text: string) => { const el = new PaperElement('#text'); el.textContent = text; return el; },
  });
  vi.stubGlobal('window', { setTimeout, clearTimeout, innerWidth: 360, innerHeight: 640, devicePixelRatio: 1, matchMedia: () => ({ matches: reduced }) });
  return body;
}
const stack = () => ({ open: vi.fn(), closed: vi.fn() }) as unknown as Layers;
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('places dawn and night on absolute ticks when the last timeline day is partial', () => {
  paperDocument(); Object.assign(window, { addEventListener() {} });
  const time = createTimeControls({ layers: stack(), reducedMotion: () => true, onSpeed() {}, onScrubStart() {}, onScrubPreview() {}, onScrub() {}, onScrubEnd() {}, onDrawerChange() {}, nameOf: id => id });
  time.update({ tick: 780, maxTick: 780, runTicks: 5100, marks: [], speed: 1, held: false });
  const days = (time.bar as unknown as PaperElement).querySelectorAll<PaperElement>('.ribbon-day');
  expect(days).toHaveLength(4);
  for (let i = 0; i < days.length; i++) {
    const style = days[i]!.attrs.get('style')!;
    const left = Number(style.match(/left: ([\d.]+)%/)![1]) / 100 * 5100;
    const width = Number(style.match(/width: ([\d.]+)%/)![1]) / 100 * 5100;
    expect(left).toBeCloseTo(i * 1440);
    expect(width).toBeCloseTo(1440);
    // The existing night band begins 930 minutes after the 06:00 origin.
    expect(left + width * (930 / 1440)).toBeCloseTo(i * 1440 + 930);
  }
});

it('renders newest cards and sends their exact participants to Show me', () => {
  paperDocument();
  const sim = createFakeSimulation(731), onShow = vi.fn();
  const story = createStory({ sim: () => sim, layers: stack(), reducedMotion: () => true, isPhone: () => true, history: () => [], onShow, onOpenChange() {} });
  const events: SimEvent[] = [
    { kind: 'whisper', tick: 1, listener: 'mira', claimId: 'tom-stole-bread', witnesses: [] },
    { kind: 'whisper', tick: 2, listener: 'ben', claimId: 'tom-stole-bread', witnesses: [] },
  ];
  story.reset(events); story.open();
  const root = story.el as unknown as PaperElement;
  const cards = root.querySelectorAll<PaperElement>('.beat-card');
  expect(cards[0]!.textContent).toContain('Ben');
  expect(cards[1]!.textContent).toContain('Mira');
  cards[0]!.querySelector('button')!.dispatchEvent(new Event('click'));
  expect(onShow).toHaveBeenLastCalledWith(['stranger', 'ben']);
  root.querySelector('.chain-person')!.dispatchEvent(new Event('click'));
  expect(onShow).toHaveBeenLastCalledWith(['stranger']);
  root.querySelector('.rail-expand')!.dispatchEvent(new Event('click'));
  expect(story.el.dataset.full).toBe('true');
  story.close(); expect(story.el.hidden).toBe(true); expect(story.el.dataset.full).toBe('false');
});
it('moves the same Now bar into the phone sheet and returns it on close', () => {
  const home = paperDocument(), bar = new PaperElement('div'); home.append(bar);
  const story = createStory({ sim: () => createFakeSimulation(1), layers: stack(), reducedMotion: () => true, isPhone: () => true, history: () => [], onShow() {}, onOpenChange() {} });
  home.append(story.el as unknown as PaperElement);
  story.setHandle(bar as unknown as HTMLElement, home as unknown as HTMLElement);
  story.open(); expect(bar.parent?.attrs.get('class')).toContain('drawer-paper');
  story.close(); expect(bar.parent).toBe(home);
});
it('waits indefinitely for a click, then plays the bounded arrival', async () => {
  vi.useFakeTimers(); const root = paperDocument();
  const arrival = createArrival(root as unknown as HTMLElement), ended = vi.fn();
  void arrival.start().then(ended);
  await vi.advanceTimersByTimeAsync(60_000); expect(ended).not.toHaveBeenCalled();
  expect(root.querySelector('.arrival')!.hidden).toBe(false);
  root.querySelector('.arrival')!.dispatchEvent(new Event('click'));
  await vi.advanceTimersByTimeAsync(2799); expect(ended).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1); expect(ended).toHaveBeenCalledOnce();
  expect(root.dataset.arriving).toBeUndefined(); arrival.destroy();
});
it('also waits for a key under reduced motion and waits again on replay', async () => {
  vi.useFakeTimers(); const root = paperDocument(true);
  const arrival = createArrival(root as unknown as HTMLElement), ended = vi.fn();
  void arrival.start().then(ended);
  await vi.advanceTimersByTimeAsync(60_000); expect(ended).not.toHaveBeenCalled();
  const key = new Event('keydown', { cancelable: true }); Object.assign(key, { key: 'Enter' });
  root.querySelector('.arrival')!.dispatchEvent(key);
  expect(key.defaultPrevented).toBe(true);
  await vi.advanceTimersByTimeAsync(350); expect(ended).toHaveBeenCalledOnce();
  const skipped = vi.fn(); void arrival.start().then(skipped);
  await vi.advanceTimersByTimeAsync(60_000); expect(skipped).not.toHaveBeenCalled();
  root.querySelector('.arrival')!.dispatchEvent(new Event('click'));
  root.querySelector('.arrival')!.dispatchEvent(new Event('click'));
  await Promise.resolve(); expect(skipped).toHaveBeenCalledOnce(); arrival.destroy();
});
it('the short welcome offers immediate exploration or a walk to Mira', () => {
  paperDocument(); const showMe = vi.fn(), changed = vi.fn();
  const guide = createOpening(stack(), showMe, vi.fn(), changed);
  guide.show(true); const root = guide.el as unknown as PaperElement;
  expect(root.querySelector('h1')!.textContent).toBe('Make yourself at home');
  root.querySelector('.button-primary')!.dispatchEvent(new Event('click'));
  expect(guide.el.hidden).toBe(true); expect(changed).toHaveBeenLastCalledWith(false);
  guide.show(true);
  root.querySelectorAll('button').find(button => button.textContent === 'Meet Mira')!.dispatchEvent(new Event('click'));
  expect(showMe).toHaveBeenCalledOnce(); expect(guide.el.hidden).toBe(true);
});

it('hides village beats until the accessible story toggle is selected', () => {
  paperDocument();
  const sim = createFakeSimulation(731);
  const story = createStory({ sim: () => sim, layers: stack(), reducedMotion: () => true, isPhone: () => false, history: () => [], onShow() {}, onOpenChange() {} });
  story.reset([{ kind: 'line', tick: 1, speaker: 'mira', listeners: ['ben'], act: 'gossip', text: 'Village news', lineId: 'test', claimId: 'bread' }]);
  story.open(); const root = story.el as unknown as PaperElement;
  expect(root.querySelectorAll('.beat-card')).toHaveLength(0);
  const toggle = root.querySelector('.village-stories')!;
  toggle.dispatchEvent(new Event('click'));
  expect(root.querySelectorAll('.beat-card')).toHaveLength(1);
  expect(toggle.attrs.get('aria-pressed')).toBe('true');
  toggle.dispatchEvent(new Event('click'));
  expect(root.querySelectorAll('.beat-card')).toHaveLength(0);
});

it('opens phone Talk without the keyboard, holds only for typing, and releases on idle, send and close', () => {
  vi.useFakeTimers(); paperDocument();
  const typing = vi.fn(), opened = vi.fn();
  const sim = createFakeSimulation(731);
  const play = createPlay({ sim: () => sim, snapshot: () => sim.snapshot(), map: villageMap, layers: stack(), isPhone: () => true,
    onTypingChange: typing, onOpenChange: opened, act() {}, rumors() {} });
  play.open();
  const root = play.el as unknown as PaperElement, input = root.querySelector('textarea')!;
  expect(document.activeElement).toBe(root.querySelector('.close'));
  expect(opened).toHaveBeenLastCalledWith(true);
  expect(typing).toHaveBeenLastCalledWith(false);
  input.value = 'walk to the inn'; input.dispatchEvent(new Event('input'));
  expect(typing).toHaveBeenLastCalledWith(true);
  vi.advanceTimersByTime(1499); expect(typing).toHaveBeenLastCalledWith(true);
  vi.advanceTimersByTime(1); expect(typing).toHaveBeenLastCalledWith(false);
  input.dispatchEvent(new Event('input'));
  root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
  expect(typing).toHaveBeenLastCalledWith(false);
  input.dispatchEvent(new Event('compositionstart'));
  vi.advanceTimersByTime(3000); expect(typing).toHaveBeenLastCalledWith(true);
  input.dispatchEvent(new Event('compositionend'));
  input.dispatchEvent(new Event('blur')); expect(typing).toHaveBeenLastCalledWith(false);
  input.dispatchEvent(new Event('input')); play.close();
  expect(typing).toHaveBeenLastCalledWith(false);
  expect(opened).toHaveBeenLastCalledWith(false);
  const calls = typing.mock.calls.length; vi.runAllTimers(); expect(typing.mock.calls).toHaveLength(calls);
});

it('keeps eyewitness exchanges connected to the player rumor in the filtered story rail', () => {
  paperDocument();
  const sim = createFakeSimulation(731);
  const events: SimEvent[] = [
    { kind: 'whisper', tick: 1, listener: 'mira', claimId: 'tom-stole-bread', witnesses: [] },
    { kind: 'witness', tick: 20, villager: 'ben', subject: 'tom', what: 'Tom return the bread', secretId: 'bread' },
  ];
  // The stand-in claim may use a shorter id; supply the same authored subject for this exchange.
  const claims = new Map(sim.claims); claims.set('tom-stole-bread', { id: 'tom-stole-bread', about: 'tom', kind: 'theft', text: 'Tom stole bread', severity: 2, valence: -1 });
  const view = { ...sim, claims }, history = createExchanges(view); history.push(events);
  const story = createStory({ sim: () => view, layers: stack(), reducedMotion: () => true, isPhone: () => false, history: () => [], exchanges: () => history, onShow() {}, onOpenChange() {} });
  story.reset(events); story.open();
  const root = story.el as unknown as PaperElement;
  expect(root.querySelectorAll('.beat-card')).toHaveLength(2);
  expect(root.querySelectorAll('.beat-card')[0]!.textContent).toContain('return the bread');
});
