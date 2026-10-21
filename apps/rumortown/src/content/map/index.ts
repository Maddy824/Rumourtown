import type { Need, Place, PlaceKind, TileKind, Vec2, VillageMap } from '../../sim/types.js';

const width = 64;
const height = 44;
const tiles: TileKind[] = new Array<TileKind>(width * height).fill('grass');
const places: Place[] = [];

function fill(x: number, y: number, w: number, h: number, kind: TileKind): void {
  for (let row = y; row < y + h; row++) {
    for (let col = x; col < x + w; col++) tiles[row * width + col] = kind;
  }
}

function room(
  id: string, name: string, kind: PlaceKind,
  x: number, y: number, w: number, h: number, satisfies: Need[], spotCount = 6,
): void {
  fill(x, y, w, h, 'wall');
  fill(x + 1, y + 1, w - 2, h - 2, 'floor');
  const entranceX = x + Math.floor(w / 2);
  fill(entranceX, y + h - 1, 1, 1, 'door');
  // Keep the entire entrance column free for people entering and leaving.
  const spots: Vec2[] = [];
  for (let row = y + 1; row < y + h - 1; row++) {
    for (let col = x + 1; col < x + w - 1; col++) {
      if (col !== entranceX && spots.length < spotCount) spots.push({ x: col, y: row });
    }
  }
  places.push({
    id, name, kind, rect: { x, y, w, h },
    door: { x: entranceX, y: y + h },
    spots,
    satisfies,
  });
}

// The river runs edge to edge. Only the two marked bridges cross it.
fill(40, 0, 3, height, 'water');
fill(1, 13, 9, 5, 'field');
fill(19, 20, 12, 5, 'field');
for (const y of [3, 6, 9]) {
  for (const x of [43, 45, 47]) fill(x, y, 1, 1, 'tree');
}

// Residential lanes, market lane, and the continuous west and riverside lanes.
for (const y of [5, 12, 19, 25, 30]) fill(0, y, 40, 1, 'path');
fill(0, 0, 1, height, 'path');
fill(17, 5, 1, 26, 'path');
fill(39, 0, 1, height, 'path');
fill(0, 18, 40, 1, 'path');
fill(10, 15, 38, 1, 'path');
fill(40, 15, 3, 1, 'bridge');
fill(43, 12, 1, 4, 'path');
fill(43, 12, 5, 1, 'path');
fill(17, 13, 12, 6, 'path');
fill(22, 15, 1, 1, 'well');

room('bakery', 'Bakery', 'bakery', 1, 8, 7, 4, ['hunger', 'duty'], 8);
room('shop', 'Shop', 'shop', 10, 8, 6, 4, ['hunger', 'duty']);
room('school', 'School', 'school', 18, 8, 7, 4, ['duty'], 8);
room('chapel', 'Chapel', 'chapel', 26, 8, 7, 4, ['social', 'duty'], 8);
room('mill', 'Mill', 'mill', 34, 8, 5, 4, ['duty']);
room('inn', 'Inn', 'inn', 1, 20, 7, 5, ['hunger', 'rest', 'social', 'duty'], 10);
room('smithy', 'Smithy', 'smithy', 10, 20, 6, 5, ['duty']);

const northHomes = ['Mira', 'Tom', 'Ada', 'Rosa', 'Jonah', 'Ben'];
const southHomes = ['Elin', 'Pim', 'Sol', 'Ivo', 'Nell', 'Otto'];
for (let i = 0; i < northHomes.length; i++) {
  const name = northHomes[i]!;
  room(`home-${name.toLowerCase()}`, `${name}'s home`, 'home', 1 + i * 6, 1, 5, 4, ['rest']);
}
for (let i = 0; i < southHomes.length; i++) {
  const name = southHomes[i]!;
  room(`home-${name.toLowerCase()}`, `${name}'s home`, 'home', 1 + i * 6, 26, 5, 4, ['rest']);
}

places.push(
  {
    id: 'square', name: 'Village square', kind: 'square',
    rect: { x: 17, y: 13, w: 12, h: 6 }, door: { x: 17, y: 15 },
    spots: [
      { x: 19, y: 14 }, { x: 25, y: 14 }, { x: 27, y: 14 },
      { x: 19, y: 16 }, { x: 25, y: 16 }, { x: 27, y: 16 },
      { x: 19, y: 17 }, { x: 21, y: 17 }, { x: 23, y: 17 }, { x: 25, y: 17 },
    ],
    satisfies: ['social'],
  },
  {
    id: 'well', name: 'Well', kind: 'well',
    rect: { x: 20, y: 14, w: 5, h: 3 }, door: { x: 22, y: 16 },
    spots: [
      { x: 21, y: 14 }, { x: 23, y: 14 }, { x: 20, y: 15 }, { x: 21, y: 15 },
      { x: 23, y: 15 }, { x: 24, y: 15 }, { x: 21, y: 16 }, { x: 23, y: 16 },
    ],
    satisfies: ['social'],
  },
  {
    id: 'field-north', name: 'North field', kind: 'field',
    rect: { x: 1, y: 13, w: 9, h: 5 }, door: { x: 9, y: 17 },
    spots: [
      { x: 3, y: 14 }, { x: 5, y: 14 }, { x: 7, y: 14 }, { x: 2, y: 15 },
      { x: 8, y: 15 }, { x: 3, y: 16 }, { x: 5, y: 16 }, { x: 7, y: 16 },
    ],
    satisfies: ['duty'],
  },
  {
    id: 'field-south', name: 'South field', kind: 'field',
    rect: { x: 19, y: 20, w: 12, h: 5 }, door: { x: 24, y: 24 },
    spots: [
      { x: 21, y: 21 }, { x: 23, y: 21 }, { x: 25, y: 21 }, { x: 27, y: 21 },
      { x: 21, y: 23 }, { x: 23, y: 23 }, { x: 25, y: 23 }, { x: 27, y: 23 },
    ],
    satisfies: ['duty'],
  },
  {
    id: 'bridge', name: 'Bridge', kind: 'bridge',
    rect: { x: 39, y: 15, w: 5, h: 1 }, door: { x: 39, y: 15 },
    spots: [{ x: 40, y: 15 }, { x: 41, y: 15 }, { x: 42, y: 15 }],
    satisfies: ['duty'],
  },
  {
    id: 'riverside', name: 'Riverside', kind: 'riverside',
    rect: { x: 39, y: 1, w: 1, h: 30 }, door: { x: 39, y: 18 },
    spots: [
      { x: 39, y: 3 }, { x: 39, y: 7 }, { x: 39, y: 11 }, { x: 39, y: 13 },
      { x: 39, y: 19 }, { x: 39, y: 21 }, { x: 39, y: 25 }, { x: 39, y: 29 },
    ],
    satisfies: ['duty'],
  },
  {
    id: 'orchard', name: 'Orchard', kind: 'orchard',
    rect: { x: 43, y: 2, w: 5, h: 11 }, door: { x: 43, y: 12 },
    spots: [{ x: 44, y: 4 }, { x: 46, y: 7 }, { x: 44, y: 10 }],
    satisfies: ['duty'],
  },
);

// Eastbank lanes and homes. Door approaches stay clear of trees and furniture.
fill(43, 12, 1, 32, 'path');
fill(48, 15, 16, 1, 'path');
for (const y of [21, 27, 33]) fill(43, y, 21, 1, 'path');
for (const x of [50, 57, 63]) fill(x, 15, 1, 19, 'path');
const eastHomes = ['Suri', 'Oren', 'Leela', 'Bram', 'Vesa', 'Dara'];
for (const [i, name] of eastHomes.entries()) {
  room(`home-${name.toLowerCase()}`, `${name}'s home`, 'home', 44 + (i % 3) * 7, 17 + Math.floor(i / 3) * 6, 5, 4, ['rest']);
}
room('pottery', 'Eastbank pottery', 'smithy', 44, 29, 6, 4, ['duty']);
room('boathouse', 'Boat workshop', 'smithy', 51, 29, 6, 4, ['duty']);
room('seedshop', 'Seed exchange', 'shop', 58, 29, 5, 4, ['duty', 'social']);

// Southern commons: workshops, a reading room, tea and a shared growing space.
for (const y of [33, 39, 43]) fill(0, y, 40, 1, 'path');
for (const x of [0, 10, 21, 32, 39]) fill(x, 30, 1, 14, 'path');
room('reading-room', 'Reading room', 'school', 1, 34, 8, 5, ['duty', 'social'], 10);
room('posthouse', 'Posthouse', 'shop', 12, 34, 7, 5, ['duty', 'social']);
room('teahouse', 'Willow teahouse', 'inn', 23, 34, 8, 5, ['hunger', 'rest', 'social', 'duty'], 10);
fill(1, 40, 30, 3, 'field');
fill(1, 41, 30, 1, 'path');
for (const x of [10, 21]) fill(x, 40, 1, 3, 'path');
fill(39, 36, 5, 1, 'path');
fill(40, 36, 3, 1, 'bridge');
fill(44, 35, 19, 7, 'path');
fill(53, 38, 1, 1, 'well');
fill(47, 38, 1, 1, 'tree');
fill(59, 38, 1, 1, 'tree');
fill(43, 43, 21, 1, 'path');
fill(63, 33, 1, 11, 'path');

// A wooded loop beyond the original orchard, with clearings and a path home.
for (let y = 1; y < 12; y += 3) for (let x = 49; x < 63; x += 3) fill(x, y, 1, 1, 'tree');
fill(48, 12, 16, 1, 'path');
fill(50, 3, 1, 13, 'path');
fill(50, 3, 12, 1, 'path');
fill(61, 3, 1, 10, 'path');
fill(50, 7, 12, 1, 'path');
places.push(
  { id: 'woodland', name: 'Woodland loop', kind: 'orchard', rect: { x: 49, y: 1, w: 14, h: 13 }, door: { x: 50, y: 12 },
    spots: [{ x: 50, y: 4 }, { x: 53, y: 7 }, { x: 58, y: 7 }, { x: 61, y: 5 }], satisfies: ['duty', 'rest'] },
  { id: 'gardens', name: 'Community gardens', kind: 'field', rect: { x: 1, y: 40, w: 30, h: 3 }, door: { x: 10, y: 41 },
    spots: [{ x: 3, y: 40 }, { x: 7, y: 42 }, { x: 14, y: 40 }, { x: 18, y: 42 }, { x: 25, y: 40 }, { x: 29, y: 42 }], satisfies: ['duty', 'social'] },
  { id: 'east-market', name: 'Eastbank market', kind: 'square', rect: { x: 44, y: 35, w: 19, h: 7 }, door: { x: 44, y: 36 },
    spots: [{ x: 46, y: 36 }, { x: 50, y: 36 }, { x: 54, y: 36 }, { x: 58, y: 36 }, { x: 46, y: 39 }, { x: 50, y: 39 }, { x: 54, y: 39 }, { x: 58, y: 39 }], satisfies: ['social', 'hunger'] },
  { id: 'bridge-south', name: 'Commons bridge', kind: 'bridge', rect: { x: 39, y: 36, w: 5, h: 1 }, door: { x: 39, y: 36 },
    spots: [{ x: 40, y: 36 }, { x: 41, y: 36 }, { x: 42, y: 36 }], satisfies: ['duty'] },
);

for (const place of places) {
  place.district = place.id === 'woodland' || place.id === 'orchard' ? 'woodland'
    : place.rect.x >= 43 ? 'eastbank' : place.rect.y >= 33 ? 'commons' : 'old-village';
}

/** Tile addresses are integers; a tile's world-space centre is (x + .5, y + .5). */
export const villageMap: VillageMap = { width, height, tiles, places, districts: [
  { id: 'old-village', name: 'Old village', description: 'The bakery, mill and familiar neighbours around the well.' },
  { id: 'eastbank', name: 'Eastbank', description: 'New homes, working kilns, boat repairs and a riverside market.' },
  { id: 'woodland', name: 'Woodland', description: 'Orchard paths and quiet clearings where private stories can be overheard.' },
  { id: 'commons', name: 'South commons', description: 'A reading room, posthouse, teahouse and gardens shared by the town.' },
] };
