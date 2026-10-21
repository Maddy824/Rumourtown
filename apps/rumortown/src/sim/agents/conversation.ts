/**
 * Conversations: up to four villagers within talking range, three to eight lines at one line per
 * tick, from greet to farewell. Each line is the speaker's best act by utility; claims spoken are
 * heard by everyone present; an accusation forces the accused's answer and the bystanders' sides.
 */
import type { Activity, GameClaim, LineKey, SpeechAct, VillagerId } from '../types.js';
import {
  addMood,
  agentOf,
  dist,
  emit,
  harmfulClaimsAbout,
  isAsleep,
  nameOf,
  recordDecision,
  strangerClaimOf,
  type AccusationRecord,
  type Agent,
  type Conversation,
  type Ctx,
  type QueuedLine,
} from './context.js';
import { correctBelief, hearFrom } from './hearing.js';
import { activityForNeed, deficit } from './needs.js';
import {
  AFFINITY,
  AFTER_TALK_COOLDOWN,
  BUBBLE_TICKS,
  CONFRONT_BELIEF,
  IMPORTANCE,
  INTENT_LINES,
  LAST_ACCUSE_LINE,
  MAX_GROUP,
  MAX_LINES,
  MIN_LINES,
  MOOD,
  PAIR_COOLDOWN,
  PUBLIC_RANGE,
  TALK_RANGE,
  TRUST,
  UTILITY_JITTER,
} from './params.js';
import { hasFirsthand, knownAlternative } from './provenance.js';
import { changeAffinity, changeTrust } from './relations.js';
import { remember } from './reflection.js';
import { considerForgiveness, repairTrust } from './repair.js';
import { entryOf, followSchedule, goToPlace, resumeGoal } from './schedule.js';
import { takeSide } from './sideTaking.js';
import { accusationOpen, confrontReason, tellingFor, whyFrom, type Term } from './tellings.js';
import { minuteOfDay, percent, STRANGER_ID } from './text.js';

const INTENT_KINDS: ReadonlySet<string> = new Set(['gossip', 'confront', 'apologize', 'reconcile']);
/** Acts worth keeping in the villager's "last decisions". */
const NOTABLE: ReadonlySet<SpeechAct> = new Set(['accuse', 'deny', 'explain', 'refuse', 'agree', 'defend', 'doubt', 'apologize', 'forgive', 'warn', 'gossip', 'confide']);

interface Candidate {
  line: QueuedLine;
  score: number;
  terms: Term[];
}

const membersOf = (ctx: Ctx, conv: Conversation): Agent[] => {
  const out: Agent[] = [];
  for (const id of conv.members) {
    const a = agentOf(ctx, id);
    if (a) out.push(a);
  }
  return out;
};

function face(a: Agent, b: Agent): void {
  const dx = b.mover.pos.x - a.mover.pos.x;
  const dy = b.mover.pos.y - a.mover.pos.y;
  a.mover.facing = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'e' : 'w') : dy >= 0 ? 's' : 'n';
}

function restingActivity(agent: Agent): Activity {
  switch (agent.goal.kind) {
    case 'need':
      return agent.goal.need ? activityForNeed(agent.goal.need) : 'idle';
    case 'avoid':
      return 'rest';
    case 'schedule': {
      const a = entryOf(agent).activity;
      return a === 'secret' ? 'errand' : a;
    }
    default:
      return 'visit';
  }
}

/** The latest accusation by `accuser` of `accused` that has not been apologised for. */
export function pendingApology(ctx: Ctx, accuser: VillagerId, accused: VillagerId): AccusationRecord | undefined {
  let found: AccusationRecord | undefined;
  for (const r of ctx.accusations) if (r.accuser === accuser && r.accused === accused && !r.apologized) found = r;
  return found;
}

/* ---------------- Lifecycle ---------------- */

export function startConversation(ctx: Ctx, a: Agent, b: Agent, intent: boolean): Conversation {
  const base = MIN_LINES + Math.floor(ctx.rng() * (MAX_LINES - MIN_LINES + 1));
  const conv: Conversation = {
    id: ctx.nextConversationId++,
    members: [],
    initiator: a.d.id,
    startTick: ctx.tick,
    lines: 0,
    maxLines: intent ? Math.max(base, INTENT_LINES) : base,
    queue: [],
    lastSpeaker: null,
    lastClaim: null,
    accusation: null,
    topic: null,
    ended: false,
  };
  ctx.conversations.push(conv);
  enter(conv, a);
  enter(conv, b);
  return conv;
}

function enter(conv: Conversation, agent: Agent): void {
  conv.members.push(agent.d.id);
  agent.conversation = conv.id;
  agent.mover.stop();
  agent.activity = 'talk';
}

export function joinConversation(conv: Conversation, agent: Agent): void {
  enter(conv, agent);
  conv.maxLines = Math.min(MAX_LINES, Math.max(conv.maxLines, conv.lines + 3));
}

function exit(ctx: Ctx, agent: Agent, others: readonly VillagerId[]): void {
  agent.conversation = null;
  agent.talkCooldownUntil = ctx.tick + AFTER_TALK_COOLDOWN;
  for (const id of others) {
    agent.lastTalk.set(id, ctx.tick);
    agentOf(ctx, id)?.lastTalk.set(agent.d.id, ctx.tick);
  }
  if (INTENT_KINDS.has(agent.goal.kind) && agent.goal.target !== undefined && others.includes(agent.goal.target)) {
    // They had their say, or their chance: back to the routine.
    agent.goal = { kind: 'schedule', since: ctx.tick };
    if (!followSchedule(ctx, agent)) agent.activity = 'idle';
    return;
  }
  agent.activity = restingActivity(agent);
  resumeGoal(ctx, agent);
}

export function leaveConversation(ctx: Ctx, conv: Conversation, agent: Agent): void {
  const others = conv.members.filter((id) => id !== agent.d.id);
  conv.members = others;
  conv.queue = conv.queue.filter((q) => q.speaker !== agent.d.id && q.listener !== agent.d.id);
  exit(ctx, agent, others);
  if (conv.members.length < 2) endConversation(ctx, conv);
}

export function endConversation(ctx: Ctx, conv: Conversation): void {
  if (conv.ended) return;
  conv.ended = true;
  const ids = conv.members.slice();
  conv.members = [];
  for (const id of ids) {
    const a = agentOf(ctx, id);
    if (a && a.conversation === conv.id) exit(ctx, a, ids.filter((o) => o !== id));
  }
}

export function tickConversations(ctx: Ctx): void {
  for (const conv of ctx.conversations) if (!conv.ended) advance(ctx, conv);
  let w = 0;
  for (const conv of ctx.conversations) if (!conv.ended) ctx.conversations[w++] = conv;
  ctx.conversations.length = w;
  tryStartConversations(ctx);
}

function advance(ctx: Ctx, conv: Conversation): void {
  const members = membersOf(ctx, conv);
  if (members.length < 2) {
    endConversation(ctx, conv);
    return;
  }
  const line = nextLine(ctx, conv, members);
  speak(ctx, conv, line);
  conv.lines++;
  if (!conv.ended && (line.act === 'farewell' || conv.lines >= MAX_LINES)) endConversation(ctx, conv);
}

/* ---------------- Choosing the next line ---------------- */

function nextLine(ctx: Ctx, conv: Conversation, members: Agent[]): QueuedLine {
  const first = members[0]!;
  const second = members[1]!;
  if (conv.lines === 0) return { speaker: first.d.id, listener: second.d.id, act: 'greet', why: 'a greeting' };
  while (conv.queue.length) {
    const q = conv.queue.shift()!;
    if (!conv.members.includes(q.speaker) || !conv.members.includes(q.listener)) continue;
    if (q.decideSide) resolveSide(ctx, conv, q);
    return q;
  }
  if (conv.lines >= conv.maxLines - 1) {
    const s = pickSpeaker(conv, members);
    const l = members.find((m) => m !== s) ?? s;
    return { speaker: s.d.id, listener: l.d.id, act: 'farewell', why: 'time to go' };
  }
  for (const m of members) {
    const intent = intentLine(ctx, conv, m, members);
    if (intent) return intent;
  }
  return chooseLine(ctx, conv, pickSpeaker(conv, members), members);
}

function pickSpeaker(conv: Conversation, members: Agent[]): Agent {
  let i = conv.lines % members.length;
  if (members[i]!.d.id === conv.lastSpeaker && members.length > 1) i = (i + 1) % members.length;
  return members[i]!;
}

/** The line someone came here to say, if its moment has not passed. */
function intentLine(ctx: Ctx, conv: Conversation, m: Agent, members: Agent[]): QueuedLine | null {
  const g = m.goal;
  if (g.target === undefined || !INTENT_KINDS.has(g.kind)) return null;
  const target = members.find((x) => x.d.id === g.target);
  if (!target) return null;
  const targetName = nameOf(ctx, target.d.id, true);
  switch (g.kind) {
    case 'confront': {
      const claim = g.claimId !== undefined ? ctx.claims.get(g.claimId) : undefined;
      if (!claim || m.accusedToday.has(`${claim.id}|${target.d.id}`) || conv.lines > LAST_ACCUSE_LINE + 1) return null;
      const conf = m.ledger.confidence(claim.id);
      if (conf < CONFRONT_BELIEF || !accusationOpen(ctx, claim.id, target.d.id)) return null;
      return { speaker: m.d.id, listener: target.d.id, act: 'accuse', claimId: claim.id, why: `${percent(conf)} sure ${claim.text}; came to have it out` };
    }
    case 'apologize': {
      const rec = pendingApology(ctx, m.d.id, target.d.id);
      const claim = rec ? ctx.claims.get(rec.claimId) : undefined;
      if (!rec || !claim) return null;
      const conf = m.ledger.confidence(claim.id);
      return { speaker: m.d.id, listener: target.d.id, act: 'apologize', claimId: claim.id, why: `Only ${percent(conf)} sure now that ${claim.text}; owes ${targetName} an apology` };
    }
    case 'reconcile':
      if (m.reconciledWith.has(target.d.id)) return null;
      return { speaker: m.d.id, listener: target.d.id, act: 'forgive', why: `The sting of being accused has faded; still fond of ${targetName}` };
    case 'gossip': {
      const claim = g.claimId !== undefined ? ctx.claims.get(g.claimId) : undefined;
      if (!claim || claim.about === target.d.id || target.ledger.knows(claim.id) || conv.members.includes(claim.about)) return null;
      const conf = m.ledger.confidence(claim.id);
      return { speaker: m.d.id, listener: target.d.id, act: g.act ?? 'gossip', claimId: claim.id, why: `${percent(conf)} sure ${claim.text}; ${targetName} would want to know` };
    }
    default:
      return null;
  }
}

function chooseLine(ctx: Ctx, conv: Conversation, speaker: Agent, members: Agent[]): QueuedLine {
  const me = speaker.d.id;
  const others = members.filter((m) => m !== speaker);
  const present = new Set<VillagerId>(conv.members);
  const cands: Candidate[] = [];

  if (conv.lines <= LAST_ACCUSE_LINE) {
    for (const t of others) {
      for (const claim of harmfulClaimsAbout(ctx, speaker, t.d.id)) {
        const conf = speaker.ledger.confidence(claim.id);
        if (conf < CONFRONT_BELIEF || speaker.accusedToday.has(`${claim.id}|${t.d.id}`) || !accusationOpen(ctx, claim.id, t.d.id)) continue;
        const reason = confrontReason(ctx, speaker, claim);
        if (!reason) continue;
        cands.push({
          line: { speaker: me, listener: t.d.id, act: 'accuse', claimId: claim.id, why: '' },
          score: 0.9 + (conf - CONFRONT_BELIEF),
          terms: [{ text: `${percent(conf)} sure ${claim.text}`, value: conf }, reason],
        });
      }
    }
  }

  if (conv.lastClaim && conv.lastClaim.speaker !== me) {
    const claim = ctx.claims.get(conv.lastClaim.claimId);
    const teller = conv.lastClaim.speaker;
    if (claim && claim.about !== me && present.has(teller)) {
      const conf = speaker.ledger.confidence(claim.id);
      const trustIn = ctx.rel.trust(me, teller);
      const tellerName = nameOf(ctx, teller, true);
      if (conf >= 0.7) {
        cands.push({
          line: { speaker: me, listener: teller, act: 'agree', claimId: claim.id, why: '' },
          score: 0.6 + 0.3 * (conf - 0.7),
          terms: [{ text: `${percent(conf)} sure ${claim.text}`, value: conf }, { text: 'had heard as much', value: 0.2 }],
        });
      }
      if (conf < 0.45 || trustIn < 0.4) {
        cands.push({
          line: { speaker: me, listener: teller, act: 'doubt', claimId: claim.id, why: '' },
          score: 0.65 + (0.45 - Math.min(conf, 0.45)) + (trustIn < 0.4 ? 0.1 : 0),
          terms: [
            { text: conf < 0.45 ? `only ${percent(conf)} sure ${claim.text}` : `does not take ${tellerName}'s word for much`, value: 0.5 },
            { text: trustIn < 0.4 ? `${tellerName} is not to be trusted` : `${tellerName} may have it wrong`, value: 0.3 },
          ],
        });
      }
    }
  }

  for (const l of others) {
    const t = tellingFor(ctx, speaker, l, present);
    if (t) cands.push({ line: { speaker: me, listener: l.d.id, act: t.act, claimId: t.claim.id, why: '' }, score: t.utility, terms: t.terms });
  }

  const listener = others.find((o) => o.d.id === conv.lastSpeaker) ?? others[0]!;
  const social = deficit(speaker, 'social');
  cands.push({
    line: { speaker: me, listener: listener.d.id, act: 'smalltalk', why: '' },
    score: 0.5 + 0.2 * social + 0.1 * (speaker.d.traits.extraversion - 0.5),
    terms: [
      { text: 'nothing pressing to say', value: 0.5 },
      { text: social > 0.5 ? 'glad of the company' : 'passing the time', value: 0.2 * social },
    ],
  });

  let best = cands[0]!;
  let bestScore = -Infinity;
  for (const c of cands) {
    const s = c.score + UTILITY_JITTER * ctx.rng();
    if (s > bestScore) {
      best = c;
      bestScore = s;
    }
  }
  best.line.why = whyFrom(best.terms);
  return best.line;
}

/* ---------------- Speaking and its effects ---------------- */

function speak(ctx: Ctx, conv: Conversation, line: QueuedLine): void {
  const speaker = agentOf(ctx, line.speaker);
  const listener = agentOf(ctx, line.listener);
  if (!speaker || !listener) return;
  const claim = line.claimId !== undefined ? ctx.claims.get(line.claimId) : undefined;
  const subject = claim ? ctx.castMap.get(claim.about) : undefined;
  const originId = claim ? speaker.ledger.rememberedOrigin(claim.id) : undefined;
  const key: LineKey = { act: line.act, speaker: speaker.d, listener: listener.d, mood: speaker.mood.value(ctx.tick), tick: ctx.tick };
  if (claim) {
    key.claim = claim;
    key.confidence = speaker.ledger.confidence(claim.id);
  }
  if (subject) key.subject = subject;
  if (originId === STRANGER_ID) key.source = 'stranger';
  else if (originId !== undefined && originId !== 'self' && originId !== speaker.d.id) {
    const src = ctx.castMap.get(originId);
    if (src) key.source = src;
  }
  if (line.act === 'smalltalk') {
    if (conv.topic === null) conv.topic = ctx.talk.pickTopic(speaker.d, listener.d, minuteOfDay(ctx.tick), ctx.rng);
    key.topic = conv.topic;
  }
  const spoken = ctx.talk.say(key, ctx.rng);
  const listeners = conv.members.filter((id) => id !== speaker.d.id);
  if (claim) emit(ctx, { kind: 'line', tick: ctx.tick, speaker: speaker.d.id, listeners, act: line.act, text: spoken.text, lineId: spoken.lineId, claimId: claim.id });
  else emit(ctx, { kind: 'line', tick: ctx.tick, speaker: speaker.d.id, listeners, act: line.act, text: spoken.text, lineId: spoken.lineId });
  speaker.bubble = { text: spoken.text, untilTick: ctx.tick + BUBBLE_TICKS, to: listener.d.id };
  face(speaker, listener);
  conv.lastSpeaker = speaker.d.id;
  if (NOTABLE.has(line.act) && line.why) recordDecision(ctx, speaker, line.act, line.why);

  const isPublic = isPublicAround(ctx, conv, speaker, listener);
  switch (line.act) {
    case 'gossip':
    case 'warn':
    case 'confide':
    case 'news':
      if (claim) spreadClaim(ctx, conv, speaker, claim, isPublic && hasFirsthand(speaker, claim.id));
      break;
    case 'agree':
      if (claim) {
        spreadClaim(ctx, conv, speaker, claim, false);
        if (conv.accusation?.isPublic && conv.accusation.claimId === claim.id) strangerClaimOf(ctx, claim.id)?.backedAccuser.add(speaker.d.id);
      }
      conv.lastClaim = null;
      break;
    case 'doubt':
      conv.lastClaim = null;
      break;
    case 'defend':
      if (claim) onDefend(ctx, conv, speaker, claim, isPublic);
      break;
    case 'accuse':
      if (claim) onAccuse(ctx, conv, speaker, listener, claim);
      break;
    case 'deny':
      if (claim) onDeny(ctx, conv, speaker, claim);
      break;
    case 'explain':
      if (claim) onExplain(ctx, conv, speaker, claim, isPublic);
      break;
    case 'refuse':
      onRefuse(ctx, conv, speaker);
      break;
    case 'apologize':
      if (claim) onApologize(ctx, conv, speaker, listener, claim);
      break;
    case 'forgive':
      onForgive(ctx, speaker, listener);
      break;
    default:
      break;
  }
}

/** Everyone present hears the claim; `evidence` marks a public, first-hand account. */
function spreadClaim(ctx: Ctx, conv: Conversation, speaker: Agent, claim: GameClaim, evidence: boolean): void {
  const speakerName = nameOf(ctx, speaker.d.id, true);
  for (const id of conv.members) {
    if (id === speaker.d.id) continue;
    const m = agentOf(ctx, id);
    if (!m) continue;
    const r = hearFrom(ctx, speaker, m, claim, evidence);
    if (r && claim.valence < 0) remember(ctx, m, IMPORTANCE.heardRumor, `${speakerName} said ${claim.text}`, `There is talk that ${claim.text}`, claim.about);
  }
  conv.lastClaim = { claimId: claim.id, speaker: speaker.d.id };
}

/** Private means just the two of them, with no third villager within earshot. */
function isPublicAround(ctx: Ctx, conv: Conversation, a: Agent, b: Agent): boolean {
  if (conv.members.length > 2) return true;
  for (const o of ctx.agents) {
    if (o === a || o === b || isAsleep(o)) continue;
    if (dist(ctx, o, a) <= PUBLIC_RANGE || dist(ctx, o, b) <= PUBLIC_RANGE) return true;
  }
  return false;
}

function onAccuse(ctx: Ctx, conv: Conversation, accuser: Agent, accused: Agent, claim: GameClaim): void {
  const isPublic = isPublicAround(ctx, conv, accuser, accused);
  const bystanders: Agent[] = [];
  for (const id of conv.members) {
    if (id === accuser.d.id || id === accused.d.id) continue;
    const b = agentOf(ctx, id);
    if (b) bystanders.push(b);
  }
  // Villagers within earshot overhear; they join if there is room, so they can take a side.
  for (const o of ctx.agents) {
    if (o.conversation !== null || isAsleep(o) || o === accuser || o === accused) continue;
    if (dist(ctx, o, accused) > PUBLIC_RANGE || !ctx.world.lineOfSight(o.mover.pos, accused.mover.pos)) continue;
    if (conv.members.length < MAX_GROUP) {
      joinConversation(conv, o);
      bystanders.push(o);
    } else {
      hearFrom(ctx, accuser, o, claim, false);
    }
  }
  const record: AccusationRecord = {
    claimId: claim.id,
    accuser: accuser.d.id,
    accused: accused.d.id,
    tick: ctx.tick,
    isPublic,
    audience: bystanders.map((b) => b.d.id),
    apologized: false,
    forgiven: false,
    accuserExposed: false,
  };
  ctx.accusations.push(record);
  conv.accusation = record;
  conv.lastClaim = null;
  accuser.accusedToday.add(`${claim.id}|${accused.d.id}`);
  for (const b of bystanders) hearFrom(ctx, accuser, b, claim, false);

  const accuserName = nameOf(ctx, accuser.d.id, true);
  const accusedName = nameOf(ctx, accused.d.id, true);
  changeAffinity(ctx, accused.d.id, accuser.d.id, AFFINITY.accused, `${accuserName} accused ${accused.d.pronouns.object} of it${isPublic ? ' in front of everyone' : ''}`);
  ctx.rel.adjustAffinity(accuser.d.id, accused.d.id, AFFINITY.accuser);
  changeTrust(ctx, accuser.d.id, accused.d.id, TRUST.accusedByAccuser, `Believes ${claim.text}`);
  const m = isPublic ? MOOD.accusedInPublic : MOOD.accused;
  addMood(ctx, accused, m.label, m.delta, m.ticks);
  // A villager knows what they did; an accusation they never took on is a false one to them.
  if (accused.ledger.confidence(claim.id) < 0.5) addMood(ctx, accused, MOOD.falselyAccused.label, MOOD.falselyAccused.delta, MOOD.falselyAccused.ticks);
  remember(ctx, accused, IMPORTANCE.accused, `${accuserName} accused me: ${claim.text}`, `${accuserName} judges too fast`, accuser.d.id);
  remember(ctx, accuser, IMPORTANCE.accusing, `accused ${accusedName}: ${claim.text}`, `${accusedName} has questions to answer`, accused.d.id);
  for (const b of bystanders) remember(ctx, b, IMPORTANCE.bystander, `saw ${accuserName} accuse ${accusedName}`, `${accuserName} and ${accusedName} fell out`, accuser.d.id);

  // The accused answers next.
  const alt = knownAlternative(ctx, accused, claim);
  const { honesty, agreeableness } = accused.d.traits;
  let act: SpeechAct;
  let why: string;
  let claimId = claim.id;
  if (alt && honesty >= 0.5 && (!isPublic || (honesty >= 0.7 && agreeableness < 0.6))) {
    act = 'explain';
    claimId = alt.id;
    why = `Knows what really happened: ${alt.text}; ${isPublic ? 'honest enough to say so in front of everyone' : 'it is just the two of them'}`;
  } else if (isPublic && agreeableness >= 0.6) {
    act = 'refuse';
    why = 'Accused in front of everyone; will not have it out in public';
  } else {
    act = 'deny';
    why = isPublic ? 'Accused in front of everyone; not one to take it quietly' : alt ? 'Would rather not explain' : 'Knows it is not true';
  }
  conv.queue.push({ speaker: accused.d.id, listener: accuser.d.id, act, claimId, why });
  for (const b of bystanders) {
    conv.queue.push({ speaker: b.d.id, listener: accuser.d.id, act: 'doubt', claimId: claim.id, why: '', decideSide: { accuser: accuser.d.id, accused: accused.d.id, claimId: claim.id } });
  }
  conv.maxLines = Math.min(MAX_LINES, Math.max(conv.maxLines, conv.lines + 1 + conv.queue.length + 1));
}

/** A bystander's side, decided with their beliefs at the moment they speak. */
function resolveSide(ctx: Ctx, conv: Conversation, q: QueuedLine): void {
  const d = q.decideSide;
  if (!d) return;
  const b = agentOf(ctx, q.speaker);
  const accuser = agentOf(ctx, d.accuser);
  const accused = agentOf(ctx, d.accused);
  const claim = ctx.claims.get(d.claimId);
  if (!b || !accuser || !accused || !claim) return;
  const side = takeSide(ctx, b, accuser, accused, claim, conv.accusation?.isPublic ?? true);
  q.why = side.why;
  q.listener = accuser.d.id;
  if (side.side === 'accuser') {
    q.act = 'agree';
    q.claimId = claim.id;
  } else if (side.side === 'accused') {
    q.act = 'defend';
    const alt = knownAlternative(ctx, b, claim);
    q.claimId = alt ? alt.id : claim.id;
  } else {
    q.act = 'doubt';
    q.claimId = claim.id;
  }
}

function onDefend(ctx: Ctx, conv: Conversation, defender: Agent, claim: GameClaim, isPublic: boolean): void {
  const rec = conv.accusation;
  if (claim.valence >= 0) {
    spreadClaim(ctx, conv, defender, claim, isPublic && hasFirsthand(defender, claim.id));
  } else {
    for (const id of conv.members) {
      if (id === defender.d.id) continue;
      const m = agentOf(ctx, id);
      if (m) correctBelief(ctx, m, claim.id, ctx.rel.trust(m.d.id, defender.d.id) * 0.5, false, defender.d.id, false);
    }
    conv.lastClaim = null;
  }
  if (rec?.isPublic) strangerClaimOf(ctx, rec.claimId)?.backedAccused.add(defender.d.id);
  const accusedId = rec?.accused ?? claim.about;
  const accused = agentOf(ctx, accusedId);
  if (accused && accused !== defender && conv.members.includes(accusedId)) {
    const defenderName = nameOf(ctx, defender.d.id, true);
    changeAffinity(ctx, accused.d.id, defender.d.id, AFFINITY.defended, `${defenderName} stood up for ${accused.d.pronouns.object}`);
    addMood(ctx, accused, `defended by ${defenderName}`, MOOD.defended.delta, MOOD.defended.ticks);
    remember(ctx, accused, IMPORTANCE.defended, `${defenderName} stood up for me`, `${defenderName} stood by me`, defender.d.id);
  }
}

function onDeny(ctx: Ctx, conv: Conversation, accused: Agent, claim: GameClaim): void {
  for (const id of conv.members) {
    if (id === accused.d.id) continue;
    const m = agentOf(ctx, id);
    if (m) correctBelief(ctx, m, claim.id, ctx.rel.trust(m.d.id, accused.d.id), false, accused.d.id, false);
  }
  const accuser = conv.accusation ? agentOf(ctx, conv.accusation.accuser) : undefined;
  if (accuser && accuser !== accused) repairTrust(ctx, accuser, accused, 'denial', `${nameOf(ctx, accused.d.id, true)} denied it`);
  conv.lastClaim = null;
}

function onExplain(ctx: Ctx, conv: Conversation, accused: Agent, alt: GameClaim, isPublic: boolean): void {
  const firsthand = hasFirsthand(accused, alt.id);
  spreadClaim(ctx, conv, accused, alt, isPublic && firsthand);
  const accuser = conv.accusation ? agentOf(ctx, conv.accusation.accuser) : undefined;
  if (accuser && accuser !== accused) {
    repairTrust(ctx, accuser, accused, firsthand ? 'denial-with-evidence' : 'denial', `${nameOf(ctx, accused.d.id, true)} explained: ${alt.text}`);
  }
}

function onRefuse(ctx: Ctx, conv: Conversation, accused: Agent): void {
  const why = 'Accused in front of everyone; would rather walk away than fight';
  accused.goal = { kind: 'avoid', since: ctx.tick, place: accused.d.home };
  if (!goToPlace(ctx, accused, accused.d.home, 'rest', accused.goal)) followSchedule(ctx, accused);
  recordDecision(ctx, accused, 'walk away', why);
  emit(ctx, { kind: 'action', tick: ctx.tick, villager: accused.d.id, action: 'walk away', why });
  leaveConversation(ctx, conv, accused);
}

function onApologize(ctx: Ctx, conv: Conversation, accuser: Agent, accused: Agent, claim: GameClaim): void {
  let rec: AccusationRecord | undefined;
  for (const r of ctx.accusations) {
    if (r.accuser === accuser.d.id && r.accused === accused.d.id && r.claimId === claim.id && !r.apologized) {
      r.apologized = true;
      rec = r;
    }
  }
  const accuserName = nameOf(ctx, accuser.d.id, true);
  const accusedName = nameOf(ctx, accused.d.id, true);
  changeAffinity(ctx, accused.d.id, accuser.d.id, AFFINITY.apology, `${accuserName} said sorry for accusing ${accused.d.pronouns.object}`);
  addMood(ctx, accused, `apology from ${accuserName}`, MOOD.apology.delta, MOOD.apology.ticks);
  remember(ctx, accused, IMPORTANCE.apologyReceived, `${accuserName} apologised`, `${accuserName} owns ${accuser.d.pronouns.possessive} mistakes`, accuser.d.id);
  remember(ctx, accuser, IMPORTANCE.accusing, `apologised to ${accusedName}`, `${accusedName} deserved better`, accused.d.id);
  const f = considerForgiveness(ctx, accused, accuser, rec);
  conv.queue.unshift({ speaker: accused.d.id, listener: accuser.d.id, act: f.forgive ? 'forgive' : 'doubt', claimId: claim.id, why: f.why });
  conv.maxLines = Math.min(MAX_LINES, Math.max(conv.maxLines, conv.lines + 3));
  conv.lastClaim = null;
}

function onForgive(ctx: Ctx, forgiver: Agent, other: Agent): void {
  for (const r of ctx.accusations) if (r.accused === forgiver.d.id && r.accuser === other.d.id && !r.forgiven) r.forgiven = true;
  const forgiverName = nameOf(ctx, forgiver.d.id, true);
  const otherName = nameOf(ctx, other.d.id, true);
  changeAffinity(ctx, forgiver.d.id, other.d.id, AFFINITY.madeUp, `Made up with ${otherName}`);
  changeAffinity(ctx, other.d.id, forgiver.d.id, AFFINITY.madeUp, `Made up with ${forgiverName}`);
  addMood(ctx, forgiver, `made up with ${otherName}`, MOOD.madeUp.delta, MOOD.madeUp.ticks);
  addMood(ctx, other, `made up with ${forgiverName}`, MOOD.madeUp.delta, MOOD.madeUp.ticks);
  forgiver.reconciledWith.add(other.d.id);
  other.reconciledWith.add(forgiver.d.id);
  forgiver.mood.clear(MOOD.falselyAccused.label);
  remember(ctx, forgiver, IMPORTANCE.madeUp, `made up with ${otherName}`, `${otherName} and I are square again`, other.d.id);
  remember(ctx, other, IMPORTANCE.madeUp, `made up with ${forgiverName}`, `${forgiverName} and I are square again`, forgiver.d.id);
}

/* ---------------- Starting conversations ---------------- */

function tryStartConversations(ctx: Ctx): void {
  const n = ctx.agents.length;
  for (let i = 0; i < n; i++) {
    const a = ctx.agents[i]!;
    if (a.conversation !== null || isAsleep(a) || ctx.tick < a.talkCooldownUntil) continue;

    // On purpose: someone they walked up to.
    if (a.goal.target !== undefined && (INTENT_KINDS.has(a.goal.kind) || a.goal.kind === 'approach')) {
      const t = agentOf(ctx, a.goal.target);
      if (t && !isAsleep(t) && dist(ctx, a, t) <= TALK_RANGE) {
        if (t.conversation !== null) {
          const conv = ctx.conversations.find((c) => c.id === t.conversation && !c.ended);
          if (conv && conv.members.length < MAX_GROUP) {
            joinConversation(conv, a);
            continue;
          }
        } else {
          startConversation(ctx, a, t, true);
          continue;
        }
      }
    }

    // By chance: whoever is standing close.
    let started = false;
    for (let j = i + 1; j < n && !started; j++) {
      const b = ctx.agents[j]!;
      if (b.conversation !== null || isAsleep(b) || ctx.tick < b.talkCooldownUntil) continue;
      if (dist(ctx, a, b) > TALK_RANGE) continue;
      const last = a.lastTalk.get(b.d.id);
      if (last !== undefined && ctx.tick - last < PAIR_COOLDOWN) continue;
      const socialA = deficit(a, 'social');
      const socialB = deficit(b, 'social');
      const p =
        0.05 +
        0.12 * socialA +
        0.12 * socialB +
        0.1 * ctx.rel.closeness(a.d.id, b.d.id) +
        0.05 * (a.d.traits.extraversion + b.d.traits.extraversion - 1);
      if (ctx.rng() < p) {
        if (socialA >= socialB) startConversation(ctx, a, b, false);
        else startConversation(ctx, b, a, false);
        started = true;
      }
    }
    if (started) continue;

    // Or drift into a group nearby.
    for (const conv of ctx.conversations) {
      if (conv.ended || conv.members.length >= MAX_GROUP || conv.lines >= conv.maxLines - 2) continue;
      let near = false;
      for (const id of conv.members) {
        const m = agentOf(ctx, id);
        if (m && dist(ctx, a, m) <= TALK_RANGE) {
          near = true;
          break;
        }
      }
      if (!near) continue;
      if (ctx.rng() < 0.25) {
        joinConversation(conv, a);
        break;
      }
    }
  }
}
