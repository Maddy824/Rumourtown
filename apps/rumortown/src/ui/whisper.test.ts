import { exportRun } from '../research/model.js';
import { villageMap } from '../content/map/index.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { neutralMeaning } from '../../../shared/open-rumor.js';
import { cast, castVersion } from '../content/cast/index.js';
import type { RumorResult } from '../net/rumorFlow.js';
import { createFakeSimulation } from '../sim/fake.js';
import type { VillagerView, WorldSnapshot } from '../sim/types.js';
import type { Layers } from './layers.js';
import { createWhisperSheet, inReach, nearbyPeople } from './whisper.js';
import { sheetDocument, TestElement } from './whisper-dom.fixture.js';
import { decodeShare, encodeShare } from './share-link.js';
vi.mock('./faces.js', () => ({ faceImg: () => document.createElement('img') }));
const person = (id: string, x: number): VillagerView => ({ id, name: id, pos: { x, y: 0 }, facing: 's', moving: false, activity: 'idle', tier: 'regular', look: cast[0]!.look, mood: 0 });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const interpreted: RumorResult = { source: 'ai', note: 'AI helped understand this story.',
  meaning: { actor: null, affected: 'tom', valence: 0, severity: 3, question: 'Who last saw Tom alive?' } };
function sheet(result: RumorResult = interpreted) {
  vi.stubGlobal('document', sheetDocument());
  vi.stubEnv('VITE_API_BASE_URL', ''); vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '');
  const sim = createFakeSimulation(731), snapshot = sim.snapshot();
  snapshot.player.pos = { x: 0, y: 0 }; snapshot.villagers = [person('mira', 1), person('tom', 2)];
  const whispered: string[] = [];
  const start = vi.fn(async () => result);
  const ui = createWhisperSheet({ sim: () => sim, snapshot: () => snapshot, isPhone: () => false, reducedMotion: () => true,
    flow: { start }, layers: { open() {}, closed() {} } as unknown as Layers,
    whisper: (_listener, id) => { whispered.push(id); return true; }, walkTo() {}, onOpenChange() {} });
  ui.open({ listener: 'mira' });
  const root = ui.el as unknown as TestElement;
  const write = (text: string) => { root.querySelector('textarea')!.value = text; root.querySelector('textarea')!.dispatchEvent(new Event('input')); };
  write('someone killed tom');
  return { ui, sim, root, start, whispered, write, submit: async () => {
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await new Promise(resolve => setTimeout(resolve, 0));
  } };
}
it('orders nearby listeners by distance and excludes sleeping people', () => {
  const snap = { player: { pos: { x: 0, y: 0 } }, villagers: [person('far', 7), person('tom', 2), { ...person('mira', 1), activity: 'sleep' }] } as WorldSnapshot;
  expect(nearbyPeople(snap).map(v => v.id)).toEqual(['mira', 'tom']);
  expect(inReach(snap).map(v => v.id)).toEqual(['tom']);
});
it('lists awake people beyond nearby sleepers in the night empty state', () => {
  vi.stubGlobal('document', sheetDocument());
  const sim = createFakeSimulation(731), snapshot = sim.snapshot(), walkTo = vi.fn();
  snapshot.minuteOfDay = 1380; snapshot.player.pos = { x: 0, y: 0 };
  snapshot.villagers = [{ ...person('mira', 1), activity: 'sleep' }, person('rosa', 30)];
  const ui = createWhisperSheet({ sim: () => sim, snapshot: () => snapshot, isPhone: () => true, reducedMotion: () => true,
    flow: { start: vi.fn() }, layers: { open() {}, closed() {} } as unknown as Layers,
    whisper: () => false, walkTo, onOpenChange() {} });
  ui.open();
  const root = ui.el as unknown as TestElement;
  expect(root.textContent).toContain('Most people are asleep. These people are awake.');
  const walks = root.querySelectorAll('.walk-to'); expect(walks).toHaveLength(1);
  walks[0]!.dispatchEvent(new Event('click')); expect(walkTo).toHaveBeenCalledWith('rosa');
});
describe('open story confirmation', () => {
  it('preserves the exact claim, discloses sharing, and registers only after confirmation', async () => {
    const view = sheet(); await view.submit();
    expect(view.root.querySelector('.whisper-confirmation')!.textContent).toContain('will hear exactly: “someone killed tom”');
    expect(view.root.querySelector('.whisper-confirmation')!.textContent).toContain('Actor: Unknown or not stated. Affected: Tom');
    expect(view.root.querySelector('.whisper-confirmation')!.textContent).toContain('research exports and shared replay links');
    expect(view.whispered).toHaveLength(0);
    expect([...view.sim.claims.values()].some(c => c.kind === 'story')).toBe(false);
    await view.submit();
    const claim = view.sim.claims.get(view.whispered[0]!)!;
    expect(claim).toMatchObject({ text: 'someone killed tom', about: 'village', target: 'tom', valence: 0, kind: 'story' });
    const shared = decodeShare(encodeShare({ v: 1, seed: 731, cast: castVersion, interventions: [{ tick: 0, listener: 'mira', claimId: claim.id }] }));
    expect(shared?.interventions[0]?.claimId).toBe(claim.id);
    expect(view.start).toHaveBeenCalledTimes(1);
  });
  it('can remove uncertain assignments without changing the story or making another request', async () => {
    const view = sheet(); await view.submit();
    view.root.querySelectorAll('button').find(b => b.textContent === 'Leave people unassigned')!.dispatchEvent(new Event('click'));
    await view.submit();
    expect(view.sim.claims.get(view.whispered[0]!)?.meaning).toEqual(neutralMeaning());
    expect(view.start).toHaveBeenCalledTimes(1);
  });
  it('shows reputation and importance before accepting an AI interpretation and lets the player reset them', async () => {
    const view = sheet({ source: 'ai', meaning: { actor: 'tom', affected: null, valence: -1, severity: 3, question: '' }, note: 'AI' });
    view.write('Tom invented a machine'); await view.submit();
    const preview = view.root.querySelector('.whisper-confirmation')!;
    expect(preview.textContent).toContain('May harm Tom’s reputation. Importance: very serious.');
    expect(view.whispered).toHaveLength(0);
    view.root.querySelectorAll('button').find(b => b.textContent === 'Leave people unassigned')!.dispatchEvent(new Event('click'));
    expect(preview.textContent).toContain('No reputation judgment. Importance: serious.');
    await view.submit();
    expect(view.sim.claims.get(view.whispered[0]!)?.valence).toBe(0);
  });
  it('invalidates the preview on text edits and never whispers stale text', async () => {
    const view = sheet({ source: 'neutral', meaning: neutralMeaning(), note: 'No AI' });
    await view.submit(); view.write('The moon is made of cheese');
    await view.submit(); expect(view.whispered).toHaveLength(0);
    await view.submit(); expect(view.sim.claims.get(view.whispered[0]!)?.text).toBe('The moon is made of cheese');
  });
  it('lets the player continue locally while inference is pending and ignores the late reply', async () => {
    const view = sheet(); let complete!: (r: RumorResult) => void;
    view.start.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    await view.submit();
    view.root.querySelectorAll('button').find(b => b.textContent === 'Continue without AI')!.dispatchEvent(new Event('click'));
    await view.submit(); expect(view.whispered).toHaveLength(1);
    complete(interpreted); await new Promise(resolve => setTimeout(resolve, 0));
    expect(view.sim.claims.get(view.whispered[0]!)?.meaning).toEqual(neutralMeaning());
  });
  it('drops an in-flight result on close', async () => {
    const view = sheet(); let complete!: (r: RumorResult) => void;
    view.start.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    await view.submit(); view.ui.close(); complete(interpreted);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(view.whispered).toHaveLength(0);
    expect(view.root.querySelector('.whisper-confirmation')!.hidden).toBe(true);
  });
  it('allows an explicit library choice to replace pending typed input without inference or mutation while browsing', async () => {
    const view = sheet(); const size = view.sim.claims.size;
    view.root.querySelector('.rumor-library-use')!.dispatchEvent(new Event('click'));
    expect(view.sim.claims.size).toBe(size); expect(view.root.querySelector('textarea')!.value).toBe('');
    await view.submit();
    expect(view.start).not.toHaveBeenCalled();
    expect(view.sim.claims.get(view.whispered[0]!)?.text).toBe('Tom leaves a blue ribbon on Rosa’s doorstep every evening');
  });
  it('prevents telling an accusation to its own actor and allows neutral correction', async () => {
    const view = sheet({ source: 'ai', meaning: { actor: 'tom', affected: 'mira', valence: -1, severity: 2, question: '' }, note: 'AI' });
    view.write('Tom stole from Mira');
    view.root.querySelectorAll<TestElement>('input').find(input => input.value === 'tom')!.dispatchEvent(new Event('change'));
    await view.submit(); await view.submit(); expect(view.whispered).toHaveLength(0);
    view.root.querySelectorAll('button').find(b => b.textContent === 'Leave people unassigned')!.dispatchEvent(new Event('click'));
    await view.submit(); expect(view.whispered).toHaveLength(1);
  });
});

it.each(['Tom said f.u.c.k', 'Tom said F U C K', 'Tom said s.e.x', 'Tom said n i g g e r'])('keeps a blocked draft local, out of inference, links and research: %s', async text => {
  const view = sheet(); view.write(text);
  await view.submit(); await view.submit();
  expect(view.start).not.toHaveBeenCalled();
  expect(view.whispered).toHaveLength(0);
  expect(view.root.querySelector('textarea')!.value).toBe(text);
  expect(view.root.querySelector('.whisper-feedback')!.textContent).toContain('stays on this device');
  expect([...view.sim.claims.values()].some(c => c.text === text)).toBe(false);
  const shared = decodeShare(encodeShare({ v: 1, seed: 731, cast: castVersion, interventions: view.sim.interventions() }))!;
  expect(shared.interventions).toEqual([]);
  expect(JSON.stringify(exportRun(view.sim, 731, castVersion, villageMap))).not.toContain(text);
  view.start.mockResolvedValue({ source: 'neutral', meaning: neutralMeaning(), note: 'No AI' });
  view.write('The moon is made of cheese');
  await view.submit(); await view.submit(); expect(view.whispered).toHaveLength(1);
});

it('shows three exact existing stories without opening a collection and sends only after an explicit submit', async () => {
  const view = sheet(); view.ui.close(); view.ui.open({ listener: 'mira' });
  const cards = view.root.querySelectorAll('.story-choice');
  expect(cards).toHaveLength(3);
  expect(cards.every(card => card.parent?.tagName !== 'details')).toBe(true);
  expect(view.root.querySelectorAll('summary').map(row => row.textContent)).toContain('Write my own');
  const text = cards[0]!.textContent;
  cards[0]!.dispatchEvent(new Event('click'));
  expect(view.start).not.toHaveBeenCalled(); expect(view.whispered).toEqual([]);
  expect(view.root.querySelector('.whisper-actions')!.querySelector('button')!.disabled).toBe(false);
  await view.submit();
  expect(view.sim.claims.get(view.whispered[0]!)?.text).toBe(text);
});
it('requires a new typed preview after changing the listener', async () => {
  const view = sheet({ source: 'neutral', meaning: neutralMeaning(), note: 'No AI' });
  await view.submit();
  view.root.querySelectorAll('input').find(input => input.value === 'tom')!.dispatchEvent(new Event('change'));
  expect(view.root.querySelector('.whisper-confirmation')!.hidden).toBe(true);
  await view.submit(); expect(view.whispered).toHaveLength(0);
  await view.submit(); expect(view.whispered).toHaveLength(1);
  expect(view.start).toHaveBeenCalledTimes(2);
});
it('requires confirmation after an inference failure and does not publish a fallback draft early', async () => {
  const view = sheet(); view.start.mockRejectedValue(new Error('offline'));
  await view.submit();
  expect(view.whispered).toEqual([]);
  expect(view.root.querySelector('.whisper-confirmation')!.hidden).toBe(false);
  expect(view.root.querySelector('.whisper-confirmation')!.textContent).toContain('research exports and shared replay links');
  await view.submit();
  expect(view.sim.claims.get(view.whispered[0]!)?.meaning).toEqual(neutralMeaning());
});
it('offers awake reachable listeners first, then opens cards only on arrival', () => {
  vi.stubGlobal('document', sheetDocument());
  const sim = createFakeSimulation(731), snap = sim.snapshot(), walkTo = vi.fn();
  snap.player.pos = { x: 0, y: 0 };
  snap.villagers = [person('mira', 1), { ...person('ben', 2), activity: 'sleep' }, person('tom', 3), person('rosa', 4)];
  const ui = createWhisperSheet({ sim: () => sim, snapshot: () => snap, isPhone: () => true, reducedMotion: () => true,
    layers: { open() {}, closed() {} } as unknown as Layers, flow: { start: vi.fn() },
    whisper: () => false, walkTo, reachable: id => id !== 'tom', onOpenChange() {} });
  ui.open(); const root = ui.el as unknown as TestElement;
  expect(root.querySelectorAll('.story-choice')).toHaveLength(0);
  expect(root.querySelectorAll('.walk-to').map(row => row.textContent)).toEqual(['Choose mira', 'Choose rosa']);
  root.querySelector('.walk-to')!.dispatchEvent(new Event('click'));
  expect(walkTo).toHaveBeenCalledWith('mira'); expect(ui.isOpen()).toBe(false);
  ui.open({ listener: 'mira' });
  expect(root.querySelectorAll('.story-choice')).toHaveLength(3);
});
it('never offers the selected listener a ready-made story about themselves', () => {
  const view = sheet(); view.ui.open({ listener: 'tom' });
  const cards = view.root.querySelectorAll('.story-choice');
  expect(cards).toHaveLength(3);
  for (const card of cards) expect(card.textContent).not.toMatch(/^Tom /);
});
