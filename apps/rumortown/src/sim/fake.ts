/**
 * A stand-in Simulation for building the renderer and UI before the real engine lands.
 * Twenty-four villagers wander a generated map and chat nonsense. Deterministic per seed.
 */
import { createRng } from 'rumormind';
import type { ClaimId } from 'rumormind';
import { readRegisteredClaim } from './registered-claim.js';
import {
  DAY_START_MINUTE,
  MINUTES_PER_DAY,
  type Dossier,
  type Facing,
  type GameClaim,
  type Inspection,
  type Intervention,
  type Look,
  type SimEvent,
  type Simulation,
  type ThreadLink,
  type TileKind,
  type Vec2,
  type VillageMap,
  type VillagerId,
  type VillagerView,
  type WorldSnapshot,
} from './types.js';

const NAMES = ['Mira', 'Tom', 'Ben', 'Ada', 'Rosa', 'Jonah', 'Elin', 'Pim', 'Sol', 'Greta', 'Ivo', 'Nell', 'Otto', 'Wren', 'Hal', 'Dag', 'Una', 'Cass', 'Fen', 'Lio', 'Mab', 'Rook', 'Tess', 'Yan'];
const PHRASES = ['Fair’s moved to Sunday, I hear.', 'Rain by evening, mark me.', 'Bread’s dearer again.', 'Did you see Jonah at the bridge?', 'My knee says storm.', 'Ada’s on the mend.', 'Who left the gate open?', 'The miller owes me a sack.'];
const PALETTE = ['#A3323B', '#3F5E8A', '#D9A531', '#6B8E4E', '#8A5A3C', '#5C4B7A', '#C96F3A', '#2F6F6D'];

export function createFakeMap(): VillageMap {
  const width = 40;
  const height = 28;
  const tiles: TileKind[] = new Array(width * height).fill('grass');
  const set = (x: number, y: number, k: TileKind) => {
    if (x >= 0 && y >= 0 && x < width && y < height) tiles[y * width + x] = k;
  };
  for (let x = 0; x < width; x++) set(x, 14, 'path');
  for (let y = 0; y < height; y++) set(20, y, 'path');
  for (let y = 0; y < height; y++) {
    set(33, y, 'water');
    set(34, y, 'water');
  }
  set(33, 14, 'bridge');
  set(34, 14, 'bridge');
  const house = (x: number, y: number) => {
    for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) set(x + i, y + j, i === 0 || j === 0 || i === 4 || j === 3 ? 'wall' : 'floor');
    set(x + 2, y + 3, 'door');
  };
  house(4, 4); house(12, 4); house(24, 4); house(4, 18); house(12, 18); house(24, 18);
  for (let i = 0; i < 12; i++) set(36 + (i % 3), 2 + Math.floor(i / 3) * 2, 'tree');
  set(20, 12, 'well');
  return {
    width,
    height,
    tiles,
    places: [
      { id: 'bakery', name: 'Bakery', kind: 'bakery', door: { x: 6, y: 8 }, rect: { x: 4, y: 4, w: 5, h: 4 }, spots: [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 7, y: 6 }], satisfies: ['hunger', 'duty'] },
      { id: 'inn', name: 'Inn', kind: 'inn', door: { x: 14, y: 8 }, rect: { x: 12, y: 4, w: 5, h: 4 }, spots: [{ x: 13, y: 5 }, { x: 14, y: 5 }, { x: 15, y: 6 }], satisfies: ['hunger', 'social'] },
      { id: 'square', name: 'Square', kind: 'square', door: { x: 20, y: 13 }, rect: { x: 17, y: 10, w: 7, h: 7 }, spots: [{ x: 18, y: 11 }, { x: 22, y: 12 }, { x: 19, y: 15 }], satisfies: ['social'] },
    ],
  };
}

function look(i: number, rng: () => number): Look {
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)] as T;
  return {
    body: pick(['round', 'tall', 'stout', 'slight'] as const),
    skin: pick(['#F1C9A5', '#D9A077', '#B47A50', '#8C5A3C', '#5E3A26']),
    hair: { style: pick(['bun', 'short', 'long', 'bald', 'braid', 'curly', 'cropped'] as const), color: pick(['#2E2A22', '#6B3F21', '#C9A66B', '#9E9E9E', '#A3323B']) },
    hat: pick(['none', 'none', 'straw', 'cap', 'bonnet', 'headscarf', 'hood', 'wide'] as const),
    top: PALETTE[i % PALETTE.length] as string,
    bottom: PALETTE[(i * 3 + 1) % PALETTE.length] as string,
    apron: rng() < 0.4 ? '#F6F0E4' : undefined,
    prop: pick(['none', 'none', 'basket', 'tool', 'book', 'loaf', 'bucket', 'broom', 'ledger', 'sack'] as const),
  };
}

export function createFakeCast(seed = 1): Dossier[] {
  const rng = createRng(seed);
  return NAMES.map((name, i) => ({
    id: name.toLowerCase(),
    name,
    pronouns: i % 2 ? { subject: 'he', object: 'him', possessive: 'his' } : { subject: 'she', object: 'her', possessive: 'her' },
    age: 22 + Math.floor(rng() * 50),
    role: ['baker', 'farmer', 'innkeeper', 'miller', 'teacher', 'fisher'][i % 6] as string,
    tier: i < 5 ? 'core' : i < 15 ? 'regular' : 'background',
    communities: ['market', 'inn'],
    home: 'inn',
    workplace: 'square',
    traits: { honesty: rng(), emotionality: rng(), extraversion: rng(), agreeableness: rng(), conscientiousness: rng(), openness: rng() },
    closeTo: [],
    secrets: [],
    schedule: [{ start: 0, place: 'square', activity: 'work' }],
    look: look(i, rng),
    voice: 'Plain.',
  }));
}

export function createFakeSimulation(seed = 1, replay: Intervention[] = []): Simulation {
  const rng = createRng(seed);
  const map = createFakeMap();
  const cast = createFakeCast(seed);
  const walkable = (x: number, y: number) => {
    const k = map.tiles[Math.floor(y) * map.width + Math.floor(x)];
    return k !== undefined && k !== 'water' && k !== 'wall' && k !== 'tree';
  };
  const randomWalkable = (): Vec2 => {
    for (;;) {
      const p = { x: Math.floor(rng() * map.width), y: Math.floor(rng() * map.height) };
      if (walkable(p.x, p.y)) return p;
    }
  };
  type Body = { view: VillagerView; target: Vec2; nextTalk: number };
  const bodies: Body[] = cast.map((d) => {
    const pos = randomWalkable();
    return { view: { id: d.id, name: d.name, tier: d.tier, pos: { x: pos.x + 0.5, y: pos.y + 0.5 }, facing: 's', moving: false, activity: 'idle', look: d.look, mood: 0 }, target: randomWalkable(), nextTalk: Math.floor(rng() * 20) };
  });
  const player = { pos: { x: 20.5, y: 15.5 }, facing: 's' as Facing, moving: false, target: null as Vec2 | null };
  const threads: ThreadLink[] = [];
  const events: SimEvent[] = [];
  const interventions: Intervention[] = [];
  const claims = new Map<ClaimId, GameClaim>([
    ['stole', { id: 'stole', kind: 'theft', about: 'tom', valence: -1, text: 'Tom stole bread from the bakery', severity: 2, contradicts: ['gaveTo'] }],
    ['gaveTo', { id: 'gaveTo', kind: 'kindness', about: 'tom', valence: 1, text: 'Tom took bread to Ada, who is ill', severity: 1, contradicts: ['stole'] }],
  ]);
  let tick = 0;

  const stepBody = (pos: Vec2, target: Vec2, speed: number): { moving: boolean; facing: VillagerView['facing'] } => {
    const dx = target.x + 0.5 - pos.x;
    const dy = target.y + 0.5 - pos.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.05) return { moving: false, facing: 's' };
    const s = Math.min(speed, dist);
    pos.x += (dx / dist) * s;
    pos.y += (dy / dist) * s;
    return { moving: true, facing: Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'e' : 'w') : dy > 0 ? 's' : 'n' };
  };

  const pending = replay.slice().sort((a, b) => a.tick - b.tick);
  let pendingIndex = 0;
  const applyWhisper = (listener: VillagerId, claimId: ClaimId, force = false): boolean => {
    const b = bodies.find((x) => x.view.id === listener);
    if (!b || !claims.has(claimId) || (!force && Math.hypot(b.view.pos.x - player.pos.x, b.view.pos.y - player.pos.y) > 2)) return false;
    interventions.push({ tick, listener, claimId });
    threads.push({ from: 'stranger', to: listener, claimId, tick });
    events.push({ kind: 'whisper', tick, listener, claimId, witnesses: [] });
    b.view.bubble = { text: 'Is that so?', untilTick: tick + 6 };
    return true;
  };
  const applyPending = (): void => {
    while (pendingIndex < pending.length && pending[pendingIndex]!.tick <= tick) {
      const iv = pending[pendingIndex++]!;
      const claim = readRegisteredClaim(iv.claimId, new Map(cast.map((d) => [d.id, d])));
      if (claim && !claims.has(claim.id)) claims.set(claim.id, claim);
      applyWhisper(iv.listener, iv.claimId, true);
    }
  };
  applyPending();

  return {
    get tick() {
      return tick;
    },
    get dayIndex() {
      return Math.floor(tick / MINUTES_PER_DAY);
    },
    claims,
    cast: new Map(cast.map((d) => [d.id, d])),
    step() {
      tick += 1;
      for (const b of bodies) {
        const m = stepBody(b.view.pos, b.target, 0.9);
        b.view.moving = m.moving;
        if (m.moving) b.view.facing = m.facing;
        else if (rng() < 0.02) b.target = randomWalkable();
        if (b.view.bubble && b.view.bubble.untilTick <= tick) b.view.bubble = undefined;
        if (tick >= b.nextTalk) {
          b.nextTalk = tick + 15 + Math.floor(rng() * 40);
          const near = bodies.find((o) => o !== b && Math.hypot(o.view.pos.x - b.view.pos.x, o.view.pos.y - b.view.pos.y) < 3);
          const text = PHRASES[Math.floor(rng() * PHRASES.length)] as string;
          b.view.bubble = { text, untilTick: tick + 6, to: near?.view.id };
          events.push({ kind: 'line', tick, speaker: b.view.id, listeners: near ? [near.view.id] : [], act: 'smalltalk', text, lineId: `fake-${tick}` });
          if (near && rng() < 0.3) threads.push({ from: b.view.id, to: near.view.id, claimId: 'stole', tick });
        }
      }
      if (player.target) {
        const m = stepBody(player.pos, player.target, 1.4);
        player.moving = m.moving;
        if (m.moving) player.facing = m.facing;
        else player.target = null;
      }
      if (tick % MINUTES_PER_DAY === 0) events.push({
        kind: 'day-end', tick, dayIndex: tick / MINUTES_PER_DAY - 1, ending: 'quiet',
        summary: 'The stand-in village talked about bread and the weather.',
      });
      applyPending();
    },
    snapshot(): WorldSnapshot {
      return {
        tick,
        dayIndex: Math.floor(tick / MINUTES_PER_DAY),
        minuteOfDay: DAY_START_MINUTE + (tick % MINUTES_PER_DAY),
        villagers: bodies.map((b) => ({ ...b.view, pos: { ...b.view.pos }, bubble: b.view.bubble ? { ...b.view.bubble } : undefined })),
        player: { pos: { ...player.pos }, facing: player.facing, moving: player.moving },
        threads: threads.slice(-40),
      };
    },
    inspect(id: VillagerId): Inspection {
      const d = cast.find((c) => c.id === id);
      if (!d) throw new Error(`unknown villager ${id}`);
      return {
        id,
        name: d.name,
        role: d.role,
        activity: 'idle',
        mood: 0.1,
        beliefs: [{ claimId: 'stole', text: 'Tom stole bread from the bakery', confidence: 0.64, chain: ['The stranger told Mira at 09:12', 'Mira told Ben at 10:30'], independentSources: 1 }],
        relations: cast.filter((c) => c.id !== id).slice(0, 4).map((c) => ({ to: c.id, name: c.name, trust: 0.5, affinity: 0.2, why: 'Old neighbours.' })),
        trustInStranger: 0.6,
        moods: [{ label: 'Defended by Ben', delta: 8, untilTick: tick + 300 }],
        decisions: [{ tick, action: 'gossip', why: '64% sure Tom stole the bread; Ben is close and would want to know.' }],
      };
    },
    registerClaim(claim) {
      if (!cast.some((d) => d.id === claim.about)) throw new Error(`unknown villager ${claim.about}`);
      if (!claims.has(claim.id)) claims.set(claim.id, { ...claim, contradicts: [...(claim.contradicts ?? [])] });
    },
    whisper: (listener, claimId) => applyWhisper(listener, claimId),
    movePlayer(target) {
      player.target = { x: Math.floor(target.x), y: Math.floor(target.y) };
    },
    events(since) {
      return events.filter((e) => e.tick >= since);
    },
    interventions() {
      return interventions.slice();
    },
  };
}
