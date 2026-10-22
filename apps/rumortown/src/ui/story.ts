/** The paper story rail reads the same event stream as timeline pins. */
import type { createExchanges } from './exchanges.js';
import type { SimEvent, Simulation, ThreadLink } from '../sim/types.js';
import { eventKey, newestStoryEntries, selectedStoryEvents, storyBeat } from './story-beats.js';
import { h } from './dom.js';
import { focusedScript } from './exchanges.js';
import { heardSinceWhisper, sinceFirstWhisper } from './rumor-trail.js';
import { faceImg } from './faces.js';
import { ENDING_TITLE, sentence, tickLabel } from './format.js';
import { closeIcon } from './icons.js';
import type { Layers } from './layers.js';
export interface StoryContext {
  sim: () => Simulation; dare?: string; layers: Layers;
  isPhone: () => boolean; reducedMotion: () => boolean;
  onShow: (ids: readonly string[]) => void;
  onFollow?: () => void;
  onWhisper?: () => void;
  onResume?: () => void;
  paused?: () => boolean;
  onOpenChange: (open: boolean) => void;
  history: () => readonly ThreadLink[];
  exchanges?: () => ReturnType<typeof createExchanges>;
}
export function createStory(ctx: StoryContext) {
  const list = h('ol', { class: 'log latest-moments', 'aria-label': 'Three newest moments' });
  const older = h('ol', { class: 'log earlier-moments', 'aria-label': 'Earlier moments, newest first' });
  const chain = h('nav', { class: 'chain-strip', 'aria-label': 'Who told whom', hidden: true });
  const empty = h('p', { class: 'log-empty' }, 'You haven’t whispered yet. Later tellings and replies will appear here.');
  const start = h('button', { type: 'button', class: 'button button-primary', onclick: () => ctx.onWhisper?.() }, 'Start a rumor');
  const claimText = h('p', { class: 'selected-rumor' });
  const heard = h('p', { class: 'heard-count', role: 'status' });
  const waiting = h('p', { class: 'rumor-waiting' });
  const resume = h('button', { type: 'button', class: 'button button-quiet', hidden: true, onclick: () => ctx.onResume?.() }, 'Resume village');
  const watchingSlot = h('div', { class: 'watching-options' });
  const choose = h('select', { 'aria-label': 'Rumor to follow', class: 'chain-choose', hidden: true });
  const endingSlot = h('div', { class: 'rail-ending' });
  const challenge = ctx.dare ? h('details', null, h('summary', null, 'Optional challenge'), h('p', { class: 'story-dare' }, ctx.dare)) : null;
  const villageToggle = h('button', { type: 'button', class: 'button button-quiet village-stories', 'aria-pressed': 'false', onclick: () => {
    village = !village; villageToggle.setAttribute('aria-pressed', String(village)); render();
  } }, 'All village stories');
  const detail = h('details', { class: 'story-detail' }, h('summary', null, 'More detail'),
    h('label', null, 'Rumor', choose), villageToggle, older, challenge,
    h('details', null, h('summary', null, 'Who told whom'), h('p', null, 'Each pair shows a telling. Hearing is not believing.'), chain),
    h('details', null, h('summary', null, 'Watching options'), watchingSlot));
  const scroller = h('div', { class: 'drawer-scroll' }, endingSlot, claimText, heard, empty, start, list, waiting, resume, detail);
  const expand = h('button', { class: 'text-button rail-expand', type: 'button', 'aria-expanded': 'false', onclick: () => api.setFull(el.dataset.full !== 'true') }, 'Expand');
  const paper = h('div', { class: 'drawer-paper card-ruled' },
    h('header', { class: 'drawer-head' }, h('div', { class: 'rail-heading' }, h('h2', { id: 'rt-story-title', class: 'drawer-title', tabindex: '-1' }, 'Your latest rumor'), expand,
      h('button', { class: 'close', type: 'button', 'aria-label': 'Close rumors', onclick: () => api.close() }, closeIcon()))), scroller);
  const el = h('section', { class: 'drawer story', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'rt-story-title', hidden: true }, paper);
  let village = false;
  let events: SimEvent[] = [], open = false, selected = '', chainKey = '', optionsKey = '';
  const expanded = new Set<string>();
  let handle: HTMLElement | undefined, home: HTMLElement | undefined;
  const face = (id: string, size = 28): HTMLImageElement => faceImg(id, ctx.sim().cast.get(id)?.look ?? 'stranger', size);
  function row(e: SimEvent): HTMLElement {
    const exchange = ctx.exchanges?.().byEvent.get(eventKey(e));
    const beat = storyBeat(e, ctx.sim()) ?? exchange?.beat;
    const lines = exchange ? focusedScript(exchange, village ? '' : selected, ctx.sim().claims) : [];
    const reply = e.kind === 'line' ? e : e.kind === 'whisper' ? [...lines].reverse().find(line =>
      line.act === 'reactToWhisper' && line.claimId === e.claimId && line.speaker === e.listener) : undefined;
    const script = exchange ? h('details', { class: 'beat-script' }, h('summary', null, 'Read the exchange'), ...lines.map(line => h('p', null, h('strong', null, `${line.speaker === 'stranger' ? 'You' : ctx.sim().cast.get(line.speaker)?.name ?? line.speaker}: `), line.text))) : null;
    if (script && exchange) {
      script.open = expanded.has(exchange.id);
      script.addEventListener('toggle', () => { if (script.open) expanded.add(exchange.id); else expanded.delete(exchange.id); });
    }
    const content = reply?.act === 'reactToWhisper' ? `You told ${ctx.sim().cast.get(reply.speaker)?.name ?? reply.speaker}: “${ctx.sim().claims.get(reply.claimId ?? selected)?.text ?? reply.text}”`
      : beat?.text ?? (e.kind === 'day-end' ? `End of day ${e.dayIndex + 1}: ${ENDING_TITLE[e.ending]}. ${sentence(e.summary)}` : '');
    return h('li', { class: 'log-entry beat-card', 'data-event': eventKey(e), 'data-kind': e.kind },
      h('time', null, tickLabel(e.tick)),
      beat ? h('div', { class: 'beat-faces' }, beat.faces.map(id => face(id))) : null,
      h('p', null, sentence(content)),
      reply ? h('blockquote', { class: 'recorded-reply' }, h('strong', null, `${ctx.sim().cast.get(reply.speaker)?.name ?? reply.speaker}: `), reply.text) : null,
      reply?.act === 'reactToWhisper' ? h('p', { class: 'hearing-note' }, ctx.sim().cast.get(reply.speaker)?.pronouns.subject === 'he' ? 'He heard it. That doesn’t mean he believes it.' : ctx.sim().cast.get(reply.speaker)?.pronouns.subject === 'she' ? 'She heard it. That doesn’t mean she believes it.' : 'They heard it. That doesn’t mean they believe it.') : null,
      beat ? h('button', { type: 'button', class: 'text-button', onclick: () => ctx.onShow(beat.faces) }, 'Find them') : null, script);
  }
  function render(): void {
    const active = document.activeElement;
    const focusedKey = active instanceof HTMLElement && scroller.contains(active) ? active.closest<HTMLElement>('[data-event]')?.dataset.event : undefined;
    const oldTop = list.firstElementChild;
    const before = oldTop?.getBoundingClientRect().top;
    const stick = scroller.scrollTop < 8;
    const history = ctx.exchanges?.();
    api.updateChain();
    const own = selectedStoryEvents(events, ctx.sim(), selected);
    const seen = new Set<string>();
    const candidates = history ? events.filter(e => e.kind === 'day-end' || storyBeat(e, ctx.sim()) ||
      history.byEvent.get(eventKey(e))?.beat.event === e).reverse() : newestStoryEntries(events, ctx.sim());
    const entries = candidates.filter(e => village || own.has(e)).filter(e => {
      const exchange = history?.byEvent.get(eventKey(e));
      if (!exchange) return true;
      if (seen.has(exchange.id)) return false;
      seen.add(exchange.id); return true;
    });
    // Your own telling, with the listener's reply, stays on top; then the newest moments.
    // With recorded exchanges the telling appears as the listener's reaction line rather than the whisper event.
    const yours = village ? undefined : entries.find(e => (e.kind === 'whisper' && e.claimId === selected) ||
      (e.kind === 'line' && e.act === 'reactToWhisper' && e.claimId === selected));
    const ordered = yours ? [yours, ...entries.filter(e => e !== yours)] : entries;
    list.replaceChildren(...ordered.slice(0, 3).map(row));
    older.replaceChildren(...ordered.slice(3).map(row));
    const whispered = events.some(e => e.kind === 'whisper' && e.claimId === selected);
    empty.hidden = entries.length > 0;
    empty.textContent = selected ? 'No recorded moments for this rumor yet.' : 'You haven’t whispered yet. Later tellings and replies will appear here.';
    start.hidden = whispered || village;
    claimText.textContent = selected ? ctx.sim().claims.get(selected)?.text ?? 'A village rumor' : '';
    claimText.hidden = !selected || village;
    el.querySelector<HTMLElement>('.drawer-title')!.textContent = village ? 'All village stories' : selected === events.filter(e => e.kind === 'whisper').at(-1)?.claimId ? 'Your latest rumor' : 'Rumors';
    api.updateJourney();
    if (focusedKey) {
      const target = Array.from(scroller.querySelectorAll<HTMLElement>('[data-event]')).find(row => row.dataset.event === focusedKey);
      const control = target?.querySelector<HTMLElement>(active?.tagName.toLowerCase() ?? 'button');
      (control ?? target)?.focus({ preventScroll: true });
    }
    if (stick) scroller.scrollTop = 0;
    else if (oldTop && before !== undefined) {
      const retained = Array.from(list.children).find(row => (row as HTMLElement).dataset.event === (oldTop as HTMLElement).dataset.event);
      if (retained) scroller.scrollTop += retained.getBoundingClientRect().top - before;
    }
  }
  choose.addEventListener('change', () => { selected = choose.value; village = false; villageToggle.setAttribute('aria-pressed', 'false'); chainKey = ''; render(); ctx.onFollow?.(); });
  const api = {
    el, endingSlot, watchingSlot,
    includesVillage: () => village,
    setFull(full: boolean) { el.dataset.full = String(full); expand.textContent = full ? 'Lower' : 'Expand'; expand.setAttribute('aria-expanded', String(full)); },
    showEnding() { scroller.scrollTop = 0; },
    selectedClaim: () => selected,
    chainPeople: (): ReadonlySet<string> => new Set(ctx.history().filter(t => t.claimId === selected).flatMap(t => [t.from, t.to])),
    focus(claimId: string) { selected = claimId; chainKey = ''; if (open) render(); else api.updateChain(); },
    present(claimId: string, opener?: Element | null) {
      selected = claimId; village = false; detail.open = false; chainKey = '';
      villageToggle.setAttribute('aria-pressed', 'false');
      if (open) render(); else api.open(opener);
      scroller.scrollTop = 0;
    },
    updateJourney() {
      if (!open) return;
      const whispered = events.some(e => e.kind === 'whisper' && e.claimId === selected);
      const count = heardSinceWhisper(ctx.history(), selected);
      heard.textContent = `Heard by ${count} ${count === 1 ? 'person' : 'people'} since your whisper`;
      heard.hidden = !whispered || village;
      waiting.hidden = !whispered || village || sinceFirstWhisper(ctx.history(), selected).some(link => link.from !== 'stranger');
      waiting.textContent = 'Waiting to see whether someone passes it on. Later tellings and replies appear here in Rumors.';
      resume.hidden = !ctx.paused?.();
    },
    refresh() { if (open) render(); },
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
        const name = id === 'stranger' ? 'You' : ctx.sim().cast.get(id)?.name ?? id;
        return [index && route[index - 1] !== '|' ? h('span', { class: 'chain-arrow', 'aria-hidden': 'true' }, '→') : h('span'),
          h('button', { type: 'button', class: 'chain-person', onclick: () => ctx.onShow([id]), 'aria-label': `Find ${name}` }, face(id, 32), h('span', null, name))];
      }));
      if (focusedIndex >= 0) chain.querySelectorAll<HTMLElement>('button')[focusedIndex]?.focus({ preventScroll: true });
    },
    setHandle(bar: HTMLElement, parent: HTMLElement) { handle = bar; home = parent; api.layout(); },
    layout() { if (!handle || !home) return; home.append(handle); handle.hidden = open; },
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
      el.querySelector<HTMLElement>('.drawer-title')?.focus({ preventScroll: true });
    },
    openAt(event: SimEvent, opener?: Element | null) {
      api.open(opener);
      detail.open = true;
      const target = Array.from(scroller.querySelectorAll<HTMLElement>('[data-event]')).find(row => (row as HTMLElement).dataset.event === eventKey(event)) as HTMLElement | undefined;
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
