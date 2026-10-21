/**
 * Small authoring helpers for the cast: pronoun sets, the felt palette, and narrowed draft
 * types so place and villager ids are checked at compile time. Drafts are plain `Dossier`s.
 */
import type { Activity, Dossier, Pronouns, ScheduleEntry, Secret } from '../../sim/types.js';
import type { CastId, Community, FixedPlaceId } from './ids.js';

export const she: Pronouns = { subject: 'she', object: 'her', possessive: 'her' };
export const he: Pronouns = { subject: 'he', object: 'him', possessive: 'his' };
export const they: Pronouns = { subject: 'they', object: 'them', possessive: 'their' };

/** Clothes: the spec's tokens (berry, denim, mustard, moss, oat, paper) plus muted dyes beside them. */
export const felt = {
  berry: '#A3323B',
  denim: '#3F5E8A',
  mustard: '#D9A531',
  moss: '#6B8E4E',
  oat: '#E8DCC3',
  paper: '#F6F0E4',
  plum: '#6E3B5C',
  teal: '#2F6F6D',
  rust: '#A65A2E',
  heather: '#8C7AA8',
  sage: '#9DB08A',
  wheat: '#D8C08A',
  slate: '#5A6772',
  bottle: '#355E3B',
  cornflower: '#6D8CC0',
  rose: '#C98A8F',
  walnut: '#6B4A33',
  brick: '#8E3B2E',
  ochre: '#C28E2C',
  damson: '#4B3550',
  leather: '#7A5638',
  fawn: '#A88B6A',
  storm: '#46505E',
} as const;

/** Skin tones from lightest (0) to deepest (9). */
export const tone = [
  '#F4D9C2',
  '#EECBAE',
  '#E3B48F',
  '#D6A07A',
  '#C68B60',
  '#B07547',
  '#97603A',
  '#7E4E30',
  '#663D26',
  '#4E2E1D',
] as const;

export const hair = {
  black: '#1F1A17',
  darkBrown: '#3B2A20',
  brown: '#6B4A2E',
  auburn: '#8A3F22',
  ginger: '#B5562F',
  honey: '#C9A35C',
  ash: '#A8A196',
  grey: '#8F8A84',
  saltPepper: '#6E6A64',
  white: '#E6E1D8',
} as const;

export interface SecretDraft extends Omit<Secret, 'place' | 'with'> {
  place: FixedPlaceId;
  with?: CastId;
}

export interface DossierDraft
  extends Omit<Dossier, 'id' | 'communities' | 'home' | 'workplace' | 'closeTo' | 'rival' | 'secrets'> {
  id: CastId;
  communities: [Community, Community];
  home: FixedPlaceId;
  workplace: FixedPlaceId;
  closeTo: CastId[];
  rival?: CastId;
  secrets: SecretDraft[];
}

/** One schedule entry as [minutes since 07:00, place, activity]. */
export type Slot = [start: number, place: FixedPlaceId, activity: Activity];

/** Expands compact slots into schedule entries, keeping their order (the tests check it is sorted). */
export const day = (slots: Slot[]): ScheduleEntry[] =>
  slots.map(([start, place, activity]) => ({ start, place, activity }));
