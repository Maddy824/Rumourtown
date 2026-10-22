import { neutralMeaning, readRumorMeaning, rumorText, type RumorMeaning } from '../../../shared/open-rumor.js';
import { cast } from '../content/cast/index.js';
import type { TurnstileClient } from './turnstile.js';
export interface RumorResult { meaning: RumorMeaning; source: 'local' | 'ai' | 'neutral'; note: string }
export interface RumorFlow { start(text: string): Promise<RumorResult>; warm(): void }
export function createRumorFlow(opts: { baseUrl: string; turnstile: Pick<TurnstileClient, 'getToken'> & Partial<Pick<TurnstileClient, 'warm'>>;
  fetch?: typeof fetch; onStateChange?: (state: 'checking' | 'asking') => void }): RumorFlow {
  const active = new Map<string, Promise<RumorResult>>();
  async function run(input: string): Promise<RumorResult> {
    const text = rumorText(input);
    if (!text) throw Error('Write a short story first.');
    const fallback = (note: string): RumorResult => ({ meaning: neutralMeaning(), source: 'neutral', note });
    if (!opts.baseUrl) return fallback('Your exact story will spread with a neutral interpretation. No AI credits used.');
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(Error('timeout')); }, 12_000);
      });
      const infer = async (): Promise<RumorResult> => {
        opts.onStateChange?.('checking');
        const token = await opts.turnstile.getToken(controller.signal);
        if (!token.trim() || controller.signal.aborted) throw Error('human-check');
        opts.onStateChange?.('asking');
        const response = await (opts.fetch ?? fetch)(`${opts.baseUrl.replace(/\/+$/u, '')}/rumor`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
          body: JSON.stringify({ text, turnstileToken: token }),
        });
        if (!response.ok) {
          const reason = await response.json().then((b: unknown) => (b && typeof b === 'object' && 'reason' in b ? (b as { reason: unknown }).reason : undefined), () => undefined);
          const wait = Number(response.headers.get('Retry-After'));
          throw Error(reason === 'budget' || reason === 'limit-global' ? 'resting'
            : reason === 'limit-visitor' ? (wait > 0 && wait <= 120 ? 'burst' : 'limit') : 'unavailable');
        }
        const meaning = readRumorMeaning(await response.json(), text, cast);
        if (!meaning) throw Error('unclear');
        return { meaning, source: 'ai', note: 'AI helped understand this story. Your wording is unchanged.' };
      };
      return await Promise.race([infer(), deadline]);
    } catch (error) {
      const why = error instanceof Error ? error.message : error === 'turnstile' ? 'human-check' : '';
      const lead = why === 'human-check' ? 'Couldn’t check that you’re human, so the village read your story without AI.'
        : why === 'resting' ? 'The shared AI allowance is resting, so the village read your story without AI.'
        : why === 'limit' ? 'You’ve used this hour’s AI stories, so the village read this one without AI.'
        : why === 'burst' ? 'That was a lot of stories at once, so the village read this one without AI.'
        : 'AI was unavailable or uncertain.';
      return fallback(`${lead} Your story still works; no one is assigned blame.`);
    }
    finally { clearTimeout(timer); }
  }
  return { warm() { void opts.turnstile.warm?.().catch(() => undefined); },
    start(text) {
      let pending = active.get(text);
      if (!pending) { pending = Promise.resolve().then(() => run(text)).finally(() => { active.delete(text); }); active.set(text, pending); }
      return pending;
    } };
}
