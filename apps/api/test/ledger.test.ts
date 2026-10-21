import { afterEach, describe, expect, it } from 'vitest';
import { memoryLedger, now, visitor } from './helpers';

const stores: ReturnType<typeof memoryLedger>[] = [];
function store(config: Parameters<typeof memoryLedger>[0] = {}) {
  const s = memoryLedger(config); stores.push(s); return s;
}
afterEach(() => { for (const s of stores.splice(0)) s.db.close(); });
const reserve = (s: ReturnType<typeof store>, usd = 0.04, time = now, who = visitor) => s.rpc('reserve', { visitorKey: who, worstCaseUsd: usd, now: time });

describe('BudgetLedger', () => {
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
