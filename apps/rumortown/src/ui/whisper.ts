/** Whisper exact stories, then let the village decide what to believe. */
import { blockedSharedText } from '../../../shared/moderation.js';
import type { ClaimId } from 'rumormind';
import { MAX_RUMOR_TEXT, neutralMeaning } from '../../../shared/open-rumor.js';
import { rumorLibrary } from '../content/rumor-packs/index.js';
import { createRumorFlow, type RumorFlow } from '../net/rumorFlow.js';
import { loadTurnstile, type TurnstileClient } from '../net/turnstile.js';
import { createOpenClaim } from '../sim/registered-claim.js';
import type { GameClaim, Simulation, VillagerId, VillagerView, WorldSnapshot } from '../sim/types.js';
import { conceal, h, reveal } from './dom.js';
import { awakePeople, isNight } from './awake.js';
import { faceImg } from './faces.js';
import { closeIcon } from './icons.js';
import type { Layers } from './layers.js';
import { createRumorLibrary } from './rumor-library.js';

export const WHISPER_RANGE = 2;

export interface WhisperContext {
  sim: () => Simulation;
  snapshot: () => WorldSnapshot;
  isPhone: () => boolean;
  reducedMotion: () => boolean;
  layers: Layers;
  /** Returns false when the listener is no longer in reach. */
  whisper: (listener: VillagerId, claimId: ClaimId) => boolean;
  walkTo: (id: VillagerId) => void;
  onOpenChange: (open: boolean) => void;
  /** Injectable verified flow for UI checks. Production uses the configured API. */
  flow?: Pick<RumorFlow, 'start'> & Partial<Pick<RumorFlow, 'warm'>>;
}

export interface WhisperSheet {
  readonly el: HTMLElement;
  open(opts?: { listener?: VillagerId; opener?: Element | null }): void;
  warm(): void;
  close(): void;
  isOpen(): boolean;
  cover(): number;
  destroy(): void;
}

export function nearbyPeople(snap: WorldSnapshot, range = 6): VillagerView[] {
  const p = snap.player.pos;
  return snap.villagers
    .map((v) => ({ v, d: Math.hypot(v.pos.x - p.x, v.pos.y - p.y) }))
    .filter((x) => x.d <= range)
    .sort((a, b) => a.d - b.d || (a.v.id < b.v.id ? -1 : a.v.id > b.v.id ? 1 : 0))
    .map((x) => x.v);
}

export const inReach = (snap: WorldSnapshot): VillagerView[] => nearbyPeople(snap, WHISPER_RANGE).filter(v => v.activity !== 'sleep');

export function createWhisperSheet(ctx: WhisperContext): WhisperSheet {
  const content = h('div', { class: 'whisper-content' });
  const feedback = h('p', { class: 'whisper-feedback', role: 'status',
    style: 'display: block; flex: 1 1 0; min-width: 0; min-height: 2lh;' });
  const sendBtn = h('button', { class: 'button button-primary', type: 'submit', disabled: true }, 'Whisper');
  const localBtn = h('button', { class: 'button button-quiet', type: 'button', hidden: true, onclick: () => {
    revision++; busy = false; activeRevision = -1;
    form.removeAttribute('aria-busy');
    prepare(neutralMeaning(), 'Your exact story will spread without assigning blame. No extra AI request.');
  } }, 'Continue without AI');
  const form = h('form', { class: 'whisper-form', novalidate: true }, content,
    h('div', { class: 'whisper-actions' }, feedback, sendBtn));
  const el = h('section', { class: 'sheet whisper', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'rt-whisper-title', hidden: true },
    h('div', { class: 'sheet-paper' }, h('header', { class: 'sheet-head' }, h('div', null,
      h('h2', { id: 'rt-whisper-title', class: 'sheet-title' }, 'Whisper'),
      h('p', { class: 'sheet-note' }, 'Time holds while you choose.')),
    h('button', { class: 'close', type: 'button', 'aria-label': 'Close the whisper sheet', onclick: () => api.close() }, closeIcon())), form));
  let open = false, busy = false, revision = 0, activeRevision = -1;
  let listener: VillagerId | null = null;
  let ownText = '';
  let selected: GameClaim | null = null, confirmed: GameClaim | null = null;
  let turnstile: TurnstileClient | undefined;
  let flow = ctx.flow;
  let confirmation = h('div');
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '';
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '';
  const invalidate = (): void => { revision++; confirmed = null; confirmation.hidden = true; feedback.textContent = ''; };
  const update = (): void => {
    sendBtn.disabled = busy || !listener || !(selected || ownText.trim());
    sendBtn.textContent = confirmed ? 'Whisper it' : 'Whisper';
    localBtn.hidden = !busy;
  };
  const prepare = (meaning: Parameters<typeof createOpenClaim>[1], note: string): void => {
    try {
      confirmed = createOpenClaim(ownText, meaning, ctx.sim().cast);
      const name = (id: string | null) => id ? ctx.sim().cast.get(id)?.name ?? id : 'Unknown or not stated';
      confirmation.replaceChildren(
        h('p', null, `${ctx.sim().cast.get(listener!)?.name ?? 'They'} will hear exactly: “${confirmed.text}”`),
        h('p', { class: 'sheet-note' }, `Actor: ${name(meaning.actor)}. Affected: ${name(meaning.affected)}.`),
        h('p', { class: 'sheet-note' }, `${meaning.actor && meaning.valence !== 0 ? `May ${meaning.valence < 0 ? 'harm' : 'help'} ${name(meaning.actor)}’s reputation.` : 'No reputation judgment.'} Importance: ${['small', 'serious', 'very serious'][meaning.severity - 1]}.`),
        ...(meaning.question ? [h('p', { class: 'sheet-note' }, `They may ask: ${meaning.question}`)] : []),
        h('p', { class: 'sheet-note' }, 'This story will appear in dialogue, research exports and shared replay links. It is a claim, not a proven event.'),
        h('button', { type: 'button', class: 'button button-quiet', onclick: () => {
          prepare(neutralMeaning(), 'No one is assigned blame. Your wording is unchanged.');
        } }, 'Leave people unassigned'),
        h('button', { type: 'button', class: 'button button-quiet', onclick: () => {
          invalidate(); update(); content.querySelector<HTMLElement>('textarea')?.focus();
        } }, 'Edit story'));
      confirmation.hidden = false;
      feedback.textContent = note;
    } catch { confirmed = null; feedback.textContent = 'Write one short story, up to 100 characters.'; }
    update();
  };
  const submit = async (): Promise<void> => {
    if (!listener || busy) return;
    if (ownText.trim() && blockedSharedText(ownText)) {
      confirmed = null; confirmation.hidden = true;
      feedback.textContent = 'This draft stays on this device. Edit the language before whispering or sharing.';
      update(); return;
    }
    if (ownText.trim() && !confirmed) {
      const requestRevision = revision;
      activeRevision = requestRevision; busy = true; update();
      form.setAttribute('aria-busy', 'true');
      try {
        api.warm();
        if (!flow) throw Error('unavailable');
        const result = await flow.start(ownText);
        if (!open || requestRevision !== revision) return;
        prepare(result.meaning, result.note);
      } catch {
        if (open && requestRevision === revision) prepare(neutralMeaning(), 'Your story still works without AI. No one is assigned blame.');
      } finally {
        if (activeRevision === requestRevision) {
          busy = false; form.removeAttribute('aria-busy'); update();
          if (open && confirmed) sendBtn.focus();
        }
      }
      return;
    }
    const claim = confirmed ?? selected;
    if (!claim) return;
    if (claim.about === listener) {
      feedback.textContent = 'Choose another listener, or leave the people unassigned.';
      return;
    }
    ctx.sim().registerClaim(claim);
    if (ctx.whisper(listener, claim.id)) api.close();
    else feedback.textContent = 'They are out of reach now. Walk closer and try again.';
  };
  form.addEventListener('submit', ev => { ev.preventDefault(); void submit(); });
  const build = (preferred?: VillagerId): void => {
    ownText = ''; selected = null; invalidate();
    const sim = ctx.sim(), snap = ctx.snapshot(), near = inReach(snap);
    listener = near.find(v => v.id === preferred)?.id ?? near[0]?.id ?? null;
    if (!near.length) {
      const listed = awakePeople(snap).slice(0, 8);
      content.replaceChildren(h('div', { class: 'nearby-people' },
        h('p', { class: 'sheet-note' }, isNight(snap) && listed.length ? 'Most of the village is asleep. The inn is still awake.' : listed.length ? 'Walk closer to someone to whisper.' : 'The village is asleep. Try again in the morning.'), listed.map(v => h('div', { class: 'nearby-person' },
          faceImg(v.id, v.look, 34), h('span', null, h('strong', null, v.name), h('small', null, sim.cast.get(v.id)?.role ?? 'Neighbour')),
          h('button', { class: 'button button-quiet walk-to', type: 'button', disabled: v.activity === 'sleep',
            'aria-label': v.activity === 'sleep' ? `${v.name}, asleep` : `Walk to ${v.name}`,
            onclick: () => { api.close(); ctx.walkTo(v.id); } }, v.activity === 'sleep' ? 'Asleep' : 'Walk to')))));
      form.dataset.empty = 'true'; update(); return;
    }
    form.dataset.empty = 'false';
    const who = h('fieldset', { class: 'whisper-who' }, h('legend', null, 'To'), h('div', { class: 'who-list' }, near.map(v => {
      const input = h('input', { type: 'radio', name: 'rt-listener', value: v.id, class: 'sr-only', checked: v.id === listener });
      input.addEventListener('change', () => { listener = v.id; invalidate(); update(); });
      return h('label', { class: 'who' }, input, h('span', { class: 'who-card' }, faceImg(v.id, v.look, 34),
        h('span', { class: 'who-text' }, h('span', { class: 'who-name' }, v.name), h('span', { class: 'who-role' }, sim.cast.get(v.id)?.role ?? 'Neighbour'))));
    })));
    const typed = h('textarea', { id: 'rt-own-story', rows: 3, maxlength: MAX_RUMOR_TEXT,
      placeholder: 'Tom borrowed Ben’s boat and never gave it back.', 'aria-describedby': 'rt-writing-note' });
    const preview = h('p', { class: 'sheet-note', id: 'rt-writing-note' }, 'Any kind of story, in your words. Use fictional details. Review what will be shared before sending.');
    confirmation = h('div', { class: 'whisper-confirmation', hidden: true, role: 'status' });
    const choose = (claim: GameClaim): void => {
      invalidate(); busy = false; activeRevision = -1; form.removeAttribute('aria-busy');
      ownText = ''; typed.value = ''; selected = claim;
      feedback.textContent = 'Selected from the library. No AI credits used.';
      update(); sendBtn.focus();
    };
    const what = h('fieldset', { class: 'whisper-what' }, h('legend', null, 'Say that'), [...sim.claims.values()].map(claim => {
      const input = h('input', { type: 'radio', name: 'rt-claim', value: claim.id, class: 'sr-only' });
      input.addEventListener('change', () => choose(claim));
      return h('label', { class: 'claim' }, input, h('span', { class: 'claim-card' }, h('span', { class: 'claim-text' }, claim.text)));
    }));
    const suggestions = h('details', { class: 'whisper-suggestions authored-stories' }, h('summary', null, 'Or choose a village story'), what);
    typed.addEventListener('input', () => {
      invalidate(); ownText = typed.value; selected = null;
      suggestions.open = !ownText.trim();
      what.querySelectorAll<HTMLInputElement>('input').forEach(input => { input.checked = false; });
      update();
    });
    const library = createRumorLibrary(rumorLibrary, choose);
    content.replaceChildren(who, h('label', { class: 'own-claim', for: 'rt-own-story' }, h('span', null, 'Write your whisper'), typed),
      preview, localBtn, confirmation, library, suggestions);
    update();
  };
  const api: WhisperSheet = {
    el,
    open(opts = {}) {
      turnstile?.destroy(); turnstile = undefined; if (!ctx.flow) flow = undefined;
      activeRevision = -1; busy = false; form.removeAttribute('aria-busy'); build(opts.listener);
      if (!open) { open = true; reveal(el); ctx.layers.open({ id: 'whisper', el, modal: true, close: () => api.close() }, opts.opener); ctx.onOpenChange(true); }
      api.warm();
      (el.querySelector<HTMLElement>(inReach(ctx.snapshot()).length ? ctx.isPhone() ? '.whisper-who input' : '.own-claim textarea' : '.walk-to') ?? el.querySelector<HTMLElement>('.close'))?.focus({ preventScroll: true });
    },
    warm() {
      if (!open) return;
      if (!flow) {
        const container = h('div', { class: 'whisper-challenge' }); content.appendChild(container);
        turnstile = baseUrl && siteKey ? loadTurnstile(siteKey, container) : undefined;
        const client = createRumorFlow({ baseUrl: turnstile ? baseUrl : '', turnstile: turnstile ?? { getToken: async () => '' },
          onStateChange: state => {
            if (!open || !busy || activeRevision !== revision || flow !== client) return;
            feedback.textContent = state === 'checking' ? "Checking you're human…" : 'AI is understanding your story…';
          } });
        flow = client;
      }
      flow.warm?.();
    },
    close() {
      if (!open) return;
      open = false; invalidate(); activeRevision = -1; busy = false; form.removeAttribute('aria-busy');
      turnstile?.destroy(); turnstile = undefined; if (!ctx.flow) flow = undefined;
      ownText = ''; const typed = content.querySelector<HTMLTextAreaElement>('textarea'); if (typed) typed.value = '';
      conceal(el, ctx.reducedMotion()); ctx.layers.closed('whisper'); ctx.onOpenChange(false);
    },
    isOpen: () => open, cover: () => open && ctx.isPhone() ? el.offsetHeight : 0,
    destroy() { api.close(); turnstile?.destroy(); },
  };
  return api;
}
