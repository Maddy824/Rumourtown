import type { ClaimId } from 'rumormind';
import type { Simulation, ThreadLink } from '../sim/types.js';
import { h } from './dom.js';
import { faceImg } from './faces.js';
import { tickLabel } from './format.js';

/** Recorded order matters: earlier tellings can share the first whisper's tick. */
export function sinceFirstWhisper(links: readonly ThreadLink[], selected: string): readonly ThreadLink[] {
  const first = links.findIndex(link => link.claimId === selected && link.from === 'stranger' && link.to !== link.from);
  return first < 0 ? [] : links.slice(first).filter(link => link.claimId === selected && link.from !== link.to);
}
export function heardSinceWhisper(links: readonly ThreadLink[], selected: string): number {
  return new Set(sinceFirstWhisper(links, selected).map(link => link.to)).size;
}

/** Collect actual transmissions, not belief corrections (which also emit belief events). */
export function createTrailHistory() {
  const links: ThreadLink[] = [];
  let through = -1;
  let seen = new Map<string, number>();
  return {
    links,
    record(recent: readonly ThreadLink[]): void {
      const counts = new Map<string, number>();
      for (const link of recent) {
        if (link.tick < through) continue;
        if (link.tick > through) { through = link.tick; seen = new Map(); counts.clear(); }
        const key = `${link.from}/${link.to}/${link.claimId}`;
        const occurrence = (counts.get(key) ?? 0) + 1;
        counts.set(key, occurrence);
        if (occurrence > (seen.get(key) ?? 0)) links.push(link);
      }
      for (const [key, count] of counts) seen.set(key, Math.max(count, seen.get(key) ?? 0));
    },
  };
}

export function createRumorTrail(ctx: {
  sim: () => Simulation;
  history: () => readonly ThreadLink[];
  pause: () => void;
  play: () => void;
  close: () => void;
}) {
  let selected: ClaimId | null = null;
  let step: number | null = null; // null follows the latest telling
  let active: ThreadLink | undefined;
  let key = '';
  let optionsKey = '';
  const choose = h('select', { id: 'rt-trail-claim', 'aria-label': 'Rumor to follow' });
  const claimText = h('p', { class: 'trail-claim' });
  const status = h('p', { class: 'trail-status', role: 'status', 'aria-live': 'polite' });
  const route = h('div', { class: 'trail-route' });
  const previous = h('button', { class: 'button button-quiet', type: 'button' }, 'Previous');
  const next = h('button', { class: 'button button-quiet', type: 'button' }, 'Next');
  const live = h('button', { class: 'button button-quiet', type: 'button', 'aria-pressed': 'true' }, 'Watch live');
  const el = h('section', { class: 'rumor-trail', 'aria-label': 'Rumor trail', hidden: true },
    h('div', { class: 'trail-heading' }, h('label', { for: 'rt-trail-claim' }, 'Follow one rumor'),
      h('button', { class: 'button button-quiet', type: 'button', 'aria-label': 'Close rumor trail', onclick: ctx.close }, 'Close')),
    choose, claimText, route, status,
    h('div', { class: 'trail-controls' }, previous, next, live),
    h('p', { class: 'trail-note' }, 'One red thread shows this telling. People are shown where they are now. Hearing is not believing.'));
  const relevant = (): ThreadLink[] => ctx.history().filter(t => t.claimId === selected);
  choose.addEventListener('change', () => { selected = choose.value; step = null; key = ''; update(); });
  previous.addEventListener('click', () => { step = Math.max(0, (step ?? relevant().length - 1) - 1); ctx.pause(); key = ''; update(); });
  next.addEventListener('click', () => { step = Math.min(relevant().length - 1, (step ?? 0) + 1); ctx.pause(); key = ''; update(); });
  live.addEventListener('click', () => { ctx.play(); step = null; key = ''; update(); });

  function update(): void {
    if (el.hidden) return;
    const sim = ctx.sim();
    if (!selected || !sim.claims.has(selected)) selected = ctx.history().at(-1)?.claimId ?? sim.claims.keys().next().value ?? null;
    const available = [...sim.claims.values()];
    const ids = available.map(c => c.id).join('|');
    if (ids !== optionsKey) {
      optionsKey = ids;
      choose.replaceChildren(...available.map(c => h('option', { value: c.id }, c.text)));
    }
    choose.value = selected ?? '';
    const links = relevant();
    const index = step === null ? links.length - 1 : Math.min(step, links.length - 1);
    active = links[index];
    const nextKey = `${selected}/${links.length}/${index}/${step === null}`;
    if (key === nextKey) return;
    key = nextKey;
    claimText.textContent = sim.claims.get(selected ?? '')?.text ?? 'Choose a village story.';
    previous.disabled = index <= 0;
    next.disabled = index >= links.length - 1 || index < 0;
    live.setAttribute('aria-pressed', String(step === null));
    if (!active) {
      route.replaceChildren(h('p', null, 'No one has passed this story on yet.'));
      status.textContent = 'Waiting for the first telling. You can start it with a whisper.';
      return;
    }
    const actor = (id: string): HTMLElement => {
      const d = sim.cast.get(id);
      return h('span', { class: 'trail-person' }, faceImg(id, d?.look ?? 'stranger', 30),
        h('strong', null, id === 'stranger' ? 'You' : d?.name ?? id));
    };
    route.replaceChildren(actor(active.from), h('span', { class: 'trail-verb' }, 'told'), actor(active.to));
    const reached = new Set(links.map(t => t.to)).size;
    status.textContent = `Telling ${index + 1} of ${links.length}. ${tickLabel(active.tick)}. ${reached} ${reached === 1 ? 'person' : 'people'} reached.`;
  }

  return {
    el, update,
    focus(id: ClaimId): void { selected = id; step = null; key = ''; },
    link: (): ThreadLink | undefined => active,
  };
}
