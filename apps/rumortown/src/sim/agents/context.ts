/**
 * The engine's shared state. Every module takes a `Ctx` and iterates `agents` in cast order,
 * so results never depend on Map or Set iteration order.
 */
import type { BeliefLedger, ClaimId, Relationships, Rng, Tuning, Provenance } from 'rumormind';
import type {
  Activity,
  DecisionView,
  Dossier,
  GameClaim,
  Mover,
  Need,
  PlaceId,
  SimEvent,
  SpeechAct,
  TalkApi,
  ThreadLink,
  Tick,
  Vec2,
  VillagerId,
  VillagerView,
  WorldApi,
} from '../types.js';
import type { MoodState } from './mood.js';
import { DECISIONS_KEPT } from './params.js';
import { displayName } from './text.js';

export type GoalKind = 'schedule' | 'need' | 'approach' | 'gossip' | 'confront' | 'avoid' | 'apologize' | 'reconcile';

export interface Goal {
  kind: GoalKind;
  since: Tick;
  place?: PlaceId;
  target?: VillagerId;
  claimId?: ClaimId;
  need?: Need;
  /** The act a telling walk is for: gossip, warn, confide, news or defend. */
  act?: SpeechAct;
  /** Where the current path was aimed, so a moving target is re-pathed only when needed. */
  pathedTo?: Vec2;
}

export interface Memory {
  tick: Tick;
  importance: number;
  text: string;
  /** The standing opinion this event would leave behind at dusk. */
  opinion: string;
  about?: VillagerId;
}

export interface Agent {
  readonly index: number;
  readonly d: Dossier;
  readonly mover: Mover;
  readonly ledger: BeliefLedger;
  readonly needs: Record<Need, number>;
  readonly mood: MoodState;
  /** Newest first, at most DECISIONS_KEPT. */
  readonly decisions: DecisionView[];
  readonly memories: Memory[];
  readonly opinions: DecisionView[];
  readonly lastTalk: Map<VillagerId, Tick>;
  /** `${claimId}|${accused}` for accusations already made today. */
  readonly accusedToday: Set<string>;
  readonly reconciledWith: Set<VillagerId>;
  /** Claims whose whisper this villager saw happen. */
  readonly whisperWitnessed: Set<ClaimId>;
  /** `${secretId}|${day}` already perceived. */
  readonly witnessed: Set<string>;
  activity: Activity;
  entryIndex: number;
  goal: Goal;
  spot: Vec2 | null;
  conversation: number | null;
  talkCooldownUntil: Tick;
  bubble: VillagerView['bubble'];
}

export interface AccusationRecord {
  claimId: ClaimId;
  accuser: VillagerId;
  accused: VillagerId;
  tick: Tick;
  isPublic: boolean;
  audience: VillagerId[];
  apologized: boolean;
  forgiven: boolean;
  accuserExposed: boolean;
}

/** Bookkeeping for one claim the stranger introduced, for exposure and endings. */
export interface StrangerClaim {
  claimId: ClaimId;
  firstTick: Tick;
  firstListener: VillagerId;
  heardBy: Set<VillagerId>;
  backedAccuser: Set<VillagerId>;
  backedAccused: Set<VillagerId>;
  /** Villagers whose belief in the claim was corrected by first-hand evidence. */
  correctedFirsthand: Set<VillagerId>;
  /** Last day each villager was penalized for this claim. */
  exposedVillagers: Map<VillagerId, number>;
  trustLost: boolean;
}

export interface QueuedLine {
  speaker: VillagerId;
  listener: VillagerId;
  act: SpeechAct;
  claimId?: ClaimId;
  why: string;
  /** Resolved when spoken: the bystander picks a side with their beliefs at that moment. */
  decideSide?: { accuser: VillagerId; accused: VillagerId; claimId: ClaimId; accusation: AccusationRecord };
}

export interface Conversation {
  id: number;
  members: VillagerId[];
  initiator: VillagerId;
  startTick: Tick;
  lines: number;
  maxLines: number;
  queue: QueuedLine[];
  lastSpeaker: VillagerId | null;
  /** The last claim spoken, so the next speaker can agree or doubt. */
  lastClaim: { claimId: ClaimId; speaker: VillagerId } | null;
  /** The accusation this conversation is about, once one has been made. */
  accusation: AccusationRecord | null;
  topic: string | null;
  ended: boolean;
  farewellTo: VillagerId | null;
}

export interface ChainEntry {
  tick: Tick;
  text: string;
  evidence: Provenance;
}

export interface Ctx {
  readonly rng: Rng;
  readonly tuning: Tuning;
  readonly world: WorldApi;
  readonly talk: TalkApi;
  readonly claims: Map<ClaimId, GameClaim>;
  readonly claimList: readonly GameClaim[];
  readonly castMap: Map<VillagerId, Dossier>;
  readonly agents: readonly Agent[];
  readonly byId: Map<VillagerId, Agent>;
  readonly rel: Relationships;
  /** Latest plain-English reason for how `from` feels about `to`, keyed by relKey. */
  readonly relationWhy: Map<string, string>;
  readonly events: SimEvent[];
  readonly threads: ThreadLink[];
  readonly conversations: Conversation[];
  /** Public reactions are separate utterances, not conversation membership or turns. */
  readonly publicResponses: { conversation: Conversation; line: QueuedLine; readyTick: Tick }[];
  /** Immutable evidence available to a teller immediately before each hearing. */
  readonly transmissionChains: WeakMap<Provenance, readonly ChainEntry[]>;
  readonly accusations: AccusationRecord[];
  readonly strangerClaims: StrangerClaim[];
  readonly player: { mover: Mover };
  tick: Tick;
  nextConversationId: number;
}

export const emit = (ctx: Ctx, ev: SimEvent): void => {
  if (ev.kind === 'line') {
    const speaker = ctx.byId.get(ev.speaker);
    if (speaker) {
      ctx.events.push({ ...ev, at: { ...speaker.mover.pos }, placeId: ctx.world.placeAt(speaker.mover.pos)?.id });
      return;
    }
  }
  ctx.events.push(ev);
};

export const agentOf = (ctx: Ctx, id: VillagerId): Agent | undefined => ctx.byId.get(id);

export const tileOf = (p: Vec2): Vec2 => ({ x: Math.floor(p.x), y: Math.floor(p.y) });

export const dist = (ctx: Ctx, a: Agent, b: Agent): number => ctx.world.distance(a.mover.pos, b.mover.pos);

export const relKey = (from: string, to: string): string => `${from}|${to}`;

export const nameOf = (ctx: Ctx, id: string, capital = false): string => displayName(ctx.castMap, id, capital);

export const isUnavailable = (a: Agent): boolean => isAsleep(a) || a.d.schedule[a.entryIndex]?.activity === 'sleep' || (a.mover.moving && a.d.schedule[a.entryIndex]?.night === true);

export const isAsleep = (a: Agent): boolean => a.activity === 'sleep';

export const strangerClaimOf = (ctx: Ctx, claimId: ClaimId): StrangerClaim | undefined =>
  ctx.strangerClaims.find((s) => s.claimId === claimId);

/** Newest first; the view keeps the last few. */
export function recordDecision(ctx: Ctx, agent: Agent, action: string, why: string): void {
  agent.decisions.unshift({ tick: ctx.tick, action, why });
  if (agent.decisions.length > DECISIONS_KEPT) agent.decisions.length = DECISIONS_KEPT;
}

export function addMood(ctx: Ctx, agent: Agent, label: string, delta: number, ticks: number): void {
  const untilTick = ctx.tick + ticks;
  agent.mood.add(label, delta, untilTick);
  emit(ctx, { kind: 'mood', tick: ctx.tick, villager: agent.d.id, label, delta, untilTick });
}

/** What the view shows: a secret act looks like an errand so the UI does not give it away. */
export const visibleActivity = (a: Activity): Activity => (a === 'secret' ? 'errand' : a);

/** Harmful claims about `subject` that `agent` has heard of, in authored claim order. */
export function harmfulClaimsAbout(ctx: Ctx, agent: Agent, subject: VillagerId): GameClaim[] {
  const out: GameClaim[] = [];
  for (const c of ctx.claimList) {
    if (c.about === subject && c.valence < 0 && agent.ledger.knows(c.id)) out.push(c);
  }
  return out;
}
