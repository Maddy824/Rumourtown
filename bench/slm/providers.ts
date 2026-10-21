import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';

export interface Message { role: 'system' | 'user' | 'assistant'; content: string }
export interface Request {
  model: string;
  messages: Message[];
  temperature?: number;
  seed?: number;
  maxTokens?: number;
  format?: Record<string, unknown>;
}
export interface Generation {
  text: string;
  model: string;
  provider: string;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  tokensPerSecond: number | null;
  costUsd: number | null;
  memoryBytes: number | null;
}
export interface Provider { name: string; generate(request: Request): Promise<Generation> }
export interface TransportOptions { fetch?: typeof fetch; timeoutMs?: number }
/** Messages constructed locally, safe to include in a run's error record. */
export class ProviderError extends Error {}

function count(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}
async function post(url: string, body: unknown, options: TransportOptions, headers: Record<string, string> = {}): Promise<Record<string, any>> {
  let response: Response;
  try {
    response = await (options.fetch ?? fetch)(url, { method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
      signal: AbortSignal.timeout(options.timeoutMs ?? 120_000) });
  } catch {
    // Fetch errors may contain request headers or token-bearing URLs. Never echo them.
    throw new ProviderError('Provider transport failed or timed out');
  }
  if (!response.ok) throw new ProviderError(`Provider HTTP ${response.status}`);
  try {
    const value: unknown = await response.json();
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value as Record<string, any>;
  } catch { throw new ProviderError('Provider returned invalid JSON'); }
}

export function ollama(options: TransportOptions & { baseUrl?: string } = {}): Provider {
  const base = (options.baseUrl ?? 'http://127.0.0.1:11434').replace(/\/$/, '');
  return { name: 'ollama', async generate(request) {
    const start = performance.now();
    const data = await post(`${base}/api/chat`, { model: request.model, messages: request.messages,
      stream: false, ...(request.format ? { format: request.format } : {}),
      options: { seed: request.seed ?? 1, temperature: request.temperature ?? 0, num_predict: request.maxTokens ?? 192 } }, options);
    if (data.error || typeof data.message?.content !== 'string' || data.done !== true) throw new ProviderError('Invalid Ollama completion');
    const latencyMs = performance.now() - start;
    const outputTokens = count(data.eval_count);
    const duration = count(data.eval_duration); // Ollama durations are nanoseconds.
    return { text: data.message.content, model: request.model, provider: 'ollama', latencyMs,
      inputTokens: count(data.prompt_eval_count), outputTokens,
      tokensPerSecond: outputTokens !== null && duration && duration > 0 ? outputTokens * 1e9 / duration : null,
      costUsd: 0, memoryBytes: null };
  } };
}

export const ACCOUNT = 'a37c517b6f93de94eee5d64f3dcd49ae';
export async function readWranglerToken(path = join(homedir(), 'Library/Preferences/.wrangler/config/default.toml')): Promise<string> {
  let config: string;
  try { config = await readFile(path, 'utf8'); } catch { throw new ProviderError('Wrangler OAuth configuration is unavailable'); }
  // Wrangler writes a quoted top-level oauth_token. Do not log config or parser errors.
  const token = config.match(/^\s*oauth_token\s*=\s*"([^"\r\n]+)"\s*(?:#.*)?$/m)?.[1];
  if (!token) throw new ProviderError('Wrangler OAuth token is missing');
  return token;
}

export function workersAI(options: TransportOptions & { token?: () => Promise<string>; account?: string } = {}): Provider {
  return { name: 'workers-ai', async generate(request) {
    const start = performance.now();
    const token = await (options.token ?? readWranglerToken)();
    const modelPath = request.model.split('/').map(encodeURIComponent).join('/');
    const data = await post(`https://api.cloudflare.com/client/v4/accounts/${options.account ?? ACCOUNT}/ai/run/${modelPath}`,
      { messages: request.messages, temperature: request.temperature ?? 0, max_tokens: request.maxTokens ?? 192,
        seed: request.seed ?? 1,
        ...(request.format ? { response_format: { type: 'json_schema', json_schema: request.format } } : {}) },
      options, { Authorization: `Bearer ${token}` });
    const result = data.result;
    if (data.success !== true || typeof result?.response !== 'string') throw new ProviderError('Invalid Workers AI completion');
    const latencyMs = performance.now() - start;
    const outputTokens = count(result.usage?.completion_tokens);
    return { text: result.response, model: request.model, provider: 'workers-ai', latencyMs,
      inputTokens: count(result.usage?.prompt_tokens), outputTokens,
      // REST does not expose decode duration: this is end-to-end throughput.
      tokensPerSecond: outputTokens !== null && latencyMs > 0 ? outputTokens * 1000 / latencyMs : null,
      costUsd: null, memoryBytes: null };
  } };
}

function defaultMockReply(request: Request): string {
  const instruction = request.messages[0]?.content ?? '';
  if (request.format?.properties && 'act' in (request.format.properties as object)) return JSON.stringify({ uses: [], act: 'abstain' });
  if (request.format || instruction.includes('Cite then speak')) return JSON.stringify({ uses: [], reply: 'I have not heard about that.' });
  return 'I have not heard about that.';
}
export function mock(replies: string[] | ((request: Request, index: number) => string) = defaultMockReply): Provider {
  let index = 0;
  return { name: 'mock', async generate(request) {
    const current = index++;
    const text = typeof replies === 'function' ? replies(request, current) : replies[current];
    if (text === undefined) throw new Error('Mock fixture exhausted');
    return { text, model: request.model, provider: 'mock', latencyMs: 1,
      inputTokens: null, outputTokens: null, tokensPerSecond: null, costUsd: 0, memoryBytes: null };
  } };
}

export function providerFor(model: string): { provider: Provider; model: string } {
  if (model.startsWith('cf:')) return { provider: workersAI(), model: model.slice(3) };
  if (model.startsWith('mock:')) return { provider: mock(), model: model.slice(5) };
  return { provider: ollama(), model: model.replace(/^ollama:/, '') };
}
