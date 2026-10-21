/** Read-only summaries and timeline pins derived from the existing event stream. */
import type { SimEvent, Simulation } from '../sim/types.js';
export type BeatKind = 'whisper' | 'confrontation' | 'defence' | 'apology' | 'exposure';
export interface StoryBeat { tick: number; kind: BeatKind; text: string; faces: [string, string]; event: SimEvent }
export const eventKey = (e: SimEvent): string => `${e.tick}:${e.kind}:${e.kind === 'line' ? e.speaker + ':' + e.lineId : e.kind === 'whisper' ? e.listener : e.kind === 'relationship' ? e.from : ''}`;
export function storyBeat(e: SimEvent, sim: Pick<Simulation, 'cast' | 'claims'>): StoryBeat | null {
  const name = (id: string): string => id === 'stranger' ? 'You' : sim.cast.get(id)?.name ?? id;
  if (e.kind === 'whisper') return { tick: e.tick, kind: 'whisper', text: `You told ${name(e.listener)} that ${sim.claims.get(e.claimId)?.text ?? 'a story was going around'}`, faces: ['stranger', e.listener], event: e };
  if (e.kind === 'relationship' && e.to === 'stranger' && e.why.endsWith('came from the stranger and did not hold up')) return { tick: e.tick, kind: 'exposure', text: `${name(e.from)} found that your story did not hold up`, faces: [e.from, 'stranger'], event: e };
  if (e.kind !== 'line' || (!e.claimId && !['accuse', 'defend', 'apologize'].includes(e.act))) return null;
  const claim = e.claimId ? sim.claims.get(e.claimId) : undefined;
  const listener = e.listeners[0] ?? claim?.about ?? e.speaker;
  const subject = claim?.about ?? listener;
  const kind: BeatKind = e.act === 'accuse' ? 'confrontation' : e.act === 'defend' ? 'defence' : e.act === 'apologize' ? 'apology' : 'whisper';
  const text = e.act === 'accuse' ? `${name(e.speaker)} confronted ${name(listener)}`
    : e.act === 'defend' ? `${name(e.speaker)} defended ${name(subject)}`
    : e.act === 'apologize' ? `${name(e.speaker)} apologised to ${name(listener)}`
    : e.act === 'deny' ? `${name(e.speaker)} denied that ${claim?.text ?? e.text}`
    : e.act === 'explain' ? `${name(e.speaker)} explained: ${e.text}`
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
