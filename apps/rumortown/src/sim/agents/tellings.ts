/**
 * What is worth saying to whom: the best claim a speaker would bring up with a listener (rumormind's
 * tellScore against tellThreshold, with the speech act it calls for), and whether a believer has
 * grounds to confront. Shared by decisions and by conversation lines.
 */
import { deterministicLog, tellScore, tellThreshold } from 'rumormind';
import type { GameClaim, SpeechAct, VillagerId } from '../types.js';
import { nameOf, type Agent, type Ctx } from './context.js';
import { ACCUSATION_COOLDOWN, CLOSE, MAX_ACCUSATIONS_PER_DAY, OPEN_STORY_ATTENTION } from './params.js';
import { motivationTerms } from './motivation.js';
import { independentSources } from './provenance.js';
import { dayOf, percent } from './text.js';

/** Confrontation is a rare public act: not again while one is fresh, nor more than a few times a day. */
export function accusationOpen(ctx: Ctx, claimId: string, accused: VillagerId): boolean {
  let today = 0;
  let last = -Infinity;
  const day = dayOf(ctx.tick);
  for (const r of ctx.accusations) {
    if (r.claimId !== claimId || r.accused !== accused) continue;
    if (dayOf(r.tick) === day) today++;
    if (r.tick > last) last = r.tick;
  }
  return today < MAX_ACCUSATIONS_PER_DAY && ctx.tick - last >= ACCUSATION_COOLDOWN;
}

export interface Term {
  text: string;
  value: number;
}

/** The top two scoring terms, in plain words. */
export function whyFrom(terms: readonly Term[]): string {
  const top = [...terms].sort((a, b) => b.value - a.value).slice(0, 2).map((t) => t.text);
  const s = top.join('; ');
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export interface Telling {
  claim: GameClaim;
  act: SpeechAct;
  score: number;
  utility: number;
  terms: Term[];
}

/** Gossip utility is capped so a juicy story delays, rather than replaces, a confrontation. */
const TELL_CAP = 0.85;

export function tellingFor(ctx: Ctx, speaker: Agent, listener: Agent, present: ReadonlySet<VillagerId>): Telling | null {
  let best: Telling | null = null;
  const s = speaker.d.id;
  const l = listener.d.id;
  const t = speaker.d.traits;
  const closenessSL = ctx.rel.closeness(s, l);
  for (const claim of ctx.claimList) {
    if (claim.about === s || claim.about === l || present.has(claim.about)) continue;
    if (!speaker.ledger.knows(claim.id)) continue;
    const confidence = speaker.ledger.confidence(claim.id);
    if (confidence < 0.15) continue;
    const listenerKnows = listener.ledger.knows(claim.id);
    const defending = claim.valence >= 0 && (claim.contradicts ?? []).some(id => listener.ledger.confidence(id) > 0.5);
    if (listenerKnows && claim.valence >= 0 && !defending) continue;
    const previous = listener.ledger.beliefs.get(claim.id)?.provenance.filter(p => p.kind === 'heard' && p.source === s).at(-1);
    const newEvidence = previous && speaker.ledger.beliefs.get(claim.id)?.provenance.some(p => p.kind === 'saw' && p.tick > previous.tick);
    // New tellers can corroborate a known rumor. The same teller needs new first-hand evidence.
    if (previous && !newEvidence) continue;
    const closenessLT = ctx.rel.closeness(l, claim.about);
    const score = tellScore(
      {
        confidence,
        valence: claim.valence,
        closenessToListener: closenessSL,
        listenerClosenessToTarget: closenessLT,
        listenerAlreadyKnows: listenerKnows,
        interestingIfTrue: claim.severity / 3,
      },
      ctx.tuning,
    );
    if (score < tellThreshold && !defending) continue;
    let utility = 0.4 + 0.4 * (score - tellThreshold);
    let act: SpeechAct;
    if (claim.valence < 0) {
      // Honesty lowers gossip, extraversion raises it: at most about 10% each way.
      utility *= (1 - 0.2 * (t.honesty - 0.5)) * (1 + 0.2 * (t.extraversion - 0.5));
      if (listenerKnows) act = 'confide';
      else if (claim.target === l || closenessLT >= 0.6) act = 'warn';
      else if (confidence < 0.6 && closenessSL >= CLOSE) act = 'confide';
      else act = 'gossip';
    } else if (defending) {
      // The truth travels when it sets a record straight.
      utility += 0.25;
      act = 'defend';
    } else {
      act = 'news';
    }
    // Newly introduced open events compete with the many authored rumors already known.
    // This bounded attention bonus changes willingness to tell, never belief or evidence.
    const storyInterest = claim.kind === 'story' && !listenerKnows ? OPEN_STORY_ATTENTION.novelty + OPEN_STORY_ATTENTION.severity * claim.severity : 0;
    utility += storyInterest;
    const motives = motivationTerms(speaker.d.character?.motives, {
      act, confidence, closeness: closenessSL,
      rival: speaker.d.rival === claim.about,
      firsthand: speaker.ledger.beliefs.get(claim.id)?.provenance.some(p => p.kind === 'saw') ?? false,
    });
    utility = Math.max(0, Math.min(TELL_CAP, utility + motives.reduce((sum, term) => sum + term.value, 0)));
    if (best && utility <= best.utility) continue;
    const listenerName = nameOf(ctx, l, true);
    const listenerTerm =
      claim.target === l
        ? `${listenerName} is the one it was done to`
        : closenessSL >= 0.6
          ? `${listenerName} is close and would want to know`
          : listenerKnows
            ? `${listenerName} has heard it already`
            : `${listenerName} has not heard it yet`;
    // Decompose the very same tellScore and utility used above, including trait scaling and cap.
    const factor = claim.valence < 0 ? (1 - 0.2 * (t.honesty - 0.5)) * (1 + 0.2 * (t.extraversion - 0.5)) : 1;
    const base = (0.4 - 0.4 * tellThreshold) * factor;
    const terms: Term[] = [
      { text: `${percent(confidence)} sure ${claim.text}`, value: base + 0.4 * confidence * factor },
      { text: listenerTerm, value: 0.4 * (0.3 * closenessSL - (listenerKnows ? 0.6 : 0) - (claim.valence < 0 ? 0.3 * closenessLT : 0)) * factor },
      { text: claim.valence < 0 ? 'a harmful story draws attention' : 'a story worth hearing', value: 0.4 * ((claim.valence < 0 ? deterministicLog(ctx.tuning.negativitySharingOdds) : 0) + 0.2 * claim.severity / 3) * factor },
    ];
    if (storyInterest) terms.push({ text: 'a new story feels worth discussing', value: storyInterest });
    terms.push(...motives);
    if (act === 'defend') terms.push({ text: 'the truth sets the record straight', value: 0.25 });
    const uncapped = terms.reduce((sum, term) => sum + term.value, 0);
    if (uncapped > TELL_CAP) for (const term of terms) term.value *= TELL_CAP / uncapped;
    best = { claim, act, score, utility, terms };
  }
  return best;
}

/**
 * Grounds for confronting the subject of a harmful claim: the believer is the one wronged, has two
 * independent sources, or is close to the one wronged.
 */
export function confrontReason(ctx: Ctx, agent: Agent, claim: GameClaim): Term | null {
  const me = agent.d.id;
  if (claim.target === me) return { text: `it happened to ${agent.d.pronouns.object}`, value: 0.3 };
  const sources = independentSources(agent, claim.id);
  if (sources >= 2) return { text: `heard it from ${sources} people separately`, value: 0.25 };
  if (claim.target && ctx.rel.closeness(me, claim.target) >= CLOSE) {
    return { text: `${nameOf(ctx, claim.target, true)} is a friend and was wronged`, value: 0.2 };
  }
  return null;
}
