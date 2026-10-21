/**
 * "Story so far": the transcript as a ruled index card. Lines, witnessed acts, the stranger's whispers and
 * each evening's summary, grouped by day. Names open that villager's tag.
 */
import type { SimEvent, Simulation, VillagerId } from '../sim/types.js';
import { conceal, h, reveal } from './dom.js';
import { ENDING_TITLE, RUMOR_ACTS, actVerb, dayIndexOfTick, listNames, sentence, tickClock } from './format.js';
import { closeIcon } from './icons.js';
import type { Layers } from './layers.js';

export interface StoryContext {
  sim: () => Simulation;
  layers: Layers;
  reducedMotion: () => boolean;
  isPhone: () => boolean;
  onSelect: (id: VillagerId) => void;
  onOpenChange: (open: boolean) => void;
}

export interface Story {
  readonly el: HTMLElement;
  push(events: readonly SimEvent[]): void;
  reset(events: readonly SimEvent[]): void;
  open(opener?: Element | null): void;
  close(): void;
  isOpen(): boolean;
  cover(): number;
}

type Entry = Extract<SimEvent, { kind: 'line' | 'witness' | 'whisper' | 'day-end' }>;

const PAGE = 250;

export function createStory(ctx: StoryContext): Story {
  const list = h('ol', { class: 'log', 'aria-label': 'Story so far' });
  const earlier = h('button', { class: 'text-button log-earlier', type: 'button', hidden: true }, 'Show earlier');
  const emptyNote = h('p', { class: 'log-empty' }, 'Nothing has happened yet. Give it a minute.');
  const onlyRumor = h('input', { type: 'checkbox', class: 'switch-input' });
  const scroller = h('div', { class: 'drawer-scroll' }, earlier, emptyNote, list);
  const el = h('section', { class: 'drawer story', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'rt-story-title', hidden: true },
    h('div', { class: 'drawer-paper card-ruled' },
      h('header', { class: 'drawer-head' },
        h('h2', { id: 'rt-story-title', class: 'drawer-title' }, 'Story so far'),
        h('label', { class: 'switch' }, onlyRumor, h('span', { class: 'switch-track', 'aria-hidden': 'true' }), h('span', null, 'Only the rumor')),
        h('button', { class: 'close', type: 'button', 'aria-label': 'Close the story', onclick: () => api.close() }, closeIcon())),
      scroller));

  const entries: Entry[] = [];
  let rendered = 0;
  let firstShown = 0;
  let open = false;
  let lastDay = -1;

  const keep = (e: SimEvent): e is Entry => e.kind === 'line' || e.kind === 'witness' || e.kind === 'whisper' || e.kind === 'day-end';
  const visible = (e: Entry): boolean => {
    if (!onlyRumor.checked) return true;
    if (e.kind === 'line') return e.claimId !== undefined || RUMOR_ACTS.has(e.act);
    return true;
  };

  const name = (id: VillagerId): string => ctx.sim().cast.get(id)?.name ?? id;
  const who = (id: VillagerId): HTMLElement =>
    h('button', { class: 'name-link', type: 'button', onclick: () => ctx.onSelect(id) }, name(id));
  const joinPeople = (ids: readonly VillagerId[]): (HTMLElement | string)[] => {
    const names = ids.map(name);
    const text = listNames(names);
    if (ids.length > 3) return [text];
    const out: (HTMLElement | string)[] = [];
    ids.forEach((id, i) => {
      if (i > 0) out.push(i === ids.length - 1 ? ' and ' : ', ');
      out.push(who(id));
    });
    return out;
  };

  const row = (e: Entry): HTMLElement => {
    const time = h('time', null, tickClock(e.tick));
    switch (e.kind) {
      case 'line': {
        const head = e.listeners.length
          ? [who(e.speaker), ` ${actVerb(e.act)} `, ...joinPeople(e.listeners)]
          : [who(e.speaker), ' said'];
        return h('li', { class: 'log-entry', 'data-kind': 'line', 'data-rumor': e.claimId ? 'true' : 'false' },
          time, h('div', null, h('p', { class: 'log-head' }, head), h('p', { class: 'log-quote' }, `“${e.text}”`)));
      }
      case 'witness':
        return h('li', { class: 'log-entry', 'data-kind': 'witness' },
          time, h('div', null, h('p', { class: 'log-head' }, who(e.villager), ' saw something'), h('p', { class: 'log-quote' }, sentence(e.what))));
      case 'whisper': {
        const claim = ctx.sim().claims.get(e.claimId);
        return h('li', { class: 'log-entry', 'data-kind': 'whisper' },
          time, h('div', null,
            h('p', { class: 'log-head' }, 'You whispered to ', who(e.listener)),
            h('p', { class: 'log-quote' }, claim ? `“${sentence(claim.text)}”` : 'Something about someone.'),
            e.witnesses.length ? h('p', { class: 'log-aside' }, 'Seen by ', ...joinPeople(e.witnesses)) : null));
      }
      case 'day-end':
        return h('li', { class: 'log-entry log-dayend', 'data-kind': 'day-end' },
          h('div', null,
            h('p', { class: 'log-head' }, `End of day ${e.dayIndex + 1}: ${ENDING_TITLE[e.ending] ?? 'The day is done'}`),
            h('p', { class: 'log-quote' }, sentence(e.summary))));
    }
  };

  const dayHeading = (day: number): HTMLElement => h('li', { class: 'log-day' }, h('h3', null, `Day ${day + 1}`));

  const appendRows = (from: number): void => {
    const frag = document.createDocumentFragment();
    for (let i = from; i < entries.length; i++) {
      const e = entries[i];
      if (!e || !visible(e)) continue;
      const day = e.kind === 'day-end' ? e.dayIndex : dayIndexOfTick(e.tick);
      if (day !== lastDay && e.kind !== 'day-end') {
        frag.appendChild(dayHeading(day));
        lastDay = day;
      }
      frag.appendChild(row(e));
    }
    list.appendChild(frag);
    rendered = entries.length;
    emptyNote.hidden = list.childElementCount > 0;
  };

  const renderAll = (): void => {
    list.replaceChildren();
    lastDay = -1;
    const shownCount = entries.filter(visible).length;
    firstShown = 0;
    if (shownCount > PAGE) {
      let seen = 0;
      for (let i = entries.length - 1; i >= 0; i--) {
        const e = entries[i];
        if (e && visible(e)) seen++;
        if (seen >= PAGE) {
          firstShown = i;
          break;
        }
      }
    }
    earlier.hidden = firstShown === 0;
    const start = firstShown;
    rendered = start;
    appendRows(start);
  };

  earlier.addEventListener('click', () => {
    const before = scroller.scrollHeight;
    const target = Math.max(0, firstShown - PAGE * 2);
    firstShown = target;
    list.replaceChildren();
    lastDay = -1;
    appendRows(target);
    earlier.hidden = firstShown === 0;
    scroller.scrollTop += scroller.scrollHeight - before;
  });

  onlyRumor.addEventListener('change', () => {
    renderAll();
    scroller.scrollTop = scroller.scrollHeight;
  });

  const atBottom = (): boolean => scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 40;

  const api: Story = {
    el,
    push(events) {
      let added = false;
      for (const e of events) {
        if (keep(e)) {
          entries.push(e);
          added = true;
        }
      }
      if (!added || !open) return;
      const stick = atBottom();
      appendRows(rendered);
      if (stick) scroller.scrollTop = scroller.scrollHeight;
    },
    reset(events) {
      entries.length = 0;
      for (const e of events) if (keep(e)) entries.push(e);
      rendered = 0;
      if (open) {
        renderAll();
        scroller.scrollTop = scroller.scrollHeight;
      }
    },
    open(opener) {
      if (open) return;
      open = true;
      renderAll();
      reveal(el);
      ctx.layers.open({ id: 'story', el, modal: false, close: () => api.close() }, opener);
      ctx.onOpenChange(true);
      scroller.scrollTop = scroller.scrollHeight;
      el.querySelector<HTMLElement>('.drawer-title')?.setAttribute('tabindex', '-1');
      el.querySelector<HTMLElement>('.drawer-title')?.focus({ preventScroll: true });
    },
    close() {
      if (!open) return;
      open = false;
      conceal(el, ctx.reducedMotion(), () => list.replaceChildren());
      ctx.layers.closed('story');
      ctx.onOpenChange(false);
    },
    isOpen: () => open,
    cover: () => (open && ctx.isPhone() ? el.offsetHeight : 0),
  };
  return api;
}
