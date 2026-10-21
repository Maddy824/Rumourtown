const scriptUrl = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

interface WidgetOptions {
  sitekey: string;
  execution: 'execute';
  appearance: 'execute';
  retry: 'never';
  'refresh-expired': 'never';
  'refresh-timeout': 'never';
  callback: (token: string) => void;
  'error-callback': () => void;
  'expired-callback': () => void;
  'timeout-callback': () => void;
}
interface TurnstileApi {
  render(container: HTMLElement, options: WidgetOptions): string;
  execute(widgetId: string): void;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}
export interface TurnstileClient {
  render(container: HTMLElement): void;
  /** Load the SDK and keep one unused token ready for at most four minutes. */
  warm(): Promise<void>;
  /** Wait for an acquisition in progress; each caller receives its own token. */
  getToken(signal?: AbortSignal): Promise<string>;
  destroy(): void;
}

const scripts = new WeakMap<Document, Promise<TurnstileApi>>();
function getApi(): TurnstileApi | undefined {
  return (globalThis as typeof globalThis & { turnstile?: TurnstileApi }).turnstile;
}

function loadScript(doc: Document): Promise<TurnstileApi> {
  const previous = scripts.get(doc);
  if (previous) return previous;
  const ready = new Promise<TurnstileApi>((resolve, reject) => {
    const existing = getApi();
    if (existing) { resolve(existing); return; }
    let script: HTMLScriptElement | undefined;
    let settled = false;
    const finish = (api?: TurnstileApi) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (script) { script.onload = null; script.onerror = null; }
      if (api) resolve(api);
      else { script?.remove(); reject('turnstile'); }
    };
    const timer = setTimeout(() => finish(), 12_000);
    try {
      script = doc.createElement('script');
      script.src = scriptUrl;
      script.async = true;
      script.defer = true;
      script.onload = () => finish(getApi());
      script.onerror = () => finish();
      doc.head.appendChild(script);
    } catch { finish(); }
  });
  scripts.set(doc, ready);
  // A failed load must be retryable, including on the same client.
  void ready.catch(() => { if (scripts.get(doc) === ready) scripts.delete(doc); });
  return ready;
}

/** No script or challenge is requested until warm() or getToken(). */
export function loadTurnstile(siteKey: string, initialContainer?: HTMLElement): TurnstileClient {
  let container = initialContainer;
  let api: TurnstileApi | undefined;
  let widgetId: string | undefined;
  let destroyed = false;
  let attempted = false;
  let cached: { token: string; at: number } | undefined;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  let acquisition: { promise: Promise<void>; finish: (token?: string) => void } | undefined;

  function discard(): void {
    cached = undefined;
    clearTimeout(expiry);
  }
  function removeWidget(): void {
    if (api && widgetId !== undefined) {
      try { api.remove(widgetId); } catch { /* Already removed by the SDK. */ }
      widgetId = undefined;
    }
  }
  function refresh(): void {
    discard();
    void warm().catch(() => undefined);
  }
  function warm(): Promise<void> {
    if (destroyed || !siteKey.trim() || !container || typeof document === 'undefined') return Promise.reject('turnstile');
    if (cached && performance.now() - cached.at < 240_000) return Promise.resolve();
    if (acquisition) return acquisition.promise;
    discard();
    let resolve!: () => void;
    let reject!: (reason: string) => void;
    const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
    const timer = setTimeout(() => {
      // Ignore late callbacks from a timed-out widget, including after retry.
      removeWidget();
      pending.finish();
    }, attempted ? 6_000 : 12_000);
    attempted = true;
    const pending = { promise, finish: (token?: string) => {
      if (acquisition !== pending) return;
      clearTimeout(timer);
      acquisition = undefined;
      if (token?.trim()) {
        cached = { token, at: performance.now() };
        expiry = setTimeout(refresh, 240_000);
        resolve();
      } else reject('turnstile');
    } };
    acquisition = pending;
    void loadScript(document).then(loaded => {
      if (acquisition !== pending || destroyed) return;
      api = loaded;
      if (widgetId === undefined) {
        // Bind callbacks to this widget so removal invalidates late SDK events.
        let id: string | undefined;
        id = api.render(container!, {
          sitekey: siteKey, execution: 'execute', appearance: 'execute', retry: 'never',
          'refresh-expired': 'never', 'refresh-timeout': 'never',
          callback: token => { if (widgetId === id) acquisition?.finish(token); },
          'error-callback': () => { if (widgetId === id) { discard(); acquisition?.finish(); } },
          'expired-callback': () => { if (widgetId === id) refresh(); },
          'timeout-callback': () => { if (widgetId === id) { discard(); acquisition?.finish(); } },
        });
        widgetId = id;
      } else api.reset(widgetId);
      api.execute(widgetId);
    }).catch(() => pending.finish());
    return promise;
  }

  return {
    render(nextContainer) {
      if (container !== nextContainer) { discard(); acquisition?.finish(); removeWidget(); }
      container = nextContainer;
    },
    warm,
    async getToken(signal) {
      if (signal?.aborted) throw 'turnstile';
      let abort!: () => void;
      const cancelled = new Promise<never>((_, reject) => { abort = () => reject('turnstile'); });
      signal?.addEventListener('abort', abort, { once: true });
      try {
        // Concurrent consumers wait for successive acquisitions, never share one token.
        while (!cached || performance.now() - cached.at >= 240_000) {
          await Promise.race([warm(), cancelled]);
          if (destroyed || signal?.aborted) throw 'turnstile';
        }
        const token = cached.token;
        discard();
        void warm().catch(() => undefined);
        return token;
      } finally { signal?.removeEventListener('abort', abort); }
    },
    destroy() {
      destroyed = true;
      discard();
      acquisition?.finish();
      removeWidget();
    },
  };
}
