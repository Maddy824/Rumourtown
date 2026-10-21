/**
 * Runtime guard: a model's reply is shown only as far as it is faithful to what the speaking
 * villager believes. Unsupported or contradicting sentences are dropped; if nothing faithful is
 * left, the villager admits not knowing. The simulation stays the source of truth.
 */
import type { Inspection } from '../sim/types.js';
import { verify, type FactRef, type Verdict } from './verifier.js';

export function factRefs(inspection: Pick<Inspection, 'beliefs'>): FactRef[] {
  return inspection.beliefs.filter(b => b.confidence >= 0.35).map(b => ({
    id: b.claimId, text: b.text, confidence: b.confidence, chain: b.chain, trueInWorld: true,
    band: b.confidence >= 0.85 ? 'sure' : b.confidence >= 0.65 ? 'fairly sure' : b.confidence >= 0.45 ? 'half' : 'doubt',
  }));
}

/** News sentences the narrator may repeat, treated as things the village plainly knows. */
export function newsRefs(news: readonly string[]): FactRef[] {
  return news.map((text, i) => ({ id: `news-${i}`, text, confidence: 1, band: 'sure', chain: [], trueInWorld: true }));
}

export interface Guarded { reply: string; verdict: Verdict; dropped: number }

export async function guardReply(reply: string, refs: FactRef[], castNames: string[], speakerName: string | null): Promise<Guarded> {
  const verdict = await verify(reply, refs, [], castNames);
  const kept = verdict.sentences.filter(s => s.label === 'supported' || s.label === 'chatter').map(s => s.text);
  const dropped = verdict.sentences.length - kept.length;
  if (!dropped) return { reply, verdict, dropped };
  const text = kept.join(' ').trim();
  return { reply: text || (speakerName ? 'I couldn’t say. Nobody has told me anything like that.' : 'Nobody in the village is saying that.'), verdict, dropped };
}
