import type { RumorPack } from '../content/rumor-packs/registry.js';
import type { GameClaim } from '../sim/types.js';
import { h } from './dom.js';

/** One story at a time, with a separate choice before a whisper is sent. */
export function createRumorLibrary(packs: RumorPack[], choose: (claim: GameClaim) => void): HTMLElement {
  const theme = h('select', { class: 'rumor-library-theme', 'aria-label': 'Story collection' },
    packs.map(pack => h('option', { value: pack.id }, pack.title)));
  const story = h('select', { class: 'rumor-library-story', 'aria-label': 'Rumor idea' });
  const preview = h('p', { class: 'rumor-library-preview', role: 'status' });
  const use = h('button', { type: 'button', class: 'button button-quiet rumor-library-use', onclick: () => {
    const claim = packs.find(pack => pack.id === theme.value)?.stories.find(item => item.id === story.value)?.claim;
    if (claim) choose(claim);
  } }, 'Choose this rumor');
  const show = () => {
    const claim = packs.find(pack => pack.id === theme.value)?.stories.find(item => item.id === story.value)?.claim;
    preview.textContent = claim?.text ?? 'No stories in this collection.';
    use.disabled = !claim;
  };
  const collection = () => {
    const stories = packs.find(pack => pack.id === theme.value)?.stories ?? [];
    story.replaceChildren(...stories.map((item, i) => h('option', { value: item.id },
      `${i + 1}. About ${item.claim.text.split(' ')[0]}`)));
    story.value = stories[0]?.id ?? '';
    show();
  };
  theme.value = packs[0]?.id ?? '';
  theme.addEventListener('change', collection);
  story.addEventListener('change', show);
  collection();
  return h('details', { class: 'whisper-suggestions rumor-library' }, h('summary', null, 'Browse the rumor library'),
    h('p', { class: 'sheet-note' }, 'Saved stories for everyone. Choosing and spreading one uses no AI credits.'),
    h('div', { class: 'rumor-library-fields' }, h('label', null, 'Collection', theme), h('label', null, 'Story', story)),
    preview, use);
}
