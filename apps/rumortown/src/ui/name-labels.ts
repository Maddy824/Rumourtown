import type { Vec2, WorldSnapshot } from '../sim/types.js';
import { h } from './dom.js';
import type { BubbleRect } from './bubbles.js';
export const CORE_PEOPLE = ['mira', 'tom', 'ben', 'ada', 'rosa', 'jonah'] as const;
export function labelVisible(id: string, distance: number, bubbleShown: boolean, onScreen: boolean): boolean {
  return onScreen && !bubbleShown && (distance <= 4 || (CORE_PEOPLE as readonly string[]).includes(id));
}
export function createNameLabels(layer: HTMLElement) {
  const labels = new Map<string, HTMLElement>();
  return (snapshot: WorldSnapshot, player: Vec2, project: (p: Vec2) => Vec2, width: number, top: number, bottom: number, bubbles: ReadonlyMap<string, BubbleRect>, muted: boolean): void => {
    for (const v of snapshot.villagers) {
      const p = project(v.pos);
      const visible = !muted && labelVisible(v.id, Math.hypot(v.pos.x - player.x, v.pos.y - player.y), bubbles.has(v.id), p.x > 24 && p.x < width - 24 && p.y > top && p.y < bottom - 20);
      let label = labels.get(v.id);
      if (!label && !visible) continue;
      if (!label) { label = h('span', { class: 'villager-name' }, v.name.split(' ')[0]!); labels.set(v.id, label); layer.append(label); }
      label.hidden = !visible;
      if (!visible) continue;
      const w = label.offsetWidth, hgt = label.offsetHeight;
      label.hidden = [...bubbles.values()].some(b => p.x - w / 2 < b.x + b.w && p.x + w / 2 > b.x && p.y + 5 < b.y + b.h && p.y + 5 + hgt > b.y);
      label.style.transform = `translate(${Math.round(p.x - w / 2)}px, ${Math.round(p.y + 5)}px)`;
    }
  };
}
