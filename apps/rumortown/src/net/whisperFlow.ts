import { interpretWhisper, type InterpretOptions, type InterpretResult } from './interpret.js';
import { fetchPublicKey } from './verify.js';
import type { TurnstileClient } from './turnstile.js';

type DoneResult = Extract<InterpretResult, { claim: unknown }>;
type RestingResult = Exclude<InterpretResult, DoneResult>;
export type WhisperState =
  | { status: 'idle' | 'checking' | 'asking' }
  | { status: 'done'; result: DoneResult }
  | { status: 'resting'; result: RestingResult; line: string };
export interface WhisperFlowDependencies extends Omit<InterpretOptions, 'turnstileToken'> {
  turnstile: Pick<TurnstileClient, 'getToken'> & Partial<Pick<TurnstileClient, 'warm'>>;
  onStateChange?: (state: WhisperState) => void;
}
export interface WhisperFlow {
  readonly state: WhisperState;
  warm(): void;
  /** While busy, repeated starts share the first operation without another call. */
  start(text: string): Promise<InterpretResult>;
}

const restingLine = "The town's gossip is resting. Try a ready-made rumor.";
function lineFor(result: RestingResult): string {
  if (result.ok) {
    switch (result.unsupported) {
      case 'not-about-cast': case 'real-person': return 'The villagers only gossip about each other.';
      case 'protected-trait': case 'sexual': case 'hateful': return 'Nobody here would repeat that.';
      case 'unclear': return 'Say it plainer.';
    }
  }
  switch (result.reason) {
    case 'limit-visitor': return "You've whispered a lot this hour. Try a ready-made rumor, or come back later.";
    case 'timeout': return 'The village took too long. Try again.';
    case 'turnstile': return "Couldn't check you're human. Try again.";
    case 'budget': case 'limit-global': return restingLine;
    default: return "Couldn't ask the village. Try again.";
  }
}

export function createWhisperFlow(deps: WhisperFlowDependencies): WhisperFlow {
  let state: WhisperState = { status: 'idle' };
  let active: Promise<InterpretResult> | undefined;
  let attempted = false;
  function transition(next: WhisperState): void {
    state = next;
    try { deps.onStateChange?.(next); } catch { /* UI observers cannot interrupt verification. */ }
  }
  async function run(text: string): Promise<InterpretResult> {
    transition({ status: 'checking' });
    let result: InterpretResult;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tokenDeadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject('turnstile'); }, attempted ? 6_000 : 12_000);
    });
    attempted = true;
    try {
      const turnstileToken = await Promise.race([deps.turnstile.getToken(controller.signal), tokenDeadline]);
      if (!turnstileToken.trim()) throw 'turnstile';
      clearTimeout(timer);
      transition({ status: 'asking' });
      // The request gets its full budget after the human check finishes.
      result = await interpretWhisper(text, {
        baseUrl: deps.baseUrl, castVersion: deps.castVersion, fetch: deps.fetch,
        timeoutMs: Math.min(deps.timeoutMs ?? 6_000, 6_000), turnstileToken,
      });
    } catch { result = { ok: false, reason: 'turnstile' }; }
    finally { clearTimeout(timer); }
    if (result.ok && 'claim' in result) transition({ status: 'done', result });
    else transition({ status: 'resting', result, line: lineFor(result) });
    return result;
  }
  return {
    get state() { return state; },
    warm() {
      void deps.turnstile.warm?.().catch(() => undefined);
      void fetchPublicKey(deps.baseUrl, deps.fetch).catch(() => undefined);
    },
    start(text) {
      if (!active) {
        // Set active before notifying observers, including synchronous reentrant starts.
        active = Promise.resolve().then(() => run(text)).finally(() => { active = undefined; });
      }
      return active;
    },
  };
}
