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
        if (!response.ok) throw Error('unavailable');
        const meaning = readRumorMeaning(await response.json(), text, cast);
        if (!meaning) throw Error('unclear');
        return { meaning, source: 'ai', note: 'AI helped understand this story. Your wording is unchanged.' };
      };
      return await Promise.race([infer(), deadline]);
    } catch { return fallback('AI was unavailable or uncertain. Your story still works; no one is assigned blame.'); }
    finally { clearTimeout(timer); }
  }
  return { warm() { void opts.turnstile.warm?.().catch(() => undefined); },
    start(text) {
      let pending = active.get(text);
      if (!pending) { pending = Promise.resolve().then(() => run(text)).finally(() => { active.delete(text); }); active.set(text, pending); }
      return pending;
    } };
}
