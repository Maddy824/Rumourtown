import { h } from './dom.js';
import { faceImg } from './faces.js';
import type { Exchange, ScriptLine } from './exchanges.js';
import type { Simulation } from '../sim/types.js';

export function createDialogue(sim: () => Simulation, next: () => void, skip: () => void) {
  const title = h('span');
  const face = h('span', { class: 'dialogue-face' });
  const name = h('strong');
  const text = h('p', { class: 'dialogue-line' });
  const el = h('section', { class: 'dialogue', 'aria-label': 'Current exchange', hidden: true },
    h('div', { class: 'dialogue-heading' }, title, h('button', { type: 'button', class: 'text-button', onclick: skip }, 'Skip')),
    h('div', { class: 'dialogue-script', 'aria-live': 'polite', 'aria-atomic': 'true' }, face, h('div', null, name, text)),
    h('button', { type: 'button', class: 'text-button dialogue-next', onclick: next }, 'Next'));
  let previous: ScriptLine | undefined;
  const nameOf = (id: string): string => id === 'stranger' ? 'You' : sim().cast.get(id)?.name ?? id;
  return {
    el,
    update(exchange: Exchange | null, line: ScriptLine | undefined, muted: boolean) {
      el.hidden = !exchange || !line || muted;
      if (!exchange || !line) { previous = undefined; return; }
      title.textContent = `Watching ${nameOf(exchange.people[0])} tell ${nameOf(exchange.people[1])}`;
      el.dataset.beat = exchange.id;
      if (previous === line) return;
      previous = line;
      face.replaceChildren(faceImg(line.speaker, sim().cast.get(line.speaker)?.look ?? 'stranger', 32));
      name.textContent = nameOf(line.speaker); text.textContent = line.text;
    },
  };
}
