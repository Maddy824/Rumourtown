/**
 * The conversation orchestrator: decides, per message, whether the village can answer from its own
 * state (instantly, deterministically, for free) or whether the villager being spoken to needs the
 * language model. When it does, it hands the model only what that villager actually knows and feels.
 *
 * The simulation stays the source of truth. The model is a voice, called only when needed.
 */
import type { Inspection, Simulation, VillageMap, VillagerId, WorldSnapshot } from '../sim/types.js';

export type Action = 'none' | 'move' | 'approach' | 'pause' | 'resume' | 'look';

export type Route =
  | { kind: 'local'; reply: string; action: Action; target: string; reason: string }
  | { kind: 'model'; facts: string[]; reason: string };

export interface OrchestratorInput {
  text: string;
  /** The villager being addressed, or null for the village narrator. */
  speaker: VillagerId | null;
  sim: Pick<Simulation, 'cast' | 'inspect'>;
  snapshot: Pick<WorldSnapshot, 'villagers' | 'minuteOfDay'>;
  map: Pick<VillageMap, 'places'>;
  /** Plain sentences about the latest rumor beats, newest first (from the story rail). */
  news: readonly string[];
}

const fold = (s: string): string => s.toLowerCase().replace(/[’']/g, "'").replace(/[^\p{L}\p{N}' ]+/gu, ' ').replace(/\s+/g, ' ').trim();

const MOVE = /\b(?:take|bring|lead|walk|guide|show) (?:me|us)(?: the way)? (?:over |back )?to\b|\b(?:go|head|walk|get|run) (?:over |back )?to\b|\bwhere(?:'s| is)\b|\bhow (?:do|can) i get to\b|\bway to\b/;
const VISIT = /\b(?:visit|go see|see|meet|find|talk to|speak to|speak with|talk with|look for)\b/;
const PAUSE = /^(?:pause|stop time|freeze(?: time)?|hold (?:on|time)|wait)(?: please)?$/;
const RESUME = /^(?:resume|unpause|continue|carry on|let time (?:flow|run|go)|play)(?: please)?$/;
const LOOK = /^(?:look around|explore|show me the (?:map|village|town)|open the map)(?: please)?$/;
const SOURCE = /\b(?:who told you|where did you hear|how do you know|who said)\b/;
const NEWS = /\b(?:gossip\w*|what(?:'s| is| are) (?:people|everyone|folk|they) (?:saying|talking about|whispering)|any news|what(?:'s| is) (?:new|going on|happening)|what happened|heard anything)\b/;

/** Words that point at a place, longest first, so "commons bridge" beats "bridge". */
function placeAliases(map: Pick<VillageMap, 'places'>): { alias: string; id: string }[] {
  const out: { alias: string; id: string }[] = [];
  for (const p of map.places) {
    const name = fold(p.name);
    out.push({ alias: name, id: p.id }, { alias: fold(p.id.replace(/-/g, ' ')), id: p.id });
    const words = name.split(' ');
    if (words.length > 1 && !/'s$/.test(words[0]!)) out.push({ alias: words[words.length - 1]!, id: p.id });
    const owner = /^(\w+)'s home$/.exec(name);
    if (owner) for (const w of ['home', 'house', 'place', 'cottage']) out.push({ alias: `${owner[1]}'s ${w}`, id: p.id });
  }
  const extra: Record<string, string> = { 'tea house': 'teahouse', willow: 'teahouse', market: 'east-market', 'old bridge': 'bridge', 'south bridge': 'bridge-south', 'post office': 'posthouse', library: 'reading-room', church: 'chapel', pub: 'inn', tavern: 'inn', forge: 'smithy', blacksmith: 'smithy', "baker's": 'bakery', fields: 'field-north', field: 'field-north', woods: 'woodland', forest: 'woodland', garden: 'gardens', river: 'riverside' };
  for (const [alias, id] of Object.entries(extra)) if (map.places.some(p => p.id === id)) out.push({ alias, id });
  return out.sort((a, b) => b.alias.length - a.alias.length);
}

function findPlace(text: string, map: Pick<VillageMap, 'places'>): string | null {
  const t = ` ${text} `;
  for (const { alias, id } of placeAliases(map)) if (alias && t.includes(` ${alias} `)) return id;
  return null;
}

function findPerson(text: string, sim: Pick<Simulation, 'cast'>): VillagerId | null {
  const t = ` ${text} `;
  for (const [id, d] of sim.cast) {
    const n = fold(d.name);
    if (t.includes(` ${n} `) || t.includes(` ${n}'s `)) {
      // "Rosa's home" is a place, not a visit to Rosa.
      if (new RegExp(`\\b${n}'s (?:home|house|place|cottage)\\b`).test(text)) continue;
      return id;
    }
  }
  return null;
}

const clockText = (minuteOfDay: number): string => `${String(Math.floor(minuteOfDay / 60) % 24).padStart(2, '0')}:${String(minuteOfDay % 60).padStart(2, '0')}`;
const isNight = (minuteOfDay: number): boolean => { const h = Math.floor(minuteOfDay / 60) % 24; return h >= 22 || h < 6; };

function band(c: number): string {
  if (c >= 0.85) return 'I am sure';
  if (c >= 0.65) return 'I am fairly sure';
  if (c >= 0.45) return 'I half believe';
  return 'I doubt';
}

/** Lowercase a sentence's first word only when it is not a name ("The miller…" → "the miller…", "Tom…" stays). */
const lowerFirst = (s: string): string => /^(?:The|A|An|Someone|Somebody|There|It|They|Everyone|Nobody|People)\b/.test(s) ? s[0]!.toLowerCase() + s.slice(1) : s;
const clip = (s: string, n = 200): string => (s.length <= n ? s : `${s.slice(0, n - 1)}…`);

/** What one villager actually knows and feels right now, as short first-person sentences. */
export function villagerFacts(inspection: Inspection, minuteOfDay: number): string[] {
  const facts: string[] = [`I am ${inspection.name}, the ${inspection.role}. It is ${clockText(minuteOfDay)} and I am ${inspection.activity === 'sleep' ? 'asleep' : `busy with ${inspection.activity}`}.`];
  const beliefs = [...inspection.beliefs].filter(b => b.confidence >= 0.35).sort((a, b) => b.confidence - a.confidence).slice(0, 4);
  for (const b of beliefs) {
    const how = b.chain.length ? ` (${b.chain[b.chain.length - 1]})` : '';
    facts.push(clip(`${band(b.confidence)} that ${lowerFirst(b.text)}${how}.`));
  }
  if (!beliefs.length) facts.push('I have not heard any rumors worth repeating.');
  for (const m of [...inspection.moods].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 2)) {
    facts.push(clip(`I feel ${m.delta >= 0 ? 'better' : 'worse'} because: ${lowerFirst(m.label)}.`));
  }
  const rel = [...inspection.relations].sort((a, b) => b.affinity - a.affinity);
  const close = rel[0], far = rel[rel.length - 1];
  if (close && close.affinity > 0.2) facts.push(clip(`I am close to ${close.name}${close.why ? ` (${lowerFirst(close.why)})` : ''}.`));
  if (far && far !== close && far.affinity < -0.1) facts.push(clip(`I do not get on with ${far.name}${far.why ? ` (${lowerFirst(far.why)})` : ''}.`));
  facts.push(inspection.trustInStranger >= 0.6 ? 'I trust the stranger I am talking to.' : inspection.trustInStranger <= 0.35 ? 'I do not trust this stranger.' : 'I am unsure about this stranger.');
  return facts.slice(0, 12);
}

/** What the village as a whole knows: the latest rumor beats and who is awake. */
export function villageFacts(input: Pick<OrchestratorInput, 'snapshot' | 'news'>): string[] {
  const awake = input.snapshot.villagers.filter(v => v.activity !== 'sleep').length;
  const facts = [`It is ${clockText(input.snapshot.minuteOfDay)}. ${awake} villagers are awake${isNight(input.snapshot.minuteOfDay) ? '; most of the village is asleep, and the inn stays open late' : ''}.`];
  for (const n of input.news.slice(0, 4)) facts.push(clip(n));
  if (!input.news.length) facts.push('Nobody is spreading any new story right now.');
  return facts;
}

/** Decide how to answer one message. Pure and deterministic. */
export function orchestrate(input: OrchestratorInput): Route {
  const text = fold(input.text);
  const name = input.speaker ? input.sim.cast.get(input.speaker)?.name ?? 'I' : null;
  if (PAUSE.test(text)) return { kind: 'local', reply: 'Time holds.', action: 'pause', target: '', reason: 'command' };
  if (RESUME.test(text)) return { kind: 'local', reply: 'Time flows again.', action: 'resume', target: '', reason: 'command' };
  if (LOOK.test(text)) return { kind: 'local', reply: 'Here is the whole village.', action: 'look', target: '', reason: 'command' };

  const wantsMove = MOVE.test(text), wantsVisit = VISIT.test(text);
  if (wantsMove || wantsVisit) {
    const place = findPlace(text, input.map);
    const person = findPerson(text, input.sim);
    if (person && (wantsVisit || !place)) {
      const who = input.sim.cast.get(person)!.name;
      const asleep = input.snapshot.villagers.find(v => v.id === person)?.activity === 'sleep';
      return { kind: 'local', reply: asleep ? `${who} is asleep at this hour, but I can take you to their door.` : `Let's find ${who}.`, action: 'approach', target: person, reason: 'visit' };
    }
    if (place) {
      const placeName = input.map.places.find(p => p.id === place)!.name;
      return { kind: 'local', reply: `${placeName} is this way.`, action: 'move', target: place, reason: 'move' };
    }
  }

  if (input.speaker && SOURCE.test(text)) {
    const inspection = input.sim.inspect(input.speaker);
    const top = [...inspection.beliefs].sort((a, b) => b.confidence - a.confidence)[0];
    const reply = top && top.chain.length
      ? `About “${top.text}”: ${top.chain[top.chain.length - 1]!}.`
      : 'Nobody has told me anything worth repeating.';
    return { kind: 'local', reply: clip(reply, 240), action: 'none', target: '', reason: 'provenance' };
  }

  if (!input.speaker && NEWS.test(text)) {
    const reply = input.news.length
      ? `People are talking. ${input.news.slice(0, 2).join(' ')}`
      : isNight(input.snapshot.minuteOfDay) ? 'The village is mostly asleep. The inn is still awake if you want to listen.' : 'It is a quiet day. Nobody is carrying a new story yet.';
    return { kind: 'local', reply: clip(reply, 240), action: 'none', target: '', reason: 'news' };
  }

  const facts = input.speaker ? villagerFacts(input.sim.inspect(input.speaker), input.snapshot.minuteOfDay) : villageFacts(input);
  return { kind: 'model', facts, reason: name ? `voice of ${name}` : 'village narrator' };
}
