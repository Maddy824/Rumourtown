import type { Mover, Place, Vec2, VillageMap, WorldApi } from '../types.js';
import { deterministicHypot } from 'rumormind';

interface Entry {
  tile: number;
  cost: number;
  score: number;
}

/** Row-major tile indices resolve equal scores by lower y, then lower x. */
function before(a: Entry, b: Entry): boolean {
  return a.score < b.score || (a.score === b.score && a.tile < b.tile);
}

class MinHeap {
  private entries: Entry[] = [];

  push(entry: Entry): void {
    let i = this.entries.length;
    this.entries.push(entry);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!before(entry, this.entries[parent]!)) break;
      this.entries[i] = this.entries[parent]!;
      i = parent;
    }
    this.entries[i] = entry;
  }

  pop(): Entry | undefined {
    const first = this.entries[0];
    const last = this.entries.pop();
    if (this.entries.length === 0 || last === undefined) return first;
    let i = 0;
    while (i * 2 + 1 < this.entries.length) {
      let child = i * 2 + 1;
      if (child + 1 < this.entries.length && before(this.entries[child + 1]!, this.entries[child]!)) child++;
      if (!before(this.entries[child]!, last)) break;
      this.entries[i] = this.entries[child]!;
      i = child;
    }
    this.entries[i] = last;
    return first;
  }
}

export function createWorld(map: VillageMap): WorldApi {
  const { width, height } = map;
  const inBounds = (x: number, y: number): boolean =>
    Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0 && x < width && y < height;
  const isWalkable = (x: number, y: number): boolean => {
    if (!inBounds(x, y)) return false;
    switch (map.tiles[Math.floor(y) * width + Math.floor(x)]) {
      case 'grass': case 'path': case 'bridge': case 'floor': case 'door': case 'field':
        return true;
      default:
        return false;
    }
  };
  const place = (id: string): Place => {
    const result = map.places.find((candidate) => candidate.id === id);
    if (!result) throw new Error(`Unknown place: ${id}`);
    return result;
  };

  return {
    map,
    isWalkable,
    place,
    distance: (a, b) => deterministicHypot(a.x - b.x, a.y - b.y),
    findPath(from, to) {
      if (!isWalkable(from.x, from.y) || !isWalkable(to.x, to.y)) return null;
      const sx = Math.floor(from.x), sy = Math.floor(from.y);
      const tx = Math.floor(to.x), ty = Math.floor(to.y);
      const start = sy * width + sx, goal = ty * width + tx;
      if (start === goal) return [];
      const costs = new Float64Array(width * height).fill(Infinity);
      const parents = new Int32Array(width * height).fill(-1);
      const closed = new Uint8Array(width * height);
      const open = new MinHeap();
      costs[start] = 0;
      open.push({ tile: start, cost: 0, score: Math.abs(tx - sx) + Math.abs(ty - sy) });

      let entry: Entry | undefined;
      while ((entry = open.pop()) !== undefined) {
        const current = entry.tile;
        if (closed[current] || entry.cost !== costs[current]) continue;
        if (current === goal) {
          const result: Vec2[] = [];
          for (let tile = goal; tile !== start; tile = parents[tile]!) {
            result.push({ x: tile % width, y: Math.floor(tile / width) });
          }
          return result.reverse();
        }
        closed[current] = 1;
        const x = current % width, y = Math.floor(current / width);
        // Fixed neighbour order complements the heap's explicit tie-break.
        for (let direction = 0; direction < 4; direction++) {
          const nx = x + (direction === 1 ? -1 : direction === 2 ? 1 : 0);
          const ny = y + (direction === 0 ? -1 : direction === 3 ? 1 : 0);
          if (!isWalkable(nx, ny)) continue;
          // Prefer lanes to trampling gardens. All costs remain >= 1, so the
          // Manhattan heuristic is admissible. Grass remains accessible for visits.
          const terrain = map.tiles[ny * width + nx];
          const stepCost = terrain === 'grass' ? 4 : terrain === 'field' ? 3 : 1;
          const next = ny * width + nx, cost = entry.cost + stepCost;
          if (closed[next] || cost >= costs[next]!) continue;
          costs[next] = cost;
          parents[next] = current;
          open.push({ tile: next, cost, score: cost + Math.abs(tx - nx) + Math.abs(ty - ny) });
        }
      }
      return null;
    },
    lineOfSight(a, b) {
      if (!inBounds(a.x, a.y) || !inBounds(b.x, b.y)) return false;
      let x = Math.floor(a.x), y = Math.floor(a.y);
      const endX = Math.floor(b.x), endY = Math.floor(b.y);
      const dx = Math.abs(endX - x), dy = -Math.abs(endY - y);
      const stepX = x < endX ? 1 : -1, stepY = y < endY ? 1 : -1;
      let error = dx + dy;
      for (;;) {
        const tile = map.tiles[y * width + x];
        if (tile === 'wall' || tile === 'tree') return false;
        if (x === endX && y === endY) return true;
        const doubled = error * 2;
        if (doubled >= dy) { error += dy; x += stepX; }
        if (doubled <= dx) { error += dx; y += stepY; }
      }
    },
    placeAt(pos) {
      // Specific places, such as the well within the square, win overlaps.
      let result: Place | null = null;
      for (const candidate of map.places) {
        const { x, y, w, h } = candidate.rect;
        if (pos.x >= x && pos.x < x + w && pos.y >= y && pos.y < y + h &&
            (!result || w * h < result.rect.w * result.rect.h)) result = candidate;
      }
      return result;
    },
    spotFor(placeId, occupied, rng) {
      const spots = place(placeId).spots;
      if (!spots.length) throw new Error(`Place has no standing spots: ${placeId}`);
      // Spots are tile addresses; occupied positions are interpolated world coordinates.
      const free = spots.filter((spot) =>
        occupied.every((pos) => deterministicHypot(spot.x + 0.5 - pos.x, spot.y + 0.5 - pos.y) >= 0.5));
      // The contract cannot express "no free spot"; fall back to the first spot.
      if (!free.length) return { ...spots[0]! };
      const index = Math.min(free.length - 1, Math.max(0, Math.floor(rng() * free.length)));
      return { ...free[index]! };
    },
  };
}

/** Start is a world position; setPath accepts integer tile addresses from findPath. */
export function createMover(start: Vec2): Mover {
  let path: Vec2[] = [];
  let next = 0;
  let reached = true;
  // Separate route progress from the small visual offset, avoiding sideways drift
  // and preventing a crowded lane from consuming the movement budget forever.
  let route = { ...start };
  return {
    pos: { ...start },
    facing: 's',
    moving: false,
    setPath(tiles) {
      path = tiles.map((tile) => ({ x: tile.x + 0.5, y: tile.y + 0.5 }));
      route = { ...this.pos };
      next = 0;
      while (next < path.length && deterministicHypot(path[next]!.x - route.x, path[next]!.y - route.y) < 1e-9) next++;
      reached = next === path.length;
      this.moving = !reached;
    },
    update(dt, speed, others) {
      if (!this.moving || !Number.isFinite(dt) || !Number.isFinite(speed) || dt <= 0 || speed <= 0) return;
      let budget = dt * speed;
      if (!Number.isFinite(budget)) return;
      let directionX = 0, directionY = 0;
      while (next < path.length && budget > 0) {
        const target = path[next]!;
        const dx = target.x - route.x, dy = target.y - route.y;
        const distance = deterministicHypot(dx, dy);
        if (distance < 1e-9) { next++; continue; }
        directionX = dx / distance;
        directionY = dy / distance;
        this.facing = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'e' : 'w') : (dy >= 0 ? 's' : 'n');
        if (budget >= distance) {
          route = { ...target };
          budget -= distance;
          next++;
        } else {
          route.x += directionX * budget;
          route.y += directionY * budget;
          budget = 0;
        }
      }
      this.pos.x = route.x;
      this.pos.y = route.y;
      if (next === path.length) {
        reached = true;
        this.moving = false;
        return;
      }
      const sideX = -directionY, sideY = directionX;
      let push = 0;
      for (const other of others) {
        const dx = route.x - other.x, dy = route.y - other.y;
        const distance = deterministicHypot(dx, dy);
        if (distance >= 0.6) continue;
        const side = dx * sideX + dy * sideY;
        push += (side < 0 ? -1 : 1) * (1 - distance / 0.6) * 0.15;
      }
      push = Math.max(-0.15, Math.min(0.15, push));
      this.pos.x += sideX * push;
      this.pos.y += sideY * push;
    },
    arrived() { return reached; },
    stop() {
      path = [];
      next = 0;
      this.moving = false;
      // Stopping midway does not claim arrival at the discarded destination.
    },
  };
}
