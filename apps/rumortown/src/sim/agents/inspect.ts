/** The tag the player opens on a villager: beliefs with their chain, relations with reasons, moods, decisions. */
import type { Provenance } from 'rumormind';
import type { BeliefView, Inspection, RelationView } from '../types.js';
import { agentOf, nameOf, relKey, visibleActivity, type Agent, type Ctx } from './context.js';
import { independentSources } from './provenance.js';
import { clock, STRANGER_ID } from './text.js';

const MAX_DEPTH = 6;

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

/** Oldest first: the teller's own trail (recursively), then this villager's. */
function trace(ctx: Ctx, agent: Agent, claimId: string, out: string[], visited: Set<string>, depth: number): void {
  if (depth > MAX_DEPTH || visited.has(agent.d.id)) return;
  visited.add(agent.d.id);
  const b = agent.ledger.beliefs.get(claimId);
  if (!b) return;
  const first = b.provenance.find((p) => p.kind === 'heard');
  if (first && first.source !== 'self' && first.source !== STRANGER_ID) {
    const src = agentOf(ctx, first.source);
    if (src) trace(ctx, src, claimId, out, visited, depth + 1);
  }
  for (const p of b.provenance) {
    const line = describe(ctx, agent, p);
    if (line !== null) out.push(line);
  }
}

export function chainFor(ctx: Ctx, agent: Agent, claimId: string): string[] {
  const out: string[] = [];
  trace(ctx, agent, claimId, out, new Set(), 0);
  return out;
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
    decisions: agent.decisions.slice(),
  };
}
