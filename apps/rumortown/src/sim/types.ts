/**
 * The contract every module codes against. Modules own their directories and
 * import only from here and from `rumormind`. Change this file only by agreement
 * recorded in docs/superpowers/plans.
 */
import type { Claim, ClaimId, CharacterId } from 'rumormind';

export type VillagerId = CharacterId;
export type PlaceId = string;
/** One tick is one game-minute. */
export type Tick = number;

/** A day runs 07:00 to 22:00. */
export const DAY_START_MINUTE = 7 * 60;
export const MINUTES_PER_DAY = 15 * 60;
/** CSS pixels per tile at the close camera. */
export const TILE = 32;

export interface Vec2 {
  x: number;
  y: number;
}

/* ---------------- Map and world ---------------- */

export type TileKind =
  | 'grass'
  | 'path'
  | 'water'
  | 'bridge'
  | 'floor'
  | 'wall'
  | 'door'
  | 'field'
  | 'tree'
  | 'well';

export type PlaceKind =
  | 'home'
  | 'bakery'
  | 'inn'
  | 'mill'
  | 'chapel'
  | 'school'
  | 'square'
  | 'field'
  | 'well'
  | 'bridge'
  | 'shop'
  | 'smithy'
  | 'orchard'
  | 'riverside';

export type Need = 'hunger' | 'rest' | 'social' | 'duty';

export interface Place {
  id: PlaceId;
  name: string;
  kind: PlaceKind;
  /** The walkable tile paths arrive at: just outside the door, or the entry tile of an outdoor place. */
  door: Vec2;
  /** Footprint in tiles. */
  rect: { x: number; y: number; w: number; h: number };
  /** Walkable standing spots inside or on the place. At least three. */
  spots: Vec2[];
  satisfies: Need[];
}

export interface VillageMap {
  width: number;
  height: number;
  /** Row-major, length width * height. */
  tiles: TileKind[];
  places: Place[];
}

export type Facing = 'n' | 's' | 'e' | 'w';

export interface WorldApi {
  readonly map: VillageMap;
  /** Optional world-owned movement implementation. */
  createMover?(start: Vec2): Mover;
  isWalkable(x: number, y: number): boolean;
  /** 4-connected A* on integer tiles. Excludes `from`, includes `to`. Null when unreachable. */
  findPath(from: Vec2, to: Vec2): Vec2[] | null;
  /** True when no wall or tree tile lies between the two tile centres. */
  lineOfSight(a: Vec2, b: Vec2): boolean;
  placeAt(pos: Vec2): Place | null;
  place(id: PlaceId): Place;
  /** Euclidean distance in tiles. */
  distance(a: Vec2, b: Vec2): number;
  /** A free standing spot for the place, chosen deterministically with rng. */
  spotFor(placeId: PlaceId, occupied: readonly Vec2[], rng: () => number): Vec2;
}

/** Interpolated movement along a tile path with light separation from others. */
export interface Mover {
  pos: Vec2;
  facing: Facing;
  moving: boolean;
  setPath(path: Vec2[]): void;
  /** Advance by dt game-minutes at `speed` tiles per game-minute. */
  update(dt: number, speed: number, others: readonly Vec2[]): void;
  arrived(): boolean;
  stop(): void;
}

/* ---------------- Cast ---------------- */

export type Tier = 'core' | 'regular' | 'background';

/** HEXACO-lite, each 0..1. Traits bias tendencies by at most ±20%; situations dominate. */
export interface Traits {
  honesty: number;
  emotionality: number;
  extraversion: number;
  agreeableness: number;
  conscientiousness: number;
  openness: number;
}

export interface Pronouns {
  subject: string;
  object: string;
  possessive: string;
}

export type Body = 'round' | 'tall' | 'stout' | 'slight';
export type HairStyle = 'bun' | 'short' | 'long' | 'bald' | 'braid' | 'curly' | 'cropped';
export type Hat = 'none' | 'straw' | 'cap' | 'bonnet' | 'headscarf' | 'hood' | 'wide';
export type Prop = 'none' | 'basket' | 'tool' | 'book' | 'loaf' | 'bucket' | 'broom' | 'ledger' | 'sack';

/** Everything the renderer needs to compose a distinct felt villager. Colours are hex. */
export interface Look {
  body: Body;
  skin: string;
  hair: { style: HairStyle; color: string };
  hat: Hat;
  top: string;
  bottom: string;
  apron?: string;
  prop: Prop;
}

export type ClaimKind =
  | 'theft'
  | 'cheating'
  | 'romance'
  | 'lying'
  | 'broken-promise'
  | 'insult'
  | 'hoarding'
  | 'shirking'
  | 'boasting'
  | 'kindness'
  | 'paid-debt'
  | 'nursed';

export type SecretKind = 'delivery' | 'gift' | 'borrow' | 'meeting' | 'practice' | 'debt' | 'nursing';

/** A witnessable private act. These are the facts lies collide with. */
export interface Secret {
  id: string;
  kind: SecretKind;
  /** Plain English, usable in the story log and as an alternative explanation. */
  description: string;
  place: PlaceId;
  /** Minutes since day start, [start, end). */
  window: [number, number];
  with?: VillagerId;
  /** Claim kinds about this villager that a witness of this act would find confirmed or contradicted. */
  confirms: ClaimKind[];
  contradicts: ClaimKind[];
}

export type Activity =
  | 'work'
  | 'eat'
  | 'rest'
  | 'errand'
  | 'worship'
  | 'idle'
  | 'visit'
  | 'sleep'
  | 'secret'
  | 'talk';

export interface ScheduleEntry {
  /** Minutes since day start. Entries sorted ascending; the first starts at 0. */
  start: number;
  place: PlaceId;
  activity: Activity;
}

export interface Dossier {
  id: VillagerId;
  name: string;
  pronouns: Pronouns;
  age: number;
  role: string;
  tier: Tier;
  /** Two of: market, farm, inn, chapel. */
  communities: string[];
  home: PlaceId;
  workplace: PlaceId;
  traits: Traits;
  closeTo: VillagerId[];
  rival?: VillagerId;
  secrets: Secret[];
  schedule: ScheduleEntry[];
  look: Look;
  /** One or two sentences on how they talk, for line authors. */
  voice: string;
  /** Rationed to once a day. */
  catchphrase?: string;
  /** Starting knowledge about others. */
  knows?: { claimId: ClaimId; confidence: number }[];
}

/* ---------------- Claims ---------------- */

/** A game claim is a rumormind Claim with a kind from the fixed taxonomy and display text. */
export interface GameClaim extends Claim {
  kind: ClaimKind;
  /** Plain sentence, e.g. "Tom stole bread from the bakery". */
  text: string;
  severity: 1 | 2 | 3;
  object?: string;
  target?: VillagerId;
  /** Set on an innocent claim: the harmful claim it is the alternative explanation for. */
  alternativeOf?: ClaimId;
}

/* ---------------- Talk ---------------- */

export type SpeechAct =
  | 'greet'
  | 'smalltalk'
  | 'news'
  | 'gossip'
  | 'warn'
  | 'confide'
  | 'accuse'
  | 'deny'
  | 'explain'
  | 'defend'
  | 'doubt'
  | 'agree'
  | 'apologize'
  | 'forgive'
  | 'refuse'
  | 'farewell'
  | 'reactToWhisper';

export interface LineKey {
  act: SpeechAct;
  speaker: Dossier;
  listener: Dossier;
  claim?: GameClaim;
  /** The villager the claim is about. */
  subject?: Dossier;
  /** Who the speaker remembers hearing it from. */
  source?: Dossier | 'stranger';
  /** Speaker's belief in the claim, 0..1. Below 0.6 the line should hedge. */
  confidence?: number;
  /** -1..1 */
  mood: number;
  /** Small-talk topic id from pickTopic. */
  topic?: string;
  tick: Tick;
}

export interface SpokenLine {
  lineId: string;
  text: string;
}

export interface TalkApi {
  /**
   * Fills the most specific matching line. Deterministic given rng. Honours a one-day cooldown per
   * lineId per speaker when an alternative exists. Capitalised names; "you" when the listener is the subject.
   */
  say(key: LineKey, rng: () => number): SpokenLine;
  /** A small-talk topic for the moment, e.g. 'weather-rain', 'the-fair', 'bread-prices'. */
  pickTopic(speaker: Dossier, listener: Dossier, minuteOfDay: number, rng: () => number): string;
}

/* ---------------- Events, interventions, views ---------------- */

export interface Intervention {
  tick: Tick;
  listener: VillagerId;
  claimId: ClaimId;
}

export type Ending = 'reconciled' | 'exposed' | 'split' | 'grudge' | 'died' | 'quiet';

export type SimEvent =
  | { kind: 'line'; tick: Tick; speaker: VillagerId; listeners: VillagerId[]; act: SpeechAct; text: string; lineId: string; claimId?: ClaimId }
  | { kind: 'belief'; tick: Tick; villager: VillagerId; claimId: ClaimId; before: number; after: number; source: VillagerId | 'stranger' | 'self'; independent: boolean }
  | { kind: 'witness'; tick: Tick; villager: VillagerId; what: string; subject?: VillagerId; secretId?: string }
  | { kind: 'action'; tick: Tick; villager: VillagerId; action: string; why: string }
  | { kind: 'whisper'; tick: Tick; listener: VillagerId; claimId: ClaimId; witnesses: VillagerId[] }
  | { kind: 'relationship'; tick: Tick; from: VillagerId; to: VillagerId | 'stranger'; trust: number; affinity: number; why: string }
  | { kind: 'mood'; tick: Tick; villager: VillagerId; label: string; delta: number; untilTick: Tick }
  | { kind: 'day-end'; tick: Tick; dayIndex: number; summary: string; ending: Ending };

export interface VillagerView {
  id: VillagerId;
  name: string;
  tier: Tier;
  pos: Vec2;
  facing: Facing;
  moving: boolean;
  activity: Activity;
  look: Look;
  /** -1..1 */
  mood: number;
  bubble?: { text: string; untilTick: Tick; to?: VillagerId };
}

export interface ThreadLink {
  from: VillagerId | 'stranger';
  to: VillagerId;
  claimId: ClaimId;
  tick: Tick;
}

export interface WorldSnapshot {
  tick: Tick;
  dayIndex: number;
  minuteOfDay: number;
  villagers: VillagerView[];
  player: { pos: Vec2; facing: Facing; moving: boolean };
  threads: ThreadLink[];
}

export interface BeliefView {
  claimId: ClaimId;
  text: string;
  confidence: number;
  /** Plain-English chain, oldest first, e.g. "The stranger told Mira at 09:12", "Mira told Ben at 10:30". */
  chain: string[];
  independentSources: number;
}

export interface RelationView {
  to: VillagerId;
  name: string;
  trust: number;
  affinity: number;
  why?: string;
}

export interface MoodView {
  label: string;
  delta: number;
  untilTick: Tick;
}

export interface DecisionView {
  tick: Tick;
  action: string;
  why: string;
}

export interface Inspection {
  id: VillagerId;
  name: string;
  role: string;
  activity: Activity;
  mood: number;
  beliefs: BeliefView[];
  relations: RelationView[];
  trustInStranger: number;
  moods: MoodView[];
  decisions: DecisionView[];
}

export interface Simulation {
  readonly tick: Tick;
  readonly dayIndex: number;
  readonly claims: ReadonlyMap<ClaimId, GameClaim>;
  readonly cast: ReadonlyMap<VillagerId, Dossier>;
  /** Advance one game-minute. Deterministic. */
  step(): void;
  snapshot(): WorldSnapshot;
  inspect(id: VillagerId): Inspection;
  /** Add a claim before whispering it. Existing ids cannot be replaced. */
  registerClaim(claim: GameClaim): void;
  /** Whisper at the current tick. Returns false when the player is not within two tiles of the listener. */
  whisper(listener: VillagerId, claimId: ClaimId): boolean;
  /** Walk the player toward a tile. */
  movePlayer(target: Vec2): void;
  /** Events with tick >= sinceTick, in order. */
  events(sinceTick: Tick): SimEvent[];
  /** Whispers so far, for share links. */
  interventions(): Intervention[];
}

export interface SimulationOptions {
  seed: number;
  cast: Dossier[];
  claims: GameClaim[];
  world: WorldApi;
  talk: TalkApi;
  /** Replayed at their ticks. */
  interventions?: Intervention[];
  days?: number;
}

/* ---------------- Rendering ---------------- */

export interface Camera {
  /** World centre in tiles. */
  center: Vec2;
  /** CSS pixels per tile. */
  zoom: number;
  /** Viewport size in CSS pixels. */
  width: number;
  height: number;
}

export interface RenderOptions {
  threads: boolean;
  selected?: VillagerId;
  /** 0..1, interpolation between the previous and current snapshot for smooth motion. */
  alpha: number;
  reducedMotion: boolean;
}

export interface Renderer {
  resize(width: number, height: number, dpr: number): void;
  render(previous: WorldSnapshot | null, current: WorldSnapshot, camera: Camera, options: RenderOptions): void;
  /** World tile coordinates to CSS pixels within the canvas. */
  project(pos: Vec2, camera: Camera): { x: number; y: number };
  unproject(px: number, py: number, camera: Camera): Vec2;
  villagerAt(px: number, py: number, snapshot: WorldSnapshot, camera: Camera): VillagerId | null;
}

/* ---------------- Share links ---------------- */

export interface ShareState {
  v: 1;
  seed: number;
  cast: string;
  interventions: Intervention[];
}
