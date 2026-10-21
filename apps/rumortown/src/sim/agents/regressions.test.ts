import { BeliefLedger, DEFAULT_TUNING, Relationships, sigmoid } from 'rumormind';
import { describe, expect, it } from 'vitest';
import { cast as authoredCast, claims as authoredClaims } from '../../content/cast/index.js';
import { createSimulation } from '../engine.js';
import { createFakeCast, createFakeMap } from '../fake.js';
import { MINUTES_PER_DAY, type Ending, type GameClaim, type TalkApi } from '../types.js';
import { createWorld, createMover as worldMover } from '../world/index.js';
import type { AccusationRecord, Agent, Ctx, StrangerClaim } from './context.js';
import { joinConversation, startConversation, tickConversations } from './conversation.js';
import { judgeDay } from './endings.js';
import { exposeStranger } from './exposure.js';
import { correctBelief, hearFrom, hearFromStranger, seeClaim } from './hearing.js';
import { chainFor, inspectAgent } from './inspect.js';
import { MoodState } from './mood.js';
import { createMover } from './mover.js';
import { freshNeeds } from './needs.js';
import { beliefCollapsed, hasFirsthand, independentSources } from './provenance.js';
import { reflect, remember } from './reflection.js';
import { initRelationships } from './relations.js';
import { onArrived, updateSchedule } from './schedule.js';
import { takeSide } from './sideTaking.js';
import { accusationOpen, confrontReason, tellingFor } from './tellings.js';

const harmful: GameClaim = { id: 'stole', about: 'tom', kind: 'theft', valence: -1, severity: 2, target: 'mira', text: 'Tom stole bread', contradicts: ['truth'] };
const truth: GameClaim = { id: 'truth', about: 'tom', kind: 'kindness', valence: 1, severity: 1, text: 'Tom delivered bread to Ada', contradicts: ['stole'], alternativeOf: 'stole' };
const talk: TalkApi = { say: (key) => ({ text: key.act, lineId: `${key.act}:${key.speaker.id}` }), pickTopic: () => 'weather' };

/** Internal fixtures use only ledger entry points; no simulated belief is assigned by hand. */
function fixture(ids = ['mira', 'tom', 'ada', 'rosa', 'ben', 'jonah', 'elin', 'pim', 'sol', 'ivo'], claims = [harmful, truth]): Ctx {
  const rng = () => 0.99; // No chance joins or attribution: intentional conversations are controlled.
  const cast = ids.map((id) => createFakeCast(2).find((d) => d.id === id)!);
  const world = { ...createWorld(createFakeMap()), lineOfSight: () => true };
  const agents: Agent[] = cast.map((d, index) => ({
    index, d, mover: createMover({ x: 10.5 + index * 10, y: 10.5 }), ledger: new BeliefLedger(d.id, rng),
    needs: freshNeeds(), mood: new MoodState(), decisions: [], memories: [], opinions: [], lastTalk: new Map(),
    accusedToday: new Set(), reconciledWith: new Set(), whisperWitnessed: new Set(), witnessed: new Set(),
    activity: 'work', entryIndex: 0, goal: { kind: 'schedule', since: 0, place: 'square' }, spot: null,
    conversation: null, talkCooldownUntil: 1000, bubble: undefined,
  }));
  const ctx: Ctx = { rng, tuning: DEFAULT_TUNING, world, talk, claims: new Map(claims.map((c) => [c.id, c])), claimList: claims,
    castMap: new Map(cast.map((d) => [d.id, d])), agents, byId: new Map(agents.map((a) => [a.d.id, a])),
    rel: new Relationships(), relationWhy: new Map(), events: [], threads: [], conversations: [], publicResponses: [],
    transmissionChains: new WeakMap(), accusations: [], strangerClaims: [], player: { mover: createMover({ x: 5.5, y: 5.5 }) },
    tick: 0, nextConversationId: 1 };
  initRelationships(ctx);
  return ctx;
}
const agent = (ctx: Ctx, id: string): Agent => ctx.byId.get(id)!;
function introduce(ctx: Ctx, claim = harmful, ids = ['mira', 'ada']): StrangerClaim {
  const sc: StrangerClaim = { claimId: claim.id, firstTick: ctx.tick, firstListener: ids[0]!, heardBy: new Set(ids),
    backedAccuser: new Set(), backedAccused: new Set(), correctedFirsthand: new Set(), exposedVillagers: new Map(), trustLost: false };
  ctx.strangerClaims.push(sc);
  return sc;
}
function hear(ctx: Ctx, a: Agent, claim = harmful, source = 'stranger', repeats = 1): void {
  for (let i = 0; i < repeats; i++) a.ledger.hear(claim, ctx.claims, { source, strength: 1, trust: 1, tick: ctx.tick });
}
function accusation(overrides: Partial<AccusationRecord> = {}): AccusationRecord {
  return { claimId: harmful.id, accuser: 'mira', accused: 'tom', tick: 1, isPublic: true, audience: ['ada'], apologized: false, forgiven: false, accuserExposed: false, ...overrides };
}
function tick(ctx: Ctx, count = 1): void { for (let i = 0; i < count; i++) { ctx.tick++; tickConversations(ctx); } }
function confrontation(ctx: Ctx, publicAnswer: boolean, agreeable = 0.2) {
  const mira = agent(ctx, 'mira'), tom = agent(ctx, 'tom');
  tom.mover.pos = { x: 11.5, y: 10.5 };
  tom.d.traits.honesty = 1;
  tom.d.traits.agreeableness = agreeable;
  tom.ledger.see(truth, ctx.claims, 0);
  hear(ctx, mira, harmful, 'stranger', 3);
  if (publicAnswer) agent(ctx, 'ada').mover.pos = { x: 13.5, y: 10.5 };
  mira.goal = { kind: 'confront', target: 'tom', claimId: harmful.id, since: 0 };
  const conv = startConversation(ctx, mira, tom, true);
  tick(ctx, 2); // greet, accuse
  expect(ctx.events.filter((e) => e.kind === 'line').map((e) => e.act)).toEqual(['greet', 'accuse']);
  return conv;
}

describe('round 1 regressions', () => {
  it('ends each day after exactly 900 steps, with the completed index, and stops after the requested days', () => {
    const cast = createFakeCast(1).slice(0, 1);
    cast[0]!.schedule = [{ start: 0, place: 'square', activity: 'sleep' }];
    const sim = createSimulation({ seed: 1, cast, claims: [], world: createWorld(createFakeMap()), talk, days: 2 });
    for (let i = 0; i < MINUTES_PER_DAY - 1; i++) sim.step();
    expect(sim.tick).toBe(899);
    expect(sim.events(0).filter((e) => e.kind === 'day-end')).toEqual([]);
    sim.step();
    expect(sim.events(900).find((e) => e.kind === 'day-end')).toMatchObject({ tick: 900, dayIndex: 0 });
    for (let i = 0; i < MINUTES_PER_DAY; i++) sim.step();
    expect(sim.events(0).filter((e) => e.kind === 'day-end')).toEqual([
      expect.objectContaining({ tick: 900, dayIndex: 0 }), expect.objectContaining({ tick: 1800, dayIndex: 1 }),
    ]);
    sim.step();
    expect(sim.tick).toBe(1800);
    expect(sim.inspect(cast[0]!.id).decisions.some((d) => d.action === 'reflect')).toBe(true);
  });

  it('seeds participants as first-hand and other dossier knowledge as hearsay with the authored strength', () => {
    const sim = createSimulation({ seed: 1, cast: authoredCast, claims: authoredClaims, world: createWorld(createFakeMap()), talk });
    expect(sim.inspect('ada').beliefs.find((b) => b.claimId === 'tom-brought-bread-to-ada')!.chain).toEqual(['Ada saw it at 07:00']);
    expect(sim.inspect('rosa').beliefs.find((b) => b.claimId === 'jonah-rosa-planning-fair')!.chain).toEqual(['Rosa saw it at 07:00']);
    for (const [id, claimId, confidence] of [['nell', 'rosa-nursed-ada', 0.7], ['otto', 'dag-fills-poor-box', 0.7], ['jonah', 'pim-gave-flour-for-fair', 0.8]] as const) {
      const actual = sim.inspect(id).beliefs.find((b) => b.claimId === claimId)!;
      expect(actual.chain).toEqual([`Villager told ${sim.cast.get(id)!.name} at 07:00`]);
      expect(actual.confidence).toBeCloseTo(sigmoid(0.6 * confidence));
    }
  });

  it.each([
    { prior: 0.7, sources: 2, eligible: false },
    { prior: 0.8, sources: 1, eligible: false },
    { prior: 0.75, sources: 2, eligible: false },
    { prior: 0.8, sources: 2, eligible: true },
  ])('gates public backing at belief > 0.75 and two origins: $prior / $sources', ({ prior, sources, eligible }) => {
    const claim = { ...harmful, basePrior: prior };
    const ctx = fixture(undefined, [claim]);
    const b = agent(ctx, 'ada'), accuser = agent(ctx, 'mira'), accused = agent(ctx, 'tom');
    const ledger = new BeliefLedger(b.d.id, ctx.rng, { ...DEFAULT_TUNING, familiarityScale: 0 });
    const observer = { ...b, ledger };
    for (let i = 0; i < sources; i++) ledger.hear(claim, ctx.claims, { source: `origin-${i}`, strength: 0, trust: 0, tick: 0 });
    ctx.rel.setAffinity(b.d.id, eligible ? accused.d.id : accuser.d.id, 1);
    ctx.rel.setAffinity(eligible ? accused.d.id : accuser.d.id, b.d.id, 1);
    ctx.rel.setAffinity(b.d.id, eligible ? accuser.d.id : accused.d.id, -1);
    ctx.rel.setAffinity(eligible ? accuser.d.id : accused.d.id, b.d.id, -1);
    const side = takeSide(ctx, observer, accuser, accused, claim, true);
    expect(side.side === 'accuser').toBe(eligible);
    if (!eligible) expect(side.side).toBe('neutral');
    expect(side.why).toMatch(/Tom|Mira/);
  });

  it('uses loyalty only for defend versus doubt when evidence does not qualify', () => {
    const ctx = fixture(), b = agent(ctx, 'ada');
    ctx.rel.setAffinity('ada', 'tom', 1); ctx.rel.setAffinity('tom', 'ada', 1);
    ctx.rel.setAffinity('ada', 'mira', -1); ctx.rel.setAffinity('mira', 'ada', -1);
    expect(takeSide(ctx, b, agent(ctx, 'mira'), agent(ctx, 'tom'), harmful, true).side).toBe('accused');
  });

  it('does not confront solely through friendship with the subject, but a non-victim friend of the victim qualifies', () => {
    const ctx = fixture(), ada = agent(ctx, 'ada');
    hear(ctx, ada, harmful, 'stranger', 3);
    expect(independentSources(ada, harmful.id)).toBe(1);
    ctx.rel.setAffinity('ada', 'tom', 1); ctx.rel.setAffinity('tom', 'ada', 1);
    expect(confrontReason(ctx, ada, harmful)).toBeNull();
    ctx.rel.setAffinity('ada', 'mira', 1); ctx.rel.setAffinity('mira', 'ada', 1);
    expect(confrontReason(ctx, ada, harmful)?.text).toBe('Mira is a friend and was wronged');
    expect(confrontReason(ctx, agent(ctx, 'mira'), harmful)?.text).toContain('happened to');
    const rosa = agent(ctx, 'rosa'); hear(ctx, rosa); hear(ctx, rosa, harmful, 'independent');
    expect(confrontReason(ctx, rosa, harmful)?.text).toContain('2 people separately');
  });

  it('keeps the approved three-accusation daily cap and 120-tick cooldown', () => {
    const ctx = fixture(); ctx.accusations.push(accusation({ tick: 1 }));
    ctx.tick = 120; expect(accusationOpen(ctx, harmful.id, 'tom')).toBe(false);
    ctx.tick = 121; expect(accusationOpen(ctx, harmful.id, 'tom')).toBe(true);
    ctx.accusations.push(accusation({ tick: 121 }), accusation({ tick: 241 }));
    ctx.tick = 500; expect(accusationOpen(ctx, harmful.id, 'tom')).toBe(false);
    ctx.tick = 901; expect(accusationOpen(ctx, harmful.id, 'tom')).toBe(true);
  });

  it('an honest accused explains the innocent alternative only in private', () => {
    const ctx = fixture(['mira', 'tom']);
    confrontation(ctx, false);
    const mira = agent(ctx, 'mira'), before = mira.ledger.confidence(harmful.id);
    tick(ctx);
    expect(ctx.events.filter((e) => e.kind === 'line').at(-1)).toMatchObject({ act: 'explain', claimId: truth.id, speaker: 'tom' });
    expect(mira.ledger.confidence(harmful.id)).toBeLessThan(before);
    expect(mira.ledger.knows(truth.id)).toBe(true);
  });

  it('an honest public accused denies with a bare correction at each listener’s trust', () => {
    const ctx = fixture(); const conv = confrontation(ctx, true);
    const mira = agent(ctx, 'mira'), before = mira.ledger.beliefs.get(harmful.id)!.logOdds;
    const trust = ctx.rel.trust('mira', 'tom');
    expect(ctx.rel.affinity('tom', 'mira')).toBeCloseTo(0.2 - 0.3);
    expect(agent(ctx, 'tom').mood.list(ctx.tick)).toContainEqual({ label: 'accused in public', delta: -0.3, untilTick: ctx.tick + 300 });
    tick(ctx);
    expect(ctx.events.filter((e) => e.kind === 'line').at(-1)).toMatchObject({ act: 'deny', claimId: harmful.id, speaker: 'tom', listeners: expect.arrayContaining(['ada']) });
    expect(mira.ledger.confidence(harmful.id)).toBeCloseTo(sigmoid(before * (1 - 0.4 * trust)));
    expect(mira.ledger.knows(truth.id)).toBe(false);
    expect(conv.members).toEqual(['mira', 'tom']);
  });

  it('a public agreeable accused refuses and walks away', () => {
    const ctx = fixture(); const conv = confrontation(ctx, true, 0.9);
    tick(ctx);
    expect(ctx.events.filter((e) => e.kind === 'line').at(-1)).toMatchObject({ speaker: 'tom', act: 'refuse' });
    expect(conv.members).not.toContain('tom');
    expect(agent(ctx, 'tom').conversation).toBeNull();
    expect(agent(ctx, 'tom').mover.moving).toBe(true);
  });

  it('every hearer in a crowd takes a public side without joining the four-person conversation', () => {
    const ctx = fixture();
    for (const b of ctx.agents.slice(2)) { b.mover.pos = { x: 13.5, y: 10.5 }; b.whisperWitnessed.add(harmful.id); }
    const ada = agent(ctx, 'ada'); hear(ctx, ada, harmful, 'first', 2); hear(ctx, ada, harmful, 'second', 2);
    ctx.rel.setAffinity('rosa', 'tom', 1); ctx.rel.setAffinity('tom', 'rosa', 1);
    ctx.rel.setAffinity('rosa', 'mira', -1); ctx.rel.setAffinity('mira', 'rosa', -1);
    const conv = confrontation(ctx, true);
    const crowd = ctx.agents.slice(2).map((b) => b.d.id);
    expect(conv.accusation!.audience).toEqual(crowd);
    expect(ctx.events.find((e) => e.kind === 'line' && e.act === 'accuse')).toMatchObject({ listeners: ['tom', ...crowd] });
    expect(joinConversation(ctx, conv, ada)).toBe(false);
    tick(ctx, 2);
    for (const b of ctx.agents.slice(2)) {
      expect(b.conversation).toBeNull();
      expect(ctx.events.filter((e) => e.kind === 'line' && e.speaker === b.d.id && ['agree', 'defend', 'doubt'].includes(e.act))).toHaveLength(1);
    }
    expect(ctx.events.find((e) => e.kind === 'line' && e.speaker === 'ada')).toMatchObject({ act: 'agree' });
    expect(ctx.events.find((e) => e.kind === 'line' && e.speaker === 'rosa')).toMatchObject({ act: 'defend' });
    expect(ctx.events.some((e) => e.kind === 'line' && e.act === 'doubt')).toBe(true);
    expect(ctx.threads.some((t) => t.from === 'ada' && t.to === 'mira')).toBe(true);
    expect(conv.members).toEqual(['mira', 'tom']);
  });

  it('keeps admitted bystanders’ reactions as single conversational turns within the eight-line cap', () => {
    const ctx = fixture(['mira', 'tom', 'ada', 'rosa']);
    const mira = agent(ctx, 'mira'), tom = agent(ctx, 'tom');
    tom.mover.pos = { x: 11.5, y: 10.5 };
    agent(ctx, 'ada').mover.pos = { x: 10.5, y: 11.5 };
    agent(ctx, 'rosa').mover.pos = { x: 11.5, y: 11.5 };
    hear(ctx, mira, harmful, 'stranger', 3); tom.d.traits.agreeableness = 0.2;
    mira.goal = { kind: 'confront', target: 'tom', claimId: harmful.id, since: 0 };
    const conv = startConversation(ctx, mira, tom, true);
    expect(joinConversation(ctx, conv, agent(ctx, 'ada'))).toBe(true);
    expect(joinConversation(ctx, conv, agent(ctx, 'rosa'))).toBe(true);
    tick(ctx, 8);
    const lines = ctx.events.filter((event) => event.kind === 'line');
    expect(lines.filter((event) => ['ada', 'rosa'].includes(event.speaker) && ['agree', 'defend', 'doubt'].includes(event.act))).toHaveLength(2);
    expect(new Set(lines.map((event) => event.tick)).size).toBe(lines.length);
    expect(lines.length).toBeLessThanOrEqual(8);
    expect(lines.at(-1)).toMatchObject({ act: 'farewell' });
    expect(ctx.publicResponses).toHaveLength(0);
  });

  it('exposes later origin rememberers and later accusers while deduplicating each penalty', () => {
    const ctx = fixture(); const sc = introduce(ctx);
    const mira = agent(ctx, 'mira'), ada = agent(ctx, 'ada');
    hearFromStranger(ctx, mira, harmful);
    seeClaim(ctx, mira, truth, 1);
    expect(ctx.rel.trust('mira', 'stranger')).toBeCloseTo(0.2);
    expect(ctx.rel.trust('ada', 'stranger')).toBe(0.5);
    ctx.tick = 10; hearFromStranger(ctx, ada, harmful);
    const rec = accusation({ accuser: 'ben', audience: ['rosa'], tick: 9 }); ctx.accusations.push(rec);
    const initial = ctx.rel.trust('rosa', 'ben');
    seeClaim(ctx, ada, truth, 1); exposeStranger(ctx, harmful, ada);
    expect(ctx.rel.trust('ada', 'stranger')).toBeCloseTo(0.2);
    expect(ctx.rel.trust('mira', 'stranger')).toBeCloseTo(0.2);
    expect(ctx.rel.trust('rosa', 'ben')).toBeCloseTo(initial - 0.2);
    expect(rec.accuserExposed).toBe(true);
    expect(sc.correctedFirsthand).toEqual(new Set(['mira', 'ada']));
    ctx.tick = 901; exposeStranger(ctx, harmful, ada);
    expect(ctx.rel.trust('ada', 'stranger')).toBe(0);
  });

  it('keeps chain evidence frozen at each telling, including later evidence in the same tick', () => {
    const ctx = fixture(), mira = agent(ctx, 'mira'), ada = agent(ctx, 'ada'), rosa = agent(ctx, 'rosa');
    ctx.tick = 1; hearFromStranger(ctx, mira, harmful);
    ctx.tick = 5; hearFrom(ctx, mira, ada, harmful, false);
    mira.ledger.see(harmful, ctx.claims, 5); // Acquired after the telling, within the same step.
    ctx.tick = 7; hearFromStranger(ctx, mira, harmful);
    ctx.tick = 10; hearFrom(ctx, ada, rosa, harmful, false);
    const expected = ['The stranger told Mira at 07:01', 'Mira told Ada at 07:05'];
    expect(chainFor(ctx, ada, harmful.id)).toEqual(expected);
    expect(chainFor(ctx, rosa, harmful.id)).toEqual([...expected, 'Ada told Rosa at 07:10']);
    expect(chainFor(ctx, mira, harmful.id)).toContain('Mira saw it at 07:05');
    ctx.tick = 11; hearFrom(ctx, mira, ada, harmful, false);
    expect(chainFor(ctx, ada, harmful.id)).toEqual([...expected, 'Mira saw it at 07:05', 'The stranger told Mira at 07:07', 'Mira told Ada at 07:11']);
  });

  it('hearsay alternatives do not expose the stranger, while a public first-hand account does', () => {
    const ctx = fixture(); introduce(ctx);
    const mira = agent(ctx, 'mira'), tom = agent(ctx, 'tom');
    tom.mover.pos = { x: 11.5, y: 10.5 }; agent(ctx, 'ada').mover.pos = { x: 13.5, y: 10.5 };
    hearFromStranger(ctx, mira, harmful);
    tom.ledger.hear(truth, ctx.claims, { source: 'villager', trust: 0.6, strength: 0.9, tick: 0 });
    expect(hasFirsthand(tom, truth.id)).toBe(false);
    const conv = startConversation(ctx, tom, mira, true); tick(ctx);
    conv.queue.push({ speaker: 'tom', listener: 'mira', act: 'explain', claimId: truth.id, why: 'An explanation from hearsay' });
    tick(ctx);
    expect(ctx.rel.trust('mira', 'stranger')).toBe(0.5);
    tom.ledger.see(truth, ctx.claims, ctx.tick);
    conv.queue.push({ speaker: 'tom', listener: 'mira', act: 'explain', claimId: truth.id, why: 'A first-hand account' });
    tick(ctx);
    expect(ctx.rel.trust('mira', 'stranger')).toBeCloseTo(0.2);
  });

  it('uses the actual scored telling terms for its explanation, including the capped utility', () => {
    const ctx = fixture(); const mira = agent(ctx, 'mira'), ada = agent(ctx, 'ada');
    hear(ctx, mira, harmful, 'stranger', 10);
    const telling = tellingFor(ctx, mira, ada, new Set())!;
    expect(telling).not.toBeNull();
    expect(telling.terms.reduce((total, term) => total + term.value, 0)).toBeCloseTo(telling.utility);
    expect(telling.utility).toBeLessThanOrEqual(0.85);
  });

  it('a schedule change ends participation and paths home before entering sleep', () => {
    const ctx = fixture(['mira', 'tom']); const mira = agent(ctx, 'mira'), tom = agent(ctx, 'tom');
    const inn = ctx.world.place('inn').spots[0]!;
    mira.mover.pos = { x: inn.x + 0.5, y: inn.y + 0.5 }; tom.mover.pos = { x: inn.x + 1.5, y: inn.y + 0.5 };
    mira.goal = { kind: 'schedule', since: 0, place: 'inn' }; mira.spot = inn;
    mira.d.schedule = [{ start: 0, place: 'inn', activity: 'talk' }, { start: 4, place: 'bakery', activity: 'sleep' }];
    const conv = startConversation(ctx, mira, tom, false);
    ctx.tick = 4; updateSchedule(ctx, mira);
    expect(mira.conversation).toBeNull(); expect(conv.members).not.toContain('mira');
    expect(mira.goal.place).toBe('bakery'); expect(mira.activity).toBe('rest'); expect(mira.mover.moving).toBe(true);
    for (let i = 0; i < 100 && mira.mover.moving; i++) mira.mover.update(1, 1, []);
    expect(ctx.world.placeAt(mira.mover.pos)?.id).toBe('bakery');
    onArrived(mira); expect(mira.activity).toBe('sleep');
  });

  it('reserves the final conversational line for farewell even with queued replies', () => {
    const ctx = fixture(['mira', 'tom']); agent(ctx, 'tom').mover.pos = { x: 11.5, y: 10.5 };
    const conv = startConversation(ctx, agent(ctx, 'mira'), agent(ctx, 'tom'), true); conv.maxLines = 8;
    tick(ctx); // greet
    for (let i = 0; i < 10; i++) conv.queue.push({ speaker: 'tom', listener: 'mira', act: 'doubt', why: 'Still unsure' });
    tick(ctx, 7);
    expect(conv.lines).toBe(8); expect(conv.ended).toBe(true);
    expect(ctx.events.filter((e) => e.kind === 'line').at(-1)).toMatchObject({ act: 'farewell' });
  });

  it('keeps a reflection inspectable for every villager, including quiet days and person-free memories', () => {
    const ctx = fixture(['mira', 'tom']); ctx.tick = 900;
    remember(ctx, agent(ctx, 'mira'), 8, 'A stranger lied', 'The stranger’s stories do not hold up');
    for (const a of ctx.agents) reflect(ctx, a);
    expect(inspectAgent(ctx, agent(ctx, 'mira')).decisions[0]!.why).toBe('The stranger’s stories do not hold up');
    expect(inspectAgent(ctx, agent(ctx, 'tom')).decisions[0]!.why).toContain('Tom had a quiet day');
    for (const a of ctx.agents) a.decisions.length = 0; // Simulate the last five decisions being replaced next morning.
    expect(inspectAgent(ctx, agent(ctx, 'mira')).decisions.at(-1)!.action).toBe('reflect');
  });

  it('keeps the approved half-peak apology trigger after a library correction', () => {
    const ctx = fixture(), mira = agent(ctx, 'mira'); hear(ctx, mira, harmful, 'stranger', 3);
    expect(beliefCollapsed(mira, harmful.id)).toBe(false);
    correctBelief(ctx, mira, harmful.id, 1, true, 'self', false);
    expect(mira.ledger.confidence(harmful.id)).toBeGreaterThan(0.45);
    expect(beliefCollapsed(mira, harmful.id)).toBe(true);
    expect(hasFirsthand(mira, harmful.id)).toBe(false);
  });

  it('never accuses at exactly 0.75, even when an intent has already been selected', () => {
    const claim = { ...harmful, basePrior: 0.75 }; const ctx = fixture(['mira', 'tom'], [claim]);
    const mira = agent(ctx, 'mira'); mira.ledger.hear(claim, ctx.claims, { source: 'stranger', trust: 0, strength: 0, tick: 0 });
    agent(ctx, 'tom').mover.pos = { x: 11.5, y: 10.5 };
    mira.goal = { kind: 'confront', target: 'tom', claimId: claim.id, since: 0 };
    startConversation(ctx, mira, agent(ctx, 'tom'), true); tick(ctx, 8);
    expect(ctx.accusations).toHaveLength(0);
  });
});

const endings: readonly Ending[] = ['exposed', 'split', 'reconciled', 'grudge', 'quiet', 'died'];
function arrangeEnding(ctx: Ctx, claim: GameClaim, ending: Ending): void {
  const sc = introduce(ctx, claim, ending === 'died' ? ['mira'] : ['mira', 'ada']);
  if (ending !== 'quiet') hear(ctx, agent(ctx, 'mira'), claim);
  if (ending === 'exposed') { sc.correctedFirsthand.add('mira'); sc.trustLost = true; }
  if (ending === 'split') {
    sc.backedAccuser = new Set(['mira', 'ada', 'rosa']); sc.backedAccused = new Set(['ben', 'jonah', 'elin']);
    ctx.accusations.push(accusation({ claimId: claim.id, apologized: true })); // split precedes reconciliation.
  }
  if (ending === 'reconciled') ctx.accusations.push(accusation({ claimId: claim.id, apologized: true }));
}

describe('endings over the introduced set', () => {
  it.each(endings)('reports %s for a claim with that outcome', (ending) => {
    const ctx = fixture(); arrangeEnding(ctx, harmful, ending);
    const verdict = judgeDay(ctx); expect(verdict.ending).toBe(ending); expect(verdict.summary).toContain('Tom');
  });
  it.each(endings.flatMap((higher, index) => endings.slice(index + 1).map((lower) => ({ higher, lower }))))(
    '$higher outranks $lower across two claims regardless of insertion or audience size', ({ higher, lower }) => {
      const second: GameClaim = { ...harmful, id: 'another', about: 'ben', text: 'Ben stole tools', contradicts: [] };
      for (const reverse of [false, true]) {
        const ctx = fixture(undefined, [harmful, truth, second]);
        if (reverse) { arrangeEnding(ctx, second, higher); arrangeEnding(ctx, harmful, lower); }
        else { arrangeEnding(ctx, harmful, lower); arrangeEnding(ctx, second, higher); }
        if (lower !== 'died') for (const a of ctx.agents) ctx.strangerClaims.find((sc) => sc.claimId === harmful.id)!.heardBy.add(a.d.id);
        const verdict = judgeDay(ctx); expect(verdict.ending).toBe(higher); expect(verdict.summary).toContain('Ben');
      }
    },
  );
  it('does not claim forgiveness after an apology was refused', () => {
    const ctx = fixture(); arrangeEnding(ctx, harmful, 'reconciled');
    expect(judgeDay(ctx).summary).toContain('forgiveness has yet to follow');
    ctx.accusations[0]!.forgiven = true;
    expect(judgeDay(ctx).summary).toContain('they made up');
  });
});

it.each([['fallback', createMover], ['world', worldMover]] as const)('uses the %s mover to walk at one tile per minute and stop on arrival', (_, makeMover) => {
  const mover = makeMover({ x: 1.5, y: 1.5 }); mover.setPath([{ x: 2, y: 1 }, { x: 3, y: 1 }]);
  mover.update(1, 1, []); expect(mover.pos).toEqual({ x: 2.5, y: 1.5 }); expect(mover.moving).toBe(true);
  mover.update(1, 1, []); expect(mover.pos).toEqual({ x: 3.5, y: 1.5 }); expect(mover.arrived()).toBe(true);
});


it.each(['fallback', 'world'] as const)('runs a deterministic 900-tick rumor day with 24 villagers using the %s mover within 1.5 seconds', (moverKind) => {
  const options = () => ({ seed: 11, cast: createFakeCast(11), claims: [harmful, truth], talk, days: 1,
    world: moverKind === 'world' ? { ...createWorld(createFakeMap()), createMover: worldMover } : createWorld(createFakeMap()),
    interventions: [1, 2, 3].map((tick) => ({ tick, listener: 'mira', claimId: harmful.id })),
  });
  const sim = createSimulation(options()); const start = performance.now();
  for (let i = 0; i < 900; i++) sim.step();
  const elapsed = performance.now() - start;
  expect(elapsed).toBeLessThan(1500); expect(sim.tick).toBe(900);
  expect(sim.events(900).find((event) => event.kind === 'day-end')).toMatchObject({ tick: 900, dayIndex: 0 });
  const replay = createSimulation(options()); for (let i = 0; i < 900; i++) replay.step();
  expect(replay.events(0)).toEqual(sim.events(0)); expect(replay.snapshot()).toEqual(sim.snapshot());
  console.log(`900 ticks, 24 villagers, rumor, ${moverKind} mover: ${elapsed.toFixed(0)} ms`);
});
