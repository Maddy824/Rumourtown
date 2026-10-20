import type { Need, Place, PlaceKind, TileKind, VillageMap } from '../../sim/types.js';

const width = 48;
const height = 32;
const tiles: TileKind[] = new Array<TileKind>(width * height).fill('grass');
const places: Place[] = [];

function fill(x: number, y: number, w: number, h: number, kind: TileKind): void {
  for (let row = y; row < y + h; row++) {
    for (let col = x; col < x + w; col++) tiles[row * width + col] = kind;
  }
}

function room(
  id: string, name: string, kind: PlaceKind,
  x: number, y: number, w: number, h: number, satisfies: Need[],
): void {
  fill(x, y, w, h, 'wall');
  fill(x + 1, y + 1, w - 2, h - 2, 'floor');
  const entranceX = x + Math.floor(w / 2);
  fill(entranceX, y + h - 1, 1, 1, 'door');
  places.push({
    id, name, kind, rect: { x, y, w, h },
    door: { x: entranceX, y: y + h },
    spots: [
      { x: x + 1, y: y + 1 },
      { x: x + w - 2, y: y + 1 },
      { x: entranceX, y: y + h - 2 },
    ],
    satisfies,
  });
}

// The river runs edge to edge: the single three-tile bridge is its only crossing.
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

room('bakery', 'Bakery', 'bakery', 1, 8, 7, 4, ['hunger', 'duty']);
room('shop', 'Shop', 'shop', 10, 8, 6, 4, ['hunger', 'duty']);
room('school', 'School', 'school', 18, 8, 6, 4, ['duty']);
room('chapel', 'Chapel', 'chapel', 26, 8, 6, 4, ['social', 'duty']);
room('mill', 'Mill', 'mill', 34, 8, 5, 4, ['duty']);
room('inn', 'Inn', 'inn', 1, 20, 7, 5, ['hunger', 'rest', 'social', 'duty']);
// The shared PlaceKind union has no smithy, orchard, or riverside variants.
room('smithy', 'Smithy', 'shop', 10, 20, 6, 5, ['duty']);

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
    spots: [{ x: 19, y: 14 }, { x: 25, y: 15 }, { x: 21, y: 17 }],
    satisfies: ['social'],
  },
  {
    id: 'well', name: 'Well', kind: 'well',
    rect: { x: 21, y: 14, w: 3, h: 3 }, door: { x: 22, y: 16 },
    spots: [{ x: 21, y: 15 }, { x: 23, y: 15 }, { x: 22, y: 14 }],
    satisfies: ['social'],
  },
  {
    id: 'field-north', name: 'North field', kind: 'field',
    rect: { x: 1, y: 13, w: 9, h: 5 }, door: { x: 9, y: 17 },
    spots: [{ x: 3, y: 14 }, { x: 5, y: 15 }, { x: 7, y: 16 }],
    satisfies: ['duty'],
  },
  {
    id: 'field-south', name: 'South field', kind: 'field',
    rect: { x: 19, y: 20, w: 12, h: 5 }, door: { x: 24, y: 24 },
    spots: [{ x: 21, y: 21 }, { x: 25, y: 22 }, { x: 29, y: 23 }],
    satisfies: ['duty'],
  },
  {
    id: 'bridge', name: 'Bridge', kind: 'bridge',
    rect: { x: 39, y: 15, w: 5, h: 1 }, door: { x: 39, y: 15 },
    spots: [{ x: 40, y: 15 }, { x: 41, y: 15 }, { x: 42, y: 15 }],
    satisfies: ['duty'],
  },
  {
    id: 'riverside', name: 'Riverside', kind: 'square',
    rect: { x: 39, y: 1, w: 1, h: 30 }, door: { x: 39, y: 18 },
    spots: [{ x: 39, y: 11 }, { x: 39, y: 19 }, { x: 39, y: 25 }],
    satisfies: ['duty'],
  },
  {
    id: 'orchard', name: 'Orchard', kind: 'field',
    rect: { x: 43, y: 2, w: 5, h: 11 }, door: { x: 43, y: 12 },
    spots: [{ x: 44, y: 4 }, { x: 46, y: 7 }, { x: 44, y: 10 }],
    satisfies: ['duty'],
  },
);

/** Tile addresses are integers; a tile's world-space centre is (x + .5, y + .5). */
export const villageMap: VillageMap = { width, height, tiles, places };
