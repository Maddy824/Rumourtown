/** Starting relationships from the dossiers, and the two ways they change, each with a reason. */
import type { Dossier, VillagerId } from '../types.js';
import { emit, relKey, type Ctx } from './context.js';
import { INITIAL, STRANGER_TRUST } from './params.js';
import { STRANGER_ID } from './text.js';

export function strangerTrustFor(d: Dossier): number {
  const byId = STRANGER_TRUST.byId[d.id];
  if (byId !== undefined) return byId;
  return d.tier === 'core' ? STRANGER_TRUST.core : STRANGER_TRUST.other;
}

function sharesCommunity(a: Dossier, b: Dossier): boolean {
  return a.communities.some((c) => b.communities.includes(c));
}

export function initRelationships(ctx: Ctx): void {
  const { rel } = ctx;
  for (const a of ctx.agents) {
    for (const b of ctx.agents) {
      if (a === b) continue;
      if (sharesCommunity(a.d, b.d)) {
        rel.setAffinity(a.d.id, b.d.id, INITIAL.communityAffinity);
        rel.setTrust(a.d.id, b.d.id, INITIAL.communityTrust);
      }
    }
  }
  // Ties after communities so they win; the listed direction is strong, the other direction warm.
  for (const a of ctx.agents) {
    for (const id of a.d.closeTo) {
      if (!ctx.byId.has(id) || id === a.d.id) continue;
      rel.setAffinity(a.d.id, id, INITIAL.closeAffinity);
      rel.setTrust(a.d.id, id, INITIAL.closeTrust);
      if (rel.affinity(id, a.d.id) < INITIAL.closeBackAffinity) rel.setAffinity(id, a.d.id, INITIAL.closeBackAffinity);
      if (rel.trust(id, a.d.id) < INITIAL.closeBackTrust) rel.setTrust(id, a.d.id, INITIAL.closeBackTrust);
    }
  }
  for (const a of ctx.agents) {
    const r = a.d.rival;
    if (!r || !ctx.byId.has(r) || r === a.d.id) continue;
    rel.setAffinity(a.d.id, r, INITIAL.rivalAffinity);
    rel.setTrust(a.d.id, r, INITIAL.rivalTrust);
    if (rel.affinity(r, a.d.id) > INITIAL.rivalBackAffinity) rel.setAffinity(r, a.d.id, INITIAL.rivalBackAffinity);
    if (rel.trust(r, a.d.id) > INITIAL.rivalBackTrust) rel.setTrust(r, a.d.id, INITIAL.rivalBackTrust);
  }
  for (const a of ctx.agents) rel.setTrust(a.d.id, STRANGER_ID, strangerTrustFor(a.d));
}

function emitRelationship(ctx: Ctx, from: VillagerId, to: VillagerId | 'stranger', why: string): void {
  ctx.relationWhy.set(relKey(from, to), why);
  emit(ctx, { kind: 'relationship', tick: ctx.tick, from, to, trust: ctx.rel.trust(from, to), affinity: ctx.rel.affinity(from, to), why });
}

export function changeAffinity(ctx: Ctx, from: VillagerId, to: VillagerId | 'stranger', delta: number, why: string): void {
  ctx.rel.adjustAffinity(from, to, delta);
  emitRelationship(ctx, from, to, why);
}

export function changeTrust(ctx: Ctx, from: VillagerId, to: VillagerId | 'stranger', delta: number, why: string): void {
  ctx.rel.adjustTrust(from, to, delta);
  emitRelationship(ctx, from, to, why);
}

/** Trust loss plus a permanent ceiling: an exposed liar never gets full trust back. */
export function exposeTrust(ctx: Ctx, from: VillagerId, to: VillagerId | 'stranger', delta: number, why: string): void {
  ctx.rel.adjustTrust(from, to, delta);
  ctx.rel.setTrustCeiling(from, to, ctx.tuning.exposedLiarTrustCeiling);
  emitRelationship(ctx, from, to, why);
}
