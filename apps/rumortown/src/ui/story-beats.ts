/** Read-only summaries and timeline pins derived from the existing event stream. */
import type { SimEvent, Simulation } from '../sim/types.js';
export type BeatKind = 'whisper' | 'confrontation' | 'defence' | 'apology' | 'exposure';
export interface StoryBeat { tick: number; kind: BeatKind; text: string; faces: [string, string]; event: SimEvent }
export const eventKey = (e: SimEvent): string => `${e.tick}:${e.kind}:${e.kind === 'line' ? e.speaker + ':' + e.lineId : e.kind === 'whisper' ? e.listener : e.kind === 'relationship' ? e.from + ':' + e.to : e.kind === 'witness' ? e.villager + ':' + (e.subject ?? '') + ':' + (e.secretId ?? e.what) : ''}`;
export function storyBeat(e: SimEvent, sim: Pick<Simulation, 'cast' | 'claims'>): StoryBeat | null {
  const name = (id: string): string => id === 'stranger' ? 'You' : sim.cast.get(id)?.name ?? id;
  if (e.kind === 'whisper') return { tick: e.tick, kind: 'whisper', text: `You told ${name(e.listener)} that ${sim.claims.get(e.claimId)?.text ?? 'a story was going around'}`, faces: ['stranger', e.listener], event: e };
  if (e.kind === 'relationship' && e.to === 'stranger' && e.why.endsWith('came from the stranger and did not hold up')) return { tick: e.tick, kind: 'exposure', text: `${name(e.from)} found that your story did not hold up`, faces: [e.from, 'stranger'], event: e };
  if (e.kind !== 'line' || (!e.claimId && !['accuse', 'defend', 'apologize'].includes(e.act))) return null;
  const claim = e.claimId ? sim.claims.get(e.claimId) : undefined;
  const listener = e.act === 'reactToWhisper' ? 'stranger' : e.listeners[0] ?? claim?.about ?? e.speaker;
  const subject = claim?.about ?? listener;
  const kind: BeatKind = e.act === 'accuse' ? 'confrontation' : e.act === 'defend' ? 'defence' : e.act === 'apologize' ? 'apology' : 'whisper';
  const text = e.act === 'reactToWhisper' ? `${name(e.speaker)} reacted to your whisper`
    : e.act === 'accuse' ? `${name(e.speaker)} confronted ${name(listener)}`
    : e.act === 'defend' ? `${name(e.speaker)} defended ${name(subject)}`
    : e.act === 'apologize' ? `${name(e.speaker)} apologised to ${name(listener)}`
    : e.act === 'deny' ? `${name(e.speaker)} denied that ${claim?.text ?? e.text}`
    : e.act === 'explain' ? `${name(e.speaker)} offered another explanation for the story about ${name(subject)}`
    : e.act === 'doubt' ? `${name(e.speaker)} doubted that ${claim?.text ?? e.text}`
    : `${name(e.speaker)} told ${name(listener)} that ${claim?.text ?? e.text}`;
  return { tick: e.tick, kind, text, faces: [e.speaker, kind === 'defence' ? subject : listener], event: e };
}
export interface BeatPin extends StoryBeat { count: number }
/** Merge neighbouring beats less than ten game-minutes apart; retain the latest 24 groups. */
export function mergeBeatPins(beats: readonly StoryBeat[]): BeatPin[] {
  const out: BeatPin[] = [];
  let previousTick = -Infinity;
  const priority: Record<BeatKind, number> = { whisper: 0, defence: 1, apology: 2, confrontation: 3, exposure: 4 };
  for (const beat of [...beats].sort((a, b) => a.tick - b.tick)) {
    const last = out.at(-1);
    if (last && beat.tick - previousTick < 10) {
      last.count++;
      if (priority[beat.kind] > priority[last.kind]) Object.assign(last, beat);
    } else out.push({ ...beat, count: 1 });
    previousTick = beat.tick;
  }
  return out.slice(-24);
}
/** A new line can replace the strip every four seconds; an unchanged line retires after eight. */
export function createBeatTicker() {
  let pending: StoryBeat | null = null, shown: StoryBeat | null = null, shownAt = -Infinity;
  return {
    push(beats: readonly StoryBeat[]) { if (beats.length) pending = beats.at(-1)!; },
    reset() { pending = shown = null; shownAt = -Infinity; },
    update(now: number): StoryBeat | null {
      if (pending && now - shownAt >= 4000) { shown = pending; pending = null; shownAt = now; }
      return now - shownAt < 8000 ? shown : null;
    },
  };
}

/** Stable newest-first ordering, including evening cards; small talk never enters the rail. */
export function newestStoryEntries(events: readonly SimEvent[], sim: Pick<Simulation, 'cast' | 'claims'>): SimEvent[] {
  return events.filter(e => e.kind === 'day-end' || storyBeat(e, sim) !== null).reverse().sort((a, b) => b.tick - a.tick);
}
/** Shared targeting for cards, chain faces and camera following. */
export function storyTarget(ids: readonly string[], snapshot: import('../sim/types.js').WorldSnapshot) {
  const points = ids.map(id => id === 'stranger' ? snapshot.player.pos : snapshot.villagers.find(v => v.id === id)?.pos).filter(p => p !== undefined);
  if (!points.length) return null;
  return { x: points.reduce((n, p) => n + p.x, 0) / points.length, y: points.reduce((n, p) => n + p.y, 0) / points.length };
}

/** Compact social actions, while keeping the actual story identifiable in the Now strip. */
export function nowSentence(beat: StoryBeat, sim: Pick<Simulation, 'cast' | 'claims'>): string {
  if (beat.text.length <= 58) return beat.text.replace(/[.!?]?$/, '.');
  const name = (id: string): string => id === 'stranger' ? 'You' : (sim.cast.get(id)?.name ?? id).split(' ')[0]!;
  const [from, to] = beat.faces;
  if (beat.kind === 'exposure') return 'The stranger’s word is worth less now.';
  if (beat.kind === 'apology') return `${name(from)} apologised to ${name(to)}.`;
  if (beat.kind === 'defence') return `${name(from)} defended ${name(to)}.`;
  if (beat.kind === 'confrontation') return `${name(from)} confronted ${name(to)}.`;
  const claimId = beat.event.kind === 'line' || beat.event.kind === 'whisper' ? beat.event.claimId : undefined;
  const claim = claimId ? sim.claims.get(claimId) : undefined;
  return claim ? `${name(from)} told ${name(to)}: “${claim.text}”.` : beat.text.replace(/[.!?]?$/, '.');
}

/** Frame both people even when an old telling's participants have since walked apart. */
export function storyZoom(ids: readonly string[], snapshot: import('../sim/types.js').WorldSnapshot, width: number, height: number): number | undefined {
  if (!ids.length) return undefined;
  const points = ids.map(id => id === 'stranger' ? snapshot.player.pos : snapshot.villagers.find(v => v.id === id)?.pos).filter(p => p !== undefined);
  if (!points.length) return undefined;
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const spanX = Math.max(...xs) - Math.min(...xs) + 4;
  const spanY = Math.max(...ys) - Math.min(...ys) + 4;
  return Math.max(2, Math.floor(Math.min(40, Math.max(64, width) / spanX, Math.max(64, height) / spanY) * 4) / 4);
}

/** Player stories start at their whisper, including later corrections and exposure. */
export function playerStoryEvents(events: readonly SimEvent[], sim: Pick<Simulation, 'claims'>): ReadonlySet<SimEvent> {
  const introduced = new Set<string>(), own = new Set<SimEvent>();
  for (const e of events) {
    if (e.kind === 'whisper') introduced.add(e.claimId);
    const claimId = e.kind === 'line' || e.kind === 'whisper' ? e.claimId : undefined;
    const claim = claimId ? sim.claims.get(claimId) : undefined;
    if (e.kind === 'day-end' || (claimId && (introduced.has(claimId) ||
        (claim?.alternativeOf && introduced.has(claim.alternativeOf)) || claim?.contradicts?.some(id => introduced.has(id)))) ||
        (e.kind === 'relationship' && e.to === 'stranger' && introduced.size > 0) ||
        (e.kind === 'witness' && [...introduced].some(id => sim.claims.get(id)?.about === e.subject))) own.add(e);
  }
  return own;
}
