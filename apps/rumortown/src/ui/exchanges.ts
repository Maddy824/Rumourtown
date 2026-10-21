/** Read-only exchange history. The engine keeps its original cadence and event stream. */
import type { SimEvent, Simulation, ThreadLink } from '../sim/types.js';
import { eventKey, storyBeat, type StoryBeat } from './story-beats.js';

export interface ScriptLine { tick: number; speaker: string; text: string; claimId?: string; act?: string; listeners?: string[] }
const scriptLine = (line: Extract<SimEvent, { kind: 'line' }>): ScriptLine => ({ tick: line.tick, speaker: line.speaker, text: line.text, claimId: line.claimId, act: line.act, listeners: line.listeners });
export interface Exchange {
  id: string; beat: StoryBeat; people: [string, string]; claims: Set<string>;
  participants: Set<string>;
  /** Claims carried after the player introduced them; excludes earlier village chatter. */
  introducedClaims: Set<string>;
  lines: ScriptLine[]; end: number; closed: boolean;
}
const pairKey = (ids: readonly string[]): string => [...ids].sort().join('/');
const overlaps = (a: ReadonlySet<string>, b: readonly string[]): boolean => b.filter(id => a.has(id)).length >= 2;
export function createExchanges(sim: Pick<Simulation, 'cast' | 'claims'>) {
  const all: Exchange[] = [], introduced = new Set<string>();
  const active = new Map<string, Exchange>();
  const lead = new Map<string, Extract<SimEvent, { kind: 'line' }>[]>();
  const byEvent = new Map<string, Exchange>();
  function expire(tick: number): void {
    for (const [key, exchange] of active) if (tick >= exchange.end) { exchange.closed = true; active.delete(key); }
    for (const [key, lines] of lead) if (tick - lines[0]!.tick >= 12) lead.delete(key);
  }
  return {
    all, introduced, byEvent, expire,
    push(events: readonly SimEvent[]): Exchange[] {
      const touched = new Set<Exchange>();
      for (const e of events) {
        expire(e.tick);
        if (e.kind === 'whisper') introduced.add(e.claimId);
        let beat = storyBeat(e, sim);
        // Seeing an authored secret is relevant only to a claim about that person.
        const witnessed = e.kind === 'witness' ? [...introduced].filter(id => sim.claims.get(id)?.about === e.subject) : [];
        if (e.kind === 'witness' && witnessed.length && e.subject) beat = {
          tick: e.tick, kind: 'exposure', text: `${sim.cast.get(e.villager)?.name ?? e.villager} saw ${e.what}`,
          faces: [e.villager, e.subject], event: e,
        };
        const people: [string, string] | null = e.kind === 'line'
          ? [e.speaker, e.listeners[0] ?? (e.act === 'reactToWhisper' ? 'stranger' : beat?.faces[1] ?? e.speaker)]
          : beat?.faces ?? null;
        if (!people) continue;
        const audience = [...new Set(e.kind === 'line' ? [...people, ...e.listeners] : people)];
        const key = pairKey(people);
        let exchange = active.get(key) ?? [...active.values()].find(item => overlaps(item.participants, audience));
        const leadEntry = [...lead].find(([k, lines]) => k === key || overlaps(new Set(lines.flatMap(l => [l.speaker, ...l.listeners])), audience));
        const leadKey = leadEntry?.[0] ?? key;
        if (!exchange && !beat) {
          if (e.kind === 'line') {
            if (e.act === 'farewell') lead.delete(leadKey);
            else { const lines = leadEntry?.[1] ?? []; lines.push(e); lead.set(leadKey, lines); }
          }
          continue;
        }
        if (!exchange && beat) {
          const before = leadEntry?.[1] ?? [];
          exchange = { id: eventKey(e), beat, people, claims: new Set(), introducedClaims: new Set(), participants: new Set([...audience, ...before.flatMap(l => [l.speaker, ...l.listeners])]),
            lines: before.map(scriptLine),
            end: (before[0]?.tick ?? e.tick) + 12, closed: false };
          lead.delete(leadKey); all.push(exchange); active.set(key, exchange);
        }
        if (!exchange) continue;
        touched.add(exchange);
        for (const id of audience) exchange.participants.add(id);
        byEvent.set(eventKey(e), exchange);
        if ((e.kind === 'line' || e.kind === 'whisper') && e.claimId) {
          exchange.claims.add(e.claimId);
          if (introduced.has(e.claimId)) exchange.introducedClaims.add(e.claimId);
        }
        for (const id of witnessed) { exchange.claims.add(id); exchange.introducedClaims.add(id); }
        if (e.kind === 'relationship' && e.to === 'stranger') for (const id of introduced) { exchange.claims.add(id); exchange.introducedClaims.add(id); }
        if (e.kind === 'line') exchange.lines.push(scriptLine(e));
        else if (e.kind === 'whisper') exchange.lines.push({ tick: e.tick, speaker: 'stranger', text: sim.claims.get(e.claimId)?.text ?? 'A village rumor.', claimId: e.claimId, listeners: [e.listener] });
        else if (beat) exchange.lines.push({ tick: e.tick, speaker: people[0], text: beat.text });
        if (e.kind === 'line' && e.act === 'farewell') {
          exchange.closed = true; exchange.end = e.tick;
          for (const [id, item] of active) if (item === exchange) active.delete(id);
        }
      }
      return [...touched];
    },
  };
}

export function followsExchange(exchange: Exchange, selected: string, introduced: ReadonlySet<string>): boolean {
  return selected ? exchange.claims.has(selected) : [...exchange.introducedClaims].some(id => introduced.has(id));
}

/** Follow one rumor and its corrections; keep the complete conversation in history. */
export function focusedScript(exchange: Exchange, selected: string, claims: Simulation['claims']): ScriptLine[] {
  if (!selected || !exchange.lines.some(line => line.claimId)) return exchange.lines;
  const relevant = (id: string) => id === selected || Boolean(claims.get(selected)?.contradicts?.includes(id)) || Boolean(claims.get(id)?.contradicts?.includes(selected));
  let topic = '';
  return exchange.lines.filter(line => {
    if (line.claimId) { topic = line.claimId; return relevant(topic); }
    if (!topic) return line.act === 'greet';
    return relevant(topic);
  });
}

/** Longest chronological chain from the stranger. Repeated recipients cannot inflate it. */
export function longestChain(links: readonly ThreadLink[]): number {
  const depths = new Map<string, Map<string, number>>();
  let longest = 0;
  for (const link of [...links].sort((a, b) => a.tick - b.tick)) {
    const known = depths.get(link.claimId) ?? new Map([['stranger', 0]]);
    depths.set(link.claimId, known);
    const from = known.get(link.from);
    if (from === undefined || known.has(link.to)) continue;
    const depth = from + 1; known.set(link.to, depth); longest = Math.max(longest, depth);
  }
  return longest;
}
export interface StoryStats { beats: number; longestChain: number }
export const statsText = (s: StoryStats): string => `${s.beats} ${s.beats === 1 ? 'beat' : 'beats'}. Longest chain: ${s.longestChain} ${s.longestChain === 1 ? 'telling' : 'tellings'}.`;
