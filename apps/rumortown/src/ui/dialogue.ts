import { h } from './dom.js';
import { faceImg } from './faces.js';
import type { Exchange, ScriptLine } from './exchanges.js';
import type { Simulation } from '../sim/types.js';

export function createDialogue(sim: () => Simulation, next: () => void, skip: () => void) {
  const title = h('span');
  const face = h('span', { class: 'dialogue-face' });
  const name = h('strong');
  const text = h('p', { class: 'dialogue-line' });
  const topic = h('p', { class: 'dialogue-topic' });
  const el = h('section', { class: 'dialogue', 'aria-label': 'Current exchange', hidden: true },
    h('div', { class: 'dialogue-heading' }, title, h('button', { type: 'button', class: 'text-button', onclick: skip }, 'Skip')),
    topic,
    h('div', { class: 'dialogue-script', 'aria-live': 'polite', 'aria-atomic': 'true' }, face, h('div', null, name, text)),
    h('button', { type: 'button', class: 'text-button dialogue-next', onclick: next }, 'Next'));
  let previous: ScriptLine | undefined;
  const nameOf = (id: string): string => id === 'stranger' ? 'You' : sim().cast.get(id)?.name ?? id;
  return {
    el,
    update(exchange: Exchange | null, line: ScriptLine | undefined, muted: boolean) {
      el.hidden = !exchange || !line || muted;
      if (!exchange || !line) { previous = undefined; return; }
      const listeners = line.listeners?.length ? line.listeners : exchange.people.filter(id => id !== line.speaker);
      title.textContent = `${nameOf(line.speaker)} to ${listeners.map(nameOf).join(', ')}`;
      const claimId = line.claimId ?? exchange.lines.slice(0, exchange.lines.indexOf(line)).reverse().find(item => item.claimId)?.claimId;
      const claim = claimId ? sim().claims.get(claimId) : undefined;
      topic.textContent = claim ? `About: ${claim.text}` : 'In this conversation';
      el.dataset.beat = exchange.id;
      if (previous === line) return;
      previous = line;
      face.replaceChildren(faceImg(line.speaker, sim().cast.get(line.speaker)?.look ?? 'stranger', 32));
      name.textContent = nameOf(line.speaker); text.textContent = line.text;
    },
  };
}
