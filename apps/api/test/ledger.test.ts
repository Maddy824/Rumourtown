import { afterEach, describe, expect, it } from 'vitest';
import { memoryLedger, now, visitor } from './helpers';

const stores: ReturnType<typeof memoryLedger>[] = [];
function store(config: Parameters<typeof memoryLedger>[0] = {}) {
  const s = memoryLedger({ DAILY_ALLOWANCE_USD: '0.10', ...config }); stores.push(s); return s;
}
afterEach(() => { for (const s of stores.splice(0)) s.db.close(); });
const reserve = (s: ReturnType<typeof store>, usd = 0.04, time = now, who = visitor) => s.rpc('reserve', { visitorKey: who, worstCaseUsd: usd, now: time });

describe('BudgetLedger', () => {
  it('funds a free hold atomically once without counting another request', async () => {
    const s = store({ PER_VISITOR_PER_HOUR: '1', GLOBAL_PER_MINUTE: '1' });
    const a = await reserve(s, 0);
    const body = { reservationId: a.reservationId, worstCaseUsd: .04 };
    expect(await s.rpc('fund', body)).toEqual({ ok: true });
    expect(await s.rpc('fund', body)).toEqual({ ok: true });
    expect(s.db.prepare('SELECT reserved, spent FROM days').all()).toEqual([{ reserved: 40_000_000_000, spent: 0 }]);
    expect(s.db.prepare('SELECT count FROM visitors').all()).toEqual([{ count: 1 }]);
    expect(s.db.prepare('SELECT count FROM minutes').all()).toEqual([{ count: 1 }]);
    await s.rpc('settle', { reservationId: a.reservationId, actualUsd: .01 });
    expect(await s.rpc('fund', body)).toEqual({ reason: 'ledger' });
  });
  it('cannot oversubscribe allowances by concurrently funding free holds', async () => {
    const s = store({ LIFETIME_ALLOWANCE_USD: '.03', PER_VISITOR_PER_HOUR: '100', GLOBAL_PER_MINUTE: '100' });
    const holds = await Promise.all(Array.from({ length: 20 }, () => reserve(s, 0)));
    const funded = await Promise.all(holds.map(h => s.rpc('fund', { reservationId: h.reservationId, worstCaseUsd: .01 })));
    expect(funded.filter(r => r.ok)).toHaveLength(3);
    expect(funded.filter(r => r.reason === 'budget')).toHaveLength(17);
    expect(s.db.prepare('SELECT SUM(reserved + spent) AS total FROM days').all()).toEqual([{ total: 30_000_000_000 }]);
  });
  it('funds against the original day and refuses billing faults, invalid and decreasing amounts', async () => {
    const s = store();
    const a = await reserve(s, 0, now - 86_400_000);
    expect(await s.rpc('fund', { reservationId: a.reservationId, worstCaseUsd: .1 })).toEqual({ ok: true });
    expect(await s.rpc('fund', { reservationId: a.reservationId, worstCaseUsd: .11 })).toEqual({ ok: false, reason: 'budget' });
    for (const amount of [-1, 'bad', .05]) expect(await s.rpc('fund', { reservationId: a.reservationId, worstCaseUsd: amount })).toEqual({ reason: 'ledger' });
    expect(s.db.prepare('SELECT day, reserved FROM days').all()).toEqual([{ day: '2026-10-20', reserved: 100_000_000_000 }]);
    const b = await reserve(s, 0);
    await s.rpc('settle', { reservationId: a.reservationId, actualUsd: .2 });
    expect(await s.rpc('fund', { reservationId: b.reservationId, worstCaseUsd: .01 })).toEqual({ ok: false, reason: 'budget' });
  });
  it('rolls back a failed funding write, preserving the original free hold', async () => {
    const s = store();
    const a = await reserve(s, 0);
    s.db.exec("CREATE TRIGGER fail_fund BEFORE UPDATE ON reservations BEGIN SELECT RAISE(ABORT, 'storage failure'); END");
    expect(await s.rpc('fund', { reservationId: a.reservationId, worstCaseUsd: .01 })).toEqual({ reason: 'ledger' });
    expect(s.db.prepare('SELECT reserved, spent FROM days').all()).toEqual([{ reserved: 0, spent: 0 }]);
    expect(s.db.prepare('SELECT amount, status FROM reservations').all()).toEqual([{ amount: 0, status: 'reserved' }]);
  });
  it('paces the default allowance for 365 days within $7, without a New Year reset', async () => {
    const s = store({ DAILY_ALLOWANCE_USD: undefined });
    for (let day = 0; day < 365; day++) {
      const result = await reserve(s, .019, now + day * 86_400_000);
      expect(result.ok).toBe(true);
      expect(await reserve(s, .000001, now + day * 86_400_000)).toEqual({ ok: false, reason: 'budget' });
      await s.rpc('settle', { reservationId: result.reservationId, actualUsd: .019 });
    }
    expect(s.db.prepare('SELECT SUM(spent) AS total FROM days').all()).toEqual([{ total: 6_935_000_000_000 }]);
    // A lower lifetime cap also applies to money already spent before a configuration change.
    const capped = store({ DAILY_ALLOWANCE_USD: '7' });
    const a = await reserve(capped, 7);
    await capped.rpc('settle', { reservationId: a.reservationId, actualUsd: 7 });
    expect(await reserve(capped, .000001, now + 366 * 86_400_000)).toEqual({ ok: false, reason: 'budget' });
  });
  it('counts outstanding holds on different days against one lifetime cap atomically', async () => {
    const s = store({ DAILY_ALLOWANCE_USD: '.10', LIFETIME_ALLOWANCE_USD: '.03', PER_VISITOR_PER_HOUR: '100', GLOBAL_PER_MINUTE: '100' });
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => reserve(s, .01, now + i * 86_400_000)));
    expect(results.filter(r => r.ok)).toHaveLength(3);
    await s.rpc('release', { reservationId: results[0]!.reservationId });
    expect((await reserve(s, .01, now + 30 * 86_400_000)).ok).toBe(true);
  });
  it('freezes all future dispatches after an unexpected overcharge, including on a new day', async () => {
    const s = store();
    const a = await reserve(s, .01);
    expect(await s.rpc('settle', { reservationId: a.reservationId, actualUsd: .02 })).toEqual({ reason: 'ledger' });
    expect(await reserve(s, 0, now + 86_400_000)).toEqual({ ok: false, reason: 'budget' });
  });
  it.each(['NaN', '-1', '7.01'])('refuses an invalid or excessive lifetime cap %s', async cap => {
    const s = store({ LIFETIME_ALLOWANCE_USD: cap });
    expect(await reserve(s)).toEqual({ reason: 'ledger' });
  });
  it('reserves before returning, settles actual cost, releases and is idempotent', async () => {
    const s = store();
    const a = await reserve(s, 0.06);
    expect(a.ok).toBe(true);
    expect(await reserve(s, 0.05)).toEqual({ ok: false, reason: 'budget' });
    expect(await s.rpc('settle', { reservationId: a.reservationId, actualUsd: 0.01 })).toEqual({ ok: true });
    await s.rpc('settle', { reservationId: a.reservationId, actualUsd: 0 });
    await s.rpc('release', { reservationId: a.reservationId });
    const b = await reserve(s, 0.09);
    expect(b.ok).toBe(true);
    await s.rpc('release', { reservationId: b.reservationId });
    await s.rpc('release', { reservationId: b.reservationId });
    expect((await reserve(s, 0.09)).ok).toBe(true);
    expect(s.db.prepare('SELECT spent FROM days').all()).toEqual([{ spent: 10_000_000_000 }]);
  });
  it('resets daily at UTC midnight and settles old holds against the original day', async () => {
    const s = store();
    const midnight = Date.UTC(2026, 9, 22);
    const a = await reserve(s, 0.1, midnight - 1);
    expect(await reserve(s, 0.01, midnight - 1)).toEqual({ ok: false, reason: 'budget' });
    expect((await reserve(s, 0.1, midnight)).ok).toBe(true);
    await s.rpc('settle', { reservationId: a.reservationId, actualUsd: 0.05 });
    expect(s.db.prepare('SELECT day, reserved, spent FROM days ORDER BY day').all()).toEqual([
      { day: '2026-10-21', reserved: 0, spent: 50_000_000_000 },
      { day: '2026-10-22', reserved: 100_000_000_000, spent: 0 },
    ]);
  });
  it('checks visitor, then global, then allowance, and resets hour/minute buckets', async () => {
    const s = store({ PER_VISITOR_PER_HOUR: '1', GLOBAL_PER_MINUTE: '1', DAILY_ALLOWANCE_USD: '0.01' });
    expect((await reserve(s, 0.01)).ok).toBe(true);
    expect(await reserve(s, 0.01)).toEqual({ ok: false, reason: 'limit-visitor' });
    expect(await reserve(s, 0.01, now, 'b'.repeat(64))).toEqual({ ok: false, reason: 'limit-global' });
    expect(await reserve(s, 0.01, now + 60_000, 'b'.repeat(64))).toEqual({ ok: false, reason: 'budget' });
    expect((await reserve(s, 0, now + 3_600_000)).ok).toBe(true);
  });
  it('uses default visitor 5/hour and global 20/minute limits', async () => {
    const s = store();
    for (let i = 0; i < 5; i++) expect((await reserve(s, 0)).ok).toBe(true);
    expect(await reserve(s, 0)).toEqual({ ok: false, reason: 'limit-visitor' });
    for (let i = 0; i < 15; i++) expect((await reserve(s, 0, now, i.toString(16).padStart(64, '0'))).ok).toBe(true);
    expect(await reserve(s, 0, now, 'c'.repeat(64))).toEqual({ ok: false, reason: 'limit-global' });
    expect((await reserve(s, 0, now + 60_000, 'c'.repeat(64))).ok).toBe(true);
  });
  it('cannot oversubscribe a daily allowance with concurrent requests', async () => {
    const s = store({ PER_VISITOR_PER_HOUR: '100', GLOBAL_PER_MINUTE: '100' });
    const attempts = await Promise.all(Array.from({ length: 50 }, () => reserve(s, 0.01)));
    expect(attempts.filter(r => r.ok).length).toBe(10);
    expect(attempts.filter(r => r.reason === 'budget').length).toBe(40);
    expect(s.db.prepare('SELECT reserved + spent AS total FROM days').all()).toEqual([{ total: 100_000_000_000 }]);
  });
  it('rounds reservations up, refuses oversettlement and keeps the hold', async () => {
    const s = store({ DAILY_ALLOWANCE_USD: '0.000000000001' });
    const a = await reserve(s, 0.0000000000001);
    expect(a.ok).toBe(true);
    expect(await s.rpc('settle', { reservationId: a.reservationId, actualUsd: 1 })).toEqual({ reason: 'ledger' });
    expect(await reserve(s, 0.0000000000001)).toEqual({ ok: false, reason: 'budget' });
    expect(await s.rpc('release', { reservationId: 'missing' })).toEqual({ reason: 'ledger' });
  });
  it('stores signed cache payloads keyed only by the hash', async () => {
    const s = store();
    expect(await s.rpc('cacheGet', { hash: visitor })).toEqual({ payload: null });
    await s.rpc('cachePut', { hash: visitor, payload: { sig: 'signed' } });
    expect(await s.rpc('cacheGet', { hash: visitor })).toEqual({ payload: { sig: 'signed' } });
  });
  it('fails closed on invalid allowance configuration', async () => {
    const s = store({ DAILY_ALLOWANCE_USD: 'NaN' });
    expect(await reserve(s)).toEqual({ reason: 'ledger' });
    expect(s.db.prepare('SELECT * FROM reservations').all()).toHaveLength(0);
  });
  it('rolls back all counters and held money if a reservation write fails', async () => {
    const s = store();
    s.db.exec("CREATE TRIGGER fail_insert BEFORE INSERT ON reservations BEGIN SELECT RAISE(ABORT, 'storage failure'); END");
    expect(await reserve(s)).toEqual({ reason: 'ledger' });
    for (const table of ['days', 'visitors', 'minutes', 'reservations']) {
      expect(s.db.prepare(`SELECT * FROM ${table}`).all()).toHaveLength(0);
    }
  });
});
