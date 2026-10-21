/**
 * The village cast: 36 dossiers in the fixed id order, the ready-made claims, and the version
 * string share links carry. Pure data; nothing here touches the simulation's rng.
 */
import type { Dossier, GameClaim } from '../../sim/types.js';
import { characters } from './characters.js';
import { newcomers, newClaims } from './newcomers.js';
import type { CastId } from './ids.js';
import { background } from './background.js';
import { claims as readyMadeClaims } from './claims.js';
import { core } from './core.js';
import { regulars } from './regulars.js';

export const castVersion = 'v3';

export const cast: Dossier[] = [...core, ...regulars, ...background, ...newcomers].map(d => ({ ...d, character: d.character ?? characters[d.id as CastId] }));

export const claims: GameClaim[] = [...readyMadeClaims, ...newClaims];

export { CAST_IDS, COMMUNITIES, PLACE_IDS } from './ids.js';
export type { CastId, Community, FixedPlaceId } from './ids.js';
