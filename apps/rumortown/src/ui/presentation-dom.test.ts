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
import { h } from './dom.js';
import { FOCUSABLE } from './dom.js';
import { createLayers } from './layers.js';
import { createTools } from './tools.js';
import { HOW_TO_PLAY } from './how-it-works.js';

vi.mock('./faces.js', () => ({ faceImg: () => document.createElement('img') }));
vi.mock('../render/sprites.js', async importOriginal => ({ ...await importOriginal<typeof import('../render/sprites.js')>(), SpriteCache: class {
  stranger() { return { img: { width: 48, height: 64 }, w: 48, h: 64, ax: 24, ay: 56 }; }
} }));
class PaperElement extends TestElement {
  style = { width: '', height: '', translate: '', setProperty: vi.fn() };
  classList = { add: vi.fn(), remove: vi.fn() };
  scrollTop = 0;
  get firstElementChild() { return this.children[0]; }
  get childElementCount() { return this.children.length; }
  get parentElement() { return this.parent; }
  get isConnected(): boolean { return this === document.body as unknown as TestElement || Boolean((this.parent as PaperElement | null)?.isConnected); }
  get className() { return this.attrs.get('class') ?? ''; }
  set className(value: string) { this.setAttribute('class', value); }
  getClientRects() { return this.closest('[hidden]') ? [] : [{}]; }
  override setAttribute(name: string, value: string) {
    super.setAttribute(name, value);
    if (name.startsWith('data-')) this.dataset[name.slice(5)] = value;
  }
  override matches(selector: string): boolean {
    if (selector === FOCUSABLE) return !this.disabled && (['button', 'input', 'select', 'textarea'].includes(this.tagName) || this.attrs.has('tabindex') && this.attrs.get('tabindex') !== '-1');
    if (selector === '[hidden]') return this.hidden;
    return selector === '[data-event]' ? this.attrs.has('data-event') : super.matches(selector);
  }
  override appendChild(child: TestElement) {
    if (child.parent) child.parent.children = child.parent.children.filter(c => c !== child);
    return super.appendChild(child);
  }
  append(...children: TestElement[]) { children.forEach(child => this.appendChild(child)); }
  prepend(child: TestElement) { this.appendChild(child); this.children = [child, ...this.children.filter(c => c !== child)]; }
  insertBefore(child: TestElement, before: TestElement) { this.appendChild(child); this.children = this.children.filter(c => c !== child); this.children.splice(this.children.indexOf(before), 0, child); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); }
  contains(element: TestElement | null) { for (let p = element; p; p = p.parent) if (p === this) return true; return false; }
  getBoundingClientRect() { return { top: 0, bottom: 64, left: 0, right: 360, width: 360, height: 64 }; }
  getContext() { return { drawImage() {} }; }
  override focus() { Object.assign(document, { activeElement: this }); }
}
function paperDocument(reduced = false) {
  vi.stubGlobal('HTMLElement', PaperElement); vi.stubGlobal('Element', PaperElement);
  const body = new PaperElement('body');
  const events = new EventTarget();
  vi.stubGlobal('document', {
    body, activeElement: null,
    addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events), dispatchEvent: events.dispatchEvent.bind(events),
    createElement: (tag: string) => new PaperElement(tag),
    createElementNS: (_ns: string, tag: string) => new PaperElement(tag),
    createTextNode: (text: string) => { const el = new PaperElement('#text'); el.textContent = text; return el; },
  });
  vi.stubGlobal('window', { setTimeout, clearTimeout, innerWidth: 360, innerHeight: 640, devicePixelRatio: 1, matchMedia: () => ({ matches: reduced }) });
  return body;
}
const stack = () => ({ open: vi.fn(), closed: vi.fn() }) as unknown as Layers;
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('renders hostile story, model and villager text as text nodes', () => {
  paperDocument();
  const text = '<img src=x onerror=alert(1)><script>alert(1)</script>';
  const element = h('p', null, text, h('strong', null, text)) as unknown as PaperElement;
  expect(element.textContent).toBe(text + text);
  expect(element.children[0]!.tagName).toBe('#text');
  expect(element.children[1]!.children[0]!.tagName).toBe('#text');
  expect(element.querySelectorAll('script')).toEqual([]);
  expect(element.querySelectorAll('img')).toEqual([]);
});

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
it('hides the status strip while Rumors is open without duplicating its header', () => {
  const home = paperDocument(), bar = new PaperElement('div'); home.append(bar);
  const story = createStory({ sim: () => createFakeSimulation(1), layers: stack(), reducedMotion: () => true, isPhone: () => true, history: () => [], onShow() {}, onOpenChange() {} });
  home.append(story.el as unknown as PaperElement);
  story.setHandle(bar as unknown as HTMLElement, home as unknown as HTMLElement);
  story.open(); expect(bar.parent).toBe(home); expect(bar.hidden).toBe(true);
  story.close(); expect(bar.parent).toBe(home); expect(bar.hidden).toBe(false);
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
it('the short welcome has one primary rumor action and a quiet exploration dismissal', () => {
  paperDocument(); const showMe = vi.fn(), changed = vi.fn();
  const guide = createOpening(stack(), showMe, vi.fn(), changed);
  guide.show(true); const root = guide.el as unknown as PaperElement;
  expect(root.querySelector('h1')!.textContent).toBe('Make yourself at home');
  root.querySelector('.button-primary')!.dispatchEvent(new Event('click'));
  expect(guide.el.hidden).toBe(true); expect(changed).toHaveBeenLastCalledWith(false);
  guide.show(true);
  root.querySelectorAll('button').find(button => button.textContent === 'Explore on my own')!.dispatchEvent(new Event('click'));
  expect(showMe).toHaveBeenCalledOnce(); expect(guide.el.hidden).toBe(true);
  expect(root.querySelectorAll('.button-primary')).toHaveLength(1);
  expect(root.querySelector('.button-primary')!.textContent).toBe('Start a rumor');
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
  expect(root.querySelectorAll('.beat-card')[0]!.textContent).toContain('You told Mira');
  expect(root.querySelectorAll('.beat-card')[1]!.textContent).toContain('return the bread');
});

it('pins the selected rumor’s actual reply above the newest moments, with older moments below More detail', () => {
  paperDocument();
  const original = createFakeSimulation(731), claims = new Map(original.claims);
  claims.set('a', { id: 'a', about: 'tom', kind: 'theft', text: 'Tom stole bread', severity: 2, valence: -1 });
  claims.set('b', { id: 'b', about: 'jonah', kind: 'romance', text: 'Jonah meets Rosa', severity: 1, valence: -1 });
  const sim = { ...original, claims };
  const line = (tick: number, claimId: string, text: string): SimEvent => ({ kind: 'line', tick, claimId, text, speaker: 'ben', listeners: ['mira'], act: 'gossip', lineId: `line-${tick}` });
  const first: SimEvent[] = [
    { kind: 'whisper', tick: 1, listener: 'ben', claimId: 'a', witnesses: [] },
    { kind: 'line', tick: 1, speaker: 'ben', listeners: [], claimId: 'a', text: 'I will ask Tom myself.', act: 'reactToWhisper', lineId: 'reply' },
    line(20, 'a', 'A later bread telling'), line(40, 'a', 'Another bread telling'), line(60, 'a', 'The newest bread telling'),
  ];
  const all: SimEvent[] = [...first, { kind: 'whisper', tick: 80, listener: 'mira', claimId: 'b', witnesses: [] }, line(80, 'b', 'A romance reply')];
  const exchanges = createExchanges(sim); exchanges.push(all);
  const story = createStory({ sim: () => sim, layers: stack(), reducedMotion: () => true, isPhone: () => true, history: () => [], exchanges: () => exchanges, onShow() {}, onOpenChange() {} });
  story.reset(first); story.present('a');
  const root = story.el as unknown as PaperElement;
  expect(root.querySelector('.latest-moments')!.children).toHaveLength(3);
  // The listener's reply to your whisper stays pinned first; the newest tellings follow it.
  expect(root.querySelector('.latest-moments')!.children[0]!.textContent).toContain('I will ask Tom myself.');
  expect(root.querySelector('.latest-moments')!.textContent).toContain('The newest bread telling');
  expect(root.querySelector('.earlier-moments')!.textContent).toContain('A later bread telling');
  expect(root.querySelector('.earlier-moments')!.closest('.story-detail')).not.toBeNull();
  story.reset(all); story.present('b');
  expect(root.querySelector('.latest-moments')!.textContent).toContain('A romance reply');
  expect(root.querySelector('.latest-moments')!.textContent).not.toContain('bread');
  story.present('a');
  expect(root.querySelector('.latest-moments')!.textContent).not.toContain('romance');
  const selector = root.querySelector('.chain-choose')!;
  selector.value = 'b'; selector.dispatchEvent(new Event('change'));
  expect(root.querySelector('.latest-moments')!.textContent).toContain('A romance reply');
  expect(root.querySelector('.earlier-moments')!.children).toHaveLength(0);
});
it('reveals the recorded reply immediately after a whisper without needing to expand the exchange', () => {
  paperDocument();
  const sim = createFakeSimulation(731), exchanges = createExchanges(sim);
  const events: SimEvent[] = [
    { kind: 'whisper', tick: 10, listener: 'tom', claimId: 'stole', witnesses: [] },
    { kind: 'line', tick: 10, speaker: 'tom', listeners: [], claimId: 'stole', text: 'That is not what happened.', act: 'reactToWhisper', lineId: 'reply' },
  ];
  exchanges.push(events);
  const story = createStory({ sim: () => sim, layers: stack(), reducedMotion: () => true, isPhone: () => true, history: () => [{ tick: 10, from: 'stranger', to: 'tom', claimId: 'stole' }], exchanges: () => exchanges, onShow() {}, onOpenChange() {} });
  story.reset(events); story.present('stole');
  const root = story.el as unknown as PaperElement;
  expect(root.querySelector('.recorded-reply')!.textContent).toBe('Tom: That is not what happened.');
  expect(root.querySelector('.recorded-reply')!.closest('details')).toBeNull();
  expect(root.querySelector('.latest-moments')!.textContent).toContain('You told Tom: “Tom stole bread from the bakery”');
  expect(root.querySelector('.hearing-note')!.textContent).toBe('He heard it. That doesn’t mean he believes it.');
  expect(root.querySelector('.heard-count')!.textContent).toBe('Heard by 1 person since your whisper');
  expect(root.querySelector('.rumor-waiting')!.hidden).toBe(false);
});
it('explains an automatic pause and preserves every playback speed and the timeline', () => {
  paperDocument(); Object.assign(window, { addEventListener() {} });
  const onSpeed = vi.fn();
  const time = createTimeControls({ layers: stack(), reducedMotion: () => true, onSpeed, onScrubStart() {}, onScrubPreview() {}, onScrub() {}, onScrubEnd() {}, onDrawerChange() {}, nameOf: id => id });
  const update = (speed: 0 | 1, held = false) => time.update({ tick: 12, maxTick: 40, runTicks: 4320, marks: [], speed, held, pauseReason: held ? 'Paused while you choose a story.' : undefined });
  update(1, true);
  expect(time.tab.textContent).toBe('TimePaused');
  expect(time.tab.getAttribute('aria-label')).toContain('Paused while you choose a story.');
  const bar = time.bar as unknown as PaperElement;
  expect(bar.querySelector('.time-reason')!.textContent).toContain('choose a story');
  expect(bar.querySelectorAll('input').filter(input => input.attrs.get('name') === 'rt-speed').map(input => input.value)).toEqual(['0', '0.5', '1', '2', '8']);
  expect(bar.querySelector('.ribbon-input')).not.toBeNull();
  update(0); expect(time.tab.textContent).toBe('TimePaused');
  update(1); expect(time.tab.textContent).toBe('TimeNormal');
  expect(bar.querySelector('.time-reason')!.hidden).toBe(true);
});

it('traps Tab in the welcome and returns focus after Escape without starting a rumor', () => {
  const body = paperDocument(), layers = createLayers(), started = vi.fn();
  const opener = h('button', { type: 'button' }, 'Enter village'); body.append(opener as unknown as PaperElement); opener.focus();
  const opening = createOpening(layers, started, vi.fn(), vi.fn()); body.append(opening.el as unknown as PaperElement);
  opening.show(true);
  const root = opening.el as unknown as PaperElement, buttons = root.querySelectorAll<PaperElement>('button');
  const key = (name: string, shiftKey = false) => {
    const event = new Event('keydown', { cancelable: true }); Object.assign(event, { key: name, shiftKey }); document.dispatchEvent(event); return event;
  };
  buttons.at(-1)!.focus(); expect(key('Tab').defaultPrevented).toBe(true); expect(document.activeElement).toBe(buttons[0]);
  buttons[0]!.focus(); expect(key('Tab', true).defaultPrevented).toBe(true); expect(document.activeElement).toBe(buttons.at(-1));
  key('Escape'); expect(opening.el.hidden).toBe(true); expect(document.activeElement).toBe(opener); expect(started).not.toHaveBeenCalled();
});
it('groups every existing menu destination, gives the exact play explanation, and retains the developer tools', () => {
  paperDocument();
  const action = (name: string) => h('button', { type: 'button' }, name);
  const tools = createTools({ layers: stack(), actions: { play: [action('Share this village')], settings: [action('Music'), action('Show rumor paths'), action('Slow down for conversations'), action('Follow the speaker')], curious: [action('Research notebook')] }, onAgent() {}, onReplayArrival() {}, onOpenChange() {} });
  const root = tools.el as unknown as PaperElement;
  expect(root.querySelectorAll('.tools-menu').flatMap(menu => menu.querySelectorAll('h3').map(title => title.textContent))).toEqual(['Play', 'Settings', 'For the curious']);
  for (const label of ['How to play', 'Watch the arrival again', 'How the AI works', 'Developer guide', 'About']) expect(root.querySelector('.tools-menu')!.textContent).toContain(label);
  expect(root.textContent).toContain(HOW_TO_PLAY);
  expect(root.textContent).toContain('npm run agent:demo');
  expect(root.textContent).toContain('Watching the arrival again does not restart your village.');
});

it('connects welcome, listener walking, cards, explicit send and the real simulation reply, restoring paused time', async () => {
  vi.useFakeTimers();
  const root = paperDocument(true);
  vi.stubGlobal('crypto', { getRandomValues: (values: Uint32Array) => { values[0] = 731; return values; } });
  const events = new EventTarget();
  let scheduled: FrameRequestCallback = () => {}, now = performance.now();
  Object.assign(window, {
    location: { href: 'https://rumourtown.test/', hash: '' }, history: { replaceState: vi.fn() },
    addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events),
    requestAnimationFrame: (callback: FrameRequestCallback) => { scheduled = callback; return 1; }, cancelAnimationFrame() {},
    matchMedia: (query: string) => ({ matches: !query.includes('landscape'), addEventListener() {}, removeEventListener() {} }),
  });
  const [{ mountApp }, { createSimulation }, { createWorld, createMover }, { createTalk }, { cast, claims }] = await Promise.all([
    import('./app.js'), import('../sim/engine.js'), import('../sim/world/index.js'), import('../sim/talk/index.js'), import('../content/cast/index.js'),
  ]);
  const app = mountApp(root as unknown as HTMLElement, { map: villageMap, startTick: 300,
    createSim: (seed, interventions) => createSimulation({ seed, interventions, cast, claims, world: { ...createWorld(villageMap), createMover }, talk: createTalk(cast) }),
    createRenderer: () => ({ resize() {}, render() {}, project: p => ({ x: p.x * 4, y: p.y * 4 }), unproject: (x, y) => ({ x: x / 4, y: y / 4 }), villagerAt: () => null }),
  });
  const frame = () => { now += 500; scheduled(now); };
  const click = (element: TestElement) => element.dispatchEvent(new Event('click'));
  await Promise.resolve();
  click(root.querySelector('.quick-whisper')!);
  expect(root.querySelector('.opening')!.hidden).toBe(true);
  expect(root.querySelector('.whisper')!.hidden).toBe(false);
  expect(root.querySelectorAll('.story-choice')).toHaveLength(0);
  const pause = root.querySelectorAll<PaperElement>('input').find(input => input.attrs.get('name') === 'rt-speed' && input.value === '0')!;
  pause.checked = true; pause.dispatchEvent(new Event('change'));
  click(root.querySelector('.walk-to')!);
  expect(root.querySelector('.walking-status')!.hidden).toBe(false);
  expect(root.querySelector('.walking-status')!.textContent).toContain('Cancel');
  for (let i = 0; i < 500 && root.querySelector('.whisper')!.hidden; i++) frame();
  expect(root.querySelector('.whisper')!.hidden).toBe(false);
  expect(root.querySelectorAll('.story-choice')).toHaveLength(3);
  expect(app.sim.events(0).some(e => e.kind === 'whisper')).toBe(false);
  // The listener walk temporarily resumes a paused village, then restores that pause.
  const arrivedTick = app.sim.tick; frame(); expect(app.sim.tick).toBe(arrivedTick);
  click(root.querySelector('.story-choice')!);
  root.querySelector('.whisper-form')!.dispatchEvent(new Event('submit', { cancelable: true }));
  expect(root.querySelector('.whisper')!.hidden).toBe(true);
  expect(root.querySelector('.story')!.hidden).toBe(false);
  const reply = app.sim.events(0).filter(e => e.kind === 'line' && e.act === 'reactToWhisper').at(-1)!;
  expect(root.querySelector('.recorded-reply')!.textContent).toContain(reply.kind === 'line' ? reply.text : 'missing reply');
  expect(root.querySelector('.rumor-waiting')!.textContent).toContain('Later tellings and replies appear here in Rumors');
  expect(root.querySelectorAll('button').find(button => button.textContent === 'Resume village')!.hidden).toBe(false);
  const pausedTick = app.sim.tick; frame(); frame(); expect(app.sim.tick).toBe(pausedTick);
  expect(root.querySelector('.now-bar')!.hidden).toBe(true);
  const canvas = root.querySelector('canvas')!;
  click(root.querySelector('.story')!.querySelector('.close')!);
  canvas.focus();
  click(root.querySelector('.follow-toggle')!); // Explicit Stop must persist through later whispers.
  expect(root.dataset.tracing).toBe('false');
  click(root.querySelector('.quick-whisper')!); click(root.querySelector('.walk-to')!);
  for (let i = 0; i < 500 && root.querySelector('.whisper')!.hidden; i++) frame();
  click(root.querySelector('.story-choice')!);
  root.querySelector('.whisper-form')!.dispatchEvent(new Event('submit', { cancelable: true }));
  expect(root.dataset.tracing).toBe('false');
  app.destroy();
});
