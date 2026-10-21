import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { interpretWhisper, type InterpretOptions, type SignedClaim, type SignedClaimPayload } from './interpret.js';
import { fetchPublicKey, verifySignedClaim } from './verify.js';
import { loadTurnstile } from './turnstile.js';
import { createWhisperFlow } from './whisperFlow.js';
import { unsupportedReasons } from './types.js';

// Vitest runs in Node: its global crypto is Node's real WebCrypto implementation.
// Use the DOM-compatible surface so these tests need no @types/node dependency.
const webcrypto = globalThis.crypto;
let privateKey: CryptoKey;
let jwk: JsonWebKey;
let sequence = 0;
const payload: SignedClaimPayload = {
  issuedAt: 1_792_540_800_000,
  castVersion: 'village-1 é 🥖',
  claim: { confidence: 0.91, valence: -1, severity: 2, object: 'bread', target: 'ada', about: 'tom', kind: 'theft' },
};

// Independent fixture of the Worker's exact signing protocol, including UTF-8.
const canonical = '{"claim":{"kind":"theft","about":"tom","target":"ada","object":"bread","severity":2,"valence":-1,"confidence":0.91},"castVersion":"village-1 é 🥖","issuedAt":1792540800000}';

async function signFixture(value: SignedClaimPayload = payload): Promise<SignedClaim> {
  const c = value.claim;
  const workerString = JSON.stringify({
    claim: { kind: c.kind, about: c.about, ...(c.target !== undefined ? { target: c.target } : {}),
      ...(c.object !== undefined ? { object: c.object } : {}), severity: c.severity, valence: c.valence, confidence: c.confidence },
    castVersion: value.castVersion, issuedAt: value.issuedAt,
  });
  if (value === payload) expect(workerString).toBe(canonical);
  const bytes = await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, new TextEncoder().encode(workerString));
  const sig = btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
  return { ...value, sig };
}

function options(fetcher: typeof fetch, overrides: Partial<InterpretOptions> = {}): InterpretOptions {
  return {
    baseUrl: `https://stub-${++sequence}.invalid`, castVersion: payload.castVersion,
    turnstileToken: 'fresh-human-token', fetch: fetcher, ...overrides,
  };
}

function server(body: unknown, status = 200) {
  return vi.fn<typeof fetch>(async (input) => {
    const path = String(input);
    if (path.endsWith('/pubkey')) return Response.json(jwk);
    if (path.endsWith('/interpret')) return Response.json(body, { status });
    throw new Error(`Unexpected stub request: ${path}`);
  });
}

function refusal(unsupported: string) {
  return { unsupported, castVersion: payload.castVersion, issuedAt: payload.issuedAt };
}

beforeAll(async () => {
  const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  privateKey = pair.privateKey;
  jwk = await webcrypto.subtle.exportKey('jwk', pair.publicKey);
});
beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
  // An accidentally unstubbed request fails locally, without making a network call.
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No network in tests'); }));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Worker signature compatibility', () => {
  it('verifies a real Worker-format signature with scrambled input order and Unicode', async () => {
    const signed = await signFixture();
    expect(signed.sig).toMatch(/^[A-Za-z0-9_-]{86}$/u);
    expect(await verifySignedClaim(signed, signed.sig, jwk)).toBe(true);
    const fetcher = server(signed);
    const result = await interpretWhisper(' Tom took Ada’s bread. ', options(fetcher));
    expect(result).toEqual({ ok: true, ...signed });
    expect(fetcher.mock.calls.map(([input]) => String(input).split('/').at(-1))).toEqual(['interpret', 'pubkey']);
  });

  it.each(['neither', 'target', 'object', 'both'] as const)('matches optional-field omission: %s', async (fields) => {
    const claim = { kind: 'kindness', about: 'mira', severity: 1, valence: 1, confidence: 1 } as const;
    const value: SignedClaimPayload = {
      ...payload,
      claim: { ...claim, ...(['target', 'both'].includes(fields) ? { target: 'ada' } : {}),
        ...(['object', 'both'].includes(fields) ? { object: 'bread' } : {}) },
    };
    const signed = await signFixture(value);
    expect(await verifySignedClaim(signed, signed.sig, jwk)).toBe(true);
  });

  it.each(['about', 'target', 'object', 'severity', 'confidence', 'castVersion', 'issuedAt'] as const)(
    'rejects tampering with %s', async (field) => {
      const signed = await signFixture();
      const changed = structuredClone(signed);
      if (field === 'castVersion') changed.castVersion = 'different-cast';
      else if (field === 'issuedAt') changed.issuedAt++;
      else if (field === 'severity') changed.claim.severity = 3;
      else if (field === 'confidence') changed.claim.confidence = 0.5;
      else changed.claim[field] = 'mira';
      expect(await verifySignedClaim(changed, changed.sig, jwk)).toBe(false);
    },
  );

  it('returns bad-signature for a tampered response and never exposes a claim', async () => {
    const signed = await signFixture();
    const fetcher = server({ ...signed, claim: { ...signed.claim, about: 'mira' } });
    expect(await interpretWhisper('A whisper.', options(fetcher))).toEqual({ ok: false, reason: 'bad-signature' });
  });

  it('rejects unsigned additions, signature disagreement, and inherited required fields before projection', async () => {
    const signed = await signFixture();
    const unknownEnvelopes = [
      { ...signed, unsupported: 'unclear' },
      { ...signed, injected: true },
      { ...signed, claim: { ...signed.claim, injected: true } },
      { ...signed, sig: 'different' },
      Object.assign(Object.create(payload), { sig: signed.sig }),
      { ...signed, claim: Object.create(payload.claim) },
    ];
    for (const value of unknownEnvelopes) {
      expect(await verifySignedClaim(value, signed.sig, jwk)).toBe(false);
    }
    for (const level of ['envelope', 'claim'] as const) {
      for (const key of ['hidden', Symbol('hidden')]) {
        const value = structuredClone(signed);
        Object.defineProperty(level === 'envelope' ? value : value.claim, key, { value: true });
        expect(await verifySignedClaim(value, signed.sig, jwk)).toBe(false);
      }
    }
    expect(await verifySignedClaim(payload, signed.sig, jwk)).toBe(true);
  });

  it('rejects even correctly signed claims that the Worker would refuse to sign', async () => {
    const invalidPayloads = [
      ...[-1, 0.5, Number.MAX_SAFE_INTEGER + 1].map(issuedAt => ({ ...payload, issuedAt })),
      { ...payload, castVersion: '' },
      { ...payload, castVersion: 'a'.repeat(129) },
      { ...payload, claim: { ...payload.claim, object: 'arbitrary narrative 🥖' } },
      { ...payload, claim: { ...payload.claim, object: undefined } },
      { ...payload, claim: { ...payload.claim, target: undefined } },
      { ...payload, claim: { ...payload.claim, valence: 1 as const } },
      { ...payload, claim: { ...payload.claim, confidence: 2 } },
      { ...payload, claim: { ...payload.claim, about: 'outsider' } },
      { ...payload, claim: { ...payload.claim, target: payload.claim.about } },
    ];
    for (const value of invalidPayloads) {
      const signed = await signFixture(value);
      expect(await verifySignedClaim(signed, signed.sig, jwk)).toBe(false);
    }
  });

  it('rejects missing, padded, malformed and wrong-key signatures', async () => {
    const signed = await signFixture();
    for (const sig of ['', '!', `${signed.sig}==`, 'a'.repeat(85), 'a'.repeat(86)]) {
      expect(await verifySignedClaim(signed, sig, jwk)).toBe(false);
    }
    const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const wrongKey = await webcrypto.subtle.exportKey('jwk', pair.publicKey);
    expect(await verifySignedClaim(signed, signed.sig, wrongKey)).toBe(false);
    expect(await verifySignedClaim(signed, signed.sig, { ...jwk, d: 'private' })).toBe(false);
    expect(await verifySignedClaim(signed, signed.sig, { kty: 'RSA' })).toBe(false);
    expect(await interpretWhisper('A whisper.', options(server(payload)))).toEqual({ ok: false, reason: 'bad-signature' });
  });

  it('fails closed when WebCrypto is unavailable', async () => {
    const signed = await signFixture();
    vi.stubGlobal('crypto', undefined);
    expect(await verifySignedClaim(signed, signed.sig, jwk)).toBe(false);
    expect(await interpretWhisper('A whisper.', options(server(signed)))).toEqual({ ok: false, reason: 'bad-signature' });
  });
});

describe('interpretWhisper', () => {
  it.each(['turnstile', 'limit-visitor', 'limit-global', 'budget', 'model', 'invalid', 'ledger'] as const)(
    'maps Worker 503 %s without retrying', async (reason) => {
      const fetcher = server({ reason }, 503);
      expect(await interpretWhisper('A whisper.', options(fetcher))).toEqual({ ok: false, reason });
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );

  it('maps an unrecognized HTTP failure to unknown', async () => {
    expect(await interpretWhisper('A whisper.', options(server({ reason: 'surprise' }, 503))))
      .toEqual({ ok: false, reason: 'unknown' });
  });

  it('maps a rejected fetch to offline without retrying', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => { throw new TypeError('network unavailable'); });
    expect(await interpretWhisper('A whisper.', options(fetcher))).toEqual({ ok: false, reason: 'offline' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('aborts after exactly six seconds even if fetch ignores the signal', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>(() => new Promise(() => undefined));
    const result = interpretWhisper('A whisper.', options(fetcher));
    const signal = fetcher.mock.calls[0]?.[1]?.signal;
    await vi.advanceTimersByTimeAsync(5_999);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toEqual({ ok: false, reason: 'timeout' });
    expect(signal?.aborted).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('supports a shorter timeout and cancels an abort-aware fetch', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    const result = interpretWhisper('A whisper.', options(fetcher, { timeoutMs: 15 }));
    await vi.advanceTimersByTimeAsync(15);
    expect(await result).toEqual({ ok: false, reason: 'timeout' });
  });

  it('includes response body parsing in the deadline', async () => {
    vi.useFakeTimers();
    const response = { ok: true, json: () => new Promise(() => undefined) } as unknown as Response;
    const result = interpretWhisper('A whisper.', options(vi.fn<typeof fetch>(async () => response)));
    await vi.advanceTimersByTimeAsync(6_000);
    expect(await result).toEqual({ ok: false, reason: 'timeout' });
  });

  it('bounds a missing pubkey with its own deadline and aborts it', async () => {
    const signed = await signFixture();
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>(async input => String(input).endsWith('/interpret')
      ? Response.json(signed) : new Promise(() => undefined));
    const result = interpretWhisper('A whisper.', options(fetcher));
    await vi.advanceTimersByTimeAsync(6_000);
    expect(await result).toEqual({ ok: false, reason: 'timeout' });
    expect(fetcher.mock.calls[1]?.[1]?.signal?.aborted).toBe(true);
  });

  it('does not charge a slow pubkey fetch to the interpretation deadline', async () => {
    const signed = await signFixture();
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>(async input => {
      const key = String(input).endsWith('/pubkey');
      await new Promise(resolve => setTimeout(resolve, key ? 4_000 : 5_000));
      return Response.json(key ? jwk : signed);
    });
    const pending = interpretWhisper('A whisper.', options(fetcher));
    await vi.advanceTimersByTimeAsync(8_999);
    expect(fetcher.mock.calls[0]?.[1]?.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toEqual({ ok: true, ...signed });
  });

  it('trims and caps at 140 Unicode code points without splitting emoji', async () => {
    const fetcher = server({ reason: 'budget' }, 503);
    const opts = options(fetcher);
    await interpretWhisper(`  ${'a'.repeat(139)}🥖this part is cut  `, opts);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe(`${opts.baseUrl}/interpret`);
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(String(init?.body))).toEqual({
      text: `${'a'.repeat(139)}🥖`, turnstileToken: opts.turnstileToken, castVersion: opts.castVersion,
    });
  });

  it.each(['', '   ', '\n\t'])('rejects empty text locally: %j', async text => {
    const fetcher = server({});
    expect(await interpretWhisper(text, options(fetcher))).toEqual({ ok: false, reason: 'invalid' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects malformed success JSON, invalid claims, and mismatched cast versions', async () => {
    for (const body of [null, [], {}, { ...payload, castVersion: 'old' },
      { ...payload, claim: { ...payload.claim, about: 'real-person' } },
      { ...payload, claim: { ...payload.claim, target: 'tom' } },
      { ...payload, claim: { ...payload.claim, confidence: 2 } },
      { ...payload, claim: { ...payload.claim, valence: 1 } },
      { ...payload, claim: { ...payload.claim, injected: true } },
      { unsupported: 'unknown' }, { unsupported: 'unclear', claim: payload.claim }]) {
      expect(await interpretWhisper('A whisper.', options(server(body)))).toEqual({ ok: false, reason: 'invalid' });
    }
    const fetcher = vi.fn<typeof fetch>(async () => new Response('invalid json'));
    expect(await interpretWhisper('A whisper.', options(fetcher))).toEqual({ ok: false, reason: 'invalid' });
  });

  it.each(unsupportedReasons)('accepts unsupported %s without fetching a key', async unsupported => {
    const fetcher = server(refusal(unsupported));
    expect(await interpretWhisper('A whisper.', options(fetcher))).toEqual({ ok: true, unsupported });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('rejects refusal envelopes with invalid metadata or unknown fields', async () => {
    for (const body of [
      { unsupported: 'unclear' },
      { ...refusal('unclear'), castVersion: 'old' },
      { ...refusal('unclear'), issuedAt: -1 },
      { ...refusal('unclear'), issuedAt: 0.5 },
      { ...refusal('unclear'), issuedAt: Number.MAX_SAFE_INTEGER + 1 },
      { ...refusal('unclear'), extra: true },
      { ...refusal('unclear'), sig: 'unsigned-refusal' },
      refusal('unknown'),
    ]) {
      const fetcher = server(body);
      expect(await interpretWhisper('A whisper.', options(fetcher))).toEqual({ ok: false, reason: 'invalid' });
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });
});

describe('public key cache', () => {
  it('caches by base URL, normalizes trailing slashes, and protects the cached object', async () => {
    const fetcher = server({});
    const base = options(fetcher).baseUrl;
    const key = await fetchPublicKey(`${base}/`, fetcher);
    key.x = 'modified by caller';
    const second = await fetchPublicKey(base, fetcher);
    expect(second.x).toBe(jwk.x);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[0]).toBe(`${base}/pubkey`);
    await fetchPublicKey(`${base}/different`, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('does not cache failures', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(Response.json(jwk));
    const base = options(fetcher).baseUrl;
    await expect(fetchPublicKey(base, fetcher)).rejects.toMatchObject({ reason: 'offline' });
    expect(await fetchPublicKey(base, fetcher)).toMatchObject({ x: jwk.x });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('rejects malformed keys and maps pubkey failures safely', async () => {
    const signed = await signFixture();
    for (const body of [null, {}, { ...jwk, x: 'broken' }, { ...jwk, d: 'private' }]) {
      const fetcher = vi.fn<typeof fetch>(async input => Response.json(String(input).endsWith('/pubkey') ? body : signed));
      expect(await interpretWhisper('A whisper.', options(fetcher))).toEqual({ ok: false, reason: 'bad-signature' });
    }
    const fetcher = vi.fn<typeof fetch>(async input => {
      if (String(input).endsWith('/pubkey')) throw new Error('offline');
      return Response.json(signed);
    });
    expect(await interpretWhisper('A whisper.', options(fetcher))).toEqual({ ok: false, reason: 'offline' });
  });
});

describe('whisper flow', () => {
  function makeFlow(fetcher: typeof fetch, getToken = vi.fn(async () => 'fresh-token')) {
    const transitions: string[] = [];
    const flow = createWhisperFlow({ ...options(fetcher), turnstile: { getToken },
      onStateChange: state => transitions.push(state.status) });
    return { flow, getToken, transitions };
  }

  it('moves through checking and asking to done only after signature verification', async () => {
    const signed = await signFixture();
    const { flow, transitions, getToken } = makeFlow(server(signed));
    expect(flow.state).toEqual({ status: 'idle' });
    expect(await flow.start('A whisper.')).toEqual({ ok: true, ...signed });
    expect(transitions).toEqual(['checking', 'asking', 'done']);
    expect(flow.state).toEqual({ status: 'done', result: { ok: true, ...signed } });
    expect(getToken).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['budget', "The town's gossip is resting. Try a ready-made rumor."],
    ['limit-global', "The town's gossip is resting. Try a ready-made rumor."],
    ['timeout', 'The village took too long. Try again.'],
    ...['ledger', 'model', 'offline', 'invalid', 'unknown'].map(reason => [reason, "Couldn't ask the village. Try again."]),
  ])('shows an honest failure line for %s', async (reason, line) => {
    vi.useFakeTimers();
    const fetcher = reason === 'timeout' ? vi.fn<typeof fetch>(() => new Promise(() => undefined))
      : reason === 'offline' ? vi.fn<typeof fetch>(async () => { throw new Error('offline'); })
        : server({ reason }, 503);
    const { flow } = makeFlow(fetcher);
    const pending = flow.start('A whisper.');
    if (reason === 'timeout') await vi.advanceTimersByTimeAsync(6_000);
    await pending;
    expect(flow.state).toMatchObject({ status: 'resting', line });
  });

  it('allows an eight-second first human check then a full request budget', async () => {
    const signed = await signFixture();
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>(async input => {
      if (String(input).endsWith('/pubkey')) return Response.json(jwk);
      await new Promise(resolve => setTimeout(resolve, 1_000));
      return Response.json(signed);
    });
    const { flow } = makeFlow(fetcher, vi.fn(() => new Promise(resolve => setTimeout(() => resolve('slow-token'), 8_000))));
    const pending = flow.start('A whisper.');
    await vi.advanceTimersByTimeAsync(7_999);
    expect(flow.state.status).toBe('checking');
    expect(fetcher).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(flow.state.status).toBe('asking');
    await vi.advanceTimersByTimeAsync(1_000);
    expect(await pending).toEqual({ ok: true, ...signed });
  });

  it('times out a seven-second interpretation six seconds after checking ends', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>(() => new Promise(resolve => setTimeout(() => resolve(Response.json(refusal('unclear'))), 7_000)));
    const { flow } = makeFlow(fetcher, vi.fn(() => new Promise(resolve => setTimeout(() => resolve('token'), 8_000))));
    const pending = flow.start('A whisper.');
    await vi.advanceTimersByTimeAsync(13_999);
    expect(flow.state.status).toBe('asking');
    expect(fetcher.mock.calls[0]?.[1]?.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toEqual({ ok: false, reason: 'timeout' });
    expect(fetcher.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    expect(flow.state).toMatchObject({ line: 'The village took too long. Try again.' });
  });

  it('bounds silent token stubs separately, aborts the waiter, and permits retry', async () => {
    vi.useFakeTimers();
    const getToken = vi.fn<(signal?: AbortSignal) => Promise<string>>(() => new Promise(() => undefined));
    const fetcher = server(refusal('unclear'));
    const flow = createWhisperFlow({ ...options(fetcher), turnstile: { getToken } });
    const first = flow.start('First.');
    await vi.advanceTimersByTimeAsync(11_999);
    expect(flow.state.status).toBe('checking');
    await vi.advanceTimersByTimeAsync(1);
    expect(await first).toEqual({ ok: false, reason: 'turnstile' });
    expect(getToken.mock.calls[0]?.[0]?.aborted).toBe(true);
    const second = flow.start('Second.');
    await vi.advanceTimersByTimeAsync(6_000);
    expect(await second).toEqual({ ok: false, reason: 'turnstile' });
    getToken.mockResolvedValueOnce('recovered');
    expect(await flow.start('Retry.')).toEqual({ ok: true, unsupported: 'unclear' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('warms one public key request and shares it with verification', async () => {
    const signed = await signFixture();
    let complete!: (response: Response) => void;
    const fetcher = vi.fn<typeof fetch>(async input => String(input).endsWith('/pubkey')
      ? new Promise(resolve => { complete = resolve; }) : Response.json(signed));
    const warm = vi.fn(async () => {});
    const flow = createWhisperFlow({ ...options(fetcher), turnstile: { getToken: async () => 'token', warm } });
    flow.warm(); flow.warm();
    expect(warm).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const pending = flow.start('A whisper.');
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    complete(Response.json(jwk));
    expect(await pending).toEqual({ ok: true, ...signed });
    await flow.start('Another whisper.');
    expect(fetcher.mock.calls.filter(([input]) => String(input).endsWith('/pubkey'))).toHaveLength(1);
  });

  it('uses the exact visitor limit line', async () => {
    const { flow } = makeFlow(server({ reason: 'limit-visitor' }, 503));
    await flow.start('A whisper.');
    expect(flow.state).toMatchObject({ status: 'resting',
      line: "You've whispered a lot this hour. Try a ready-made rumor, or come back later." });
  });

  it('handles a local Turnstile failure without calling the API', async () => {
    const fetcher = server({});
    const { flow, transitions } = makeFlow(fetcher, vi.fn(async () => { throw 'turnstile'; }));
    expect(await flow.start('A whisper.')).toEqual({ ok: false, reason: 'turnstile' });
    expect(flow.state).toMatchObject({ status: 'resting', line: "Couldn't check you're human. Try again." });
    expect(transitions).toEqual(['checking', 'resting']);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('uses the same Turnstile line for Worker verification failure', async () => {
    const { flow } = makeFlow(server({ reason: 'turnstile' }, 503));
    await flow.start('A whisper.');
    expect(flow.state).toMatchObject({ status: 'resting', line: "Couldn't check you're human. Try again." });
  });

  it.each([
    ['not-about-cast', 'The villagers only gossip about each other.'],
    ['real-person', 'The villagers only gossip about each other.'],
    ['protected-trait', 'Nobody here would repeat that.'],
    ['sexual', 'Nobody here would repeat that.'],
    ['hateful', 'Nobody here would repeat that.'],
    ['unclear', 'Say it plainer.'],
  ])('uses the exact unsupported line for %s', async (unsupported, line) => {
    const { flow } = makeFlow(server(refusal(unsupported)));
    await flow.start('A whisper.');
    expect(flow.state).toMatchObject({ status: 'resting', line, result: { ok: true, unsupported } });
  });

  it('never reaches done for a tampered claim', async () => {
    const signed = await signFixture();
    const { flow, transitions } = makeFlow(server({ ...signed, issuedAt: signed.issuedAt + 1 }));
    expect(await flow.start('A whisper.')).toEqual({ ok: false, reason: 'bad-signature' });
    expect(transitions).toEqual(['checking', 'asking', 'resting']);
  });

  it('coalesces simultaneous starts and obtains a new token on the next start', async () => {
    const fetcher = server({ reason: 'budget' }, 503);
    const { flow, getToken } = makeFlow(fetcher);
    const first = flow.start('First whisper.');
    expect(flow.start('Second whisper.')).toBe(first);
    await first;
    await flow.start('Next whisper.');
    expect(getToken).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

function fakeDocument() {
  const appended: HTMLScriptElement[] = [];
  const doc = {
    createElement: vi.fn(() => ({ src: '', async: false, defer: false, onload: null, onerror: null, remove: vi.fn() })),
    head: { appendChild: vi.fn((script: HTMLScriptElement) => { appended.push(script); return script; }) },
  } as unknown as Document;
  vi.stubGlobal('document', doc);
  vi.stubGlobal('turnstile', undefined);
  const container = {} as HTMLElement;
  return { doc, appended, container };
}
function fakeSdk() {
  type Callbacks = { callback: (token: string) => void; 'error-callback': () => void; 'expired-callback': () => void };
  let callbacks: Callbacks;
  const api = {
    render: vi.fn((_container: HTMLElement, opts: Callbacks) => { callbacks = opts; return 'widget-1'; }),
    execute: vi.fn(), reset: vi.fn(), remove: vi.fn(),
  };
  vi.stubGlobal('turnstile', api);
  return { api, token: (value: string) => callbacks.callback(value), error: () => callbacks['error-callback'](),
    expire: () => callbacks['expired-callback']() };
}

async function flushSdk(): Promise<void> { await Promise.resolve(); await Promise.resolve(); }

describe('Turnstile loader', () => {
  it('loads only on warm, shares script loading, and retries after a failed load', async () => {
    vi.useFakeTimers();
    const { container, appended } = fakeDocument();
    const first = loadTurnstile('site-key', container);
    const second = loadTurnstile('site-key', container);
    expect(appended).toHaveLength(0);
    const one = expect(first.warm()).rejects.toBe('turnstile');
    const two = expect(second.warm()).rejects.toBe('turnstile');
    expect(appended).toHaveLength(1);
    expect(appended[0]?.src).toBe('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit');
    await vi.advanceTimersByTimeAsync(12_000);
    await Promise.all([one, two]);
    expect(vi.getTimerCount()).toBe(0);
    const retry = expect(first.getToken()).rejects.toBe('turnstile');
    expect(appended).toHaveLength(2);
    appended[1]?.onerror?.(new Event('error'));
    await retry;
    first.destroy(); second.destroy();
    // The shared script load also settles on error, leaving no orphan timer.
    expect(vi.getTimerCount()).toBe(0);
  });

  it('allows an eight-second initial script load within the first acquisition budget', async () => {
    vi.useFakeTimers();
    const { container, appended } = fakeDocument();
    const client = loadTurnstile('site-key', container);
    const pending = client.getToken();
    await vi.advanceTimersByTimeAsync(8_000);
    const sdk = fakeSdk();
    appended[0]?.onload?.(new Event('load'));
    await flushSdk(); sdk.token('first-token');
    expect(await pending).toBe('first-token');
    client.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects script errors and missing SDKs', async () => {
    const { container, appended } = fakeDocument();
    const client = loadTurnstile('site-key', container);
    const failed = expect(client.getToken()).rejects.toBe('turnstile');
    appended[0]?.onerror?.(new Event('error'));
    await failed;
    const next = fakeDocument();
    const missing = loadTurnstile('site-key', next.container);
    const noSdk = expect(missing.getToken()).rejects.toBe('turnstile');
    next.appended[0]?.onload?.(new Event('load'));
    await noSdk;
    client.destroy(); missing.destroy();
  });

  it('warms one token, then resets and executes the same widget for distinct consecutive tokens', async () => {
    const { container } = fakeDocument();
    const sdk = fakeSdk();
    const client = loadTurnstile('site-key');
    client.render(container);
    const warmed = client.warm();
    await flushSdk();
    expect(sdk.api.render).toHaveBeenCalledWith(container, expect.objectContaining({
      sitekey: 'site-key', execution: 'execute', appearance: 'execute', retry: 'never',
    }));
    sdk.token('token-one'); await warmed;
    await client.warm();
    expect(sdk.api.execute).toHaveBeenCalledTimes(1);
    expect(await client.getToken()).toBe('token-one');
    const second = client.getToken();
    await flushSdk();
    expect(sdk.api.reset).toHaveBeenCalledWith('widget-1');
    expect(sdk.api.execute).toHaveBeenCalledTimes(2);
    sdk.token('token-two');
    expect(await second).toBe('token-two');
    await flushSdk();
    expect(sdk.api.render).toHaveBeenCalledTimes(1);
    expect(sdk.api.reset).toHaveBeenCalledTimes(2);
    expect(sdk.api.execute).toHaveBeenCalledTimes(3);
    client.destroy();
    expect(sdk.api.remove).toHaveBeenCalledWith('widget-1');
    await expect(client.getToken()).rejects.toBe('turnstile');
  });

  it('waits behind an acquisition and gives concurrent callers distinct tokens', async () => {
    const { container } = fakeDocument(); const sdk = fakeSdk();
    const client = loadTurnstile('site-key', container);
    const first = client.getToken(); const second = client.getToken();
    await flushSdk(); sdk.token('one');
    expect(await first).toBe('one');
    await flushSdk(); sdk.token('two');
    expect(await second).toBe('two');
    client.destroy();
  });

  it('re-arms after SDK failure without leaving a busy waiter', async () => {
    const { container } = fakeDocument(); const sdk = fakeSdk();
    const client = loadTurnstile('site-key', container);
    const failed = expect(client.getToken()).rejects.toBe('turnstile');
    await flushSdk(); sdk.error(); await failed;
    const next = client.getToken();
    await flushSdk();
    expect(sdk.api.reset).toHaveBeenCalledTimes(1);
    sdk.token('recovered'); expect(await next).toBe('recovered');
    client.destroy();
  });

  it('refreshes unused tokens at 240 seconds and on SDK expiry', async () => {
    vi.useFakeTimers();
    const { container } = fakeDocument(); const sdk = fakeSdk();
    const client = loadTurnstile('site-key', container);
    const warmed = client.warm(); await flushSdk(); sdk.token('old'); await warmed;
    await vi.advanceTimersByTimeAsync(240_000);
    expect(sdk.api.reset).toHaveBeenCalledTimes(1);
    const waiting = client.getToken();
    sdk.token('fresh'); expect(await waiting).toBe('fresh');
    await flushSdk(); sdk.token('ready');
    sdk.expire(); await flushSdk();
    expect(sdk.api.reset).toHaveBeenCalledTimes(3);
    const afterExpiry = client.getToken();
    sdk.token('after-expiry'); expect(await afterExpiry).toBe('after-expiry');
    client.destroy(); expect(vi.getTimerCount()).toBe(0);
  });

  it('bounds silent SDK acquisitions to 12 seconds first, then six, and cancels on destroy', async () => {
    vi.useFakeTimers();
    const { container } = fakeDocument(); const sdk = fakeSdk();
    const client = loadTurnstile('site-key', container);
    const failed = expect(client.getToken()).rejects.toBe('turnstile');
    await vi.advanceTimersByTimeAsync(11_999);
    expect(sdk.api.remove).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1); await failed;
    const retry = expect(client.getToken()).rejects.toBe('turnstile');
    await vi.advanceTimersByTimeAsync(6_000); await retry;
    const pending = expect(client.getToken()).rejects.toBe('turnstile');
    await flushSdk(); client.destroy(); await pending;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not consume a late token after a flow waiter is aborted', async () => {
    const { container } = fakeDocument(); const sdk = fakeSdk();
    const client = loadTurnstile('site-key', container);
    const controller = new AbortController();
    const stopped = expect(client.getToken(controller.signal)).rejects.toBe('turnstile');
    await flushSdk(); controller.abort(); await stopped;
    sdk.token('still-unused');
    expect(await client.getToken()).toBe('still-unused');
    client.destroy();
  });

  it('sends two successive whispers through fetch using the actual token client', async () => {
    const { container } = fakeDocument(); const sdk = fakeSdk();
    const turnstile = loadTurnstile('site-key', container);
    const fetcher = server(refusal('unclear'));
    const flow = createWhisperFlow({ ...options(fetcher), turnstile });
    const first = flow.start('First.');
    await flushSdk(); sdk.token('first-token'); await first;
    const second = flow.start('Second.');
    await flushSdk(); sdk.token('second-token'); await second;
    expect(fetcher.mock.calls.map(([, init]) => JSON.parse(String(init?.body)).turnstileToken))
      .toEqual(['first-token', 'second-token']);
    turnstile.destroy();
  });

  it('fails safely without a document or a container', async () => {
    vi.stubGlobal('document', undefined);
    await expect(loadTurnstile('site-key', {} as HTMLElement).getToken()).rejects.toBe('turnstile');
    fakeDocument(); fakeSdk();
    await expect(loadTurnstile('site-key').getToken()).rejects.toBe('turnstile');
  });
});
