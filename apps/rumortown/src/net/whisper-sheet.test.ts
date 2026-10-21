import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cast } from '../content/cast/index.js';
import { createFakeSimulation } from '../sim/fake.js';
import { createWhisperSheet } from '../ui/whisper.js';
import { sheetDocument, TestElement } from '../ui/whisper-dom.fixture.js';
import type { Layers } from '../ui/layers.js';
import { loadTurnstile } from './turnstile.js';
vi.mock('./turnstile.js', () => ({ loadTurnstile: vi.fn() }));
vi.mock('../ui/faces.js', () => ({ faceImg: () => document.createElement('img') }));
let client: ReturnType<typeof loadTurnstile>;
beforeEach(() => {
  vi.stubGlobal('document', sheetDocument());
  vi.stubEnv('VITE_API_BASE_URL', 'https://test.invalid'); vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'test');
  client = { warm: vi.fn(async () => {}), getToken: vi.fn(async () => 'token'), render: vi.fn(), destroy: vi.fn() };
  vi.mocked(loadTurnstile).mockReturnValue(client);
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ reason: 'budget' }, { status: 503 })));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function sheet(phone = false, sleeping = false) {
  const sim = createFakeSimulation(731), snapshot = sim.snapshot(); snapshot.player.pos = { x: 0, y: 0 };
  snapshot.villagers = [{ id: 'mira', name: 'Mira', pos: { x: 1, y: 0 }, facing: 's', moving: false, activity: sleeping ? 'sleep' : 'idle', tier: 'regular', look: cast[0]!.look, mood: 0 }];
  const ui = createWhisperSheet({ sim: () => sim, snapshot: () => snapshot, isPhone: () => phone, reducedMotion: () => true,
    layers: { open() {}, closed() {} } as unknown as Layers, whisper: () => true, walkTo() {}, onOpenChange() {} });
  ui.open(); const root = ui.el as unknown as TestElement;
  return { ui, root, async submit(text: string) {
    const input = root.querySelector('textarea')!; input.value = text; input.dispatchEvent(new Event('input'));
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await new Promise(resolve => setTimeout(resolve, 0));
  } };
}
it('uses semantic inference even for familiar events without rewriting the words', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ actor: 'tom', affected: null, valence: -1, severity: 2, question: 'Did anyone see Tom?' })));
  const view = sheet(); await view.submit('Tom stole bread behind the mill');
  expect(client.getToken).toHaveBeenCalledOnce();
  expect(view.root.querySelector('.whisper-confirmation')!.textContent).toContain('Tom stole bread behind the mill');
  expect(view.root.querySelector('.whisper-feedback')!.textContent).toContain('AI helped understand this story');
});
it('keeps an open story usable after shared budget exhaustion', async () => {
  const view = sheet(); await view.submit('someone killed tom');
  expect(client.getToken).toHaveBeenCalledOnce();
  expect(view.root.querySelector('.whisper-confirmation')!.textContent).toContain('someone killed tom');
  expect(view.root.querySelector('.whisper-feedback')!.textContent).toContain('Your story still works');
});
it('warms a fresh widget on reopen and focuses the listener on phone without opening the keyboard', () => {
  const focus = vi.spyOn(TestElement.prototype, 'focus');
  const view = sheet(true);
  expect(focus.mock.instances.at(-1)).toBe(view.root.querySelector('.whisper-who input'));
  expect(client.warm).toHaveBeenCalled(); view.ui.close(); expect(client.destroy).toHaveBeenCalled();
  view.ui.open(); expect(vi.mocked(loadTurnstile).mock.calls.at(-1)?.[1]).toBe(view.root.querySelector('.whisper-challenge'));
  focus.mockRestore();
});
it('explains when everyone is asleep without offering an unreachable listener', () => {
  const view = sheet(true, true);
  expect(view.root.querySelector('textarea')).toBeNull();
  expect(view.root.querySelector('.walk-to')).toBeNull();
  expect(view.root.textContent).toContain('The village is asleep. Try again in the morning.');
});
