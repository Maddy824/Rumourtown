import { BODY, CORE_SCALE } from '../render/sprites.js';
import type { Vec2 } from '../sim/types.js';
/** Project both world positions so the renderer owns the scale, including the legacy close request. */
export const headAnchor = (pos: Vec2, project: (p: Vec2) => Vec2, lift = -BODY.top): Vec2 => project({ x: pos.x, y: pos.y - lift });
export const projectedTile = (pos: Vec2, project: (p: Vec2) => Vec2): number => Math.abs(project({ x: pos.x + 1, y: pos.y }).x - project(pos).x);

export const headLift = (core: boolean): number => -BODY.top * (core ? CORE_SCALE : 1);
