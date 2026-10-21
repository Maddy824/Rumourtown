import type { Vec2, WorldSnapshot } from '../sim/types.js';
import { h } from './dom.js';
import type { BubbleRect } from './bubbles.js';
export const CORE_PEOPLE = ['mira', 'tom', 'ben', 'ada', 'rosa', 'jonah'] as const;
export interface LabelRules { phone?: boolean; focus?: boolean; chain?: ReadonlySet<string>; spotlight?: readonly string[] }
export function labelVisible(id: string, distance: number, bubbleShown: boolean, onScreen: boolean, rules: LabelRules = {}): boolean {
  if (!onScreen || bubbleShown) return false;
  const chain = rules.chain?.has(id) ?? false;
  const core = (CORE_PEOPLE as readonly string[]).includes(id);
  if (rules.phone) return chain || (distance <= 3 && (!rules.focus || core));
  return rules.focus ? chain || core : distance <= 4 || core;
}
export function createNameLabels(layer: HTMLElement) {
  const labels = new Map<string, HTMLElement>();
  return (snapshot: WorldSnapshot, player: Vec2, project: (p: Vec2) => Vec2, width: number, top: number, bottom: number, bubbles: ReadonlyMap<string, BubbleRect>, muted: boolean, rules: LabelRules = {}): void => {
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    const order = [...snapshot.villagers].sort((a, b) => Number(rules.chain?.has(b.id) ?? 0) - Number(rules.chain?.has(a.id) ?? 0) ||
      Math.hypot(a.pos.x - player.x, a.pos.y - player.y) - Math.hypot(b.pos.x - player.x, b.pos.y - player.y));
    for (const v of order) {
      const p = project(v.pos);
      const visible = !muted && labelVisible(v.id, Math.hypot(v.pos.x - player.x, v.pos.y - player.y), bubbles.has(v.id), p.x > 24 && p.x < width - 24 && p.y > top && p.y < bottom - 20, rules);
      let label = labels.get(v.id);
      if (!label && !visible) continue;
      if (!label) { label = h('span', { class: 'villager-name' }, v.name.split(' ')[0]!); labels.set(v.id, label); layer.append(label); }
      label.hidden = !visible;
      label.style.opacity = rules.spotlight?.length && !rules.spotlight.includes(v.id) ? ".4" : "1";
      if (!visible) continue;
      const w = label.offsetWidth, hgt = label.offsetHeight;
      const box = { x: p.x - w / 2 - 2, y: p.y + 5, w: w + 4, h: hgt + 2 };
      const hits = (b: { x: number; y: number; w: number; h: number }) => box.x < b.x + b.w && box.x + box.w > b.x && box.y < b.y + b.h && box.y + box.h > b.y;
      label.hidden = [...bubbles.values()].some(hits) || placed.some(hits);
      if (!label.hidden) placed.push(box);
      label.style.transform = `translate(${Math.round(p.x - w / 2)}px, ${Math.round(p.y + 5)}px)`;
    }
  };
}
