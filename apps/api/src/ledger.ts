import { record, type Env } from './types';

// Integer picodollars: all supported token prices are exactly representable here.
const SCALE = 1_000_000_000_000;
function units(usd: number): number {
  const value = Math.ceil(usd * SCALE);
  if (!Number.isFinite(usd) || usd < 0 || !Number.isSafeInteger(value)) throw new Error('amount');
  return value;
}
function limit(value: string | undefined, fallback: number): number {
  const n = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(n) || n < 0) throw new Error('config');
  return n;
}
function text(value: unknown): string {
  if (typeof value !== 'string' || !value) throw new Error('input');
  return value;
}

export class BudgetLedger {
  private readonly sql: SqlStorage;
  private prunedHour = -1;
  constructor(private readonly ctx: DurableObjectState, private readonly env: Env) {
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS days (day TEXT PRIMARY KEY, reserved INTEGER NOT NULL, spent INTEGER NOT NULL)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS visitors (visitor TEXT NOT NULL, hour INTEGER NOT NULL, count INTEGER NOT NULL, PRIMARY KEY(visitor, hour))`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS minutes (minute INTEGER PRIMARY KEY, count INTEGER NOT NULL)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS reservations (id TEXT PRIMARY KEY, day TEXT NOT NULL, amount INTEGER NOT NULL, status TEXT NOT NULL)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS cache (hash TEXT PRIMARY KEY, payload TEXT NOT NULL)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS billing_faults (reason TEXT PRIMARY KEY)`);
    this.sql.exec('CREATE INDEX IF NOT EXISTS visitors_hour ON visitors(hour)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS completed_reservations_day ON reservations(day) WHERE status != \'reserved\'');
  }

  private prune(now: number): void {
    const hour = Math.floor(now / 3_600_000);
    if (hour <= this.prunedHour) return;
    const cutoff = new Date(now - 30 * 86_400_000).toISOString().slice(0, 10);
    this.ctx.storage.transactionSync(() => {
      // Keep the preceding buckets for in-flight requests across a boundary.
      this.sql.exec('DELETE FROM visitors WHERE hour < ?', hour - 1);
      this.sql.exec('DELETE FROM minutes WHERE minute < ?', Math.floor(now / 60_000) - 1);
      this.sql.exec("DELETE FROM reservations WHERE day < ? AND status != 'reserved'", cutoff);
    });
    this.prunedHour = hour;
    // Never prune days, unresolved holds or billing faults: they enforce the
    // lifetime cap. Expired settlement IDs fail closed instead of refunding.
  }

  private reserve(body: Record<string, unknown>): unknown {
    const visitor = text(body.visitorKey);
    if (!/^[a-f0-9]{64}$/u.test(visitor) || typeof body.now !== 'number' || !Number.isSafeInteger(body.now) || body.now < 0 ||
        typeof body.worstCaseUsd !== 'number') throw new Error('input');
    const date = new Date(body.now);
    const day = date.toISOString().slice(0, 10);
    const hour = Math.floor(body.now / 3_600_000);
    const minute = Math.floor(body.now / 60_000);
    const amount = units(body.worstCaseUsd);
    const visitorLimit = limit(this.env.PER_VISITOR_PER_HOUR, 5);
    const globalLimit = limit(this.env.GLOBAL_PER_MINUTE, 20);
    const allowance = units(this.env.DAILY_ALLOWANCE_USD === undefined ? 0.019 : Number(this.env.DAILY_ALLOWANCE_USD));
    const lifetime = units(this.env.LIFETIME_ALLOWANCE_USD === undefined ? 7 : Number(this.env.LIFETIME_ALLOWANCE_USD));
    if (lifetime > units(7)) throw new Error('config');
    this.prune(body.now);
    return this.ctx.storage.transactionSync(() => {
      if (this.sql.exec('SELECT reason FROM billing_faults LIMIT 1').toArray().length) return { ok: false, reason: 'budget' };
      const visits = this.sql.exec<{ count: number }>('SELECT count FROM visitors WHERE visitor = ? AND hour = ?', visitor, hour).toArray()[0]?.count ?? 0;
      if (visits >= visitorLimit) return { ok: false, reason: 'limit-visitor' };
      const calls = this.sql.exec<{ count: number }>('SELECT count FROM minutes WHERE minute = ?', minute).toArray()[0]?.count ?? 0;
      if (calls >= globalLimit) return { ok: false, reason: 'limit-global' };
      const daily = this.sql.exec<{ reserved: number; spent: number }>('SELECT reserved, spent FROM days WHERE day = ?', day).toArray()[0];
      if ((daily?.reserved ?? 0) + (daily?.spent ?? 0) + amount > allowance) return { ok: false, reason: 'budget' };
      // Includes all historical days and outstanding holds, including pre-upgrade rows.
      const total = this.sql.exec<{ total: number }>('SELECT COALESCE(SUM(reserved + spent), 0) AS total FROM days').toArray()[0]!.total;
      if (total + amount > lifetime) return { ok: false, reason: 'budget' };
      const id = crypto.randomUUID();
      this.sql.exec('INSERT INTO days (day, reserved, spent) VALUES (?, ?, 0) ON CONFLICT(day) DO UPDATE SET reserved = reserved + excluded.reserved', day, amount);
      this.sql.exec('INSERT INTO visitors (visitor, hour, count) VALUES (?, ?, 1) ON CONFLICT(visitor, hour) DO UPDATE SET count = count + 1', visitor, hour);
      this.sql.exec('INSERT INTO minutes (minute, count) VALUES (?, 1) ON CONFLICT(minute) DO UPDATE SET count = count + 1', minute);
      this.sql.exec('INSERT INTO reservations (id, day, amount, status) VALUES (?, ?, ?, ?)', id, day, amount, 'reserved');
      return { ok: true, reservationId: id };
    });
  }

  private finish(body: Record<string, unknown>, release: boolean): unknown {
    const id = text(body.reservationId);
    return this.ctx.storage.transactionSync(() => {
      const row = this.sql.exec<{ day: string; amount: number; status: string }>('SELECT day, amount, status FROM reservations WHERE id = ?', id).toArray()[0];
      if (!row) throw new Error('reservation');
      // Retry-safe: settlement/release can never refund or charge twice.
      if (row.status !== 'reserved') return { ok: true };
      if (!release && typeof body.actualUsd !== 'number') throw new Error('amount');
      const actual = release ? 0 : units(body.actualUsd as number);
      if (actual > row.amount) {
        // Freeze future dispatches if the provider ever exceeds our conservative quote.
        // Retain the hold for reconciliation instead of silently refunding it.
        this.sql.exec("INSERT OR IGNORE INTO billing_faults (reason) VALUES ('reservation-exceeded')");
        return { reason: 'ledger' };
      }
      this.sql.exec('UPDATE days SET reserved = reserved - ?, spent = spent + ? WHERE day = ?', row.amount, actual, row.day);
      this.sql.exec('UPDATE reservations SET status = ? WHERE id = ?', release ? 'released' : 'settled', id);
      return { ok: true };
    });
  }

  async fetch(request: Request): Promise<Response> {
    try {
      if (request.method !== 'POST') throw new Error('method');
      const body: unknown = await request.json();
      if (!record(body)) throw new Error('input');
      let result: unknown;
      switch (new URL(request.url).pathname) {
        case '/reserve': result = this.reserve(body); break;
        case '/settle': result = this.finish(body, false); break;
        case '/release': result = this.finish(body, true); break;
        case '/cacheGet': {
          const hash = text(body.hash);
          if (!/^[a-f0-9]{64}$/u.test(hash)) throw new Error('hash');
          const row = this.sql.exec<{ payload: string }>('SELECT payload FROM cache WHERE hash = ?', hash).toArray()[0];
          result = { payload: row ? JSON.parse(row.payload) as unknown : null };
          break;
        }
        case '/cachePut': {
          const hash = text(body.hash);
          if (!/^[a-f0-9]{64}$/u.test(hash) || !record(body.payload)) throw new Error('cache');
          this.ctx.storage.transactionSync(() => {
            this.sql.exec('INSERT INTO cache (hash, payload) VALUES (?, ?) ON CONFLICT(hash) DO UPDATE SET payload = excluded.payload', hash, JSON.stringify(body.payload));
            // Bounded FIFO cache; eviction can cause another budgeted model call,
            // so this data never participates in spending correctness.
            this.sql.exec('DELETE FROM cache WHERE rowid <= (SELECT rowid FROM cache ORDER BY rowid DESC LIMIT 1 OFFSET 2048)');
          });
          result = { ok: true };
          break;
        }
        default: throw new Error('route');
      }
      return Response.json(result);
    } catch { return Response.json({ reason: 'ledger' }, { status: 503 }); }
  }
}
