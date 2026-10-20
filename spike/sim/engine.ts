import { hear, newBelief } from './beliefs';
import { CLAIMS, IDS, NAMES, PLACES } from './data';
import { line } from './lines';
import { TUNING as T } from './tuning';
import type { Action, Character, CharacterId, ClaimId, PlaceId, ShareState, SpeechAct, StoryEvent, World } from './types';

export const DEFAULT_STATE: ShareState = { v: 1, seed: 731, witness: false, interventions: [] };
function random(world: World): number {
  // mulberry32; state belongs to this run, never to the clock or a global variable.
  world.randomState = (world.randomState + 0x6D2B79F5) >>> 0;
  let n = world.randomState;
  n = Math.imul(n ^ (n >>> 15), n | 1);
  n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
  return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
}
function emit(world: World, event: Omit<StoryEvent, 'id' | 'tick'>): void {
  world.events.push({ ...event, id: world.events.length, tick: world.tick });
}
export function schedule(id: CharacterId, tick: number, witness: boolean): PlaceId {
  if (id === 'mira') return tick < T.returnTick ? 'square' : tick < T.squareTick ? 'bakery' : tick < T.middayEnd ? 'square' : 'bakery';
  if (id === 'tom') return tick < T.breakfastEnd ? 'bakery' : tick < T.morningEnd ? 'cottage' : tick < T.squareTick ? 'house' : tick < T.eveningStart ? 'square' : 'house';
  return tick < T.breakfastEnd ? 'house' : tick < T.morningEnd ? (witness ? 'cottage' : 'house') : tick < T.squareTick ? 'house' : tick < T.eveningStart ? 'square' : 'house';
}
export function createWorld(config: ShareState): World {
  const makeCharacter = (id: CharacterId): Character => ({
    id, place: schedule(id, 0, config.witness),
    beliefs: { stole: newBelief(), gaveTo: newBelief() },
    trust: { ...T.initialTrust[id], stranger: T.strangerTrust[id] },
    affinity: { ...T.initialAffinity[id] },
    decisions: [], lastSpeech: -T.cooldown, told: {}, accusations: {}, confronted: false, reconciled: false,
  });
  const characters = { mira: makeCharacter('mira'), tom: makeCharacter('tom'), ben: makeCharacter('ben') };
  return {
    tick: -1, characters, events: [], outcome: '', randomState: config.seed >>> 0,
    config: { ...config, interventions: config.interventions.map(i => ({ ...i })) },
  };
}
function move(world: World, person: Character, place: PlaceId, why: string): void {
  if (person.place === place) return;
  person.place = place;
  emit(world, { kind: 'move', actor: person.id, place, text: `${NAMES[person.id]} goes to ${PLACES[place]}.`, why });
}
function speak(world: World, person: Character, to: CharacterId, act: SpeechAct, claim: ClaimId, why: string, transmit = true): void {
  const listener = world.characters[to];
  if (person.place !== listener.place) return;
  const belief = person.beliefs[claim];
  let text = line(act === 'defend' && !transmit ? 'deny' : act, person.id, random(world), CLAIMS[claim].text);
  if (act === 'defend' && belief.provenance.some(p => p.kind === 'firsthand')) text = `I saw it myself. ${text}`;
  emit(world, {
    kind: 'speech', actor: person.id, to, place: person.place, act, claim, text, why, transmits: transmit,
    beliefLink: { character: person.id, claim, confidence: belief.confidence, provenanceCount: belief.provenance.length },
  });
  if (act === 'confront') {
    for (const id of IDS.filter(id => id !== person.id && world.characters[id].place === person.place)) {
      world.characters[id].accusations[person.id] = world.tick;
    }
  } else if (act === 'gossip' && claim === 'stole') listener.accusations[person.id] = world.tick;
  if (transmit) {
    const remembered = belief.provenance.find(p => p.kind === 'firsthand')
      ?? belief.provenance.find(p => p.delta > 0);
    const chain = [...(remembered?.chain ?? []), { source: person.id, tick: world.tick }];
    hear(listener, claim, person.id, world.tick, chain);
  }
  person.lastSpeech = world.tick;
  person.told[`${act}:${to}:${claim}`] = world.tick;
  if (act === 'defend' && world.characters.tom.place === person.place) {
    world.characters.tom.affinity[person.id] = Math.min(1, world.characters.tom.affinity[person.id] + T.defenseAffinity);
  }
}
interface Candidate { action: Action; score: number; why: string; perform: () => void }
function choose(world: World, person: Character): void {
  const tick = world.tick;
  const others = IDS.filter(id => id !== person.id);
  const nearby = others.filter(id => world.characters[id].place === person.place);
  const harmful = person.beliefs.stole.confidence;
  const helpful = person.beliefs.gaveTo.confidence;
  const noticedMissing = world.events.some(e => e.kind === 'fact' && e.actor === person.id && e.text.includes('notices a loaf is missing'));
  const accusation = others.find(id => nearby.includes(id) && person.accusations[id] !== undefined
    && tick - person.accusations[id]! <= T.responseExpiry);
  const candidates: Candidate[] = [{
    action: 'routine', score: T.routineScore, why: `Follow my daily routine at ${PLACES[schedule(person.id, tick, world.config.witness)]}.`,
    perform: () => move(world, person, schedule(person.id, tick, world.config.witness), 'My daily routine.'),
  }];
  const addSpeech = (action: SpeechAct, score: number, why: string, to: CharacterId, claim: ClaimId, transmit = true) => {
    candidates.push({ action, score, why, perform: () => speak(world, person, to, action, claim, why, transmit) });
  };
  const mayTalk = tick - person.lastSpeech >= T.cooldown;
  if (person.id !== 'tom' && !person.confronted && harmful >= T.confrontThreshold
      && (person.id === 'mira' ? noticedMissing : person.affinity.mira > T.closeAffinity)) {
    const why = `I believe Tom stole the loaf (${Math.round(harmful * 100)}%). ${person.id === 'mira' ? 'I noticed my bread missing; honesty matters to me.' : 'Mira is my friend.'}`;
    candidates.push({
      action: 'confront', score: T.confrontScore + harmful * T.angerScore, why,
      perform: () => {
        if (person.place !== world.characters.tom.place) move(world, person, world.characters.tom.place, why);
        speak(world, person, 'tom', 'confront', 'stole', why);
        person.confronted = true;
      },
    });
  }
  if (person.id === 'tom') {
    const accuser = accusation ?? nearby.find(id => person.accusations[id] !== undefined);
    if (accuser && nearby.includes(accuser)) {
      const act = helpful > T.gossipThreshold ? 'explain' : 'deny';
      if (person.told[`${act}:${accuser}:gaveTo`] === undefined) {
        addSpeech(act, T.explanationScore, act === 'explain'
          ? 'I delivered the loaf to sick Ada. Explaining my intention may calm the accusation.'
          : 'I meant to pay later. I want to clear this up without a fight.', accuser, 'gaveTo', act === 'explain');
      }
    }
  }
  if (person.id !== 'tom' && person.affinity.tom > T.closeAffinity && accusation) {
    const key = `defend:${accusation}:gaveTo`;
    if (person.told[key] === undefined) {
      addSpeech('defend', T.defenseScore + helpful * T.evidenceScore,
        `Tom is my friend. ${helpful > T.gossipThreshold ? 'I have evidence that the bread went to Ada.' : 'I distrust this accusation.'}`,
        accusation, 'gaveTo', helpful > T.gossipThreshold);
    }
  }
  // A witness can respond to an unresolved accusation later, when meeting the accuser.
  if (person.id === 'ben' && helpful > T.gossipThreshold && person.accusations.mira !== undefined
      && nearby.includes('mira') && person.told['defend:mira:gaveTo'] === undefined) {
    addSpeech('defend', T.defenseScore + helpful * T.evidenceScore,
      'I know the loaf went to Ada, and my friend Tom has been accused.', 'mira', 'gaveTo');
  }
  if (person.confronted && !person.reconciled && harmful < T.reconcileThreshold) {
    const why = `The alternative explanation reduced my suspicion to ${Math.round(harmful * 100)}%. I owe Tom an apology.`;
    candidates.push({
      action: 'reconcile', score: T.reconcileScore, why,
      perform: () => {
        if (!nearby.includes('tom')) move(world, person, world.characters.tom.place, why);
        else {
          speak(world, person, 'tom', 'reconcile', 'stole', why, false);
          person.reconciled = true;
          person.affinity.tom = Math.max(person.affinity.tom, T.initialAffinity[person.id].tom);
        }
      },
    });
  }
  if (mayTalk) for (const to of nearby) for (const claim of ['stole', 'gaveTo'] as const) {
    const belief = person.beliefs[claim];
    if (belief.confidence <= T.gossipThreshold || (person.id === 'tom' && claim === 'stole')) continue;
    // One telling to each listener avoids an infinite conversational echo.
    if (person.told[`gossip:${to}:${claim}`] !== undefined) continue;
    if (claim === 'stole' && (person.reconciled || helpful > harmful)) continue;
    addSpeech('gossip', T.gossipScore + belief.confidence + (person.id === 'mira' && claim === 'stole' ? T.angerScore * (harmful - 0.5) : 0),
      `${Math.round(belief.confidence * 100)}% confident: ${CLAIMS[claim].text}. ${person.id === 'mira' && claim === 'stole' ? 'I am upset and want someone to hear it.' : 'Someone nearby may want to know.'}`,
      to, claim);
  }
  candidates.sort((a, b) => b.score - a.score);
  const winner = candidates[0]!;
  person.decisions.push({ tick, action: winner.action, score: winner.score, why: winner.why });
  winner.perform();
}
function facts(world: World): void {
  const { tick, characters: c } = world;
  // Scripted ground-truth beats; only people physically present perceive them.
  if (tick === T.takeTick) {
    move(world, c.tom, 'bakery', 'Collect a loaf for Ada and pay later.');
    emit(world, { kind: 'fact', actor: 'tom', place: 'bakery', text: 'Tom takes a loaf from the back shelf. He intends to pay later.' });
    for (const id of IDS.filter(id => c[id].place === 'bakery')) {
      emit(world, { kind: 'fact', actor: id, place: 'bakery', text: `${NAMES[id]} sees Tom take a loaf; intention is not visible.` });
    }
  }
  if (tick === T.deliveryTick) {
    move(world, c.tom, 'cottage', 'Bring the loaf to sick Ada.');
    emit(world, { kind: 'fact', actor: 'tom', place: 'cottage', text: 'Tom gives the loaf to Ada, who is sick at home.' });
    for (const id of IDS.filter(id => c[id].place === 'cottage')) {
      hear(c[id], 'gaveTo', 'saw', tick, [{ source: 'saw', tick }, { source: id, tick }], true);
      emit(world, { kind: 'fact', actor: id, place: 'cottage', claim: 'gaveTo', text: `${NAMES[id]} sees the bread reach Ada.` });
    }
  }
  noticeMissing(world);
}
export function step(world: World): World {
  if (world.tick >= T.ticks) return world;
  world.tick++;
  facts(world);
  for (const intervention of world.config.interventions.filter(i => i.t === world.tick)) {
    hear(world.characters[intervention.to], intervention.claim, 'stranger', world.tick);
    emit(world, { kind: 'whisper', to: intervention.to, claim: intervention.claim, text: `Stranger tells ${NAMES[intervention.to]}: “${CLAIMS[intervention.claim].text}.”` });
    const person = world.characters[intervention.to];
    const act = person.beliefs[intervention.claim].confidence >= T.confrontThreshold ? 'agree' : 'doubt';
    emit(world, { kind: 'speech', actor: person.id, place: person.place, act, claim: intervention.claim,
      text: line(act, person.id, random(world), CLAIMS[intervention.claim].text),
      beliefLink: { character: person.id, claim: intervention.claim, confidence: person.beliefs[intervention.claim].confidence, provenanceCount: person.beliefs[intervention.claim].provenance.length },
    });
  }
  for (const id of IDS) choose(world, world.characters[id]);
  noticeMissing(world);
  if (world.tick === T.ticks) {
    const mira = world.characters.mira;
    world.outcome = mira.reconciled ? 'Mira apologized to Tom. Next time, he’ll leave a note.'
      : mira.confronted && world.characters.ben.beliefs.gaveTo.confidence > T.gossipThreshold ? 'The village split: Mira suspects Tom; Ben stands by him.'
      : mira.confronted ? 'Mira and Tom fell out over a loaf of bread.'
      : 'A loaf reached Ada. The village carried on with its day.';
    emit(world, { kind: 'outcome', text: world.outcome });
  }
  return world;
}
function noticeMissing(world: World): void {
  // Returning after a decision still lets Mira notice the missing loaf that tick.
  if (world.tick >= T.returnTick && world.characters.mira.place === 'bakery'
      && !world.events.some(e => e.kind === 'fact' && e.actor === 'mira' && e.text.includes('missing'))) {
    emit(world, { kind: 'fact', actor: 'mira', place: 'bakery', text: 'Mira notices a loaf is missing. She does not know who took it.' });
  }
}
export function replay(config: ShareState, through: number = T.ticks): World {
  const world = createWorld(config);
  const end = Math.min(T.ticks, Math.max(0, Math.floor(through)));
  while (world.tick < end) step(world);
  return world;
}
export function timeLabel(tick: number): string {
  const minutes = T.startHour * 60 + tick * T.minutesPerTick;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
