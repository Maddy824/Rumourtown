import { apiBase, fields, record } from './types.js';
export interface PlayContext {
  speaker: string | null;
  nearby: { id: string; activity: string; mood: number }[];
  places: { id: string; name: string }[];
  voice: string;
  history: { you: string; reply: string }[];
}
export interface PlayReply { reply: string; action: 'none' | 'move' | 'approach' | 'pause' | 'resume' | 'look'; target: string }
export function readPlayReply(value: unknown, places: readonly string[], people: readonly string[]): PlayReply | null {
  if (!record(value) || !fields(value, ['reply', 'action', 'target'], ['reply', 'action', 'target']) ||
      typeof value.reply !== 'string' || !value.reply.trim() || value.reply.length > 240 || /[\u0000-\u001f\u007f]/u.test(value.reply) ||
      typeof value.target !== 'string' || value.target.length > 64 || typeof value.action !== 'string' ||
      !['none', 'move', 'approach', 'pause', 'resume', 'look'].includes(value.action)) return null;
  if (value.action === 'move' ? !places.includes(value.target) : value.action === 'approach' ? !people.includes(value.target) : value.target !== '') return null;
  return value as unknown as PlayReply;
}
export async function askVillage(text: string, context: PlayContext, opts: {
  baseUrl: string; token: string; signal: AbortSignal; people: readonly string[]; fetch?: typeof fetch;
}): Promise<PlayReply> {
  const response = await (opts.fetch ?? fetch)(`${apiBase(opts.baseUrl)}/play`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: opts.signal,
    body: JSON.stringify({ text, context, turnstileToken: opts.token }),
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    const reason = record(body) ? body.reason : undefined;
    if (reason === 'budget' || reason === 'limit-global') throw Error('The shared AI allowance is resting. You can still walk and use ready-made rumors.');
    if (reason === 'limit-visitor') throw Error('You’ve reached the hourly AI limit. You can still explore, or come back later to chat.');
    throw Error('The village could not answer. Try again in a moment.');
  }
  const result = readPlayReply(body, context.places.map(p => p.id), opts.people);
  if (!result) throw Error('The village returned an unclear answer. No action was taken.');
  return result;
}
