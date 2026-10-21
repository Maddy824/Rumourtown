/**
 * Engine-side tunables. Everything here is a designer starting point ("tuned") unless the
 * comment says where the number comes from; the measured rules live in rumormind's tuning.ts.
 */
import type { Need } from '../types.js';

/** Tiles per game-minute. */
export const VILLAGER_SPEED = 1.0;
export const PLAYER_SPEED = 1.4;

/** Ranges in tiles. */
export const TALK_RANGE = 1.5;
export const WHISPER_RANGE = 2;
export const WITNESS_RANGE = 4;
/** A conversation is private when no third villager stands within this range. */
export const PUBLIC_RANGE = 3;
/** How far a villager will walk to tell someone something or to confront them. */
export const APPROACH_RANGE = 12;

export const DECISION_PERIOD = 5;
export const BUBBLE_TICKS = 6;
export const THREADS_KEPT = 60;
export const DECISIONS_KEPT = 5;

export const MAX_GROUP = 4;
export const MIN_LINES = 3;
export const MAX_LINES = 8;
/** A conversation started on purpose (to tell, confront, apologise) gets at least this many lines. */
export const INTENT_LINES = 6;
/** Spontaneous accusations only early in a conversation, so the answer and the side-taking fit. */
export const LAST_ACCUSE_LINE = 3;
/** Ticks before two villagers who just talked will start another conversation together. */
export const PAIR_COOLDOWN = 45;
export const AFTER_TALK_COOLDOWN = 6;
/** A walk toward someone is given up after this many ticks. */
export const GOAL_TIMEOUT = 60;
/** The accused must have been accused within this many ticks for "avoid" to fire. */
export const AVOID_WINDOW = 30;

/** Knowing versus acting: public accusation needs belief above this (complex contagion, Centola 2010). */
export const CONFRONT_BELIEF = 0.75;
/** An accusation is withdrawn below this belief, or once the belief has fallen to half its peak log-odds. */
export const APOLOGY_BELIEF = 0.45;
/** Confrontation is a rare public act: a claim is put to its subject at most this often. */
export const MAX_ACCUSATIONS_PER_DAY = 3;
export const ACCUSATION_COOLDOWN = 120;
/** Closeness (0..1) above which two villagers count as close. */
export const CLOSE = 0.65;
export const SIDE_THRESHOLD = 0.4;
export const FORGIVE_THRESHOLD = 0.6;
/** Small deterministic noise added to utilities so equal-looking days differ. */
export const UTILITY_JITTER = 0.05;

export const NEED_DECAY: Record<Need, number> = { hunger: 0.0023, rest: 0.0009, social: 0.003, duty: 0.002 };
export const NEED_RECOVERY = 0.02;
export const NEED_AT_DAWN: Record<Need, number> = { hunger: 0.8, rest: 1, social: 0.6, duty: 0.9 };
/** Below this deficit a need does not compete with the schedule at all. */
export const NEED_ATTENTION = 0.5;

/** Mood modifiers: delta in -1..1 and duration in ticks. The first three labels are fixed because rules test for them. */
export const MOOD = {
  accusedInPublic: { label: 'accused in public', delta: -0.3, ticks: 300 },
  accused: { label: 'accused', delta: -0.15, ticks: 200 },
  falselyAccused: { label: 'falsely accused', delta: -0.2, ticks: 400 },
  defended: { delta: 0.1, ticks: 200 },
  apology: { delta: 0.15, ticks: 300 },
  madeUp: { delta: 0.1, ticks: 200 },
  caughtOut: { label: 'caught out', delta: -0.2, ticks: 300 },
  liedTo: { label: 'lied to by the stranger', delta: -0.1, ticks: 200 },
} as const;

export const AFFINITY = {
  /** The accused's affinity for the accuser. */
  accused: -0.3,
  /** The accuser's affinity for the accused while the accusation stands. */
  accuser: -0.1,
  defended: 0.15,
  apology: 0.2,
  madeUp: 0.15,
} as const;

export const TRUST = {
  /** Lowered by every villager who remembers the stranger behind an exposed claim (then x trustLossMultiplier). */
  strangerExposed: -0.15,
  /** Lowered by the audience of a public accusation that later fell apart. */
  accuserExposed: -0.1,
  /** The accuser's trust in the accused while the accusation stands. */
  accusedByAccuser: -0.1,
  /** Base increment for a repair response, scaled by rumormind.trustRepair. */
  repairBase: 0.08,
} as const;

export const STRANGER_TRUST = { core: 0.5, other: 0.4, byId: { ben: 0.2, rosa: 0.7 } as Record<string, number> } as const;

export const INITIAL = {
  closeAffinity: 0.6,
  closeTrust: 0.7,
  closeBackAffinity: 0.4,
  closeBackTrust: 0.6,
  rivalAffinity: -0.5,
  rivalTrust: 0.3,
  rivalBackAffinity: -0.3,
  rivalBackTrust: 0.4,
  communityAffinity: 0.2,
  communityTrust: 0.55,
} as const;

/** Importance (1..10) of remembered events, for the dusk reflection. */
export const IMPORTANCE = {
  accused: 8,
  apologyReceived: 7,
  strangerExposed: 7,
  accusing: 6,
  defended: 6,
  madeUp: 6,
  witnessed: 5,
  heardRumor: 4,
  sawWhisper: 3,
  bystander: 4,
} as const;
