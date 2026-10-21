import { groundedPeople } from '../../../shared/whisper-grounding.js';
import { interpretWhisper, type InterpretOptions, type InterpretResult } from './interpret.js';
import { cast } from '../content/cast/index.js';
import { interpretLocally, type LocalPerson } from './local-interpreter.js';
import type { Claim } from './types.js';
import { fetchPublicKey } from './verify.js';
import type { TurnstileClient } from './turnstile.js';

// Local claims are never presented as signed Worker responses.
export type WhisperResult = InterpretResult | { ok: true; claim: Claim; source: 'local' };
type DoneResult = Extract<WhisperResult, { claim: unknown }>;
type RestingResult = Exclude<InterpretResult, DoneResult>;
export type WhisperState =
  | { status: 'idle' | 'checking' | 'asking' }
  | { status: 'done'; result: DoneResult }
  | { status: 'resting'; result: RestingResult; line: string };
export interface WhisperFlowDependencies extends Omit<InterpretOptions, 'turnstileToken'> {
  cast?: readonly LocalPerson[];
  turnstile: Pick<TurnstileClient, 'getToken'> & Partial<Pick<TurnstileClient, 'warm'>>;
  onStateChange?: (state: WhisperState) => void;
}
export interface WhisperFlow {
  readonly state: WhisperState;
  warm(): void;
  /** While busy, repeated starts share the first operation without another call. */
  start(text: string): Promise<WhisperResult>;
}

const restingLine = "The town's gossip is resting. Try a ready-made rumor.";
function lineFor(result: RestingResult): string {
  if (result.ok) {
    switch (result.unsupported) {
      case 'not-about-cast': case 'real-person': return 'The villagers only gossip about each other.';
      case 'protected-trait': case 'sexual': case 'hateful': return 'Nobody here would repeat that.';
      case 'unclear': return "I couldn't match that rumor reliably. Nothing was sent. Edit it or choose a village story.";
      case 'unsupported-story': return "This kind of rumor isn't supported yet. Nothing was sent. Edit it or choose a village story.";
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
  let active: Promise<WhisperResult> | undefined;
  let attempted = false;
  function transition(next: WhisperState): void {
    state = next;
    try { deps.onStateChange?.(next); } catch { /* UI observers cannot interrupt verification. */ }
  }
  async function run(text: string): Promise<WhisperResult> {
    const local = interpretLocally(text, deps.cast ?? cast);
    if ('claim' in local && local.confidence >= .75) {
      const result: DoneResult = { ok: true, claim: { ...local.claim, confidence: local.confidence }, source: 'local' };
      transition({ status: 'done', result });
      return result;
    }
    if ('unsupported' in local) {
      const result: RestingResult = { ok: true, unsupported: local.unsupported };
      transition({ status: 'resting', result, line: lineFor(result) });
      return result;
    }
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
    if (result.ok && 'claim' in result && !groundedPeople(text, result.claim, deps.cast ?? cast)) {
      result = { ok: true, unsupported: 'unclear' };
    }
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
