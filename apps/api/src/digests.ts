import { notifyUsage } from './alerts';
import type { Env, Fetcher } from './types';

const DAY = 86_400_000;
const SCALE = 1_000_000_000_000;
const reasons = ['not-about-cast', 'real-person', 'protected-trait', 'sexual', 'hateful', 'unclear',
  'turnstile', 'limit-visitor', 'limit-global', 'budget', 'model', 'invalid', 'ledger'] as const;
type Job = { day: string; phase: string; attempts: number };

/** Separate from billing faults: a failed digest must never freeze inference. */
export class DailyDigests {
  constructor(private readonly ctx: DurableObjectState, private readonly env: Env, private readonly fetcher: Fetcher) {
    const sql = ctx.storage.sql;
    sql.exec('CREATE TABLE IF NOT EXISTS provider_counts (day TEXT NOT NULL, provider TEXT NOT NULL, requests INTEGER NOT NULL, failures INTEGER NOT NULL, PRIMARY KEY(day, provider))');
    sql.exec('CREATE TABLE IF NOT EXISTS usage_days (day TEXT PRIMARY KEY, count INTEGER NOT NULL)');
    sql.exec('CREATE TABLE IF NOT EXISTS refusal_counts (day TEXT NOT NULL, reason TEXT NOT NULL, count INTEGER NOT NULL, PRIMARY KEY(day, reason))');
    sql.exec('CREATE TABLE IF NOT EXISTS digest_jobs (day TEXT NOT NULL, phase TEXT NOT NULL, due INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT \'pending\', PRIMARY KEY(day, phase))');
    sql.exec('CREATE TABLE IF NOT EXISTS alert_faults (day TEXT NOT NULL, phase TEXT NOT NULL, attempt INTEGER NOT NULL, PRIMARY KEY(day, phase, attempt))');
  }

  async record(body: Record<string, unknown>): Promise<void> {
    if (typeof body.now !== 'number' || !Number.isSafeInteger(body.now) || body.now < 0) throw new Error('time');
    const now = body.now;
    const day = new Date(now).toISOString().slice(0, 10);
    const sql = this.ctx.storage.sql;
    this.ctx.storage.transactionSync(() => {
      for (const [provider, dispatched, failed] of [
        ['workers-ai', body.workersAi, body.workersAiFailed], ['openrouter', body.openRouter, false],
      ] as const) {
        if (dispatched === true) sql.exec('INSERT INTO provider_counts (day, provider, requests, failures) VALUES (?, ?, 1, ?) ON CONFLICT(day, provider) DO UPDATE SET requests = requests + 1, failures = failures + excluded.failures', day, provider, failed === true ? 1 : 0);
      }
      if (body.dispatched === true) {
        sql.exec('INSERT INTO usage_days (day, count) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET count = count + 1', day);
        if (this.env.USAGE_ALERT_URL) {
          sql.exec("INSERT OR IGNORE INTO digest_jobs (day, phase, due) VALUES (?, 'first', ?)", day, now);
          sql.exec("INSERT OR IGNORE INTO digest_jobs (day, phase, due) VALUES (?, 'end', ?)", day, (Math.floor(now / DAY) + 1) * DAY);
        }
      }
      if (typeof body.reason === 'string' && (reasons as readonly string[]).includes(body.reason)) {
        sql.exec('INSERT INTO refusal_counts (day, reason, count) VALUES (?, ?, 1) ON CONFLICT(day, reason) DO UPDATE SET count = count + 1', day, body.reason);
      }
    });
    if (!this.env.USAGE_ALERT_URL) return;
    await this.arm();
    // Delivery, including its deadline and receipt, is outside the request path.
    this.ctx.waitUntil(this.flush(now));
  }

  private async arm(): Promise<void> {
    const row = this.ctx.storage.sql.exec<{ due: number }>("SELECT MIN(due) AS due FROM digest_jobs WHERE status IN ('pending', 'sending')").toArray()[0];
    if (row?.due != null) await this.ctx.storage.setAlarm(row.due);
  }

  async flush(now: number): Promise<void> {
    if (!this.env.USAGE_ALERT_URL) return;
    const sql = this.ctx.storage.sql;
    const jobs = sql.exec<Job>("SELECT day, phase, attempts FROM digest_jobs WHERE status IN ('pending', 'sending') AND due <= ? ORDER BY day, phase", now).toArray();
    for (const job of jobs) {
      const daily = sql.exec<{ reserved: number; spent: number }>('SELECT reserved, spent FROM days WHERE day = ?', job.day).toArray()[0];
      const workers = sql.exec<{ requests: number; failures: number }>("SELECT requests, failures FROM provider_counts WHERE day = ? AND provider = 'workers-ai'", job.day).toArray()[0];
      if (job.phase === 'end' && !daily?.spent && !workers?.requests) {
        sql.exec("UPDATE digest_jobs SET status = 'done' WHERE day = ? AND phase = ?", job.day, job.phase);
        continue;
      }
      // Claim before awaiting. Persist the single next-day retry even if the object
      // restarts during network I/O. Overlapping request/alarm flushes skip it.
      const claimed = this.ctx.storage.transactionSync(() => {
        const row = sql.exec<{ attempts: number; due: number; status: string }>('SELECT attempts, due, status FROM digest_jobs WHERE day = ? AND phase = ?', job.day, job.phase).toArray()[0]!;
        if (row.due > now || !['pending', 'sending'].includes(row.status)) return false;
        if (row.attempts >= 2) {
          sql.exec("UPDATE digest_jobs SET status = 'failed' WHERE day = ? AND phase = ?", job.day, job.phase);
          return false;
        }
        sql.exec("UPDATE digest_jobs SET attempts = attempts + 1, status = 'sending', due = ? WHERE day = ? AND phase = ?", (Math.floor(now / DAY) + 1) * DAY, job.day, job.phase);
        return true;
      });
      if (!claimed) continue;
      await this.arm();
      const total = sql.exec<{ total: number }>('SELECT COALESCE(SUM(reserved + spent), 0) AS total FROM days').toArray()[0]!.total;
      const count = sql.exec<{ count: number }>('SELECT count FROM usage_days WHERE day = ?', job.day).toArray()[0]?.count ?? 0;
      try {
        await notifyUsage(this.env, this.fetcher, {
          workersAiRequests: workers?.requests ?? 0, workersAiFailures: workers?.failures ?? 0,
          openRouterRequests: sql.exec<{ requests: number }>("SELECT requests FROM provider_counts WHERE day = ? AND provider = 'openrouter'", job.day).toArray()[0]?.requests ?? 0,
          day: job.day, count, spent: (daily?.spent ?? 0) / SCALE,
          dailyRemaining: Math.max(0, Number(this.env.DAILY_ALLOWANCE_USD ?? '.019') - ((daily?.spent ?? 0) + (daily?.reserved ?? 0)) / SCALE),
          lifetimeRemaining: Math.max(0, Number(this.env.LIFETIME_ALLOWANCE_USD ?? '7') - total / SCALE),
          refusals: sql.exec<{ reason: string; count: number }>('SELECT reason, count FROM refusal_counts WHERE day = ? ORDER BY count DESC, reason LIMIT 5', job.day).toArray(),
        });
        sql.exec("UPDATE digest_jobs SET status = 'done' WHERE day = ? AND phase = ?", job.day, job.phase);
      } catch {
        sql.exec('INSERT OR IGNORE INTO alert_faults (day, phase, attempt) VALUES (?, ?, ?)', job.day, job.phase, job.attempts + 1);
        sql.exec('UPDATE digest_jobs SET status = ? WHERE day = ? AND phase = ?', job.attempts === 0 ? 'pending' : 'failed', job.day, job.phase);
      }
    }
    await this.arm();
  }
}
