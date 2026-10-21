import { blockedReason, hash, normalise } from './moderation';
import { actualCost, estimatePromptTokens, MAX_TOKENS, modelList, providerPriceCap, reservationCost } from './prices';
import { admit, Failure, readInput } from './admission';
import { claimCache, type EdgeCache } from './edge-cache';
import { systemPrompt } from './prompt';
import { publicKey, sign, verify } from './sign';
import { record, type Env, type FailureReason, type Fetcher, type Refusal, type SignedPayload } from './types';
import { schema, validate } from './validate';
import { workersAi } from './workers-ai';
import { playPrompt, playSchema, readPlayContext, validatePlay, type PlayReply } from './play';
export { BudgetLedger } from './ledger';

interface Dependencies { fetch?: Fetcher; now?: () => number; cache?: EdgeCache }

function allowedOrigins(env: Env): string[] {
  return env.ALLOWED_ORIGIN === 'https://rumourtown.dev'
    ? [env.ALLOWED_ORIGIN, 'https://www.rumourtown.dev'] : [env.ALLOWED_ORIGIN];
}
interface Usage {
  dispatched: boolean; track?: boolean; reason?: string;
  workersAi?: boolean; workersAiFailed?: boolean; openRouter?: boolean;
  pending: Promise<unknown>[];
}
type Defer = (task: Promise<void>) => Promise<void>;

// Single stable object for the whole deployment, never a per-visitor object.
async function ledger(env: Env, method: string, body: unknown): Promise<Record<string, unknown>> {
  try {
    const stub = env.LEDGER.get(env.LEDGER.idFromName('global-budget'));
    const response = await stub.fetch(`https://ledger/${method}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error('ledger');
    const result: unknown = await response.json();
    if (!record(result)) throw new Error('ledger');
    return result;
  } catch { throw new Failure('ledger'); }
}
async function finish(env: Env, method: 'settle' | 'release' | 'cachePut', body: unknown): Promise<void> {
  if ((await ledger(env, method, body)).ok !== true) throw new Failure('ledger');
}

async function turnstile(request: Request, token: string, env: Env, fetcher: Fetcher): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6_000);
  try {
    const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token });
    const ip = request.headers.get('CF-Connecting-IP');
    if (ip) body.set('remoteip', ip);
    const response = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body, signal: controller.signal });
    const result: unknown = await response.json();
    if (!response.ok || !record(result) || result.success !== true) throw new Error('turnstile');
    if (typeof result.hostname === 'string' && result.hostname !== new URL(request.headers.get('Origin')!).hostname) throw new Error('hostname');
  } catch { throw new Failure('turnstile'); }
  finally { clearTimeout(timer); }
}

async function interpret(request: Request, env: Env, fetcher: Fetcher, now: () => number, usage: Usage, defer: Defer, cache?: EdgeCache): Promise<SignedPayload | Refusal> {
  await admit(request, env);
  const input = await readInput(request);
  if (!record(input) || Object.keys(input).some(key => !['text', 'turnstileToken', 'castVersion'].includes(key)) ||
      typeof input.text !== 'string' || typeof input.turnstileToken !== 'string' || !input.turnstileToken.trim() || input.turnstileToken.length > 2048 ||
      typeof input.castVersion !== 'string' || input.castVersion.trim().length === 0 || input.castVersion.length > 128) throw new Failure('invalid');
  const text = input.text.trim();
  if (Array.from(text).length < 1 || Array.from(text).length > 140) throw new Failure('invalid');
  const normalised = normalise(text);
  if (!normalised) throw new Failure('invalid');
  const unsupported = blockedReason(normalised);
  if (unsupported) return { unsupported, castVersion: input.castVersion, issuedAt: now() };
  await turnstile(request, input.turnstileToken, env, fetcher);
  usage.track = true;
  const key = await hash(normalised);
  const edge = claimCache(cache, request, await hash(JSON.stringify([key, input.castVersion, publicKey(env.SIGNING_KEY_JWK)])));
  const edgePayload = await edge.get();
  const cached = edgePayload === null ? await ledger(env, 'cacheGet', { hash: key }) : { payload: edgePayload };
  if (!Object.hasOwn(cached, 'payload')) throw new Failure('ledger');
  if (cached.payload !== null) {
    const p = cached.payload;
    if (!record(p) || typeof p.sig !== 'string' || typeof p.castVersion !== 'string' || typeof p.issuedAt !== 'number') throw new Failure('ledger');
    // Authenticate the complete stored envelope before projecting or normalising it.
    if (!await verify(p, p.sig, publicKey(env.SIGNING_KEY_JWK))) throw new Failure('ledger');
    const claim = validate(p.claim);
    if (!claim || 'unsupported' in claim) throw new Failure('ledger');
    const payload = { claim, castVersion: p.castVersion, issuedAt: p.issuedAt };
    if (p.castVersion === input.castVersion) {
      const signed = { ...payload, sig: p.sig };
      if (edgePayload === null) await edge.put(signed);
      return signed;
    }
    // Hash cache is independent of caller castVersion; re-sign without another model call.
    const signed = await sign({ claim, castVersion: input.castVersion, issuedAt: now() }, env.SIGNING_KEY_JWK);
    await finish(env, 'cachePut', { hash: key, payload: signed });
    await edge.put(signed);
    return signed;
  }

  const messages = [{ role: 'system', content: systemPrompt }, { role: 'user', content: JSON.stringify({ whisper: text }) }];
  const claim = await infer(request, env, fetcher, now, usage, defer, messages, schema, validate);
  if ('unsupported' in claim) return { unsupported: claim.unsupported, castVersion: input.castVersion, issuedAt: now() };
  const signed = await sign({ claim, castVersion: input.castVersion, issuedAt: now() }, env.SIGNING_KEY_JWK);
  await finish(env, 'cachePut', { hash: key, payload: signed });
  await edge.put(signed);
  return signed;
}

/** Both typed routes share the same exact admission, reservation and settlement boundary. */
async function infer<T>(request: Request, env: Env, fetcher: Fetcher, now: () => number, usage: Usage, defer: Defer,
  messages: { role: string; content: string }[], outputSchema: unknown, validateOutput: (value: unknown) => T | null, temperature = 0): Promise<T> {
  // Gate both tiers through the exact ledger limits; a free attempt holds $0.
  let models: string[] = [];
  let body: Record<string, unknown> = {};
  let worstCaseUsd = 0;
  function openRouterBody() {
    try { models = modelList(env.MODELS); } catch { throw new Failure('model'); }
    body = {
      models, messages,
      response_format: { type: 'json_schema', json_schema: { name: 'village_reply', strict: true, schema: outputSchema } },
      provider: { require_parameters: true, max_price: providerPriceCap(models) }, temperature, max_tokens: MAX_TOKENS,
    };
    worstCaseUsd = reservationCost(models, estimatePromptTokens(body));
  }
  if (!env.AI) openRouterBody();
  const visitorKey = await hash(JSON.stringify([request.headers.get('CF-Connecting-IP') ?? 'unknown', request.headers.get('User-Agent') ?? '']));
  const reserved = await ledger(env, 'reserve', { visitorKey, worstCaseUsd, now: now() });
  if (reserved.ok === false && ['limit-visitor', 'limit-global', 'budget'].includes(reserved.reason as string)) {
    const reason = reserved.reason as FailureReason;
    throw new Failure(reason, reason === 'budget' ? 503 : 429, reason === 'limit-visitor' ? 3600 : 60);
  }
  if (reserved.ok !== true || typeof reserved.reservationId !== 'string') throw new Failure('ledger');
  const reservationId = reserved.reservationId;

  let openRouterDispatched = false;
  let settled = false;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Validate signing configuration before either provider can dispatch.
    publicKey(env.SIGNING_KEY_JWK);
    if (env.AI) {
      usage.dispatched = true;
      usage.workersAi = true;
      const claim = await workersAi(env, messages, { schema: outputSchema, validate: validateOutput, temperature });
      if (claim) {
        settled = true;
        await defer(finish(env, 'settle', { reservationId, actualUsd: 0 }));
        return claim;
      }
      usage.workersAiFailed = true;
      openRouterBody();
      const funded = await ledger(env, 'fund', { reservationId, worstCaseUsd });
      if (funded.ok === false && funded.reason === 'budget') throw new Failure('budget');
      if (funded.ok !== true) throw new Failure('ledger');
    }
    if (!env.OPENROUTER_API_KEY) throw new Failure('model');
    timer = setTimeout(() => controller.abort(), 6_000);
    openRouterDispatched = true;
    usage.dispatched = true;
    usage.openRouter = true;
    const response = await fetcher('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST', headers: { authorization: `Bearer ${env.OPENROUTER_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify(body), signal: controller.signal,
    });
    const result: unknown = await response.json();
    // Settle even malformed/refused output: inference may already have been billed.
    settled = true;
    await defer(finish(env, 'settle', { reservationId, actualUsd: actualCost(result, models, worstCaseUsd) }));
    if (!response.ok || !record(result) || !Array.isArray(result.choices)) throw new Failure('model');
    const choice: unknown = result.choices[0];
    if (!record(choice) || !record(choice.message) || typeof choice.message.content !== 'string') throw new Failure('invalid');
    let output: unknown;
    try { output = JSON.parse(choice.message.content); } catch { throw new Failure('invalid'); }
    const claim = validateOutput(output);
    if (!claim) throw new Failure('invalid');
    return claim;
  } catch (error) {
    if (!settled) {
      // Aborts, lost responses and unknown usage are charged at the reserved bound.
      // If settlement itself fails, its durable reservation remains held (fail closed).
      if (!(error instanceof Failure && error.reason === 'ledger')) {
        await defer(finish(env, openRouterDispatched ? 'settle' : 'release', { reservationId, actualUsd: worstCaseUsd }));
      }
    }
    if (error instanceof Failure) throw error;
    throw new Failure('model');
  } finally { if (timer !== undefined) clearTimeout(timer); }
}

export function createWorker(deps: Dependencies = {}) {
  return {
    async fetch(request: Request, env: Env, ctx?: Pick<ExecutionContext, 'waitUntil'>): Promise<Response> {
      const origin = request.headers.get('Origin');
      if (!env.ALLOWED_ORIGIN || !origin || !allowedOrigins(env).includes(origin)) return Response.json({ reason: 'invalid' }, { status: 403, headers: { Vary: 'Origin' } });
      const headers = {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400',
        'Access-Control-Expose-Headers': 'Retry-After', Vary: 'Origin', 'Cache-Control': 'no-store',
      };
      const json = (value: unknown, status = 200) => Response.json(value, { status, headers });
      const usage: Usage = { dispatched: false, pending: [] };
      const defer: Defer = async task => {
        if (ctx) usage.pending.push(task.catch(() => undefined));
        else await task;
      };
      const isInterpret = request.method === 'POST' && ['/interpret', '/play'].includes(new URL(request.url).pathname);
      const requestTime = (deps.now ?? Date.now)();
      try {
        const path = new URL(request.url).pathname;
        if (request.method === 'OPTIONS' && ['/interpret', '/play', '/pubkey', '/health'].includes(path)) return new Response(null, { status: 204, headers });
        if (request.method === 'GET' && path === '/health') return json({ ok: true });
        if (request.method === 'GET' && path === '/pubkey') return json(publicKey(env.SIGNING_KEY_JWK));
        if (request.method === 'POST' && path === '/play') {
          await admit(request, env);
          const input = await readInput(request);
          if (!record(input) || Object.keys(input).some(key => !['text', 'context', 'turnstileToken'].includes(key)) ||
              typeof input.text !== 'string' || !input.text.trim() || input.text.length > 280 || /[\u0000-\u001f\u007f]/u.test(input.text) ||
              typeof input.turnstileToken !== 'string' || !input.turnstileToken.trim() || input.turnstileToken.length > 2048) throw new Failure('invalid', 400);
          const context = readPlayContext(input.context);
          if (!context) throw new Failure('invalid', 400);
          await turnstile(request, input.turnstileToken, env, deps.fetch ?? fetch);
          usage.track = true;
          if (blockedReason(normalise(input.text))) return json({ reply: 'Let’s keep this conversation about life in the village.', action: 'none', target: '' } satisfies PlayReply);
          // No prose, context or generated reply enters either cache or the ledger.
          const result = await infer(request, env, deps.fetch ?? fetch, deps.now ?? Date.now, usage, defer,
            [{ role: 'system', content: playPrompt }, { role: 'user', content: JSON.stringify({ text: input.text, context }) }],
            playSchema, value => validatePlay(value, context), .7);
          return json(result);
        }
        if (request.method === 'POST' && path === '/interpret') {
          const cache = deps.cache ?? (typeof caches === 'undefined' ? undefined : caches.default);
          const result = await interpret(request, env, deps.fetch ?? fetch, deps.now ?? Date.now, usage, defer, cache);
          if ('unsupported' in result) usage.reason = result.unsupported;
          return json(result);
        }
        return json({ reason: 'invalid' }, 404);
      } catch (error) {
        usage.reason = error instanceof Failure ? error.reason : 'invalid';
        const response = json({ reason: error instanceof Failure ? error.reason : 'invalid' }, error instanceof Failure ? error.status : 503);
        if (error instanceof Failure && error.retryAfter) response.headers.set('Retry-After', String(error.retryAfter));
        return response;
      } finally {
        if (isInterpret && (usage.dispatched || usage.track && usage.reason)) {
          // Aggregate bookkeeping and ntfy are never on the response critical path.
          const { pending, ...counts } = usage;
          const recordUsage = Promise.all(pending).then(() => ledger(env, 'usage', { ...counts, now: requestTime })).catch(() => undefined);
          if (ctx) ctx.waitUntil(recordUsage);
          else await recordUsage;
        } else if (ctx && usage.pending.length) {
          ctx.waitUntil(Promise.all(usage.pending));
        }
      }
    },
  };
}
export default createWorker();
