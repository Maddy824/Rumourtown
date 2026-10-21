import type { Env, Fetcher } from './types';

/** No player text, visitor identity or credentials are included in the notification. */
export async function notifyUsage(env: Env, fetcher: Fetcher, requestId: string, reservedUsd: number): Promise<void> {
  const url = new URL(env.USAGE_ALERT_URL ?? '');
  if (url.origin !== 'https://ntfy.sh' || !/^\/[A-Za-z0-9_-]{32,128}$/.test(url.pathname) || url.search || url.hash || url.username || url.password) {
    throw new Error('alerts');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetcher(url.href, {
      method: 'POST', redirect: 'error', signal: controller.signal,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', Title: 'RumorTown AI usage', Tags: 'robot', Priority: 'default' },
      body: `An AI request is starting. Reserved up to $${reservedUsd.toFixed(6)}; this is a ceiling, not the final charge. Request ${requestId}. The local town and agent remain free.`,
    });
    if (!response.ok) throw new Error('alerts');
    const receipt: unknown = await response.json();
    if (!receipt || typeof receipt !== 'object' || !('id' in receipt) || typeof receipt.id !== 'string' ||
        !('event' in receipt) || receipt.event !== 'message') throw new Error('alerts');
  } finally { clearTimeout(timer); }
}
