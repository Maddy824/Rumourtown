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
  remove(widgetId: string): void;
}
export interface TurnstileClient {
  /** Supply the UI-owned container before requesting a token. */
  render(container: HTMLElement): void;
  /** Concurrent token requests reject; tokens are never shared or reused. */
  getToken(): Promise<string>;
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
      else reject('turnstile');
    };
    const timer = setTimeout(() => finish(), 5_000);
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
  return ready;
}

/**
 * The site key must be configured as an invisible widget in Cloudflare.
 * Each getToken renders and executes a new widget in the supplied container.
 * No script or challenge is requested merely by importing this module.
 */
export function loadTurnstile(siteKey: string, initialContainer?: HTMLElement): TurnstileClient {
  const ready = typeof document === 'undefined' ? Promise.reject('turnstile') : loadScript(document);
  // Loading starts here; a caller may not request its first token until later.
  void ready.catch(() => undefined);
  let container = initialContainer;
  let api: TurnstileApi | undefined;
  let widgetId: string | undefined;
  let destroyed = false;
  let cancel: (() => void) | undefined;

  function removeWidget(): void {
    if (api && widgetId !== undefined) {
      try { api.remove(widgetId); } catch { /* Already removed by the SDK. */ }
      widgetId = undefined;
    }
  }

  return {
    render(nextContainer) { container = nextContainer; },
    getToken() {
      if (destroyed || cancel || !siteKey.trim() || !container) return Promise.reject('turnstile');
      return new Promise<string>((resolve, reject) => {
        let settled = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const finish = (token?: string) => {
          if (settled) return;
          settled = true;
          if (timer !== undefined) clearTimeout(timer);
          cancel = undefined;
          if (token) resolve(token);
          else { removeWidget(); reject('turnstile'); }
        };
        cancel = () => finish();
        void ready.then(loaded => {
          if (settled) return;
          api = loaded;
          removeWidget();
          // Also bound a silent SDK; its normal error/expiry callbacks reject sooner.
          timer = setTimeout(() => finish(), 6_000);
          widgetId = api.render(container!, {
            sitekey: siteKey, execution: 'execute', appearance: 'execute', retry: 'never',
            'refresh-expired': 'never', 'refresh-timeout': 'never',
            callback: token => finish(token),
            'error-callback': () => finish(),
            'expired-callback': () => finish(),
            'timeout-callback': () => finish(),
          });
          if (!settled) api.execute(widgetId);
        }).catch(() => finish());
      });
    },
    destroy() {
      destroyed = true;
      cancel?.();
      removeWidget();
    },
  };
}
