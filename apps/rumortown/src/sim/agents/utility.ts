/**
 * Action selection by utility, every five ticks per villager. Candidates: continue the routine,
 * satisfy a need, approach someone, tell someone something, confront, walk away, apologise,
 * make up. The winner's top two terms become the plain-English `why`.
 */
import type { Need, PlaceId, SpeechAct, VillagerId } from '../types.js';
import { agentOf, dist, emit, harmfulClaimsAbout, isAsleep, nameOf, recordDecision, type Agent, type Ctx, type GoalKind } from './context.js';
import { pendingApology } from './conversation.js';
import { activityForNeed, deficit, nearestPlaceFor, urgentNeed } from './needs.js';
import { APPROACH_RANGE, AVOID_WINDOW, CONFRONT_BELIEF, GOAL_TIMEOUT, MOOD, NEED_ATTENTION, UTILITY_JITTER } from './params.js';
import { beliefCollapsed } from './provenance.js';
import { atPlace, entryOf, followSchedule, goToPlace, placeOf, walkToward } from './schedule.js';
import { accusationOpen, confrontReason, tellingFor, whyFrom, type Term } from './tellings.js';
import { activityWord, needWord, percent } from './text.js';

interface Candidate {
  kind: GoalKind;
  action: string;
  terms: Term[];
  target?: VillagerId;
  claimId?: string;
  need?: Need;
  place?: PlaceId;
  act?: SpeechAct;
}

const PEOPLE_KINDS: ReadonlySet<GoalKind> = new Set(['approach', 'gossip', 'confront', 'apologize', 'reconcile']);

export function decide(ctx: Ctx, agent: Agent): void {
  const cands: Candidate[] = [];
  const g = agent.goal;
  const t = agent.d.traits;
  const me = agent.d.id;
  const entry = entryOf(agent);
  const entryPlace = placeOf(ctx, entry.place);
  const placeName = entryPlace ? `the ${entryPlace.name.toLowerCase()}` : entry.place;
  const stale = g.target !== undefined && ctx.tick - g.since > GOAL_TIMEOUT ? g.target : undefined;

  // The routine leads.
  const routineTerms: Term[] = [
    { text: `it is ${activityWord(entry.activity)} time at ${placeName}`, value: 0.45 + (g.kind === 'schedule' ? 0.05 : 0) },
    { text: t.conscientiousness >= 0.5 ? 'keeps to the routine' : 'nothing better to do', value: 0.15 * t.conscientiousness },
  ];
  if (stale !== undefined) routineTerms.push({ text: `gave up on reaching ${nameOf(ctx, stale, true)}`, value: 0 });
  cands.push({
    kind: 'schedule',
    action: `${entry.activity} at ${placeName}`,
    terms: routineTerms,
  });

  // Needs, mildly.
  const urgent = urgentNeed(agent);
  if (urgent.deficit > NEED_ATTENTION) {
    const here = ctx.world.placeAt(agent.mover.pos);
    const place = here?.satisfies.includes(urgent.need) ? null : nearestPlaceFor(ctx, urgent.need, agent.mover.pos);
    if (place) {
      const d = ctx.world.distance(agent.mover.pos, { x: place.door.x + 0.5, y: place.door.y + 0.5 });
      cands.push({
        kind: 'need',
        action: `${activityForNeed(urgent.need)} at the ${place.name.toLowerCase()}`,
        terms: [
          { text: `${needWord(urgent.need)} (${percent(urgent.deficit)})`, value: 0.9 * urgent.deficit * urgent.deficit },
          { text: `the ${place.name.toLowerCase()} is ${d <= 8 ? 'close by' : 'not far'}`, value: g.kind === 'need' && g.need === urgent.need ? 0.05 : 0 },
        ],
        need: urgent.need,
        place: place.id,
      });
    }
  }

  // Walking away from a public accusation.
  if (t.agreeableness >= 0.6 && g.kind !== 'avoid' && agent.mood.active(MOOD.accusedInPublic.label, ctx.tick)) {
    if (ctx.accusations.some((r) => r.accused === me && ctx.tick - r.tick <= AVOID_WINDOW)) {
      cands.push({
        kind: 'avoid',
        action: 'walk away',
        terms: [
          { text: 'accused in front of everyone', value: 0.6 },
          { text: 'would rather walk away than fight', value: 0.25 },
        ],
      });
    }
  }

  // People.
  const social = deficit(agent, 'social');
  const nobody = new Set<VillagerId>();
  for (const other of ctx.agents) {
    if (other === agent || isAsleep(other)) continue;
    const them = other.d.id;
    if (them === stale) continue;
    const d = dist(ctx, agent, other);
    if (d > APPROACH_RANGE) continue;
    const otherName = nameOf(ctx, them, true);
    const commit = g.target === them ? 0.05 : 0;

    const rec = pendingApology(ctx, me, them);
    const owed = rec ? ctx.claims.get(rec.claimId) : undefined;
    if (owed) {
      const conf = agent.ledger.confidence(owed.id);
      if (beliefCollapsed(agent, owed.id)) {
        cands.push({
          kind: 'apologize',
          action: `apologize to ${otherName}`,
          terms: [
            { text: `only ${percent(conf)} sure now that ${owed.text}`, value: 0.7 },
            { text: `owes ${otherName} an apology`, value: 0.2 * t.honesty + 0.1 * t.agreeableness + commit },
          ],
          target: them,
          claimId: owed.id,
        });
      }
    }

    if (
      agent.mood.expired(MOOD.falselyAccused.label, ctx.tick) &&
      !agent.reconciledWith.has(them) &&
      ctx.rel.affinity(me, them) > 0 &&
      ctx.accusations.some((r) => r.accused === me && r.accuser === them && !r.forgiven)
    ) {
      cands.push({
        kind: 'reconcile',
        action: `make up with ${otherName}`,
        terms: [
          { text: 'the sting of being accused has faded', value: 0.6 },
          { text: `still fond of ${otherName}`, value: 0.2 * t.agreeableness + commit },
        ],
        target: them,
      });
    }

    for (const claim of harmfulClaimsAbout(ctx, agent, them)) {
      const conf = agent.ledger.confidence(claim.id);
      if (conf <= CONFRONT_BELIEF || agent.accusedToday.has(`${claim.id}|${them}`) || !accusationOpen(ctx, claim.id, them)) continue;
      const reason = confrontReason(ctx, agent, claim);
      if (!reason) continue;
      cands.push({
        kind: 'confront',
        action: `confront ${otherName}`,
        terms: [
          { text: `${percent(conf)} sure ${claim.text}`, value: 0.85 + 0.8 * (conf - CONFRONT_BELIEF) },
          { text: reason.text, value: 0.05 * (t.emotionality - 0.5) - 0.05 * (t.agreeableness - 0.5) + commit },
        ],
        target: them,
        claimId: claim.id,
      });
    }

    const telling = tellingFor(ctx, agent, other, nobody);
    if (telling) {
      cands.push({
        kind: 'gossip',
        action: `${telling.act} to ${otherName}`,
        terms: [...telling.terms, { text: `${otherName} is within reach`, value: -(0.02 * d) / APPROACH_RANGE + commit }],
        target: them,
        claimId: telling.claim.id,
        act: telling.act,
      });
    }

    if (social > 0.3 && other.conversation === null) {
      const last = agent.lastTalk.get(them);
      const recently = last !== undefined && ctx.tick - last < 120;
      const closeness = ctx.rel.closeness(me, them);
      cands.push({
        kind: 'approach',
        action: `talk to ${otherName}`,
        terms: [
          { text: `wants company (${percent(social)} lonely)`, value: 0.2 + 0.35 * social + 0.1 * (t.extraversion - 0.5) },
          { text: closeness >= 0.6 ? `${otherName} is a friend` : `${otherName} is nearby`, value: 0.15 * closeness - 0.1 * (d / APPROACH_RANGE) - (recently ? 0.2 : 0) + commit },
        ],
        target: them,
      });
    }
  }

  let best = cands[0]!;
  let bestScore = -Infinity;
  for (const c of cands) {
    const s = c.terms.reduce((sum, term) => sum + term.value, 0) + UTILITY_JITTER * ctx.rng();
    if (s > bestScore) {
      best = c;
      bestScore = s;
    }
  }
  apply(ctx, agent, best);
}

function apply(ctx: Ctx, agent: Agent, c: Candidate): void {
  const prev = agent.goal;
  const changed = prev.kind !== c.kind || prev.target !== c.target || prev.claimId !== c.claimId || prev.need !== c.need;
  const since = changed ? ctx.tick : prev.since;
  let ok = true;
  switch (c.kind) {
    case 'schedule': {
      const entry = entryOf(agent);
      const settled = !agent.mover.moving && agent.spot !== null && atPlace(ctx, agent, entry.place);
      if (changed || (!agent.mover.moving && !settled)) ok = followSchedule(ctx, agent);
      break;
    }
    case 'need':
      if (c.place !== undefined && c.need !== undefined) {
        ok = goToPlace(ctx, agent, c.place, activityForNeed(c.need), { kind: 'need', since, need: c.need });
      }
      break;
    case 'avoid':
      ok = goToPlace(ctx, agent, agent.d.home, 'rest', { kind: 'avoid', since });
      break;
    default: {
      const target = c.target !== undefined ? agentOf(ctx, c.target) : undefined;
      if (!target || !PEOPLE_KINDS.has(c.kind)) {
        ok = false;
        break;
      }
      const goal = { kind: c.kind, since, target: c.target, pathedTo: prev.target === c.target ? prev.pathedTo : undefined } as Agent['goal'];
      if (c.claimId !== undefined) goal.claimId = c.claimId;
      if (c.act !== undefined) goal.act = c.act;
      agent.goal = goal;
      agent.activity = 'visit';
      ok = walkToward(ctx, agent, target);
    }
  }
  if (!ok && c.kind !== 'schedule') followSchedule(ctx, agent);
  const why = whyFrom(c.terms);
  recordDecision(ctx, agent, c.action, why);
  if (changed) emit(ctx, { kind: 'action', tick: ctx.tick, villager: agent.d.id, action: c.action, why });
}
