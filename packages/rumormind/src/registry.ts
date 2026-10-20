import type { Claim, ClaimId } from './claims.js';

/** An alternative carries the id of the claim it explains away. */
export interface RegisteredClaim extends Claim {
  alternativeOf?: ClaimId;
}

/** Claims in registration order. `claims` can also be passed to BeliefLedger and tell. */
export class ClaimRegistry<C extends RegisteredClaim = RegisteredClaim> {
  readonly claims = new Map<ClaimId, C>();

  constructor(claims: Iterable<C> = []) {
    for (const claim of claims) this.add(claim);
  }

  add(claim: C): void {
    if (this.claims.has(claim.id)) throw new Error(`Duplicate claim: ${claim.id}`);
    this.claims.set(claim.id, claim);
  }

  get(id: ClaimId): C | undefined {
    return this.claims.get(id);
  }

  /** Resolve contradictions in their authored order. Validate after registering all claims. */
  contradictionsOf(id: ClaimId): C[] {
    const result: C[] = [];
    for (const otherId of this.claims.get(id)?.contradicts ?? []) {
      const other = this.claims.get(otherId);
      if (other) result.push(other);
    }
    return result;
  }

  /** Find the first registered explanation whose `alternativeOf` points to this id. */
  alternativeOf(id: ClaimId): C | undefined {
    if (!this.claims.has(id)) return undefined;
    for (const claim of this.claims.values()) {
      if (claim.alternativeOf === id) return claim;
    }
    return undefined;
  }

  validate(): void {
    for (const claim of this.claims.values()) {
      for (const otherId of claim.contradicts ?? []) {
        const other = this.claims.get(otherId);
        if (!other) throw new Error(`Claim ${claim.id} contradicts missing claim ${otherId}`);
        if (otherId === claim.id) throw new Error(`Claim ${claim.id} contradicts itself`);
        if (!other.contradicts?.includes(claim.id)) {
          throw new Error(`Contradiction is not mutual: ${claim.id} and ${otherId}`);
        }
      }
      if (claim.alternativeOf !== undefined && !this.claims.has(claim.alternativeOf)) {
        throw new Error(`Claim ${claim.id} is an alternative to missing claim ${claim.alternativeOf}`);
      }
    }
  }
}
