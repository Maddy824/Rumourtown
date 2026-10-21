import { describe, expect, it } from 'vitest';
import { villageMap } from '../../content/map/index.js';
import type { TileKind, Vec2, VillageMap } from '../types.js';
import { createMover, createWorld } from './index.js';

function emptyMap(width = 8, height = 8): VillageMap {
  return { width, height, tiles: new Array<TileKind>(width * height).fill('grass'), places: [] };
}

function setTile(map: VillageMap, x: number, y: number, tile: TileKind): void {
  map.tiles[y * map.width + x] = tile;
}

function centre(tile: Vec2): Vec2 {
  return { x: tile.x + 0.5, y: tile.y + 0.5 };
}

function independentRouteCost(map: VillageMap, from: Vec2, to: Vec2): number | null {
  const world = createWorld(map);
  const queue = [{ ...from, cost: 0 }];
  const costs = new Map([[`${from.x},${from.y}`, 0]]);
  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift()!;
    if (current.x === to.x && current.y === to.y) return current.cost;
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]] as const) {
      const x = current.x + dx, y = current.y + dy, key = `${x},${y}`;
      if (!world.isWalkable(x, y)) continue;
      const tile = map.tiles[y * map.width + x];
      const cost = current.cost + (tile === 'grass' ? 4 : tile === 'field' ? 3 : 1);
      if (cost >= (costs.get(key) ?? Infinity)) continue;
      costs.set(key, cost);
      queue.push({ x, y, cost });
    }
  }
  return null;
}

describe('village map', () => {
  const world = createWorld(villageMap);
  const homes = ['mira', 'tom', 'ada', 'rosa', 'jonah', 'ben', 'elin', 'pim', 'sol', 'ivo', 'nell', 'otto'];
  const buildings = ['bakery', 'mill', 'inn', 'chapel', 'school', 'shop', 'smithy', ...homes.map((id) => `home-${id}`)];
  const expectedIds = [...buildings, 'square', 'well', 'field-north', 'field-south', 'bridge', 'riverside', 'orchard'];
  const busyPlaces = ['inn', 'square', 'chapel', 'well', 'field-north', 'field-south', 'riverside', 'bakery', 'school'];

  it('has the exact dimensions and fixed place ids', () => {
    expect([villageMap.width, villageMap.height, villageMap.tiles.length]).toEqual([48, 32, 1536]);
    expect(villageMap.places.map((p) => p.id).sort()).toEqual(expectedIds.sort());
  });

  it('gives every place a walkable entry and at least three distinct walkable spots inside its rect', () => {
    for (const place of villageMap.places) {
      expect(world.isWalkable(place.door.x, place.door.y), `${place.id} entry`).toBe(true);
      expect(place.spots.length).toBeGreaterThanOrEqual(3);
      expect(new Set(place.spots.map((p) => `${p.x},${p.y}`)).size).toBe(place.spots.length);
      for (const spot of place.spots) {
        expect(world.isWalkable(spot.x, spot.y), `${place.id} spot`).toBe(true);
        expect(spot.x).toBeGreaterThanOrEqual(place.rect.x);
        expect(spot.x).toBeLessThan(place.rect.x + place.rect.w);
        expect(spot.y).toBeGreaterThanOrEqual(place.rect.y);
        expect(spot.y).toBeLessThan(place.rect.y + place.rect.h);
      }
    }
  });

  it('connects every entry and interior spot to the square', () => {
    const square = world.place('square');
    for (const place of villageMap.places) {
      for (const destination of [place.door, ...place.spots]) {
        const path = world.findPath(square.door, destination);
        expect(path, `${place.id}: ${destination.x},${destination.y}`).not.toBeNull();
        if (path!.length) expect(path!.at(-1)).toEqual(destination);
      }
    }
  });

  it('provides 8–10 spots at busy places and 4–6 at other rooms, with clear door columns', () => {
    for (const id of busyPlaces) {
      expect(world.place(id).spots.length, id).toBeGreaterThanOrEqual(8);
      expect(world.place(id).spots.length, id).toBeLessThanOrEqual(10);
    }
    for (const id of buildings) {
      const place = world.place(id);
      if (!busyPlaces.includes(id)) {
        expect(place.spots.length, id).toBeGreaterThanOrEqual(4);
        expect(place.spots.length, id).toBeLessThanOrEqual(6);
      }
      for (const spot of place.spots) {
        expect(spot.x, `${id} door column`).not.toBe(place.door.x);
        expect(villageMap.tiles[spot.y * villageMap.width + spot.x], `${id} standing floor`).toBe('floor');
      }
    }
  });

  it('allocates distinct destinations up to each busy place capacity, including five inn lodgers', () => {
    for (const id of busyPlaces) {
      const occupied: Vec2[] = [];
      for (let i = 0; i < world.place(id).spots.length; i++) {
        const destination = centre(world.spotFor(id, occupied, () => 0));
        expect(occupied, `${id} guest ${i + 1}`).not.toContainEqual(destination);
        occupied.push(destination);
      }
    }
    const squareSpots = world.place('square').spots;
    for (const spot of world.place('well').spots) expect(squareSpots).not.toContainEqual(spot);
  });

  it('builds nineteen cut-away rooms with intact wall rings, one door, and an adjacent path entry', () => {
    for (const id of buildings) {
      const place = world.place(id);
      const { x, y, w, h } = place.rect;
      expect(w).toBeGreaterThanOrEqual(5);
      expect(h).toBeGreaterThanOrEqual(4);
      const doors: Vec2[] = [];
      for (let row = y; row < y + h; row++) {
        for (let col = x; col < x + w; col++) {
          const tile = villageMap.tiles[row * villageMap.width + col];
          const edge = col === x || row === y || col === x + w - 1 || row === y + h - 1;
          if (tile === 'door') doors.push({ x: col, y: row });
          expect(edge ? tile === 'wall' || tile === 'door' : tile === 'floor', `${id} room tile`).toBe(true);
        }
      }
      expect(doors).toHaveLength(1);
      expect(Math.abs(doors[0]!.x - place.door.x) + Math.abs(doors[0]!.y - place.door.y)).toBe(1);
      expect(villageMap.tiles[place.door.y * villageMap.width + place.door.x]).toBe('path');
    }
  });

  it('connects every building door through path tiles alone', () => {
    const lanes: VillageMap = {
      ...villageMap,
      tiles: villageMap.tiles.map((tile) => tile === 'path' || tile === 'bridge' ? tile : 'wall'),
    };
    const laneWorld = createWorld(lanes);
    for (const id of buildings) {
      expect(laneWorld.findPath(world.place('square').door, world.place(id).door), id).not.toBeNull();
    }
  });

  it('contains the well in the square, with walkable neighbours but an impassable well tile', () => {
    const well = world.place('well'), square = world.place('square');
    expect(well.rect.x).toBeGreaterThanOrEqual(square.rect.x);
    expect(well.rect.y).toBeGreaterThanOrEqual(square.rect.y);
    expect(well.rect.x + well.rect.w).toBeLessThanOrEqual(square.rect.x + square.rect.w);
    expect(well.rect.y + well.rect.h).toBeLessThanOrEqual(square.rect.y + square.rect.h);
    expect(world.isWalkable(22, 15)).toBe(false);
    for (const p of [{ x: 21, y: 15 }, { x: 23, y: 15 }, { x: 22, y: 14 }, { x: 22, y: 16 }]) {
      expect(world.isWalkable(p.x, p.y)).toBe(true);
    }
  });

  it('has exactly one river crossing and trees with reachable ground in the orchard', () => {
    expect(villageMap.tiles.filter((tile) => tile === 'bridge')).toHaveLength(3);
    const withoutBridge = createWorld({
      ...villageMap,
      tiles: villageMap.tiles.map((tile) => tile === 'bridge' ? 'water' : tile),
    });
    expect(withoutBridge.findPath(world.place('square').door, world.place('orchard').door)).toBeNull();
    const { x, y, w, h } = world.place('orchard').rect;
    let trees = 0;
    for (let row = y; row < y + h; row++) {
      for (let col = x; col < x + w; col++) {
        if (villageMap.tiles[row * villageMap.width + col] === 'tree') trees++;
      }
    }
    expect(trees).toBeGreaterThanOrEqual(6);
  });

  it('satisfies the required needs at food, rest, social, and work places', () => {
    for (const id of ['bakery', 'inn', 'shop']) expect(world.place(id).satisfies).toContain('hunger');
    for (const id of ['inn', ...homes.map((name) => `home-${name}`)]) expect(world.place(id).satisfies).toContain('rest');
    for (const id of ['square', 'inn', 'chapel', 'well']) expect(world.place(id).satisfies).toContain('social');
    for (const id of ['bakery', 'mill', 'inn', 'chapel', 'school', 'shop', 'smithy', 'field-north', 'field-south', 'bridge', 'riverside', 'orchard']) {
      expect(world.place(id).satisfies).toContain('duty');
    }
  });
});

describe('world queries', () => {
  it('recognises every walkable tile kind and rejects blocked and out-of-bounds tiles', () => {
    const tiles: TileKind[] = ['grass', 'path', 'bridge', 'floor', 'door', 'field', 'water', 'wall', 'tree', 'well'];
    const world = createWorld({ width: tiles.length, height: 1, tiles, places: [] });
    expect(tiles.map((_, x) => world.isWalkable(x, 0))).toEqual([true, true, true, true, true, true, false, false, false, false]);
    for (const p of [{ x: -0.1, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 1 }, { x: NaN, y: 0 }, { x: 0, y: Infinity }]) {
      expect(world.isWalkable(p.x, p.y)).toBe(false);
    }
  });

  it('returns null across water without a bridge, and finds a shortest path with one', () => {
    const map = emptyMap();
    for (let y = 0; y < map.height; y++) setTile(map, 4, y, 'water');
    const world = createWorld(map), from = { x: 1, y: 1 }, to = { x: 6, y: 1 };
    expect(world.findPath(from, to)).toBeNull();
    setTile(map, 4, 6, 'bridge');
    const path = world.findPath(from, to)!;
    expect(path).toContainEqual({ x: 4, y: 6 });
    expect(path).toHaveLength(15);
    let previous = from;
    for (const step of path) {
      expect(Math.abs(previous.x - step.x) + Math.abs(previous.y - step.y)).toBe(1);
      expect(world.isWalkable(step.x, step.y)).toBe(true);
      previous = step;
    }
    expect(previous).toEqual(to);
  });

  it('matches independent Dijkstra costs across the real map', () => {
    const world = createWorld(villageMap);
    const from = world.place('square').door;
    for (const place of villageMap.places) {
      const path = world.findPath(from, place.door);
      const cost = path?.reduce((sum, p) => {
        const tile = villageMap.tiles[p.y * villageMap.width + p.x];
        return sum + (tile === 'grass' ? 4 : tile === 'field' ? 3 : 1);
      }, 0) ?? null;
      expect(cost).toBe(independentRouteCost(villageMap, from, place.door));
    }
  });

  it('takes a longer paved lane instead of cutting across a lawn', () => {
    const map = emptyMap(8, 4);
    for (let x = 0; x < 8; x++) setTile(map, x, 2, 'path');
    const path = createWorld(map).findPath({ x: 0, y: 1 }, { x: 7, y: 1 })!;
    expect(path.length).toBeGreaterThan(7);
    expect(path.filter(p => map.tiles[p.y * map.width + p.x] === 'path').length).toBeGreaterThanOrEqual(7);
  });

  it('excludes the starting tile, includes the target, and normalises world positions', () => {
    const world = createWorld(emptyMap());
    expect(world.findPath({ x: 1.5, y: 1.5 }, { x: 3.8, y: 1.2 })).toEqual([{ x: 2, y: 1 }, { x: 3, y: 1 }]);
    expect(world.findPath({ x: 1, y: 1 }, { x: 1, y: 1 })).toEqual([]);
    expect(world.findPath({ x: -1, y: 1 }, { x: 1, y: 1 })).toBeNull();
    expect(world.findPath({ x: 1, y: 1 }, { x: 8, y: 1 })).toBeNull();
    const map = emptyMap();
    setTile(map, 1, 1, 'wall');
    expect(createWorld(map).findPath({ x: 1, y: 1 }, { x: 1, y: 1 })).toBeNull();
  });

  it('deterministically breaks equal scores by lower y then lower x', () => {
    const map = emptyMap(5, 5);
    setTile(map, 2, 2, 'wall');
    const world = createWorld(map);
    const expected = [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 2 }];
    for (let repeat = 0; repeat < 30; repeat++) {
      expect(world.findPath({ x: 1, y: 2 }, { x: 3, y: 2 })).toEqual(expected);
    }
    expect(createWorld(map).findPath({ x: 1, y: 2 }, { x: 3, y: 2 })).toEqual(expected);
    setTile(map, 2, 2, 'grass');
    expect(createWorld(map).findPath({ x: 2, y: 2 }, { x: 1, y: 3 })).toEqual([{ x: 1, y: 2 }, { x: 1, y: 3 }]);
    expect(createWorld(map).findPath({ x: 0, y: 0 }, { x: 3, y: 3 })).toEqual([
      { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 },
      { x: 3, y: 1 }, { x: 3, y: 2 }, { x: 3, y: 3 },
    ]);
  });

  it('uses Bresenham visibility blocked by walls and trees, including endpoints', () => {
    const map = emptyMap(), world = createWorld(map);
    const a = { x: 0, y: 0 }, b = { x: 7, y: 7 };
    expect(world.lineOfSight(a, b)).toBe(true);
    setTile(map, 3, 3, 'tree');
    expect(world.lineOfSight(a, b)).toBe(false);
    expect(world.lineOfSight(b, a)).toBe(false);
    setTile(map, 3, 3, 'water');
    expect(world.lineOfSight(a, b)).toBe(true);
    setTile(map, 7, 7, 'wall');
    expect(world.lineOfSight(a, b)).toBe(false);
    expect(world.lineOfSight(b, b)).toBe(false);
    expect(world.lineOfSight({ x: -1, y: 0 }, a)).toBe(false);
    expect(world.lineOfSight(a, a)).toBe(true);
    setTile(map, 0, 3, 'wall');
    expect(world.lineOfSight(a, { x: 0, y: 7 })).toBe(false);
    setTile(map, 3, 0, 'tree');
    expect(world.lineOfSight(a, { x: 7, y: 0 })).toBe(false);
  });

  it('looks up places, prefers a nested footprint, and measures Euclidean distance', () => {
    const world = createWorld(villageMap);
    expect(world.placeAt({ x: 22.5, y: 15.5 })?.id).toBe('well');
    expect(world.placeAt({ x: 18.5, y: 13.5 })?.id).toBe('square');
    expect(world.placeAt({ x: -1, y: -1 })).toBeNull();
    expect(() => world.place('missing')).toThrow('Unknown place');
    expect(world.distance({ x: 1, y: 1 }, { x: 4, y: 5 })).toBe(5);
  });

  it('chooses among free spots with rng and falls back predictably when all are occupied', () => {
    const world = createWorld(villageMap), place = world.place('bakery');
    const first = place.spots[0]!, second = place.spots[1]!, last = place.spots.at(-1)!;
    expect(world.spotFor(place.id, [], () => 0)).toEqual(first);
    expect(world.spotFor(place.id, [], () => 0.99)).toEqual(last);
    const allExceptSecond = place.spots.filter((_, index) => index !== 1).map(centre);
    expect(world.spotFor(place.id, allExceptSecond, () => 0.7)).toEqual(second);
    const nearby = { x: first.x + 0.99, y: first.y + 0.5 };
    expect(world.spotFor(place.id, [nearby], () => 0)).toEqual(second);
    expect(world.spotFor(place.id, [{ x: first.x + 1, y: first.y + 0.5 }], () => 0)).toEqual(first);
    expect(world.spotFor(place.id, place.spots.map(centre), () => { throw new Error('unneeded rng'); })).toEqual(first);
  });

  it.each([false, true])('returns an independent spot copy when fully occupied is %s', (fullyOccupied) => {
    // Isolate this fixture so a failed copy assertion cannot corrupt the shared map.
    const map: VillageMap = {
      ...villageMap,
      places: villageMap.places.map((place) => ({ ...place, spots: place.spots.map((spot) => ({ ...spot })) })),
    };
    const world = createWorld(map), place = world.place('bakery');
    const original = { ...place.spots[0]! };
    const occupied = fullyOccupied ? place.spots.map(centre) : [];
    const result = world.spotFor(place.id, occupied, () => 0);
    result.x = -100;
    expect(place.spots[0]).toEqual(original);
    expect(result).not.toBe(place.spots[0]);
  });

  it('finds a 60-tile path with a median below 1 ms after warm-up', () => {
    const world = createWorld(emptyMap(48, 32));
    const from = { x: 0, y: 0 }, to = { x: 30, y: 30 };
    for (let i = 0; i < 50; i++) world.findPath(from, to);
    const timings: number[] = [];
    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      const path = world.findPath(from, to);
      timings.push(performance.now() - start);
      expect(path).toHaveLength(60);
    }
    timings.sort((a, b) => a - b);
    console.info(`60-tile A*: median ${timings[50]!.toFixed(3)} ms; p95 ${timings[95]!.toFixed(3)} ms (100 runs)`);
    expect(timings[50]!).toBeLessThan(1);
  });
});

describe('mover', () => {
  const straightPath = Array.from({ length: 20 }, (_, index) => ({ x: index + 1, y: 0 }));

  it('traverses a 20-tile path at the requested speed and arrives exactly at its final centre', () => {
    const mover = createMover({ x: 0.5, y: 0.5 });
    mover.setPath(straightPath);
    expect(mover.arrived()).toBe(false);
    for (let i = 0; i < 79; i++) mover.update(0.25, 1, []);
    expect(mover.pos.x).toBe(20.25);
    expect(mover.facing).toBe('e');
    expect(mover.moving).toBe(true);
    mover.update(0.25, 1, []);
    expect(mover.pos).toEqual({ x: 20.5, y: 0.5 });
    expect(mover.arrived()).toBe(true);
    expect(mover.moving).toBe(false);
    mover.update(10, 1, []);
    expect(mover.pos).toEqual({ x: 20.5, y: 0.5 });
  });

  it.each([1.4, 0.5])('moves at %s tiles per game-minute', (speed) => {
    const mover = createMover({ x: 0.5, y: 0.5 });
    mover.setPath(straightPath);
    mover.update(1, speed, []);
    expect(mover.pos.x).toBeCloseTo(0.5 + speed, 10);
    expect(mover.pos.y).toBe(0.5);
    mover.update(0.5, speed, []);
    expect(mover.pos.x).toBeCloseTo(0.5 + 1.5 * speed, 10);
    expect(mover.arrived()).toBe(false);
  });

  it('spends a large update across corners and reports the last direction of travel', () => {
    const mover = createMover({ x: 1.5, y: 1.5 });
    mover.setPath([{ x: 2, y: 1 }, { x: 2, y: 2 }, { x: 1, y: 2 }, { x: 1, y: 1 }]);
    mover.update(1, 1, []);
    expect(mover.facing).toBe('e');
    mover.update(1, 1, []);
    expect(mover.facing).toBe('s');
    mover.update(1, 1, []);
    expect(mover.facing).toBe('w');
    mover.update(10, 1, []);
    expect(mover.facing).toBe('n');
    expect(mover.arrived()).toBe(true);
    expect(mover.pos).toEqual({ x: 1.5, y: 1.5 });
    const oneStep = createMover({ x: 1.5, y: 1.5 });
    oneStep.setPath([{ x: 2, y: 1 }, { x: 2, y: 2 }, { x: 1, y: 2 }, { x: 1, y: 1 }]);
    oneStep.update(4, 1, []);
    expect(oneStep.pos).toEqual(mover.pos);
  });

  it('clears paths on stop without claiming arrival, and can accept a replacement', () => {
    const mover = createMover({ x: 0.5, y: 0.5 });
    mover.setPath(straightPath);
    mover.update(0.5, 1, []);
    mover.stop();
    const stopped = { ...mover.pos };
    mover.update(10, 10, []);
    expect(mover.pos).toEqual(stopped);
    expect(mover.moving).toBe(false);
    expect(mover.arrived()).toBe(false);
    mover.setPath([{ x: 1, y: 0 }]);
    mover.update(1, 1, []);
    expect(mover.arrived()).toBe(true);
    expect(mover.pos).toEqual({ x: 1.5, y: 0.5 });
  });

  it('handles empty paths, duplicate current tiles, zero time, and invalid movement budgets', () => {
    const mover = createMover({ x: 0.5, y: 0.5 });
    expect(mover.arrived()).toBe(true);
    mover.setPath([]);
    expect(mover.moving).toBe(false);
    mover.setPath([{ x: 0, y: 0 }, { x: 0, y: 0 }]);
    expect(mover.arrived()).toBe(true);
    mover.setPath(straightPath);
    for (const [dt, speed] of [[0, 1], [1, 0], [-1, 1], [1, -1], [Infinity, 1], [1, NaN]]) {
      mover.update(dt!, speed!, [{ x: 0.5, y: 0.5 }]);
      expect(mover.pos).toEqual({ x: 0.5, y: 0.5 });
    }
  });

  it('copies the supplied start and path', () => {
    const start = { x: 0.5, y: 0.5 }, path = [{ x: 1, y: 0 }];
    const mover = createMover(start);
    mover.setPath(path);
    start.x = 100;
    expect(mover.pos).toEqual({ x: 0.5, y: 0.5 });
    path[0]!.x = 100;
    mover.update(1, 1, []);
    expect(mover.pos).toEqual({ x: 1.5, y: 0.5 });
  });

  it('applies the full 0.15 sideways push for a coincident neighbour', () => {
    const mover = createMover({ x: 0.5, y: 0.5 });
    mover.setPath(straightPath);
    mover.update(0.25, 1, [{ x: 0.75, y: 0.5 }]);
    expect(mover.pos.x).toBe(0.75);
    expect(mover.pos.y).toBeCloseTo(0.65, 10);
  });

  it('pushes at 0.5 tiles but not at 0.65 tiles from a neighbour', () => {
    const near = createMover({ x: 0.5, y: 0.5 });
    near.setPath(straightPath);
    near.update(0.25, 1, [{ x: 0.75, y: 0 }]);
    expect(near.pos.x).toBe(0.75);
    expect(near.pos.y).toBeCloseTo(0.525, 10);
    const far = createMover({ x: 0.5, y: 0.5 });
    far.setPath(straightPath);
    far.update(0.25, 1, [{ x: 0.75, y: -0.15 }]);
    expect(far.pos).toEqual({ x: 0.75, y: 0.5 });
  });

  it('pushes sideways away from nearby villagers by at most 0.15, without accumulated drift', () => {
    const mover = createMover({ x: 0.5, y: 0.5 });
    mover.setPath(straightPath);
    mover.update(0.25, 1, [{ x: 0.75, y: 0.6 }]);
    expect(mover.pos.x).toBe(0.75);
    expect(mover.pos.y).toBeLessThan(0.5);
    expect(Math.abs(mover.pos.y - 0.5)).toBeLessThanOrEqual(0.15);
    for (let i = 0; i < 10; i++) {
      const other = { x: mover.pos.x + 0.25, y: 0.5 };
      mover.update(0.25, 1, [other, other, other]);
      expect(Math.abs(mover.pos.y - 0.5)).toBeLessThanOrEqual(0.150000001);
    }
    mover.update(0.25, 1, [{ x: mover.pos.x + 0.25, y: 1.2 }]);
    expect(mover.pos.y).toBe(0.5);
    mover.update(100, 1, [{ x: 20.5, y: 0.5 }]);
    expect(mover.pos).toEqual({ x: 20.5, y: 0.5 });
    expect(mover.arrived()).toBe(true);
  });
});
