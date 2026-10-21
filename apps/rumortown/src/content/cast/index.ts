/**
 * The village cast: 24 dossiers in the fixed id order, the ready-made claims, and the version
 * string share links carry. Pure data; nothing here touches the simulation's rng.
 */
import type { Dossier, GameClaim } from '../../sim/types.js';
import { background } from './background.js';
import { claims as readyMadeClaims } from './claims.js';
import { core } from './core.js';
import { regulars } from './regulars.js';

export const castVersion = 'v1';

export const cast: Dossier[] = [...core, ...regulars, ...background];

export const claims: GameClaim[] = readyMadeClaims;

export { CAST_IDS, COMMUNITIES, PLACE_IDS } from './ids.js';
export type { CastId, Community, FixedPlaceId } from './ids.js';
