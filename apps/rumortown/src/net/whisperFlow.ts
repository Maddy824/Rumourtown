import { interpretWhisper, type InterpretOptions, type InterpretResult } from './interpret.js';
import type { TurnstileClient } from './turnstile.js';

type DoneResult = Extract<InterpretResult, { claim: unknown }>;
type RestingResult = Exclude<InterpretResult, DoneResult>;
export type WhisperState =
  | { status: 'idle' | 'checking' | 'asking' }
  | { status: 'done'; result: DoneResult }
  | { status: 'resting'; result: RestingResult; line: string };
export interface WhisperFlowDependencies extends Omit<InterpretOptions, 'turnstileToken'> {
  turnstile: Pick<TurnstileClient, 'getToken'>;
  onStateChange?: (state: WhisperState) => void;
}
export interface WhisperFlow {
  readonly state: WhisperState;
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
    case 'turnstile': return "Couldn't check you're human. Try again.";
    default: return restingLine;
  }
}

export function createWhisperFlow(deps: WhisperFlowDependencies): WhisperFlow {
  let state: WhisperState = { status: 'idle' };
  let active: Promise<InterpretResult> | undefined;
  function transition(next: WhisperState): void {
    state = next;
    try { deps.onStateChange?.(next); } catch { /* UI observers cannot interrupt verification. */ }
  }
  async function run(text: string): Promise<InterpretResult> {
    transition({ status: 'checking' });
    let result: InterpretResult;
    const deadlineMs = Math.min(deps.timeoutMs ?? 5_800, 5_800);
    const started = performance.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), deadlineMs); });
    try {
      const turnstileToken = await Promise.race([deps.turnstile.getToken(), timeout]);
      if (!turnstileToken.trim()) throw new Error('turnstile');
      transition({ status: 'asking' });
      // interpretWhisper verifies before exposing a successful claim to any caller.
      result = await Promise.race([interpretWhisper(text, {
        baseUrl: deps.baseUrl, castVersion: deps.castVersion, fetch: deps.fetch,
        timeoutMs: Math.max(0, deadlineMs - (performance.now() - started)), turnstileToken,
      }), timeout]);
    } catch (error) { result = { ok: false, reason: error instanceof Error && error.message === 'timeout' ? 'timeout' : 'turnstile' }; }
    finally { if (timer !== undefined) clearTimeout(timer); }
    if (result.ok && 'claim' in result) transition({ status: 'done', result });
    else transition({ status: 'resting', result, line: lineFor(result) });
    return result;
  }
  return {
    get state() { return state; },
    start(text) {
      if (!active) {
        // Set active before notifying observers, including synchronous reentrant starts.
        active = Promise.resolve().then(() => run(text)).finally(() => { active = undefined; });
      }
      return active;
    },
  };
}
