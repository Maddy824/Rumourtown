import type { Vec2, WorldSnapshot } from '../sim/types.js';
/** Join visible participants into conversations before choosing the three closest spotlights. */
export function conversationGroups(snapshot: WorldSnapshot, player: Vec2): { ids: Set<string>; distance: number }[] {
  const active = snapshot.villagers.filter(v => v.activity === 'talk');
  const parent = new Map(active.map(v => [v.id, v.id]));
  const root = (id: string): string => {
    let next = id;
    while (parent.get(next) && parent.get(next) !== next) next = parent.get(next)!;
    return next;
  };
  const join = (a: string, b: string): void => {
    if (!parent.has(a)) parent.set(a, a);
    if (!parent.has(b)) parent.set(b, b);
    parent.set(root(b), root(a));
  };
  for (const v of active) {
    if (v.bubble?.to && v.bubble.untilTick > snapshot.tick) join(v.id, v.bubble.to);
    for (const other of active) {
      if (v.id !== other.id && Math.hypot(v.pos.x - other.pos.x, v.pos.y - other.pos.y) <= 2) join(v.id, other.id);
    }
  }
  const groups = new Map<string, { ids: Set<string>; distance: number }>();
  for (const v of snapshot.villagers) {
    if (!parent.has(v.id)) continue;
    const id = root(v.id);
    let group = groups.get(id);
    if (!group) { group = { ids: new Set(), distance: Infinity }; groups.set(id, group); }
    group.ids.add(v.id);
    group.distance = Math.min(group.distance, Math.hypot(v.pos.x - player.x, v.pos.y - player.y));
  }
  return [...groups.values()].sort((a, b) => a.distance - b.distance);
}
