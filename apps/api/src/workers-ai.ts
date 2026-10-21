import { MAX_TOKENS } from './prices';
import { record, type Env } from './types';
import { schema, validate, type Claim, type Unsupported } from './validate';

export const DEFAULT_WORKERS_AI_MODEL = '@cf/meta/llama-3.2-3b-instruct';
/** Measured on 2026-10-22: the 3B model named the culprit in 3/12 stories, the 70B model in 10/12 (agent-tradeoff/reports/qa-2026-10-22.md). */
export const DEFAULT_QUALITY_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
export type Route = 'rumor' | 'play' | 'interpret';
export function modelFor(env: { WORKERS_AI_MODEL?: string; WORKERS_AI_RUMOR_MODEL?: string; WORKERS_AI_PLAY_MODEL?: string }, route: Route): string {
  if (route === 'rumor') return env.WORKERS_AI_RUMOR_MODEL ?? DEFAULT_QUALITY_MODEL;
  if (route === 'play') return env.WORKERS_AI_PLAY_MODEL ?? DEFAULT_QUALITY_MODEL;
  return env.WORKERS_AI_MODEL ?? DEFAULT_WORKERS_AI_MODEL;
}

/** The binding uses a bare JSON Schema; OpenRouter wraps this same schema. */
export async function workersAi<T = Claim | Unsupported>(env: Env, messages: { role: string; content: string }[],
  options?: { schema: unknown; validate: (value: unknown) => T | null; temperature: number; model?: string; route?: Route }): Promise<T | null> {
  const controller = new AbortController();
  const model = options?.model ?? env.WORKERS_AI_MODEL ?? DEFAULT_WORKERS_AI_MODEL;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error('workers-ai-timeout')); }, 6_000);
    });
    const result = await Promise.race([env.AI!.run(model, {
      messages, response_format: { type: 'json_schema', json_schema: options?.schema ?? schema },
      temperature: options?.temperature ?? 0, max_tokens: MAX_TOKENS,
      ...(options?.route === 'play' && model === DEFAULT_WORKERS_AI_MODEL && env.WORKERS_AI_PLAY_LORA
        ? { lora: env.WORKERS_AI_PLAY_LORA } : {}),
    }, { signal: controller.signal }), timeout]);
    if (!record(result) || result.success === false || result.error || result.errors ||
        typeof result.status === 'number' && result.status >= 400) return null;
    const output: unknown = typeof result.response === 'string' ? JSON.parse(result.response) : result.response;
    return options ? options.validate(output) : validate(output) as T | null;
  } catch { return null; }
  finally { if (timer !== undefined) clearTimeout(timer); }
}
