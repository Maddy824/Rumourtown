import { askVillage, type PlayContext, type PlayReply } from '../net/play.js';
import { loadTurnstile, type TurnstileClient } from '../net/turnstile.js';
import type { Simulation, VillageMap, WorldSnapshot } from '../sim/types.js';
import { nearbyPeople } from './whisper.js';
import { orchestrate } from '../agentic/orchestrator.js';
import { newestStoryEntries, nowSentence, storyBeat } from './story-beats.js';
import { h } from './dom.js';
import { closeIcon } from './icons.js';
import type { Layers } from './layers.js';

/** A requested person must never silently turn into a different conversation partner. */
export function conversationChoices(snapshot: WorldSnapshot, requested?: string) {
  const reachable = nearbyPeople(snapshot, 2).filter(p => p.activity !== 'sleep');
  const preferred = reachable.find(p => p.id === requested);
  const people = (preferred ? [preferred, ...reachable.filter(p => p.id !== requested)] : reachable).slice(0, 8);
  const selected = requested ? preferred?.id ?? '' : people[0]?.id ?? '';
  const person = requested ? snapshot.villagers.find(p => p.id === requested) : undefined;
  const notice = requested && !preferred ? `${person?.name ?? 'That person'} is ${person?.activity === 'sleep' ? 'asleep' : 'not close enough to talk'}. You can talk to the village or visit later.` : '';
  return { people, selected, notice };
}

export function createPlay(ctx: {
  sim: () => Simulation; snapshot: () => WorldSnapshot; map: VillageMap; layers: Layers;
  onOpenChange: (open: boolean) => void; act: (reply: PlayReply) => void; rumors: () => void;
}) {
  const title = h('h2', { id: 'rt-play-title' }, 'Talk or act');
  const person = h('select', { id: 'rt-play-person', 'aria-label': 'Talk to' });
  const input = h('textarea', { id: 'rt-play-input', rows: 3, maxlength: 280, placeholder: 'Say something, ask a question, or tell me where to go…', required: true });
  const status = h('p', { class: 'play-status', role: 'status' });
  const transcript = h('div', { class: 'play-transcript', role: 'log', 'aria-label': 'Your conversation', 'aria-live': 'polite' });
  const send = h('button', { type: 'submit', class: 'button button-primary' }, 'Send');
  const form = h('form', { class: 'play-form' }, h('label', { for: 'rt-play-person' }, 'Talk to'), person,
    transcript, h('label', { for: 'rt-play-input' }, 'Your words'), input, status,
    h('div', { class: 'card-actions' }, send, h('button', { type: 'button', class: 'button button-quiet', onclick: () => { api.close(); ctx.rumors(); } }, 'Spread a rumor')));
  const quick = h('div', { class: 'play-quick' },
    h('button', { type: 'button', class: 'text-button', onclick: () => execute({ reply: '', action: 'look', target: '' }) }, 'Look around'),
    h('button', { type: 'button', class: 'text-button', onclick: () => execute({ reply: '', action: 'move', target: 'square' }) }, 'Walk to the square'));
  const el = h('section', { class: 'sheet play-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'rt-play-title', hidden: true },
    h('div', { class: 'sheet-paper' }, h('header', { class: 'sheet-head' }, title,
      h('button', { type: 'button', class: 'close', 'aria-label': 'Close conversation', onclick: () => api.close() }, closeIcon())),
    h('p', { class: 'sheet-note' }, 'Talk naturally. Ask to visit someone or walk somewhere.'), quick, form,
    h('p', { class: 'play-footnote' }, 'Walking, visiting and questions about the village are answered by the village itself. Open conversation is voiced by AI from what that villager knows. Actions happen only when you choose them.')));
  let turnstile: TurnstileClient | undefined, controller: AbortController | undefined;
  // Each villager remembers their own conversation with you; the village narrator has its own.
  const histories = new Map<string, PlayContext['history']>();
  let revision = 0;
  const historyKey = (): string => person.value || 'village';
  const baseUrl = import.meta.env.VITE_API_BASE_URL, siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  function execute(reply: PlayReply): void { api.close(); ctx.act(reply); }
  function clearConversation(): void { transcript.replaceChildren(); revision++; controller?.abort(); controller = undefined; send.disabled = false; input.disabled = false; form.removeAttribute('aria-busy'); status.textContent = ''; }
  person.addEventListener('change', clearConversation);
  function context(): PlayContext {
    const nearby = conversationChoices(ctx.snapshot(), person.value).people;
    const speaker = nearby.find(p => p.id === person.value)?.id ?? null;
    const dossier = speaker ? ctx.sim().cast.get(speaker) : undefined;
    return { speaker, nearby: nearby.map(p => ({ id: p.id, mood: p.mood, activity: p.activity })),
      places: ctx.map.places.map(p => ({ id: p.id, name: p.name })),
      voice: dossier ? [dossier.voice, dossier.character?.aspiration, dossier.character?.worry, dossier.character?.habit].filter(Boolean).join(' ').slice(0, 700) : '',
      history: (histories.get(historyKey()) ?? []).slice(-3) };
  }
  function news(): string[] {
    const sim = ctx.sim();
    try {
      return newestStoryEntries(sim.events(Math.max(0, sim.tick - 720)), sim).map(e => storyBeat(e, sim)).filter((b): b is NonNullable<typeof b> => !!b)
        .slice(0, 4).map(b => nowSentence(b, sim));
    } catch { return []; }
  }
  function turn(text: string): HTMLElement {
    const entry = h('article', { class: 'play-turn' }, h('p', null, h('strong', null, 'You: '), text));
    transcript.append(entry);
    while (transcript.childElementCount > 3) transcript.firstElementChild?.remove();
    entry.scrollIntoView({ block: 'nearest' });
    return entry;
  }
  function answer(entry: HTMLElement, name: string, reply: PlayReply, route: 'local' | 'model'): void {
    entry.dataset.route = route;
    entry.append(h('p', null, h('strong', null, `${name}: `), reply.reply));
    if (reply.action !== 'none') {
      const label = reply.action === 'move' ? `Walk to ${ctx.map.places.find(p => p.id === reply.target)!.name}` :
        reply.action === 'approach' ? `Visit ${ctx.sim().cast.get(reply.target)!.name}` :
        reply.action === 'pause' ? 'Pause the village' : reply.action === 'resume' ? 'Let time flow' : 'Look around';
      entry.append(h('button', { class: 'button button-primary', type: 'button', onclick: () => execute(reply) }, label));
    }
    const key = historyKey(); const list = [...(histories.get(key) ?? []), { you: entry.querySelector('p')!.textContent!.replace(/^You: /, ''), reply: reply.reply.slice(0, 240) }];
    histories.set(key, list.slice(-3));
    entry.scrollIntoView({ block: 'nearest' });
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const text = input.value.trim().replace(/[\r\n\t]+/g, ' ');
    if (!text || text.length > 280 || controller) return;
    const current = context();
    const name = current.speaker ? ctx.sim().cast.get(current.speaker)?.name ?? 'Villager' : 'Village';
    const route = orchestrate({ text, speaker: current.speaker, sim: ctx.sim(), snapshot: ctx.snapshot(), map: ctx.map, news: news() });
    const entry = turn(text);
    input.value = ''; status.textContent = '';
    // The village answers from its own state whenever it can: instant, exact and free.
    if (route.kind === 'local') { answer(entry, name, { reply: route.reply, action: route.action, target: route.target }, 'local'); input.focus(); return; }
    if (!baseUrl || !siteKey) { entry.append(h('p', { class: 'play-error' }, 'Open conversation needs rumourtown.dev. Walking, visiting and questions about the village work here.')); return; }
    const ownRevision = ++revision, request = new AbortController(); controller = request;
    const timer = window.setTimeout(() => request.abort(), 30_000);
    send.disabled = true; form.setAttribute('aria-busy', 'true');
    const thinking = h('p', { class: 'play-thinking' }, h('strong', null, name), h('span', { class: 'play-thinking-text' }, ' is thinking'), h('span', { class: 'dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')));
    entry.append(thinking); entry.scrollIntoView({ block: 'nearest' });
    const slow = window.setTimeout(() => { thinking.querySelector('.play-thinking-text')!.textContent = ' is still thinking'; }, 4_000);
    try {
      turnstile ??= loadTurnstile(siteKey, form);
      const token = await turnstile.getToken(request.signal);
      if (request.signal.aborted) return;
      const reply = await askVillage(text, { ...current, facts: route.facts }, { baseUrl, token, signal: request.signal, people: [...ctx.sim().cast.keys()] });
      if (request.signal.aborted || ownRevision !== revision || el.hidden) return;
      thinking.remove();
      answer(entry, name, reply, 'model');
    } catch (error) {
      if (ownRevision === revision && !el.hidden) thinking.replaceWith(h('p', { class: 'play-error' }, request.signal.aborted ? 'The reply took too long. Try again.' : error instanceof Error ? error.message : 'Could not connect. Try again.'));
    } finally {
      window.clearTimeout(timer); window.clearTimeout(slow);
      if (ownRevision === revision) { controller = undefined; send.disabled = false; form.removeAttribute('aria-busy'); if (!el.hidden) input.focus(); }
    }
  });
  const api = {
    el, isOpen: () => !el.hidden,
    open(opener?: Element, listener?: string) {
      clearConversation();
      const choices = conversationChoices(ctx.snapshot(), listener);
      person.replaceChildren(h('option', { value: '' }, 'The village'), ...choices.people.map(p => h('option', { value: p.id }, p.name)));
      person.value = choices.selected; status.textContent = choices.notice;
      el.hidden = false; el.dataset.open = ''; ctx.layers.open({ id: 'play', el, modal: true, close: () => api.close() }, opener);
      ctx.onOpenChange(true); input.focus({ preventScroll: true });
      if (baseUrl && siteKey) { turnstile ??= loadTurnstile(siteKey, form); void turnstile.warm().catch(() => undefined); }
    },
    close() {
      if (el.hidden) return;
      revision++; controller?.abort(); controller = undefined; send.disabled = false; input.disabled = false; form.removeAttribute('aria-busy');
      el.hidden = true; delete el.dataset.open; ctx.layers.closed('play'); ctx.onOpenChange(false);
    },
    destroy() { api.close(); turnstile?.destroy(); histories.clear(); el.remove(); },
  };
  return api;
}
