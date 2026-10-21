import { describe, expect, it } from 'vitest';
import { neutralMeaning } from '../../../shared/open-rumor.js';
import { cast, claims } from '../content/cast/index.js';
import { villageMap } from '../content/map/index.js';
import { createSimulation } from './engine.js';
import { createOpenClaim, readRegisteredClaim } from './registered-claim.js';
import { createTalk } from './talk/index.js';
import { createMover, createWorld } from './world/index.js';
import { decodeShare, encodeShare } from '../ui/share-link.js';
import { shareCardData } from '../ui/share.js';
const castMap = new Map(cast.map(d => [d.id, d]));
const meaning = { actor: null, affected: 'tom', valence: 0, severity: 3, question: 'Who saw what happened to Tom?' } as const;
const story = createOpenClaim('someone killed tom', meaning, castMap);
const make = () => createSimulation({ seed: 731, cast, claims, world: { ...createWorld(villageMap), createMover }, talk: createTalk(cast),
  interventions: [{ tick: 0, listener: 'mira', claimId: story.id }] });
describe('open rumor simulation', { timeout: 30000 }, () => {
  it('round trips exact words and unknown actors without a fabricated category or culprit', () => {
    expect(story).toMatchObject({ about: 'village', target: 'tom', valence: 0, kind: 'story', text: 'someone killed tom' });
    expect(readRegisteredClaim(story.id, castMap)).toEqual(story);
    expect(readRegisteredClaim(story.id + 'a', castMap)).toBeNull();
    expect(() => createOpenClaim('someone killed tom', { ...meaning, actor: 'tom', valence: -1 }, castMap)).toThrow();
    expect(() => createOpenClaim('anything', { ...neutralMeaning(), severity: 99 as 1 }, castMap)).toThrow();
  });
  it('replays open stories deterministically, spreads hearsay, and never kills or blames the victim', () => {
    const state = decodeShare(encodeShare({ v: 1, seed: 731, cast: 'v4', interventions: [{ tick: 0, listener: 'mira', claimId: story.id }] }))!;
    expect(state.interventions[0]!.claimId).toBe(story.id);
    const a = make(), b = make();
    for (let i = 0; i < 720; i++) { a.step(); b.step(); }
    expect(a.events(0)).toEqual(b.events(0));
    expect(a.claims.get(story.id)).toEqual(story);
    expect(a.snapshot().villagers.find(v => v.id === 'tom')).toBeDefined();
    const events = a.events(0).filter(e => 'claimId' in e && e.claimId === story.id);
    expect(events.some(e => e.kind === 'belief' && e.source !== 'stranger')).toBe(true);
    expect(events.some(e => e.kind === 'belief' && e.source === 'self')).toBe(false);
    expect(events.some(e => e.kind === 'line' && e.act === 'accuse')).toBe(false);
    const lines = events.filter(e => e.kind === 'line');
    expect(lines.some(e => e.text.includes(story.text))).toBe(true);
    expect(lines.every(e => e.text.length <= 139)).toBe(true);
    const card = shareCardData(a, a.snapshot(), villageMap, a.interventions());
    expect(card.faces.every(f => f.name !== 'village')).toBe(true);
  });
  it.each(['The moon is made of cheese', 'The river can remember every secret', 'A distant city elected a robot mayor'])('accepts novel world stories locally: %s', text => {
    const claim = createOpenClaim(text, neutralMeaning(), castMap);
    const sim = make(); sim.registerClaim(claim);
    expect(sim.claims.get(claim.id)?.text).toBe(text);
    expect(readRegisteredClaim(claim.id, castMap)).toEqual(claim);
  });
});

it.each(['Tom said f.u.c.k', 'Tom said F U C K', 'Tom said n i g g e r', 'Tom,sex', 'porn,Tom', 'Tom said f\u200bu\u200bc\u200bk'])('rejects blocked canonical stories and malicious replay payloads: %s', text => {
  expect(() => createOpenClaim(text, neutralMeaning(), castMap)).toThrow();
  const data = [text, null, null, 0, 2, ''];
  const id = 'story_' + btoa(Array.from(new TextEncoder().encode(JSON.stringify(data)), b => String.fromCharCode(b)).join(''))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  expect(readRegisteredClaim(id, castMap)).toBeNull();
  const sim = createSimulation({ seed: 731, cast, claims, world: { ...createWorld(villageMap), createMover }, talk: createTalk(cast),
    interventions: [{ tick: 0, listener: 'mira', claimId: id }] });
  expect(sim.interventions()).toEqual([]);
  expect(sim.claims.has(id)).toBe(false);
  expect(sim.events(0).some(e => 'claimId' in e && e.claimId === id)).toBe(false);
});

it('rejects blocked questions injected through model output or an offline replay', () => {
  const question = 'porn,Tom?';
  expect(() => createOpenClaim('someone killed tom', { ...meaning, question }, castMap)).toThrow();
  const data = ['someone killed tom', null, 'tom', 0, 3, question];
  const id = 'story_' + btoa(JSON.stringify(data)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  expect(readRegisteredClaim(id, castMap)).toBeNull();
  const sim = createSimulation({ seed: 731, cast, claims, world: { ...createWorld(villageMap), createMover }, talk: createTalk(cast),
    interventions: [{ tick: 0, listener: 'mira', claimId: id }] });
  expect(sim.claims.has(id)).toBe(false);
  expect(sim.interventions()).toEqual([]);
});
