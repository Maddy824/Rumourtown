import type { CharacterId, Claim, ClaimId, PlaceId } from './types';
export const IDS: CharacterId[] = ['mira', 'tom', 'ben'];
export const NAMES = { mira: 'Mira', tom: 'Tom', ben: 'Ben' };
export const ROLES = { mira: 'The proud baker', tom: 'A quiet kindness', ben: 'Tom’s loyal friend' };
export const PLACES: Record<PlaceId, string> = {
  bakery: 'Bakery', square: 'Square', house: 'Tom’s house', cottage: 'Ada’s cottage',
};
export const CLAIMS: Record<ClaimId, Claim> = {
  stole: { id: 'stole', kind: 'stole', about: 'tom', object: 'bread', text: 'Tom stole the bread', harmful: true },
  gaveTo: { id: 'gaveTo', kind: 'gaveTo', about: 'tom', object: 'bread', target: 'ada', text: 'Tom took the bread to Ada', harmful: false },
};
// Narrative alternatives for this spike, not a claim that generosity rules out theft.
export const CONTRADICTIONS: Record<ClaimId, ClaimId> = { stole: 'gaveTo', gaveTo: 'stole' };
