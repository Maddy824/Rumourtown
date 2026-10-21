import { expect, it } from 'vitest';
import { cast } from '../content/cast/index.js';
import type { VillagerView, WorldSnapshot } from '../sim/types.js';
import { inReach, nearbyPeople } from './whisper.js';
const person = (id: string, x: number): VillagerView => ({ id, name: id, pos: { x, y: 0 }, facing: 's', moving: false, activity: 'idle', tier: 'regular', look: cast[0]!.look, mood: 0 });
it('orders people within six tiles by distance with a stable id tie break', () => {
  const villagers = [person('far', 6.01), person('zoe', 4), person('ada', -4), person('ben', 2), person('edge', 6)];
  const snap: WorldSnapshot = { tick: 0, dayIndex: 0, minuteOfDay: 420, villagers, player: { pos: { x: 0, y: 0 }, facing: 's', moving: false }, threads: [] };
  expect(nearbyPeople(snap).map(v => v.id)).toEqual(['ben', 'ada', 'zoe', 'edge']);
  expect(inReach(snap).map(v => v.id)).toEqual(['ben']);
  expect(snap.villagers).toBe(villagers); expect(villagers[0]!.id).toBe('far');
});

// These exercise the actual form and registration path without a DOM dependency.
import { afterEach, describe, vi } from 'vitest';
import { castVersion } from '../content/cast/index.js';
import { villageMap } from '../content/map/index.js';
import { createFakeSimulation } from '../sim/fake.js';
import { exportRun } from '../research/model.js';
import type { InterpretResult } from '../net/types.js';
import { loadTurnstile } from '../net/turnstile.js';
import { createWhisperFlow } from '../net/whisperFlow.js';
import type { Layers } from './layers.js';
import { createWhisperSheet } from './whisper.js';
import { decodeShare, encodeShare } from './share-link.js';
import { sheetDocument, TestElement } from './whisper-dom.fixture.js';

vi.mock('../net/turnstile.js', () => ({ loadTurnstile: vi.fn(() => ({
  getToken: vi.fn(async () => 'test-token'), warm: vi.fn(async () => {}), render: vi.fn(), destroy: vi.fn(),
})) }));
vi.mock('./faces.js', () => ({ faceImg: () => document.createElement('img') }));

const privateText = 'My private sentence about a honey stash';
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function sheet(result?: InterpretResult) {
  vi.stubGlobal('document', sheetDocument());
  vi.stubEnv('VITE_API_BASE_URL', ''); vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '');
  const sim = createFakeSimulation(731);
  const snapshot = sim.snapshot();
  snapshot.player.pos = { x: 0, y: 0 };
  snapshot.villagers = [person('mira', 1), person('tom', 2)];
  const whispered: string[] = [];
  const line = result?.ok ? 'Say it plainer.' : "The town's gossip is resting. Try a ready-made rumor.";
  const start = vi.fn(async () => result!);
  const flow = result ? { start, state: result.ok && 'claim' in result
    ? { status: 'done' as const, result } : { status: 'resting' as const, result: result as Exclude<InterpretResult, { claim: unknown }>, line } } : undefined;
  const sheet = createWhisperSheet({ sim: () => sim, snapshot: () => snapshot, isPhone: () => false, reducedMotion: () => true,
    flow, layers: { open() {}, closed() {} } as unknown as Layers,
    whisper: (_listener, claimId) => { whispered.push(claimId); return true; }, walkTo() {}, onOpenChange() {} });
  sheet.open({ listener: 'mira' });
  const root = sheet.el as unknown as TestElement;
  const typed = root.querySelector('textarea')!;
  typed.value = privateText; typed.dispatchEvent(new Event('input'));
  return { sheet, sim, root, whispered, start, submit: async () => {
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await new Promise(resolve => setTimeout(resolve, 0));
  } };
}
const verified = { ok: true, claim: { kind: 'theft', about: 'tom', object: 'bread', severity: 3, valence: -1, confidence: .9 }, castVersion, issuedAt: 1, sig: 'already-verified-by-flow' } as const;

describe('whisper confirmation and privacy', () => {
  it('confirms a verified claim before registering and whispering it', async () => {
    const ui = sheet(verified);
    await ui.submit();
    const card = ui.root.querySelector('.whisper-confirmation')!;
    expect(card.hidden).toBe(false);
    expect(card.textContent).toContain('Mira will hear: Tom stole bread');
    expect(ui.root.querySelector('form')!.textContent).toContain('Whisper it');
    expect(ui.whispered).toEqual([]);
    expect(ui.sim.claims.has('typed_theft_tom_none_bread_3')).toBe(false);
    await ui.submit();
    expect(ui.whispered).toEqual(['typed_theft_tom_none_bread_3']);
    expect(ui.start).toHaveBeenCalledTimes(1);
    expect(ui.sim.claims.get(ui.whispered[0]!)?.text).toBe('Tom stole bread');
  });
  it('prefills the manual selects when the player changes the interpretation', async () => {
    const ui = sheet(verified); await ui.submit();
    ui.root.querySelector('.whisper-confirmation')!.querySelector('button')!.dispatchEvent(new Event('click'));
    expect(ui.root.querySelector('.story-meaning')!.hidden).toBe(false);
    expect(ui.root.querySelectorAll<TestElement>('select').map(s => s.value)).toEqual(['tom', 'theft', '3']);
    await ui.submit();
    expect(ui.start).toHaveBeenCalledTimes(1);
    expect(ui.whispered[0]).toBe('typed_theft_tom_none_none_3');
  });
  it.each([
    [{ ok: true, unsupported: 'unclear' }, 'Say it plainer.'],
    [{ ok: false, reason: 'budget' }, "The town's gossip is resting. Try a ready-made rumor."],
  ] as const)('keeps manual choices available for %o', async (result, line) => {
    const ui = sheet(result); await ui.submit();
    expect(ui.root.querySelector('.whisper-feedback')!.textContent).toBe(line);
    expect(ui.root.querySelector('.story-meaning')!.hidden).toBe(false);
    expect(ui.root.querySelector('.whisper-confirmation')!.hidden).toBe(true);
    await ui.submit();
    expect(ui.whispered).toHaveLength(1);
    expect(ui.start).toHaveBeenCalledTimes(1);
  });
  it('keeps local categorisation usable without settings and leaves no prose in a share or research export', async () => {
    const ui = sheet();
    expect(ui.root.querySelector('.story-meaning')!.hidden).toBe(false);
    expect(ui.root.textContent).toContain('Your words are only read to understand the rumor; the village repeats the rumor, not your words.');
    await ui.submit();
    const encoded = encodeShare({ v: 1, seed: 731, cast: castVersion,
      interventions: [{ tick: 0, listener: 'mira', claimId: ui.whispered[0]! }] });
    const decoded = decodeShare(encoded)!;
    expect(JSON.stringify(decoded)).not.toContain(privateText);
    expect(ui.whispered[0]).toMatch(/^typed_/);
    expect(JSON.stringify([...ui.sim.claims.values()])).not.toContain(privateText);
    expect(JSON.stringify(exportRun(ui.sim, 731, castVersion, villageMap))).not.toContain(privateText);
  });
  it('drops an in-flight result when the sheet is closed', async () => {
    let complete!: (result: InterpretResult) => void;
    const ui = sheet(verified);
    ui.start.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    await ui.submit();
    expect(ui.root.querySelector('.whisper-feedback')!.textContent).toBe("Checking you're human…");
    ui.sheet.close(); complete(verified);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(ui.whispered).toEqual([]);
    expect(ui.sim.claims.has('typed_theft_tom_none_bread_3')).toBe(false);
    expect(ui.sheet.isOpen()).toBe(false);
    expect(ui.root.querySelector('.whisper-confirmation')!.hidden).toBe(true);
  });
  it('uses a fresh Turnstile container when a configured sheet is reopened', async () => {
    const ui = sheet(); ui.sheet.destroy();
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.test');
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'public-site-key');
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ reason: 'model' }, { status: 503 })));
    vi.mocked(loadTurnstile).mockClear();
    const snapshot = ui.sim.snapshot(); snapshot.player.pos = { x: 0, y: 0 }; snapshot.villagers = [person('mira', 1)];
    const configured = createWhisperSheet({ sim: () => ui.sim, snapshot: () => snapshot, isPhone: () => false, reducedMotion: () => true,
      layers: { open() {}, closed() {} } as unknown as Layers, whisper: () => true, walkTo() {}, onOpenChange() {} });
    const root = configured.el as unknown as TestElement;
    for (let attempt = 0; attempt < 2; attempt++) {
      configured.open();
      const typed = root.querySelector('textarea')!;
      typed.value = privateText; typed.dispatchEvent(new Event('input'));
      root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(vi.mocked(loadTurnstile).mock.calls[attempt]?.[1]).toBe(root.querySelector('.whisper-challenge'));
      configured.close();
      expect(vi.mocked(loadTurnstile).mock.results[attempt]?.value.destroy).toHaveBeenCalledTimes(1);
    }
    expect(loadTurnstile).toHaveBeenCalledTimes(2);
  });
  it('bounds the human check to twelve seconds first and six seconds afterward', async () => {
    vi.useFakeTimers();
    try {
      const fetcher = vi.fn();
      const flow = createWhisperFlow({ baseUrl: 'https://api.test', castVersion,
        turnstile: { getToken: () => new Promise(() => {}) }, fetch: fetcher });
      const pending = flow.start(privateText);
      await vi.advanceTimersByTimeAsync(11_999);
      expect(flow.state.status).toBe('checking');
      await vi.advanceTimersByTimeAsync(1);
      expect(await pending).toEqual({ ok: false, reason: 'turnstile' });
      expect(flow.state).toMatchObject({ status: 'resting', line: "Couldn't check you're human. Try again." });

      const retry = flow.start(privateText);
      await vi.advanceTimersByTimeAsync(5_999);
      expect(flow.state.status).toBe('checking');
      await vi.advanceTimersByTimeAsync(1);
      expect(await retry).toEqual({ ok: false, reason: 'turnstile' });
      expect(fetcher).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });
});

it('shows an in-range sleeping resident as Asleep with no listener radio', () => {
  vi.stubGlobal('document', sheetDocument());
  vi.stubGlobal('window', { setTimeout, clearTimeout, matchMedia: () => ({ matches: true }) });
  const sim = createFakeSimulation(731), snapshot = sim.snapshot();
  snapshot.villagers = [{ ...person('mira', 1), activity: 'sleep' }];
  snapshot.player.pos = { x: 0, y: 0 };
  const whisper = createWhisperSheet({ sim: () => sim, snapshot: () => snapshot,
    isPhone: () => true, reducedMotion: () => true, layers: { open() {}, closed() {} } as unknown as Layers,
    whisper: () => false, walkTo() {}, onOpenChange() {} });
  whisper.open({ listener: 'mira' });
  const root = whisper.el as unknown as TestElement;
  expect(root.querySelector('.walk-to')!.textContent).toBe('Asleep');
  expect(root.querySelector('.walk-to')!.disabled).toBe(true);
  expect(root.querySelectorAll('input')).toHaveLength(0);
  expect(root.querySelectorAll('button').find(b => b.attrs.get('type') === 'submit')!.disabled).toBe(true);
  whisper.destroy();
});
