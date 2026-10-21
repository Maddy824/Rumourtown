import type { Vec2 } from '../sim/types.js';
import { districtAt, districtViews, type DistrictId } from '../content/map/wayfinding.js';

/** Track entries even during the quiet opening, so a delayed banner never appears. */
export function createDistrictTrigger(startedAt: number) {
  let previous: DistrictId | undefined;
  return (pos: Vec2, now: number): string | null => {
    const next = districtAt(pos);
    const entered = previous !== undefined && next !== previous;
    previous = next;
    return entered && now - startedAt >= 10_000 ? districtViews.find(d => d.id === next)!.name : null;
  };
}
