/** Event checks use the existing small sheet DOM; they do not assert browser layout. */
import { afterEach, expect, it, vi } from 'vitest';
import { TestElement } from './whisper-dom.fixture.js';
import { createFakeSimulation } from '../sim/fake.js';
import { createStory } from './story.js';
import { createTimeControls } from './timebar.js';
import { createArrival } from './arrival.js';
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
it('ends the arrival in 2.8 seconds even when no renderer or font signals readiness', async () => {
  vi.useFakeTimers(); const root = paperDocument();
  const arrival = createArrival(root as unknown as HTMLElement), ended = vi.fn();
  void arrival.start().then(ended);
  await vi.advanceTimersByTimeAsync(2799); expect(ended).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1); expect(ended).toHaveBeenCalledOnce();
  expect(root.dataset.arriving).toBeUndefined(); arrival.destroy();
});
it('skips on a tap and uses a single short cross-fade under reduced motion', async () => {
  vi.useFakeTimers(); const root = paperDocument(true);
  const arrival = createArrival(root as unknown as HTMLElement), ended = vi.fn();
  void arrival.start().then(ended);
  await vi.advanceTimersByTimeAsync(350); expect(ended).toHaveBeenCalledOnce();
  const skipped = vi.fn(); void arrival.start().then(skipped);
  root.querySelector('.arrival')!.dispatchEvent(new Event('click'));
  await Promise.resolve(); expect(skipped).toHaveBeenCalledOnce(); arrival.destroy();
});
it('the guide advances through three cards and Show me starts the Mira walkthrough', () => {
  paperDocument(); const showMe = vi.fn();
  const guide = createOpening(stack(), showMe, vi.fn(), vi.fn());
  guide.show(true); const root = guide.el as unknown as PaperElement;
  const next = root.querySelector('.button-primary')!;
  expect(root.querySelector('h1')!.textContent).toBe('What you do');
  next.dispatchEvent(new Event('click')); expect(root.querySelector('h1')!.textContent).toBe('How villagers think');
  next.dispatchEvent(new Event('click')); expect(root.querySelector('h1')!.textContent).toBe('Sharing and your typed whisper');
  root.querySelectorAll('button').find(button => button.textContent === 'Show me')!.dispatchEvent(new Event('click'));
  expect(showMe).toHaveBeenCalledOnce(); expect(guide.el.hidden).toBe(true);
});
