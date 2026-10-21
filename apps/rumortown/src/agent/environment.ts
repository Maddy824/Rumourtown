/** A bounded, local tool interface for the traveller. No DOM, network or model calls. */
import { cast, claims, castVersion } from '../content/cast/index.js';
import { villageMap } from '../content/map/index.js';
import { exportRun, MODEL_VERSION } from '../research/model.js';
import { createSimulation } from '../sim/engine.js';
import { createWrittenClaim } from '../sim/registered-claim.js';
import { createTalk } from '../sim/talk/index.js';
import { createMover, createWorld } from '../sim/world/index.js';
import type { GameClaim } from '../sim/types.js';

export const AGENT_LIMITS = { ticks: 2700, stepsPerCall: 120, actions: 2000, viewRadius: 6 } as const;
const kinds = ['theft', 'cheating', 'romance', 'lying', 'broken-promise', 'insult', 'hoarding', 'shirking', 'boasting', 'kindness', 'paid-debt', 'nursed'];
const id = { type: 'string', minLength: 1, maxLength: 64 };
const ticks = { type: 'integer', minimum: 1, maximum: AGENT_LIMITS.stepsPerCall };
const schema = (properties: Record<string, unknown>) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
export const AGENT_TOOLS = [
  { name: 'observe', description: 'See the traveller and people within six tiles and line of sight. Does not advance time.', inputSchema: schema({}) },
  { name: 'move', description: 'Choose a reachable place. Starts a path; use wait to walk it.', inputSchema: schema({ placeId: id }) },
  { name: 'approach', description: 'Follow a currently visible person for at most ticks minutes. Reports whether whisper range was reached.', inputSchema: schema({ villagerId: id, ticks }) },
  { name: 'wait', description: 'Advance the world by a bounded number of minutes.', inputSchema: schema({ ticks }) },
  { name: 'whisper', description: 'Tell a person within two tiles your sentence. Supply explicit meaning; the engine does not infer it from prose.', inputSchema: schema({ listener: id, text: { type: 'string', minLength: 1, maxLength: 100 }, about: id, kind: { type: 'string', enum: kinds }, severity: { type: 'integer', enum: [1, 2, 3] } }) },
] as const;

export type AgentAction = { tool: string; arguments: Record<string, unknown> };
export interface AgentReplay { schema: 'rumortown-agent/1'; seed: number; castVersion: string; modelVersion: string; actions: AgentAction[] }
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const copy = <T>(v: T): T => structuredClone(v);

export function createAgentEnvironment(seed = 731) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Seed must be an unsigned 32-bit integer.');
  const world = { ...createWorld(villageMap), createMover };
  const sim = createSimulation({ seed, cast, claims, world, talk: createTalk(cast), days: 3 });
  const actions: AgentAction[] = [];
  function observe() {
    const s = sim.snapshot();
    return copy({ tick: sim.tick, done: sim.tick >= AGENT_LIMITS.ticks, actionsRemaining: AGENT_LIMITS.actions - actions.length,
      player: s.player, creditsUsedUsd: 0,
      nearby: s.villagers.filter(v => world.distance(v.pos, s.player.pos) <= AGENT_LIMITS.viewRadius && world.lineOfSight(s.player.pos, v.pos))
        .map(v => ({ id: v.id, name: v.name, pos: v.pos, activity: v.activity, canWhisper: world.distance(v.pos, s.player.pos) <= 2,
          ...(v.bubble ? { speech: v.bubble.text } : {}) })),
    });
  }
  const fail = (error: string) => ({ ok: false as const, error, observation: observe() });
  function call(tool: string, args: unknown = {}) {
    const spec = AGENT_TOOLS.find(t => t.name === tool);
    if (!spec || !record(args)) return fail('Unknown tool or invalid arguments.');
    const fields = spec.inputSchema.required;
    if (Object.keys(args).some(k => !fields.includes(k)) || fields.some(k => !Object.hasOwn(args, k))) return fail('Supply exactly the documented arguments.');
    if (tool === 'observe') return { ok: true as const, observation: observe() };
    if (sim.tick >= AGENT_LIMITS.ticks || actions.length >= AGENT_LIMITS.actions) return fail('This run has reached its limit. Start a new environment.');
    if ((tool === 'wait' || tool === 'approach') &&
        (typeof args.ticks !== 'number' || !Number.isInteger(args.ticks) || args.ticks < 1 || args.ticks > AGENT_LIMITS.stepsPerCall)) return fail('ticks must be an integer from 1 to 120.');
    let reached: boolean | undefined;
    let claimId: string | undefined;
    if (tool === 'move') {
      const place = villageMap.places.find(p => p.id === args.placeId);
      if (!place || world.findPath(sim.snapshot().player.pos, place.door) === null) return fail('Unknown or unreachable place.');
      sim.movePlayer(place.door);
    } else if (tool === 'approach') {
      if (!observe().nearby.some(v => v.id === args.villagerId)) return fail('Approach a visible person from the latest observation.');
      reached = false;
      for (let i = 0; i <= (args.ticks as number); i++) {
        const s = sim.snapshot(), person = s.villagers.find(v => v.id === args.villagerId)!;
        if (world.distance(s.player.pos, person.pos) <= 1.5) {
          sim.movePlayer({ x: Math.floor(s.player.pos.x), y: Math.floor(s.player.pos.y) }); reached = true; break;
        }
        if (i === args.ticks || sim.tick >= AGENT_LIMITS.ticks) break;
        sim.movePlayer({ x: Math.floor(person.pos.x), y: Math.floor(person.pos.y) }); sim.step();
      }
    } else if (tool === 'wait') {
      for (let i = 0; i < (args.ticks as number) && sim.tick < AGENT_LIMITS.ticks; i++) sim.step();
    } else if (tool === 'whisper') {
      const listener = sim.snapshot().villagers.find(v => v.id === args.listener);
      if (!listener || listener.id === args.about || world.distance(sim.snapshot().player.pos, listener.pos) > 2) return fail('Choose a listener within two tiles who is not the subject.');
      let claim: GameClaim;
      try {
        if (typeof args.text !== 'string' || typeof args.about !== 'string') return fail('Invalid whisper text or subject.');
        claim = createWrittenClaim(args.text, args.about, args.kind as GameClaim['kind'], args.severity as GameClaim['severity'], sim.cast);
      } catch { return fail('Use 1–100 characters, a cast member, a supported kind and severity 1, 2 or 3.'); }
      sim.registerClaim(claim);
      if (!sim.whisper(listener.id, claim.id)) return fail('The whisper was refused.');
      claimId = claim.id;
    }
    actions.push(copy({ tool, arguments: args }));
    return { ok: true as const, ...(reached !== undefined ? { reached } : {}), ...(claimId ? { claimId } : {}), observation: observe() };
  }
  return {
    observe, call,
    describe: () => copy({ tools: AGENT_TOOLS, limits: AGENT_LIMITS, castVersion, modelVersion: MODEL_VERSION,
      places: villageMap.places.filter(p => world.isWalkable(p.door.x, p.door.y)).map(p => ({ id: p.id, name: p.name, district: p.district })),
      people: cast.map(d => ({ id: d.id, name: d.name, role: d.role })), creditsUsedUsd: 0 }),
    replay: (): AgentReplay => copy({ schema: 'rumortown-agent/1', seed, castVersion, modelVersion: MODEL_VERSION, actions }),
    /** Full hidden state is for the evaluator, never included in ordinary tool results. */
    // The export includes a module namespace of model constants. Serialise it to plain
    // JSON data; browser structuredClone rejects namespace objects even though Node's
    // bundled version appears to be an ordinary object.
    research: (): ReturnType<typeof exportRun> => JSON.parse(JSON.stringify(exportRun(sim, seed, castVersion, villageMap))),
  };
}

export function replayAgentRun(input: unknown) {
  if (!record(input) || input.schema !== 'rumortown-agent/1' || input.castVersion !== castVersion || input.modelVersion !== MODEL_VERSION ||
      typeof input.seed !== 'number' || !Array.isArray(input.actions) || input.actions.length > AGENT_LIMITS.actions) throw new Error('Incompatible agent replay.');
  const env = createAgentEnvironment(input.seed);
  for (const action of input.actions) {
    if (!record(action) || typeof action.tool !== 'string' || !env.call(action.tool, action.arguments).ok) throw new Error('Invalid replay action.');
  }
  return env;
}
