import { blockedReason, hash, normalise } from './moderation';
import { actualCost, estimatePromptTokens, MAX_TOKENS, modelList, providerPriceCap, reservationCost } from './prices';
import { notifyUsage } from './alerts';
import { admit, Failure, readInput } from './admission';
import { claimCache, type EdgeCache } from './edge-cache';
import { systemPrompt } from './prompt';
import { publicKey, sign, verify } from './sign';
import { record, type Env, type FailureReason, type Fetcher, type Refusal, type SignedPayload } from './types';
import { schema, validate } from './validate';
export { BudgetLedger } from './ledger';

interface Dependencies { fetch?: Fetcher; now?: () => number; cache?: EdgeCache }

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
    if (typeof result.hostname === 'string' && result.hostname !== new URL(env.ALLOWED_ORIGIN).hostname) throw new Error('hostname');
  } catch { throw new Failure('turnstile'); }
  finally { clearTimeout(timer); }
}

async function interpret(request: Request, env: Env, fetcher: Fetcher, now: () => number, cache?: EdgeCache): Promise<SignedPayload | Refusal> {
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

  let models: string[];
  try { models = modelList(env.MODELS); } catch { throw new Failure('model'); }
  const body = {
    models, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: JSON.stringify({ whisper: text }) }],
    response_format: { type: 'json_schema', json_schema: { name: 'whisper', strict: true, schema } },
    provider: { require_parameters: true, max_price: providerPriceCap(models) }, temperature: 0, max_tokens: MAX_TOKENS,
  };
  const worstCaseUsd = reservationCost(models, estimatePromptTokens(body));
  const visitorKey = await hash(JSON.stringify([request.headers.get('CF-Connecting-IP') ?? 'unknown', request.headers.get('User-Agent') ?? '']));
  const reserved = await ledger(env, 'reserve', { visitorKey, worstCaseUsd, now: now() });
  if (reserved.ok === false && ['limit-visitor', 'limit-global', 'budget'].includes(reserved.reason as string)) {
    const reason = reserved.reason as FailureReason;
    throw new Failure(reason, reason === 'budget' ? 503 : 429, reason === 'limit-visitor' ? 3600 : 60);
  }
  if (reserved.ok !== true || typeof reserved.reservationId !== 'string') throw new Failure('ledger');
  const reservationId = reserved.reservationId;

  let dispatched = false;
  let settled = false;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Invalid/missing secrets fail before dispatch and can safely release the reservation.
    if (!env.OPENROUTER_API_KEY) throw new Failure('model');
    publicKey(env.SIGNING_KEY_JWK);
    try { await notifyUsage(env, fetcher, reservationId, worstCaseUsd); }
    catch { throw new Failure('alerts'); }
    timer = setTimeout(() => controller.abort(), 6_000);
    dispatched = true;
    const response = await fetcher('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST', headers: { authorization: `Bearer ${env.OPENROUTER_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify(body), signal: controller.signal,
    });
    const result: unknown = await response.json();
    // Settle even malformed/refused output: inference may already have been billed.
    await finish(env, 'settle', { reservationId, actualUsd: actualCost(result, models, worstCaseUsd) });
    settled = true;
    if (!response.ok || !record(result) || !Array.isArray(result.choices)) throw new Failure('model');
    const choice: unknown = result.choices[0];
    if (!record(choice) || !record(choice.message) || typeof choice.message.content !== 'string') throw new Failure('invalid');
    let output: unknown;
    try { output = JSON.parse(choice.message.content); } catch { throw new Failure('invalid'); }
    const claim = validate(output);
    if (!claim) throw new Failure('invalid');
    if ('unsupported' in claim) return { unsupported: claim.unsupported, castVersion: input.castVersion, issuedAt: now() };
    const signed = await sign({ claim, castVersion: input.castVersion, issuedAt: now() }, env.SIGNING_KEY_JWK);
    await finish(env, 'cachePut', { hash: key, payload: signed });
    await edge.put(signed);
    return signed;
  } catch (error) {
    if (!settled) {
      // Aborts, lost responses and unknown usage are charged at the reserved bound.
      // If settlement itself fails, its durable reservation remains held (fail closed).
      if (!(error instanceof Failure && error.reason === 'ledger')) {
        await finish(env, dispatched ? 'settle' : 'release', { reservationId, actualUsd: worstCaseUsd });
      }
    }
    if (error instanceof Failure) throw error;
    throw new Failure('model');
  } finally { if (timer !== undefined) clearTimeout(timer); }
}

export function createWorker(deps: Dependencies = {}) {
  return {
    async fetch(request: Request, env: Env): Promise<Response> {
      const origin = request.headers.get('Origin');
      if (!env.ALLOWED_ORIGIN || origin !== env.ALLOWED_ORIGIN) return Response.json({ reason: 'invalid' }, { status: 403, headers: { Vary: 'Origin' } });
      const headers = {
        'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400',
        'Access-Control-Expose-Headers': 'Retry-After', Vary: 'Origin', 'Cache-Control': 'no-store',
      };
      const json = (value: unknown, status = 200) => Response.json(value, { status, headers });
      try {
        const path = new URL(request.url).pathname;
        if (request.method === 'OPTIONS' && ['/interpret', '/pubkey', '/health'].includes(path)) return new Response(null, { status: 204, headers });
        if (request.method === 'GET' && path === '/health') return json({ ok: true });
        if (request.method === 'GET' && path === '/pubkey') return json(publicKey(env.SIGNING_KEY_JWK));
        if (request.method === 'POST' && path === '/interpret') {
          const cache = deps.cache ?? (typeof caches === 'undefined' ? undefined : caches.default);
          return json(await interpret(request, env, deps.fetch ?? fetch, deps.now ?? Date.now, cache));
        }
        return json({ reason: 'invalid' }, 404);
      } catch (error) {
        const response = json({ reason: error instanceof Failure ? error.reason : 'invalid' }, error instanceof Failure ? error.status : 503);
        if (error instanceof Failure && error.retryAfter) response.headers.set('Retry-After', String(error.retryAfter));
        return response;
      }
    },
  };
}
export default createWorker();
