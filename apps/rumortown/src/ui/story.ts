/** The paper story rail reads the same event stream as timeline pins. */
import type { createExchanges } from './exchanges.js';
import type { SimEvent, Simulation, ThreadLink } from '../sim/types.js';
import { eventKey, newestStoryEntries, playerStoryEvents, storyBeat } from './story-beats.js';
import { h } from './dom.js';
import { faceImg } from './faces.js';
import { ENDING_TITLE, sentence, tickLabel } from './format.js';
import { closeIcon } from './icons.js';
import type { Layers } from './layers.js';
export interface StoryContext {
  sim: () => Simulation; dare?: string; layers: Layers;
  isPhone: () => boolean; reducedMotion: () => boolean;
  onShow: (ids: readonly string[]) => void;
  onFollow?: () => void;
  onOpenChange: (open: boolean) => void;
  history: () => readonly ThreadLink[];
  exchanges?: () => ReturnType<typeof createExchanges>;
}
export function createStory(ctx: StoryContext) {
  const list = h('ol', { class: 'log', 'aria-label': 'Story beats, newest first' });
  const chain = h('nav', { class: 'chain-strip', 'aria-label': 'Rumor transmission chain', hidden: true });
  const empty = h('p', { class: 'log-empty' }, 'Whisper something and watch the agents react.');
  const choose = h('select', { 'aria-label': 'Rumor to follow', class: 'chain-choose', hidden: true });
  const endingSlot = h('div', { class: 'rail-ending' });
  const dare = ctx.dare ? h('p', { class: 'story-dare' }, `Your dare: ${ctx.dare}`) : null;
  const villageToggle = h('button', { type: 'button', class: 'button button-quiet village-stories', 'aria-pressed': 'false', onclick: () => {
    village = !village; villageToggle.setAttribute('aria-pressed', String(village)); render();
  } }, 'Include village stories');
  const scroller = h('div', { class: 'drawer-scroll' }, endingSlot, villageToggle, choose, chain, empty, list);
  const expand = h('button', { class: 'text-button rail-expand', type: 'button', 'aria-expanded': 'false', onclick: () => api.setFull(el.dataset.full !== 'true') }, 'Expand');
  const paper = h('div', { class: 'drawer-paper card-ruled' },
    h('header', { class: 'drawer-head' }, h('div', { class: 'rail-heading' }, h('h2', { id: 'rt-story-title', class: 'drawer-title', tabindex: '-1' }, 'What’s happening'), expand,
      h('button', { class: 'close', type: 'button', 'aria-label': 'Close the story', onclick: () => api.close() }, closeIcon())), dare),
    scroller);
  const el = h('section', { class: 'drawer story', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'rt-story-title', hidden: true }, paper);
  let village = false;
  let events: SimEvent[] = [], open = false, selected = '', chainKey = '', optionsKey = '';
  const expanded = new Set<string>();
  let handle: HTMLElement | undefined, home: HTMLElement | undefined;
  const face = (id: string, size = 28): HTMLImageElement => faceImg(id, ctx.sim().cast.get(id)?.look ?? 'stranger', size);
  function row(e: SimEvent): HTMLElement {
    const exchange = ctx.exchanges?.().byEvent.get(eventKey(e));
    const beat = storyBeat(e, ctx.sim()) ?? exchange?.beat;
    const script = exchange ? h('details', { class: 'beat-script' }, h('summary', null, 'Read the exchange'), ...exchange.lines.map(line => h('p', null, h('strong', null, `${line.speaker === 'stranger' ? 'You' : ctx.sim().cast.get(line.speaker)?.name ?? line.speaker}: `), line.text))) : null;
    if (script && exchange) {
      script.open = expanded.has(exchange.id);
      script.addEventListener('toggle', () => { if (script.open) expanded.add(exchange.id); else expanded.delete(exchange.id); });
    }
    const content = beat?.text ?? (e.kind === 'day-end' ? `End of day ${e.dayIndex + 1}: ${ENDING_TITLE[e.ending]}. ${sentence(e.summary)}` : '');
    return h('li', { class: 'log-entry beat-card', 'data-event': eventKey(e), 'data-kind': e.kind },
      h('time', null, tickLabel(e.tick)),
      beat ? h('div', { class: 'beat-faces' }, beat.faces.map(id => face(id))) : null,
      h('p', null, sentence(content)),
      beat ? h('button', { type: 'button', class: 'text-button', onclick: () => ctx.onShow(beat.faces) }, 'Show me') : null, script);
  }
  function render(): void {
    const active = document.activeElement;
    const focusedKey = active instanceof HTMLElement && list.contains(active) ? active.closest<HTMLElement>('[data-event]')?.dataset.event : undefined;
    const oldTop = list.firstElementChild;
    const before = oldTop?.getBoundingClientRect().top;
    const stick = scroller.scrollTop < 8;
    const history = ctx.exchanges?.();
    const own = playerStoryEvents(events, ctx.sim());
    const seen = new Set<string>();
    const candidates = history ? events.filter(e => e.kind === 'day-end' || storyBeat(e, ctx.sim()) ||
      history.byEvent.get(eventKey(e))?.beat.event === e).reverse() : newestStoryEntries(events, ctx.sim());
    const entries = candidates.filter(e => village || own.has(e)).filter(e => {
      const exchange = history?.byEvent.get(eventKey(e));
      if (!exchange) return true;
      if (seen.has(exchange.id)) return false;
      seen.add(exchange.id); return true;
    });
    list.replaceChildren(...entries.map(row));
    empty.hidden = list.childElementCount > 0;
    api.updateChain();
    if (focusedKey) {
      const target = Array.from(list.children).find(row => (row as HTMLElement).dataset.event === focusedKey);
      target?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
    }
    if (stick) scroller.scrollTop = 0;
    else if (oldTop && before !== undefined) {
      const retained = Array.from(list.children).find(row => (row as HTMLElement).dataset.event === (oldTop as HTMLElement).dataset.event);
      if (retained) scroller.scrollTop += retained.getBoundingClientRect().top - before;
    }
  }
  choose.addEventListener('change', () => { selected = choose.value; chainKey = ''; api.updateChain(); ctx.onFollow?.(); });
  const api = {
    el, endingSlot,
    includesVillage: () => village,
    setFull(full: boolean) { el.dataset.full = String(full); expand.textContent = full ? 'Lower' : 'Expand'; expand.setAttribute('aria-expanded', String(full)); },
    showEnding() { scroller.scrollTop = 0; },
    selectedClaim: () => selected,
    chainPeople: (): ReadonlySet<string> => new Set(ctx.history().filter(t => t.claimId === selected).flatMap(t => [t.from, t.to])),
    focus(claimId: string) { selected = claimId; chainKey = ''; api.updateChain(); },
    updateChain() {
      const whispers = events.filter(e => e.kind === 'whisper');
      choose.hidden = chain.hidden = !whispers.length;
      if (!whispers.length) { selected = ''; chain.replaceChildren(); return; }
      const history = ctx.history();
      const ids = [...new Set([...whispers.map(e => e.claimId), ...history.map(t => t.claimId)])];
      if (!ids.includes(selected)) selected = whispers.at(-1)!.claimId;
      choose.hidden = ids.length < 2;
      const nextOptions = ids.join('|');
      if (nextOptions !== optionsKey) { optionsKey = nextOptions; choose.replaceChildren(...ids.map(id => h('option', { value: id }, ctx.sim().claims.get(id)?.text ?? 'A village rumor'))); }
      choose.value = selected;
      const links = history.filter(t => t.claimId === selected);
      // Show both ends of a branch, so the strip never implies a telling that did not happen.
      const route: string[] = [];
      for (const link of links) {
        if (route.length && route.at(-1) !== link.from) route.push('|');
        if (route.at(-1) !== link.from) route.push(link.from);
        route.push(link.to);
      }
      if (!route.length) { const first = whispers.find(e => e.claimId === selected); if (first) route.push('stranger', first.listener); }
      const key = `${selected}/${route.join('/')}`;
      if (key === chainKey) return;
      chainKey = key;
      const focusedIndex = chain.contains(document.activeElement) ? Array.from(chain.querySelectorAll('button')).indexOf(document.activeElement as HTMLButtonElement) : -1;
      chain.replaceChildren(...route.flatMap((id, index) => {
        if (id === '|') return [h('span', { class: 'chain-branch', 'aria-label': 'Another telling' }, ' / ')];
        const name = id === 'stranger' ? 'The stranger' : ctx.sim().cast.get(id)?.name ?? id;
        return [index && route[index - 1] !== '|' ? h('span', { class: 'chain-arrow', 'aria-hidden': 'true' }, '→') : h('span'),
          h('button', { type: 'button', class: 'chain-person', onclick: () => ctx.onShow([id]), 'aria-label': `Find ${name}` }, face(id, 32), h('span', null, name))];
      }));
      if (focusedIndex >= 0) chain.querySelectorAll<HTMLElement>('button')[focusedIndex]?.focus({ preventScroll: true });
    },
    setHandle(bar: HTMLElement, parent: HTMLElement) { handle = bar; home = parent; api.layout(); },
    layout() { if (!handle || !home) return; if (open && ctx.isPhone()) paper.prepend(handle); else home.append(handle); },
    push(fresh: readonly SimEvent[]) {
      events.push(...fresh);
      if (open && fresh.some(e => e.kind === 'day-end' || storyBeat(e, ctx.sim()) || ctx.exchanges?.().byEvent.has(eventKey(e)))) render();
      else api.updateChain();
    },
    reset(all: readonly SimEvent[]) { events = [...all]; expanded.clear(); chainKey = optionsKey = ''; if (open) render(); else api.updateChain(); },
    open(opener?: Element | null) {
      if (open) return;
      open = true; render(); el.hidden = false; el.dataset.open = 'true'; api.layout();
      ctx.layers.open({ id: 'story', el, modal: false, close: () => api.close() }, opener);
      ctx.onOpenChange(true);
      const title = el.querySelector<HTMLElement>('.drawer-title');
      (ctx.isPhone() ? handle?.querySelector<HTMLElement>('button') ?? title : title)?.focus({ preventScroll: true });
    },
    openAt(event: SimEvent, opener?: Element | null) {
      api.open(opener);
      const target = Array.from(list.children).find(row => (row as HTMLElement).dataset.event === eventKey(event)) as HTMLElement | undefined;
      if (target) { target.scrollIntoView({ block: 'nearest' }); target.tabIndex = -1; target.focus({ preventScroll: true }); }
    },
    close() {
      if (!open) return;
      open = false; api.setFull(false); el.hidden = true; delete el.dataset.open; api.layout(); ctx.layers.closed('story'); ctx.onOpenChange(false);
    },
    isOpen: () => open,
    cover: () => open && ctx.isPhone() ? el.offsetHeight : 0,
  };
  return api;
}
