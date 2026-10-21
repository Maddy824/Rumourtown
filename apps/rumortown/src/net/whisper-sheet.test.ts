import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cast, castVersion } from '../content/cast/index.js';
import { createFakeSimulation } from '../sim/fake.js';
import { createWhisperSheet } from '../ui/whisper.js';
import { sheetDocument, TestElement } from '../ui/whisper-dom.fixture.js';
import type { Layers } from '../ui/layers.js';
import type { VillagerView } from '../sim/types.js';
import { loadTurnstile } from './turnstile.js';

vi.mock('./turnstile.js', () => ({ loadTurnstile: vi.fn() }));
vi.mock('../ui/faces.js', () => ({ faceImg: () => document.createElement('img') }));

const pause = () => new Promise(resolve => setTimeout(resolve, 0));
const person = (id: string, x: number): VillagerView => ({ id, name: id, pos: { x, y: 0 }, facing: 's', moving: false,
  activity: 'idle', tier: 'regular', look: cast[0]!.look, mood: 0 });
let client: ReturnType<typeof loadTurnstile>;
let fetcher: ReturnType<typeof vi.fn<typeof fetch>>;
beforeEach(() => {
  vi.stubGlobal('document', sheetDocument());
  vi.stubEnv('VITE_API_BASE_URL', 'https://sheet-18.invalid');
  vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'site-key');
  client = { warm: vi.fn(async () => {}), getToken: vi.fn(async () => 'token'), render: vi.fn(), destroy: vi.fn() };
  vi.mocked(loadTurnstile).mockReturnValue(client);
  fetcher = vi.fn<typeof fetch>(async input => String(input).endsWith('/pubkey') ? Response.json({}, { status: 503 })
    : Response.json({ unsupported: 'unclear', castVersion, issuedAt: 1 }));
  vi.stubGlobal('fetch', fetcher);
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

function sheet(phone = false, reachable = true) {
  const sim = createFakeSimulation(731);
  const snap = sim.snapshot();
  snap.player.pos = { x: 0, y: 0 };
  snap.villagers = [person('mira', reachable ? 1 : 10), person('tom', reachable ? 2 : 11)];
  const ui = createWhisperSheet({ sim: () => sim, snapshot: () => snap, isPhone: () => phone, reducedMotion: () => true,
    layers: { open() {}, closed() {} } as unknown as Layers, whisper: () => true, walkTo() {}, onOpenChange() {} });
  ui.open({ listener: 'mira' });
  const root = ui.el as unknown as TestElement;
  const typed = root.querySelector('textarea');
  const write = (text: string) => { typed!.value = text; typed!.dispatchEvent(new Event('input')); };
  const submit = () => root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
  const feedback = () => root.querySelector('.whisper-feedback')!.textContent;
  const retry = () => root.querySelectorAll('button').find(button => button.textContent === 'Try again')!;
  return { ui, root, typed, write, submit, feedback, retry };
}

describe('whisper sheet timing and writing', () => {
  it('warms on open before typing, puts writing under the listener, and focuses it on desktop', () => {
    const focus = vi.spyOn(TestElement.prototype, 'focus');
    const view = sheet();
    expect(client.warm).toHaveBeenCalled();
    expect(client.getToken).not.toHaveBeenCalled();
    expect(fetcher.mock.calls[0]?.[0]).toBe('https://sheet-18.invalid/pubkey');
    const children = view.root.querySelector('.whisper-content')!.children;
    expect(children[0]!.attrs.get('class')).toBe('whisper-who');
    expect(children[1]!.attrs.get('class')).toBe('own-claim');
    expect(view.root.querySelector('.nearby-people')).toBeNull();
    expect(focus.mock.instances.at(-1)).toBe(view.typed);
    const disclosure = view.root.querySelector('.authored-stories')! as TestElement & { open: boolean };
    expect(disclosure.querySelector('summary')!.textContent).toBe('Or choose a village story');
    expect(disclosure.open).toBe(true);
    view.write('Tom took bread.'); expect(disclosure.open).toBe(false);
    view.write(''); expect(disclosure.open).toBe(true);
    view.ui.destroy();
  });

  it('focuses a listener without opening the phone keyboard, and offers walking when nobody is in range', () => {
    const focus = vi.spyOn(TestElement.prototype, 'focus');
    const phone = sheet(true);
    expect(focus.mock.instances.at(-1)).toBe(phone.root.querySelector('.whisper-who input'));
    phone.ui.destroy();
    const far = sheet(true, false);
    expect(far.typed).toBeNull();
    expect(focus.mock.instances.at(-1)).toBe(far.root.querySelector('.walk-to'));
    far.ui.destroy();
  });

  it('shows checking, then asking only when the token arrives', async () => {
    let token!: (value: string) => void;
    let response!: (value: Response) => void;
    vi.mocked(client.getToken).mockImplementation(() => new Promise(resolve => { token = resolve; }));
    fetcher.mockImplementation(async input => String(input).endsWith('/pubkey') ? Response.json({}, { status: 503 })
      : new Promise(resolve => { response = resolve; }));
    const view = sheet(); view.write('Tom took bread.'); view.submit();
    await pause(); expect(view.feedback()).toBe("Checking you're human…");
    const status = view.root.querySelector('.whisper-feedback')!;
    const style = status.attrs.get('style');
    token('ready'); await pause(); expect(view.feedback()).toBe('Asking the village…');
    expect(view.root.querySelector('.whisper-feedback')).toBe(status);
    expect(status.attrs.get('style')).toBe(style);
    response(Response.json({ unsupported: 'unclear', castVersion, issuedAt: 1 }));
    await pause(); expect(view.feedback()).toBe("I couldn't match that rumor reliably. Nothing was sent. Edit it or choose a village story.");
    view.ui.destroy();
  });

  it('shows a local confirmation immediately, reserves status space and lets the player change it', async () => {
    const focus = vi.spyOn(TestElement.prototype, 'focus');
    const view = sheet(); view.write('Tom stole bread.'); view.submit();
    await pause();
    expect(view.feedback()).toBe('Understood locally');
    const feedback = view.root.querySelector('.whisper-feedback')!;
    expect(feedback.attrs.get('role')).toBe('status');
    expect(feedback.attrs.get('style')).toContain('min-height: 2lh');
    expect(feedback.attrs.get('style')).toContain('display: block');
    expect(feedback.attrs.get('style')).toContain('flex: 1 1 0');
    expect(client.getToken).not.toHaveBeenCalled();
    expect(fetcher.mock.calls.filter(([input]) => String(input).endsWith('/interpret'))).toHaveLength(0);
    const confirmation = view.root.querySelector('.whisper-confirmation')!;
    expect(confirmation.hidden).toBe(false);
    expect(confirmation.textContent).toContain('Mira will hear: Tom stole bread');
    expect(focus.mock.instances.at(-1)).toBe(view.root.querySelectorAll('button').find(b => b.textContent === 'Whisper it'));
    const style = feedback.attrs.get('style');
    confirmation.querySelector('button')!.dispatchEvent(new Event('click'));
    expect(view.root.querySelector('.story-meaning')!.hidden).toBe(false);
    expect(view.root.querySelector('.story-meaning')!.querySelectorAll<TestElement>('select').map(s => s.value)).toEqual(['tom', 'theft', '2']);
    expect(feedback.attrs.get('style')).toBe(style);
    expect(focus.mock.instances.at(-1)).toBe(view.root.querySelector('select'));
    view.ui.destroy();
  });

  it('offers a human-check retry that warms the widget and reaches fetch', async () => {
    vi.mocked(client.getToken).mockRejectedValueOnce('turnstile').mockResolvedValueOnce('retry-token');
    const view = sheet(); view.write('Tom took bread.'); view.submit(); await pause();
    expect(view.feedback()).toBe("Couldn't check you're human. Try again.");
    expect(view.retry().hidden).toBe(false);
    const warmedBeforeRetry = vi.mocked(client.warm).mock.calls.length;
    view.retry().dispatchEvent(new Event('click')); await pause();
    expect(vi.mocked(client.warm).mock.calls.length).toBeGreaterThan(warmedBeforeRetry);
    expect(client.getToken).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls.filter(([input]) => String(input).endsWith('/interpret'))).toHaveLength(1);
    expect(view.feedback()).toBe("I couldn't match that rumor reliably. Nothing was sent. Edit it or choose a village story.");
    view.ui.destroy();
  });

  it('shows the timeout line and retries interpretation rather than switching to manual sending', async () => {
    vi.useFakeTimers();
    fetcher.mockImplementation(async input => String(input).endsWith('/pubkey') ? Response.json({}, { status: 503 })
      : new Promise(() => undefined));
    const view = sheet(); view.write('Tom took bread.'); view.submit();
    await vi.advanceTimersByTimeAsync(6_000);
    expect(view.feedback()).toBe('The village took too long. Try again.');
    expect(view.retry().hidden).toBe(false);
    view.retry().dispatchEvent(new Event('click'));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher.mock.calls.filter(([input]) => String(input).endsWith('/interpret'))).toHaveLength(2);
    view.ui.destroy();
    await vi.advanceTimersByTimeAsync(6_000);
  });
});
