/**
 * The whisper sheet, opened from the postbox: who is within two tiles, player-written stories and optional ready-made claims. Time holds while it is open.
 */
import type { ClaimId } from 'rumormind';
import { castVersion } from '../content/cast/index.js';
import { rumorLibrary } from '../content/rumor-packs/index.js';
import { createWhisperFlow, type WhisperFlow } from '../net/whisperFlow.js';
import { loadTurnstile, type TurnstileClient } from '../net/turnstile.js';
import { createRegisteredClaim, MAX_WRITTEN_TEXT } from '../sim/registered-claim.js';
import type { GameClaim, Simulation, VillagerId, VillagerView, WorldSnapshot } from '../sim/types.js';
import { conceal, h, reveal } from './dom.js';
import { CORE_PEOPLE } from './name-labels.js';
import { faceImg } from './faces.js';
import { glyphSvg } from './glyphs.js';
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
  flow?: Pick<WhisperFlow, 'state' | 'start'> & Partial<Pick<WhisperFlow, 'warm'>>;
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
  // Reserve two text lines at phone width, including while empty. Both progress
  // labels share this box; longer failure messages may still grow naturally.
  const feedback = h('p', { class: 'whisper-feedback', role: 'status',
    style: 'display: block; flex: 1 1 0; min-width: 0; min-height: 2lh;' });
  const retryBtn = h('button', { class: 'button button-quiet', type: 'button', hidden: true, onclick: () => {
    manual = false; confirmed = null; api.warm(); void submit();
  } }, 'Try again');
  const sendBtn = h('button', { class: 'button button-primary', type: 'submit', disabled: true }, 'Whisper');
  const form = h('form', { class: 'whisper-form', novalidate: true }, content, h('div', { class: 'whisper-actions' }, feedback, retryBtn, sendBtn));
  const el = h('section', { class: 'sheet whisper', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'rt-whisper-title', hidden: true },
    h('div', { class: 'sheet-paper' },
      h('header', { class: 'sheet-head' },
        h('div', null,
          h('h2', { id: 'rt-whisper-title', class: 'sheet-title' }, 'Whisper'),
          h('p', { class: 'sheet-note' }, 'Time holds while you choose.')),
        h('button', { class: 'close', type: 'button', 'aria-label': 'Close the whisper sheet', onclick: () => api.close() }, closeIcon())),
      form));

  let open = false;
  let listener: VillagerId | null = null;
  let claimId: ClaimId | null = null;
  let libraryClaim: GameClaim | null = null;
  let ownText = '';
  let about = '';
  let kind: GameClaim['kind'] = 'lying';
  let severity: GameClaim['severity'] = 2;
  let confirmed: GameClaim | null = null;
  let manual = false;
  let busy = false;
  let revision = 0;
  let activeRevision = 0;
  let turnstile: TurnstileClient | undefined;
  let flow = ctx.flow;
  const baseUrl = import.meta.env.VITE_API_BASE_URL;
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  const ai = Boolean(flow || (baseUrl && siteKey));
  let showConfirmation = (): void => {};
  let showManual = (): void => {};
  const invalidate = (): void => { revision++; confirmed = null; manual = false; retryBtn.hidden = true; };

  const update = (): void => {
    retryBtn.disabled = busy;
    sendBtn.disabled = busy || !(listener && (claimId || (ownText.trim() && (ai && !manual || about && about !== listener))));
    sendBtn.textContent = confirmed ? 'Whisper it' : 'Whisper';
  };

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    void submit();
  });
  const submit = async (): Promise<void> => {
    if (!listener || busy) return;
    const to = listener;
    const sim = ctx.sim();
    const name = sim.cast.get(to)?.name ?? 'They';
    let chosen = claimId;
    if (ownText.trim()) {
      if (ai && !manual && !confirmed) {
        const requestRevision = revision;
        activeRevision = revision;
        retryBtn.hidden = true;
        busy = true;
        update();
        form.setAttribute('aria-busy', 'true');
        feedback.textContent = "Checking you're human…";
        try {
          api.warm();
          if (!flow) throw new Error('unavailable');
          const result = await flow.start(ownText);
          if (!open || requestRevision !== revision) return;
          if (result.ok && 'claim' in result) {
            confirmed = createRegisteredClaim(result.claim, sim.cast);
            if (confirmed.about === listener) {
              confirmed = null;
              feedback.textContent = 'Say that to my face? Choose a story about someone else.';
              manual = true;
              showManual();
            } else {
              feedback.textContent = 'source' in result && result.source === 'local' ? 'Understood locally' : '';
              showConfirmation();
            }
          } else {
            feedback.textContent = flow.state.status === 'resting' ? flow.state.line : "Couldn't ask the village. Try again.";
            const retryable = !result.ok && !['budget', 'limit-global', 'limit-visitor'].includes(result.reason);
            retryBtn.hidden = !retryable;
            manual = !retryable;
            if (manual) showManual();
          }
        } catch {
          if (open && requestRevision === revision) {
            feedback.textContent = "Couldn't ask the village. Try again.";
            retryBtn.hidden = false;
          }
        } finally {
          if (activeRevision === requestRevision) {
            busy = false;
            form.removeAttribute('aria-busy');
            update();
            if (open && confirmed) sendBtn.focus();
          }
        }
        return;
      }
      if (about === to && !confirmed) {
        feedback.textContent = 'Choose a listener other than the person your story is about.';
        return;
      }
      try {
        // Only taxonomy fields enter the simulation, story, exports and replay links.
        const claim = confirmed ?? createRegisteredClaim({ about, kind, severity,
          valence: ['kindness', 'paid-debt', 'nursed'].includes(kind) ? 1 : -1 }, sim.cast);
        sim.registerClaim(claim);
        chosen = claim.id;
      } catch {
        feedback.textContent = 'Choose who and what your story is about.';
        return;
      }
    }
    if (!chosen) return;
    if ((libraryClaim?.id === chosen ? libraryClaim : sim.claims.get(chosen))?.about === to) {
      feedback.textContent = 'Say that to my face? Choose a story about someone else.';
      return;
    }
    if (libraryClaim?.id === chosen) sim.registerClaim(libraryClaim);
    if (ctx.whisper(to, chosen)) api.close();
    else feedback.textContent = `${name} is out of reach now. Walk closer and try again.`;
  };

  const suggest = (near: VillagerView[], to: VillagerId | null, claims: GameClaim[]): ClaimId | null => {
    const nearIds = new Set(near.map((v) => v.id));
    const harmful = claims.filter((c) => c.valence < 0 && c.about !== to);
    const pick = harmful.find((c) => nearIds.has(c.about))
      ?? harmful.find((c) => ctx.sim().cast.get(c.about)?.tier === 'core')
      ?? harmful[0]
      ?? claims.find((c) => c.about !== to)
      ?? claims[0];
    return pick ? pick.id : null;
  };

  const build = (preferred?: VillagerId): void => {
    ownText = '';
    libraryClaim = null;
    invalidate();
    const sim = ctx.sim();
    const snap = ctx.snapshot();
    const near = inReach(snap);
    feedback.textContent = '';
    listener = preferred && near.some((v) => v.id === preferred) ? preferred : near[0]?.id ?? null;

    const nearby = nearbyPeople(snap);
    const listed = nearby.length ? nearby : snap.villagers.filter(v => (CORE_PEOPLE as readonly string[]).includes(v.id));
    const people = h('div', { class: 'nearby-people' },
      nearby.length ? h('p', { class: 'sheet-note' }, 'People within six tiles, nearest first.')
        : h('p', { class: 'whisper-empty-lead' }, 'Nobody is close. Walk to the square or tap a name.'),
      listed.map(v => {
        const distance = Math.hypot(v.pos.x - snap.player.pos.x, v.pos.y - snap.player.pos.y);
        return h('div', { class: 'nearby-person' }, faceImg(v.id, v.look, 34),
          h('span', null, h('strong', null, v.name), h('small', null, `${sim.cast.get(v.id)?.role ?? 'Neighbour'}, ${distance.toFixed(1)} tiles`)),
          h('button', { class: 'button button-quiet walk-to', type: 'button', 'aria-label': v.activity === 'sleep' ? `${v.name}, asleep` : `Walk to ${v.name}`, disabled: v.activity === 'sleep', onclick: () => { api.close(); ctx.walkTo(v.id); } }, v.activity === 'sleep' ? 'Asleep' : 'Walk to'));
      }));
    if (near.length === 0) {
      content.replaceChildren(people);
      form.dataset.empty = 'true'; claimId = null; update(); return;
    }

    form.dataset.empty = 'false';
    const who = h('fieldset', { class: 'whisper-who' },
      h('legend', null, 'To'),
      h('div', { class: 'who-list' },
        near.map((v) => {
          const d = sim.cast.get(v.id);
          const input = h('input', { type: 'radio', name: 'rt-listener', value: v.id, class: 'sr-only', checked: v.id === listener });
          input.addEventListener('change', () => {
            listener = v.id;
            invalidate();
            confirmation.hidden = true;
            describe();
          });
          return h('label', { class: 'who' }, input,
            h('span', { class: 'who-card' }, faceImg(v.id, v.look, 34),
              h('span', { class: 'who-text' }, h('span', { class: 'who-name' }, v.name), d ? h('span', { class: 'who-role' }, d.role) : null)));
        })));

    const claims = [...sim.claims.values()];
    const suggestion = suggest(near, listener, claims);
    claimId = null;
    about = sim.claims.get(suggestion ?? '')?.about ?? [...sim.cast.keys()].find(id => id !== listener) ?? '';
    kind = 'lying';
    severity = 2;
    const order = new Map<string, number>();
    near.forEach((v, i) => order.set(v.id, i));
    let i = near.length;
    for (const d of sim.cast.values()) if (!order.has(d.id)) order.set(d.id, i++);
    const groups = new Map<VillagerId, GameClaim[]>();
    for (const c of claims) {
      const list = groups.get(c.about) ?? [];
      list.push(c);
      groups.set(c.about, list);
    }
    const subjects = [...groups.keys()].sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999));
    const what = h('fieldset', { class: 'whisper-what' },
      h('legend', null, 'Say that'),
      subjects.map((about) => {
        const d = sim.cast.get(about);
        const name = d?.name ?? about;
        const object = d?.pronouns.object ?? 'them';
        const look = snap.villagers.find((v) => v.id === about)?.look ?? d?.look;
        return h('div', { class: 'claim-group', role: 'group', 'aria-label': `About ${name}` },
          h('p', { class: 'claim-about', 'aria-hidden': 'true' }, look ? faceImg(about, look, 22) : null, `About ${name}`),
          (groups.get(about) ?? []).map((c) => {
            const input = h('input', { type: 'radio', name: 'rt-claim', value: c.id, class: 'sr-only', checked: c.id === claimId });
            input.addEventListener('change', () => {
              invalidate();
              confirmation.hidden = true;
              claimId = c.id;
              libraryClaim = null;
              ownText = '';
              const typed = content.querySelector<HTMLTextAreaElement>('.own-claim textarea');
              if (typed) typed.value = '';
              describe();
            });
            const effect = c.valence < 0 ? `Hurts ${object}` : c.valence > 0 ? `Helps ${object}` : null;
            return h('label', { class: 'claim', 'data-valence': String(c.valence) }, input,
              h('span', { class: 'claim-card' },
                glyphSvg(c.kind, 20),
                h('span', { class: 'claim-text' }, c.text),
                h('span', { class: 'claim-tags' },
                  c.id === claimId ? h('span', { class: 'claim-suggested' }, 'Suggested') : null,
                  effect ? h('span', { class: 'claim-effect' }, effect) : null)));
          }));
      }));

    const typed = h('textarea', { id: 'rt-own-story', rows: 3, maxlength: MAX_WRITTEN_TEXT,
      placeholder: 'Tom keeps a secret stash of honey behind the mill.', 'aria-describedby': 'rt-writing-note' });
    const aboutSelect = h('select', { 'aria-label': 'Who is your story about?' },
      [...sim.cast.values()].map(d => h('option', { value: d.id, selected: d.id === about }, d.name)));
    const meanings: [GameClaim['kind'], string][] = [
      ['lying', 'A lie'], ['theft', 'Theft'], ['cheating', 'Cheating'], ['romance', 'A secret romance'],
      ['broken-promise', 'A broken promise'], ['insult', 'An insult'], ['hoarding', 'Hoarding'],
      ['shirking', 'Avoiding work'], ['boasting', 'Boasting'], ['kindness', 'Kindness'],
      ['paid-debt', 'Repaying a debt'], ['nursed', 'Caring for someone'],
    ];
    const meaningSelect = h('select', { 'aria-label': 'What kind of story?' },
      meanings.map(([value, label]) => h('option', { value }, label)));
    const weightSelect = h('select', { 'aria-label': 'How much does it matter?' },
      h('option', { value: '1' }, 'Small'), h('option', { value: '2', selected: true }, 'Serious'), h('option', { value: '3' }, 'Very serious'));
    const preview = h('p', { class: 'sheet-note', id: 'rt-writing-note', role: 'status' });
    const describe = (): void => {
      const picked = claimId ? libraryClaim ?? sim.claims.get(claimId) : undefined;
      const helps = picked ? picked.valence > 0 : ['kindness', 'paid-debt', 'nursed'].includes(kind);
      preview.textContent = picked ? `Selected: ${picked.text}` : `${ownText.length}/${MAX_WRITTEN_TEXT} characters. ${helps ? 'Helps' : 'Hurts'} ${sim.cast.get(about)?.name ?? 'the subject'}’s reputation. Your words are only read to understand the rumor; the village repeats the rumor, not your words.`;
      suggestions.open = !ownText.trim() && !libraryClaim;
      feedback.textContent = about === listener && ownText.trim() ? 'Pick someone else to hear this story.' : '';
      update();
    };
    aboutSelect.addEventListener('change', () => { about = aboutSelect.value; describe(); });
    meaningSelect.addEventListener('change', () => { kind = meaningSelect.value as GameClaim['kind']; describe(); });
    weightSelect.addEventListener('change', () => { severity = Number(weightSelect.value) as GameClaim['severity']; describe(); });
    typed.addEventListener('input', () => {
      invalidate();
      confirmation.hidden = true;
      ownText = typed.value;
      claimId = null;
      libraryClaim = null;
      what.querySelectorAll<HTMLInputElement>('input').forEach((input) => { input.checked = false; });
      describe();
    });
    const manualFields = h('div', { class: 'story-meaning', hidden: ai },
      h('label', null, 'About', aboutSelect), h('label', null, 'Kind of story', meaningSelect), h('label', null, 'Weight', weightSelect));
    const confirmation = h('div', { class: 'whisper-confirmation', hidden: true, role: 'status' });
    showManual = () => { manualFields.hidden = false; confirmation.hidden = true; aboutSelect.focus(); };
    showConfirmation = () => {
      if (!confirmed) return;
      confirmation.replaceChildren(h('p', null, `${sim.cast.get(listener!)?.name ?? 'They'} will hear: ${confirmed.text}`),
        h('button', { type: 'button', class: 'button button-quiet', onclick: () => {
          if (!confirmed) return;
          about = confirmed.about; kind = confirmed.kind; severity = confirmed.severity;
          aboutSelect.value = about; meaningSelect.value = kind; weightSelect.value = String(severity);
          confirmed = null; manual = true; showManual(); describe();
        } }, 'Change it'));
      confirmation.hidden = false;
    };
    const suggestions = h('details', { class: 'whisper-suggestions authored-stories', open: true }, h('summary', null, 'Or choose a village story'), what);
    const library = createRumorLibrary(rumorLibrary.map(pack => ({ ...pack,
      stories: pack.stories.filter(story => sim.cast.has(story.claim.about)),
    })).filter(pack => pack.stories.length), claim => {
      invalidate();
      confirmation.hidden = true;
      libraryClaim = claim;
      claimId = claim.id;
      ownText = ''; typed.value = '';
      what.querySelectorAll<HTMLInputElement>('input').forEach(input => { input.checked = false; });
      describe();
      feedback.textContent = 'Selected from the library. No AI credits used.';
      sendBtn.focus();
    });
    content.replaceChildren(who,
      h('label', { class: 'own-claim', for: 'rt-own-story' }, h('span', null, 'Write your whisper'), typed),
      h('p', { class: 'sheet-note' }, ai ? 'Write it in your own words. The village will ask you to confirm the rumor.' : 'Write it in your own words. Choose how the villagers should treat it.'),
      manualFields, confirmation, preview, library, suggestions);
    describe();
    update();
  };

  const api: WhisperSheet = {
    el,
    open(opts = {}) {
      turnstile?.destroy();
      turnstile = undefined;
      if (!ctx.flow) flow = undefined;
      activeRevision = -1;
      busy = false;
      form.removeAttribute('aria-busy');
      build(opts.listener);
      if (!open) {
        open = true;
        reveal(el);
        ctx.layers.open({ id: 'whisper', el, modal: true, close: () => api.close() }, opts.opener);
        ctx.onOpenChange(true);
      }
      api.warm();
      // Keep the phone keyboard closed; the listener remains keyboard reachable.
      const target = el.querySelector<HTMLElement>(inReach(ctx.snapshot()).length
        ? ctx.isPhone() ? '.whisper-who input' : '.own-claim textarea'
        : '.walk-to');
      (target ?? el.querySelector<HTMLElement>('.close'))?.focus({ preventScroll: true });
    },
    warm() {
      if (!ai || !open) return;
      if (!flow) {
        const container = h('div', { class: 'whisper-challenge' });
        content.appendChild(container);
        turnstile = loadTurnstile(siteKey, container);
        const clientFlow = createWhisperFlow({ baseUrl, castVersion, turnstile, onStateChange: state => {
          if (!open || !busy || activeRevision !== revision || flow !== clientFlow) return;
          if (state.status === 'checking') feedback.textContent = "Checking you're human…";
          if (state.status === 'asking') feedback.textContent = 'Asking the village…';
        } });
        flow = clientFlow;
      }
      flow.warm?.();
    },
    close() {
      if (!open) return;
      open = false;
      invalidate();
      activeRevision = -1;
      busy = false;
      form.removeAttribute('aria-busy');
      turnstile?.destroy();
      turnstile = undefined;
      if (!ctx.flow) flow = undefined;
      ownText = '';
      const typed = content.querySelector<HTMLTextAreaElement>('.own-claim textarea');
      if (typed) typed.value = '';
      conceal(el, ctx.reducedMotion());
      ctx.layers.closed('whisper');
      ctx.onOpenChange(false);
    },
    isOpen: () => open,
    cover: () => (open && ctx.isPhone() ? el.offsetHeight : 0),
    destroy() { api.close(); turnstile?.destroy(); },
  };
  return api;
}
