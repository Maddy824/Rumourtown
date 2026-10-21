/**
 * Fixed ids every module shares (see the global constraints of the village build plan).
 * Typed as literal unions so a misspelt place or villager id fails the typecheck.
 */

export const PLACE_IDS = [
  'square',
  'well',
  'bakery',
  'mill',
  'inn',
  'chapel',
  'school',
  'shop',
  'smithy',
  'field-north',
  'field-south',
  'bridge',
  'riverside',
  'orchard',
  'home-mira',
  'home-tom',
  'home-ada',
  'home-rosa',
  'home-jonah',
  'home-ben',
  'home-elin',
  'home-pim',
  'home-sol',
  'home-ivo',
  'home-nell',
  'home-otto',
] as const;
export type FixedPlaceId = (typeof PLACE_IDS)[number];

/** In the order the engine iterates them: core, then regulars, then background. */
export const CAST_IDS = [
  'mira',
  'tom',
  'ben',
  'ada',
  'rosa',
  'jonah',
  'elin',
  'pim',
  'sol',
  'greta',
  'ivo',
  'nell',
  'otto',
  'wren',
  'hal',
  'dag',
  'una',
  'cass',
  'fen',
  'lio',
  'mab',
  'rook',
  'tess',
  'yan',
] as const;
export type CastId = (typeof CAST_IDS)[number];

/** Market; farm and mill; inn; chapel and school. Every villager belongs to two. */
export const COMMUNITIES = ['market', 'farm', 'inn', 'chapel'] as const;
export type Community = (typeof COMMUNITIES)[number];
