import { MAX_TOKENS } from './prices';
import { record, type Env } from './types';
import { schema, validate } from './validate';

export const DEFAULT_WORKERS_AI_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast';

/** The binding uses a bare JSON Schema; OpenRouter wraps this same schema. */
export async function workersAi(env: Env, messages: { role: string; content: string }[]) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error('workers-ai-timeout')); }, 6_000);
    });
    const result = await Promise.race([env.AI!.run(env.WORKERS_AI_MODEL ?? DEFAULT_WORKERS_AI_MODEL, {
      messages, response_format: { type: 'json_schema', json_schema: schema },
      temperature: 0, max_tokens: MAX_TOKENS,
    }, { signal: controller.signal }), timeout]);
    if (!record(result) || result.success === false || result.error || result.errors ||
        typeof result.status === 'number' && result.status >= 400) return null;
    const output: unknown = typeof result.response === 'string' ? JSON.parse(result.response) : result.response;
    return validate(output);
  } catch { return null; }
  finally { if (timer !== undefined) clearTimeout(timer); }
}
