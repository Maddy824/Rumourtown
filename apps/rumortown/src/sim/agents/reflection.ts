/**
 * Episodic memory with importance and recency (0.995 per game-hour, Park et al. 2023), and the
 * dusk reflection that turns the day's most important event into one standing opinion.
 */
import type { VillagerId } from '../types.js';
import { emit, relKey, type Agent, type Ctx } from './context.js';

export function remember(ctx: Ctx, agent: Agent, importance: number, text: string, opinion: string, about?: VillagerId): void {
  agent.memories.push(about ? { tick: ctx.tick, importance, text, opinion, about } : { tick: ctx.tick, importance, text, opinion });
}

/** The day's weightiest memory becomes an opinion; it is kept for inspection and, when it is about someone, becomes the reason behind that relation. */
export function reflect(ctx: Ctx, agent: Agent): string | null {
  let best: Agent['memories'][number] | null = null;
  let bestScore = -Infinity;
  for (const m of agent.memories) {
    const hours = Math.max(0, ctx.tick - m.tick) / 60;
    const score = m.importance * Math.pow(0.995, hours);
    if (score > bestScore) {
      best = m;
      bestScore = score;
    }
  }
  agent.memories.length = 0;
  if (!best) return null;
  agent.opinions.push(best.opinion);
  if (best.about) ctx.relationWhy.set(relKey(agent.d.id, best.about), best.opinion);
  emit(ctx, { kind: 'action', tick: ctx.tick, villager: agent.d.id, action: 'reflect', why: best.opinion });
  return best.opinion;
}
