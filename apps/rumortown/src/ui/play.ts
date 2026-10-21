import { askVillage, type PlayContext, type PlayReply } from '../net/play.js';
import { loadTurnstile, type TurnstileClient } from '../net/turnstile.js';
import type { Simulation, VillageMap, WorldSnapshot } from '../sim/types.js';
import { nearbyPeople } from './whisper.js';
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
    h('p', { class: 'play-footnote' }, 'AI replies are improvised. Actions happen only when you choose them. Conversation stays in this tab and is sent to AI only when you press Send.')));
  let turnstile: TurnstileClient | undefined, controller: AbortController | undefined;
  let history: PlayContext['history'] = [], revision = 0;
  const baseUrl = import.meta.env.VITE_API_BASE_URL, siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  function execute(reply: PlayReply): void { api.close(); ctx.act(reply); }
  function clearConversation(): void { history = []; transcript.replaceChildren(); revision++; controller?.abort(); controller = undefined; send.disabled = false; input.disabled = false; form.removeAttribute('aria-busy'); status.textContent = ''; }
  person.addEventListener('change', clearConversation);
  function context(): PlayContext {
    const nearby = conversationChoices(ctx.snapshot(), person.value).people;
    const speaker = nearby.find(p => p.id === person.value)?.id ?? null;
    const dossier = speaker ? ctx.sim().cast.get(speaker) : undefined;
    return { speaker, nearby: nearby.map(p => ({ id: p.id, mood: p.mood, activity: p.activity })),
      places: ctx.map.places.map(p => ({ id: p.id, name: p.name })),
      voice: dossier ? [dossier.voice, dossier.character?.aspiration, dossier.character?.worry, dossier.character?.habit].filter(Boolean).join(' ').slice(0, 700) : '',
      history: history.slice(-3) };
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const text = input.value.trim().replace(/[\r\n\t]+/g, ' ');
    if (!text || text.length > 280 || controller) return;
    if (!baseUrl || !siteKey) { status.textContent = 'AI conversation is available on rumourtown.dev. You can still use the walking buttons or spread a ready-made rumor here.'; return; }
    const ownRevision = ++revision, request = new AbortController(); controller = request;
    const timer = window.setTimeout(() => request.abort(), 30_000);
    send.disabled = true; input.disabled = true; form.setAttribute('aria-busy', 'true');
    status.textContent = 'Checking your connection…';
    try {
      turnstile ??= loadTurnstile(siteKey, form);
      const token = await turnstile.getToken(request.signal);
      if (request.signal.aborted) return;
      status.textContent = 'AI is thinking. This uses the shared, capped allowance.';
      const current = context();
      const answer = await askVillage(text, current, { baseUrl, token, signal: request.signal, people: [...ctx.sim().cast.keys()] });
      if (request.signal.aborted || ownRevision !== revision || el.hidden) return;
      history.push({ you: text, reply: answer.reply }); history = history.slice(-3);
      const name = current.speaker ? ctx.sim().cast.get(current.speaker)?.name ?? 'Villager' : 'Village';
      const entry = h('article', { class: 'play-turn' }, h('p', null, h('strong', null, 'You: '), text), h('p', null, h('strong', null, `${name}: `), answer.reply));
      if (answer.action !== 'none') {
        const label = answer.action === 'move' ? `Walk to ${ctx.map.places.find(p => p.id === answer.target)!.name}` :
          answer.action === 'approach' ? `Visit ${ctx.sim().cast.get(answer.target)!.name}` :
          answer.action === 'pause' ? 'Pause the village' : answer.action === 'resume' ? 'Let time flow' : 'Look around';
        entry.append(h('button', { class: 'button button-primary', type: 'button', onclick: () => execute(answer) }, label));
      }
      transcript.append(entry);
      while (transcript.childElementCount > 3) transcript.firstElementChild?.remove();
      input.value = ''; status.textContent = 'AI reply received.';
      entry.scrollIntoView({ block: 'nearest' });
    } catch (error) {
      if (ownRevision === revision && !el.hidden) status.textContent = request.signal.aborted ? 'The reply took too long. Try again.' : error instanceof Error ? error.message : 'Could not connect. Try again.';
    } finally {
      window.clearTimeout(timer);
      if (ownRevision === revision) { controller = undefined; send.disabled = false; input.disabled = false; form.removeAttribute('aria-busy'); if (!el.hidden) input.focus(); }
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
    },
    close() {
      if (el.hidden) return;
      revision++; controller?.abort(); controller = undefined; send.disabled = false; input.disabled = false; form.removeAttribute('aria-busy');
      el.hidden = true; delete el.dataset.open; ctx.layers.closed('play'); ctx.onOpenChange(false);
    },
    destroy() { api.close(); turnstile?.destroy(); history = []; el.remove(); },
  };
  return api;
}
