import type { Env, Fetcher } from './types';

export interface UsageDigest {
  day: string;
  count: number;
  spent: number;
  dailyRemaining: number;
  lifetimeRemaining: number;
  refusals: { reason: string; count: number }[];
}

/** Only aggregate counters leave the ledger; never prose, identities or credentials. */
export async function notifyUsage(env: Env, fetcher: Fetcher, digest: UsageDigest): Promise<void> {
  if (!env.USAGE_ALERT_URL) return;
  const url = new URL(env.USAGE_ALERT_URL);
  if (url.origin !== 'https://ntfy.sh' || !/^\/[A-Za-z0-9_-]{32,128}$/.test(url.pathname) || url.search || url.hash || url.username || url.password) throw new Error('alerts');
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new Error('alerts')); }, 4000);
  });
  try {
    await Promise.race([(async () => {
      const response = await fetcher(url.href, {
        method: 'POST', redirect: 'error', signal: controller.signal,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', Title: 'Rumourtown daily AI usage', Tags: 'robot', Priority: 'default' },
        body: `${digest.day}: ${digest.count} uncached model requests. Spend $${digest.spent.toFixed(6)}. Remaining daily $${digest.dailyRemaining.toFixed(6)}; lifetime $${digest.lifetimeRemaining.toFixed(6)}. Top refusals: ${digest.refusals.map(r => `${r.reason} (${r.count})`).join(', ') || 'none'}.`,
      });
      if (!response.ok) throw new Error('alerts');
      const receipt: unknown = await response.json();
      if (!receipt || typeof receipt !== 'object' || !('id' in receipt) || typeof receipt.id !== 'string' ||
          !('event' in receipt) || receipt.event !== 'message') throw new Error('alerts');
    })(), timeout]);
  } finally { if (timer !== undefined) clearTimeout(timer); }
}
