/** Presentation metadata only. Never changes walkability, places or the replay map. */
import type { Place, Vec2, VillageMap } from '../../sim/types.js';

export const districtViews = [
  { id: 'old-village', name: 'Old village', ground: '#6B8E4E', trim: '#E8DCC3', tag: { x: 19, y: 7 }, door: { x: 17, y: 15 } },
  { id: 'eastbank', name: 'Eastbank', ground: '#d7cbaa', trim: '#3F5E8A', tag: { x: 54, y: 16 }, door: { x: 44, y: 36 } },
  { id: 'woodland', name: 'Woodland', ground: '#5e7d45', trim: '#E8DCC3', tag: { x: 55, y: 1 }, door: { x: 50, y: 12 } },
  { id: 'commons', name: 'Farmland', ground: '#89a56e', trim: '#D9A531', tag: { x: 20, y: 32 }, door: { x: 10, y: 41 } },
] as const;
export type DistrictId = typeof districtViews[number]['id'];
export function districtAt(pos: Vec2): DistrictId {
  return pos.x >= 43 ? pos.y < 14 ? 'woodland' : 'eastbank' : pos.y >= 33 ? 'commons' : 'old-village';
}
/** A district field for each visual tile, kept outside the simulation contract. */
export function districtTiles(map: VillageMap): { district: DistrictId }[] {
  return Array.from({ length: map.width * map.height }, (_, i) => ({ district: districtAt({ x: i % map.width, y: Math.floor(i / map.width) }) }));
}
export const signposts = [
  { x: 39, y: 15, arms: ['Eastbank', 'Bakery'] },
  { x: 43, y: 15, arms: ['Woodland', 'Old village', 'Eastbank'] },
  { x: 50, y: 12, arms: ['Woodland', 'Eastbank'] },
  { x: 17, y: 33, arms: ['Old village', 'Farmland'] },
  { x: 39, y: 36, arms: ['Eastbank', 'Farmland'] },
  { x: 43, y: 36, arms: ['Farmland', 'Eastbank'] },
] as const;
export const buildingIcons: Readonly<Record<string, string>> = { bakery: '♨', inn: '☕', mill: '☸', chapel: '♰', school: '▱', smithy: '⚒', shop: '▤' };

const buildingSignLabels: Readonly<Record<string, string>> = { bakery: 'Bakery', inn: 'Inn', mill: 'Mill', chapel: 'Chapel', school: 'School', smithy: 'Forge', shop: 'Shop', home: 'Home' };
/** Far-view signs use words so missing symbol glyphs cannot leave blank paper. */
export function buildingSignText(place: Pick<Place, 'kind' | 'name'>, zoom: number): string {
  return zoom < 24 ? buildingSignLabels[place.kind] ?? place.name : place.name.replace(' home', '');
}
