/**
 * The simulation: twenty-four rule-driven villagers living a day, one game-minute per step.
 * Deterministic for a seed. Wires the modules under ./agents/ and satisfies the Simulation contract.
 */
import { BeliefLedger, createRng, DEFAULT_TUNING, Relationships, type ClaimId, type Tuning } from 'rumormind';
import { emit, isAsleep, visibleActivity, type Agent, type Ctx } from './agents/context.js';
import { tickConversations } from './agents/conversation.js';
import { judgeDay } from './agents/endings.js';
import { inspectAgent } from './agents/inspect.js';
import { MoodState } from './agents/mood.js';
import { createMover as fallbackMover } from './agents/mover.js';
import { freshNeeds, resetNeeds, tickNeeds } from './agents/needs.js';
import { DECISION_PERIOD, PLAYER_SPEED, TALK_RANGE, THREADS_KEPT, VILLAGER_SPEED } from './agents/params.js';
import { reflect } from './agents/reflection.js';
import { initRelationships } from './agents/relations.js';
import { currentEntryIndex, entryOf, insidePlace, onArrived, pathFrom, placeOf, updateSchedule, walkToward } from './agents/schedule.js';
import { whisper } from './agents/stranger.js';
import { decide } from './agents/utility.js';
import { tickWitnessing } from './agents/witness.js';
import { matchesAuthoredFact, readRegisteredClaim } from './registered-claim.js';
import {
  DAY_START_MINUTE,
  MINUTES_PER_DAY,
  type Dossier,
  type GameClaim,
  type Inspection,
  type Intervention,
  type Mover,
  type SimEvent,
  type Simulation,
  type SimulationOptions,
  type Vec2,
  type VillagerId,
  type VillagerView,
  type WorldSnapshot,
} from './types.js';

const DEFAULT_DAYS = 3;

/** Prefer the world's movement implementation; retain the isolated engine fallback. */
function moverFactory(world: SimulationOptions['world']): (start: Vec2) => Mover {
  if (world.createMover) return (start) => world.createMover!(start);
  return fallbackMover;
}

/** What a villager knows at dawn: their own witnessable acts, and whatever the dossier says. */
function seedKnowledge(ctx: Ctx, agent: Agent): void {
  for (const s of agent.d.secrets) {
    for (const c of ctx.claimList) {
      if (c.about === agent.d.id && s.confirms.includes(c.kind) && !agent.ledger.knows(c.id)) agent.ledger.see(c, ctx.claims, 0, 1);
    }
  }
  for (const k of agent.d.knows ?? []) {
    const c = ctx.claims.get(k.claimId);
    if (!c || agent.ledger.knows(c.id)) continue;
    const participant = c.about === agent.d.id || (ctx.castMap.get(c.about)?.secrets.some(
      (secret) => secret.with === agent.d.id && secret.confirms.includes(c.kind),
    ) ?? false);
    if (participant) agent.ledger.see(c, ctx.claims, 0, k.confidence);
    else agent.ledger.hear(c, ctx.claims, { source: 'villager', trust: 0.6, strength: k.confidence, tick: 0 });
  }
}

export function createSimulation(opts: SimulationOptions): Simulation {
  const rng = createRng(opts.seed);
  // `forget` runs once per day at dawn, so its half-life unit here is days: two, per the spec.
  const tuning: Tuning = { ...DEFAULT_TUNING, sourceMemoryHalfLifeTicks: 2, ...opts.tuning };
  const world = opts.world;
  const makeMover = moverFactory(world);
  const claims = new Map<ClaimId, GameClaim>();
  for (const c of opts.claims) claims.set(c.id, c);
  const claimList = opts.claims.slice();
  const castMap = new Map<VillagerId, Dossier>();
  for (const d of opts.cast) castMap.set(d.id, d);
  const square = world.map.places.find((p) => p.id === 'square') ?? world.map.places[0];
  const start: Vec2 = square ? { x: square.door.x + 0.5, y: square.door.y + 0.5 } : { x: Math.floor(world.map.width / 2) + 0.5, y: Math.floor(world.map.height / 2) + 0.5 };

  const agents: Agent[] = [];
  const ctx: Ctx = {
    rng,
    tuning,
    world,
    talk: opts.talk,
    claims,
    claimList,
    castMap,
    agents,
    byId: new Map(),
    rel: new Relationships(tuning),
    relationWhy: new Map(),
    events: [],
    threads: [],
    conversations: [],
    publicResponses: [],
    transmissionChains: new WeakMap(),
    accusations: [],
    strangerClaims: [],
    player: { mover: makeMover(start) },
    tick: 0,
    nextConversationId: 1,
  };

  opts.cast.forEach((d, index) => {
    const agent: Agent = {
      index,
      d,
      mover: makeMover(start),
      ledger: new BeliefLedger(d.id, rng, tuning),
      needs: freshNeeds(),
      mood: new MoodState(),
      decisions: [],
      memories: [],
      opinions: [],
      lastTalk: new Map(),
      accusedToday: new Set(),
      reconciledWith: new Set(),
      whisperWitnessed: new Set(),
      witnessed: new Set(),
      activity: 'idle',
      entryIndex: 0,
      goal: { kind: 'schedule', since: 0 },
      spot: null,
      conversation: null,
      talkCooldownUntil: 0,
      bubble: undefined,
    };
    agents.push(agent);
    ctx.byId.set(d.id, agent);
  });

  // Everyone starts at their first entry's place (or home) and knows what they would know.
  const placed: Vec2[] = [];
  for (const a of agents) {
    a.entryIndex = currentEntryIndex(a.d.schedule, 0);
    const entry = entryOf(a);
    const place = placeOf(ctx, entry.place) ?? placeOf(ctx, a.d.home);
    if (place) {
      let spot: Vec2;
      try {
        spot = world.spotFor(place.id, placed, rng);
      } catch {
        spot = place.door;
      }
      a.mover.pos.x = spot.x + 0.5;
      a.mover.pos.y = spot.y + 0.5;
      a.spot = spot;
      a.goal = { kind: 'schedule', since: 0, place: place.id };
      a.activity = visibleActivity(entry.activity);
    }
    placed.push(a.mover.pos);
    seedKnowledge(ctx, a);
  }
  initRelationships(ctx);

  const registerClaim = (claim: GameClaim): void => {
    if (claim.kind === 'story') {
      const canonical = readRegisteredClaim(claim.id, castMap);
      if (!canonical || canonical.kind !== 'story') throw Error('Invalid story');
      claim = canonical;
    }
    if (!(claim.kind === 'story' && claim.about === 'village') && !castMap.has(claim.about)) throw new Error(`unknown villager ${claim.about}`);
    // Registration is idempotent, and cannot rewrite claims already held in a ledger.
    if (claims.has(claim.id)) return;
    const alternatives = claimList.filter((c) => {
      const harmful = c.alternativeOf ? claims.get(c.alternativeOf) : undefined;
      return c.valence > 0 && harmful !== undefined && matchesAuthoredFact(claim, harmful);
    });
    const added = { ...claim, contradicts: alternatives.map((c) => c.id) };
    claims.set(added.id, added);
    claimList.push(added);
    for (const alternative of alternatives) {
      const updated = { ...alternative, contradicts: [...(alternative.contradicts ?? []), added.id] };
      claims.set(updated.id, updated);
      claimList[claimList.indexOf(alternative)] = updated;
    }
  };

  const interventions: Intervention[] = [];
  const pending = (opts.interventions ?? []).slice().sort((x, y) => x.tick - y.tick);
  let pendingIndex = 0;
  const days = Math.max(1, Math.floor(opts.days ?? DEFAULT_DAYS));
  let finished = false;

  const applyPending = (): void => {
    while (pendingIndex < pending.length && pending[pendingIndex]!.tick <= ctx.tick) {
      const iv = pending[pendingIndex++]!;
      if (!claims.has(iv.claimId)) {
        const claim = readRegisteredClaim(iv.claimId, castMap);
        if (claim) registerClaim(claim);
      }
      if (whisper(ctx, iv.listener, iv.claimId, true)) interventions.push({ tick: ctx.tick, listener: iv.listener, claimId: iv.claimId });
    }
  };
  applyPending();

  const endDay = (): void => {
    const dayIndex = Math.floor(ctx.tick / MINUTES_PER_DAY) - 1;
    const verdict = judgeDay(ctx);
    emit(ctx, { kind: 'day-end', tick: ctx.tick, dayIndex, summary: verdict.summary, ending: verdict.ending });
    for (const a of agents) {
      resetNeeds(a);
      reflect(ctx, a);
      a.ledger.forget(ctx.tick);
      a.accusedToday.clear();
    }
    if (dayIndex + 1 >= days) finished = true;
  };

  const step = (): void => {
    if (finished) return;
    ctx.tick += 1;
    for (const a of agents) updateSchedule(ctx, a);
    for (const a of agents) {
      if ((ctx.tick + a.index) % DECISION_PERIOD === 0 && a.conversation === null && !isAsleep(a)) decide(ctx, a);
    }
    // Movement, with light separation from everyone else.
    for (const a of agents) {
      if (a.conversation !== null || !a.mover.moving) continue;
      const others: Vec2[] = [];
      for (const o of agents) if (o !== a) others.push(o.mover.pos);
      // Player walks are not part of a share link, so they cannot alter NPC paths or decisions.
      a.mover.update(1, VILLAGER_SPEED, others);
      if (a.mover.arrived()) onArrived(a);
    }
    if (ctx.player.mover.moving) {
      const others: Vec2[] = [];
      for (const o of agents) others.push(o.mover.pos);
      ctx.player.mover.update(1, PLAYER_SPEED, others);
    }
    // Someone walking up to a person who moved re-paths once they have drifted apart.
    for (const a of agents) {
      if (a.conversation !== null || a.goal.target === undefined) continue;
      const t = ctx.byId.get(a.goal.target);
      if (t && a.goal.pathedTo && world.distance(a.goal.pathedTo, t.mover.pos) > TALK_RANGE) walkToward(ctx, a, t);
    }
    tickWitnessing(ctx);
    tickConversations(ctx);
    for (const a of agents) {
      tickNeeds(ctx, a);
      a.mood.expire(ctx.tick);
      if (a.bubble && a.bubble.untilTick <= ctx.tick) a.bubble = undefined;
    }
    if (ctx.tick % MINUTES_PER_DAY === 0) endDay();
    // The UI records a live whisper at `sim.tick` once the step has run, so a replayed one lands here.
    applyPending();
  };

  const snapshot = (): WorldSnapshot => {
    const villagers: VillagerView[] = agents.map((a) => {
      const view: VillagerView = {
        id: a.d.id,
        name: a.d.name,
        tier: a.d.tier,
        pos: { x: a.mover.pos.x, y: a.mover.pos.y },
        facing: a.mover.facing,
        moving: a.mover.moving,
        activity: visibleActivity(a.activity),
        look: a.d.look,
        mood: a.mood.value(ctx.tick),
      };
      if (a.bubble && a.bubble.untilTick > ctx.tick) view.bubble = { ...a.bubble };
      return view;
    });
    const p = ctx.player.mover;
    return {
      tick: ctx.tick,
      dayIndex: Math.floor(ctx.tick / MINUTES_PER_DAY),
      minuteOfDay: (DAY_START_MINUTE + (ctx.tick % MINUTES_PER_DAY)) % MINUTES_PER_DAY,
      villagers,
      player: { pos: { x: p.pos.x, y: p.pos.y }, facing: p.facing, moving: p.moving },
      threads: ctx.threads.slice(-THREADS_KEPT),
    };
  };

  const movePlayer = (target: Vec2): void => {
    // Visits stop outside private homes, including requests from keyboard and agent tools.
    const home = world.map.places.find(p => p.kind === 'home' && insidePlace(p, target));
    // An older replay can place the stranger beside an awake resident at home. Allow the exit.
    const originHome = world.map.places.find(p => p.kind === 'home' && insidePlace(p, ctx.player.mover.pos));
    const goal = home ? { ...home.door } : { x: Math.floor(target.x), y: Math.floor(target.y) };
    const options: Vec2[] = [goal, { x: goal.x, y: goal.y - 1 }, { x: goal.x - 1, y: goal.y }, { x: goal.x + 1, y: goal.y }, { x: goal.x, y: goal.y + 1 }];
    for (const o of options) {
      if (!world.isWalkable(o.x, o.y)) continue;
      const path = pathFrom(ctx, ctx.player.mover.pos, o);
      if (path) {
        const interior = path.findIndex(tile => world.map.places.some(p => p.kind === 'home' && p !== originHome &&
          tile.x > p.rect.x && tile.x < p.rect.x + p.rect.w - 1 && tile.y > p.rect.y && tile.y < p.rect.y + p.rect.h - 1));
        ctx.player.mover.setPath(interior < 0 ? path : path.slice(0, interior));
        return;
      }
    }
  };

  const events = (sinceTick: number): SimEvent[] => {
    const all = ctx.events;
    let lo = 0;
    let hi = all.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (all[mid]!.tick < sinceTick) lo = mid + 1;
      else hi = mid;
    }
    return all.slice(lo);
  };

  return {
    get tick() {
      return ctx.tick;
    },
    get dayIndex() {
      return Math.floor(ctx.tick / MINUTES_PER_DAY);
    },
    claims,
    cast: castMap,
    registerClaim,
    step,
    snapshot,
    inspect(id: VillagerId): Inspection {
      const a = ctx.byId.get(id);
      if (!a) throw new Error(`unknown villager ${id}`);
      return inspectAgent(ctx, a);
    },
    whisper(listener, claimId) {
      const ok = whisper(ctx, listener, claimId, false);
      if (ok) interventions.push({ tick: ctx.tick, listener, claimId });
      return ok;
    },
    movePlayer,
    events,
    interventions: () => interventions.slice(),
  };
}
