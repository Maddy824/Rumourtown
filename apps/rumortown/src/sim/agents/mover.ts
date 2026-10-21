/**
 * A fallback Mover. The world module exports its own `createMover`, but `WorldApi` does not
 * carry it, so the engine uses `opts.world.createMover` when the world object offers one and
 * this otherwise. Start is a world position; paths are integer tile addresses.
 */
import type { Mover, Vec2 } from '../types.js';

export function createMover(start: Vec2): Mover {
  let path: Vec2[] = [];
  let next = 0;
  let reached = true;
  const mover: Mover = {
    pos: { x: start.x, y: start.y },
    facing: 's',
    moving: false,
    setPath(tiles) {
      path = tiles.map((t) => ({ x: t.x + 0.5, y: t.y + 0.5 }));
      next = 0;
      while (next < path.length && Math.hypot(path[next]!.x - mover.pos.x, path[next]!.y - mover.pos.y) < 1e-9) next++;
      reached = next >= path.length;
      mover.moving = !reached;
    },
    update(dt, speed, others) {
      if (reached || dt <= 0 || speed <= 0) return;
      let budget = dt * speed;
      let dirX = 0;
      let dirY = 0;
      while (next < path.length && budget > 0) {
        const target = path[next]!;
        const dx = target.x - mover.pos.x;
        const dy = target.y - mover.pos.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 1e-9) {
          next++;
          continue;
        }
        dirX = dx / distance;
        dirY = dy / distance;
        mover.facing = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'e' : 'w') : dy >= 0 ? 's' : 'n';
        if (budget >= distance) {
          mover.pos.x = target.x;
          mover.pos.y = target.y;
          budget -= distance;
          next++;
        } else {
          mover.pos.x += dirX * budget;
          mover.pos.y += dirY * budget;
          budget = 0;
        }
      }
      if (next >= path.length) {
        reached = true;
        mover.moving = false;
        return;
      }
      // Light separation: neighbours within 0.6 tiles push sideways by up to 0.15 tiles.
      const sideX = -dirY;
      const sideY = dirX;
      let push = 0;
      for (const o of others) {
        const dx = mover.pos.x - o.x;
        const dy = mover.pos.y - o.y;
        const d = Math.hypot(dx, dy);
        if (d >= 0.6) continue;
        const side = dx * sideX + dy * sideY;
        push += (side < 0 ? -1 : 1) * (1 - d / 0.6) * 0.15;
      }
      push = Math.max(-0.15, Math.min(0.15, push));
      mover.pos.x += sideX * push;
      mover.pos.y += sideY * push;
    },
    arrived() {
      return reached;
    },
    stop() {
      path = [];
      next = 0;
      reached = true;
      mover.moving = false;
    },
  };
  return mover;
}
