/** The tag the player opens on a villager: beliefs with their chain, relations with reasons, moods, decisions. */
import type { Provenance } from 'rumormind';
import type { BeliefView, Inspection, RelationView } from '../types.js';
import { nameOf, relKey, visibleActivity, type Agent, type Ctx, type ChainEntry } from './context.js';
import { independentSources } from './provenance.js';
import { clock, STRANGER_ID } from './text.js';

/**
 * The UI parses exactly two shapes, "X told Y at HH:MM" and "Y saw it at HH:MM", so corrections
 * (which are not tellings of the claim) stay out of the chain; they show in the confidence instead.
 */
function describe(ctx: Ctx, agent: Agent, p: Provenance): string | null {
  const time = clock(p.tick);
  switch (p.kind) {
    case 'heard':
      return `${nameOf(ctx, p.source, true)} told ${agent.d.name} at ${time}`;
    case 'saw':
      return `${agent.d.name} saw it at ${time}`;
    default:
      return null;
  }
}

/** Evidence snapshots preserve causal order even when a teller learns more later in the same tick. */
export function chainEntries(ctx: Ctx, agent: Agent, claimId: string): ChainEntry[] {
  const out: ChainEntry[] = [];
  const seen = new Set<Provenance>();
  for (const p of agent.ledger.beliefs.get(claimId)?.provenance ?? []) {
    for (const entry of ctx.transmissionChains.get(p) ?? []) {
      if (!seen.has(entry.evidence)) { seen.add(entry.evidence); out.push(entry); }
    }
    const text = describe(ctx, agent, p);
    if (text !== null && !seen.has(p)) { seen.add(p); out.push({ tick: p.tick, text, evidence: p }); }
  }
  return out.sort((a, b) => a.tick - b.tick);
}

export function chainFor(ctx: Ctx, agent: Agent, claimId: string): string[] {
  return chainEntries(ctx, agent, claimId).map((entry) => entry.text);
}

export function inspectAgent(ctx: Ctx, agent: Agent): Inspection {
  const beliefs: BeliefView[] = [];
  for (const claim of ctx.claimList) {
    if (!agent.ledger.knows(claim.id)) continue;
    beliefs.push({
      claimId: claim.id,
      text: claim.text,
      confidence: agent.ledger.confidence(claim.id),
      chain: chainFor(ctx, agent, claim.id),
      independentSources: independentSources(agent, claim.id),
    });
  }
  beliefs.sort((a, b) => b.confidence - a.confidence);
  const relations: RelationView[] = [];
  for (const other of ctx.agents) {
    if (other === agent) continue;
    const why = ctx.relationWhy.get(relKey(agent.d.id, other.d.id));
    const view: RelationView = { to: other.d.id, name: other.d.name, trust: ctx.rel.trust(agent.d.id, other.d.id), affinity: ctx.rel.affinity(agent.d.id, other.d.id) };
    if (why !== undefined) view.why = why;
    relations.push(view);
  }
  return {
    id: agent.d.id,
    name: agent.d.name,
    role: agent.d.role,
    activity: visibleActivity(agent.activity),
    mood: agent.mood.value(ctx.tick),
    beliefs,
    relations,
    trustInStranger: ctx.rel.trust(agent.d.id, STRANGER_ID),
    moods: agent.mood.list(ctx.tick),
    decisions: agent.decisions.some((d) => d.action === 'reflect') || !agent.opinions.length
      ? agent.decisions.slice()
      : [...agent.decisions.slice(0, 4), agent.opinions[agent.opinions.length - 1]!],
  };
}
