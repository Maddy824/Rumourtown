/**
 * The whisper sheet, opened from the postbox: who is within two tiles, player-written stories and optional ready-made claims. Time holds while it is open.
 */
import type { ClaimId } from 'rumormind';
import { createWrittenClaim, MAX_WRITTEN_TEXT } from '../sim/registered-claim.js';
import type { GameClaim, Simulation, VillagerId, VillagerView, WorldSnapshot } from '../sim/types.js';
import { conceal, h, reveal } from './dom.js';
import { faceImg } from './faces.js';
import { glyphSvg } from './glyphs.js';
import { closeIcon } from './icons.js';
import type { Layers } from './layers.js';

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
}

export interface WhisperSheet {
  readonly el: HTMLElement;
  open(opts?: { listener?: VillagerId; opener?: Element | null }): void;
  close(): void;
  isOpen(): boolean;
  cover(): number;
  destroy(): void;
}

export function inReach(snap: WorldSnapshot): VillagerView[] {
  const p = snap.player.pos;
  return snap.villagers
    .map((v) => ({ v, d: Math.hypot(v.pos.x - p.x, v.pos.y - p.y) }))
    .filter((x) => x.d <= WHISPER_RANGE)
    .sort((a, b) => a.d - b.d)
    .map((x) => x.v);
}

export function createWhisperSheet(ctx: WhisperContext): WhisperSheet {
  const content = h('div', { class: 'whisper-content' });
  const feedback = h('p', { class: 'whisper-feedback', role: 'status' });
  const sendBtn = h('button', { class: 'button button-primary', type: 'submit', disabled: true }, 'Whisper');
  const form = h('form', { class: 'whisper-form', novalidate: true }, content, h('div', { class: 'whisper-actions' }, feedback, sendBtn));
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
  let ownText = '';
  let about = '';
  let kind: GameClaim['kind'] = 'lying';
  let severity: GameClaim['severity'] = 2;

  const update = (): void => {
    sendBtn.disabled = !(listener && (claimId || (ownText.trim() && about && about !== listener)));
  };

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    if (!listener) return;
    const to = listener;
    const sim = ctx.sim();
    const name = sim.cast.get(to)?.name ?? 'They';
    let chosen = claimId;
    if (ownText.trim()) {
      if (about === to) {
        feedback.textContent = 'Choose a listener other than the person your story is about.';
        return;
      }
      try {
        const claim = createWrittenClaim(ownText, about, kind, severity, sim.cast);
        sim.registerClaim(claim);
        chosen = claim.id;
      } catch {
        feedback.textContent = `Use one sentence of up to ${MAX_WRITTEN_TEXT} characters and choose its subject.`;
        return;
      }
    }
    if (!chosen) return;
    if (sim.claims.get(chosen)?.about === to) {
      feedback.textContent = 'Say that to my face? Choose a story about someone else.';
      return;
    }
    if (ctx.whisper(to, chosen)) {
      api.close();
    } else {
      feedback.textContent = `${name} is out of reach now. Walk closer and try again.`;
    }
  });

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
    const sim = ctx.sim();
    const snap = ctx.snapshot();
    const near = inReach(snap);
    feedback.textContent = '';
    listener = preferred && near.some((v) => v.id === preferred) ? preferred : near[0]?.id ?? null;

    if (near.length === 0) {
      const p = snap.player.pos;
      const nearest = [...snap.villagers]
        .sort((a, b) => Math.hypot(a.pos.x - p.x, a.pos.y - p.y) - Math.hypot(b.pos.x - p.x, b.pos.y - p.y))
        .slice(0, 3);
      content.replaceChildren(
        h('div', { class: 'whisper-empty' },
          h('p', { class: 'whisper-empty-lead' }, 'Walk closer to someone first.'),
          h('p', null, ctx.isPhone() ? 'Tap the village to walk there, or go to someone nearby:' : 'Click the village or use the arrow keys to walk, or go to someone nearby:'),
          h('div', { class: 'walk-list' },
            nearest.map((v) =>
              h('button', { class: 'button button-quiet walk-to', type: 'button', onclick: () => { api.close(); ctx.walkTo(v.id); } },
                faceImg(v.id, v.look, 24), `Walk to ${v.name}`)))));
      form.dataset.empty = 'true';
      claimId = null;
      update();
      return;
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
              claimId = c.id;
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
      const picked = claimId ? sim.claims.get(claimId) : undefined;
      const helps = picked ? picked.valence > 0 : ['kindness', 'paid-debt', 'nursed'].includes(kind);
      preview.textContent = picked ? `Selected: ${picked.text}` : `${ownText.length}/${MAX_WRITTEN_TEXT} characters. ${helps ? 'Helps' : 'Hurts'} ${sim.cast.get(about)?.name ?? 'the subject'}’s reputation. Your words stay in the story and its shared link.`;
      feedback.textContent = about === listener && ownText.trim() ? 'Pick someone else to hear this story.' : '';
      update();
    };
    aboutSelect.addEventListener('change', () => { about = aboutSelect.value; describe(); });
    meaningSelect.addEventListener('change', () => { kind = meaningSelect.value as GameClaim['kind']; describe(); });
    weightSelect.addEventListener('change', () => { severity = Number(weightSelect.value) as GameClaim['severity']; describe(); });
    typed.addEventListener('input', () => {
      ownText = typed.value;
      claimId = null;
      what.querySelectorAll<HTMLInputElement>('input').forEach((input) => { input.checked = false; });
      describe();
    });
    const suggestions = h('details', { class: 'whisper-suggestions' }, h('summary', null, 'Or choose a village story'), what);
    content.replaceChildren(who,
      h('label', { class: 'own-claim', for: 'rt-own-story' }, h('span', null, 'Write your whisper'), typed),
      h('p', { class: 'sheet-note' }, 'Write it in your own words. Choose how the villagers should treat it.'),
      h('div', { class: 'story-meaning' },
        h('label', null, 'About', aboutSelect), h('label', null, 'Kind of story', meaningSelect), h('label', null, 'Weight', weightSelect)),
      preview, suggestions);
    describe();
    update();
  };

  const api: WhisperSheet = {
    el,
    open(opts = {}) {
      build(opts.listener);
      if (!open) {
        open = true;
        reveal(el);
        ctx.layers.open({ id: 'whisper', el, modal: true, close: () => api.close() }, opts.opener);
        ctx.onOpenChange(true);
      }
      // Start with writing; with nobody in reach, offer the first walk-to button.
      const target = ['.own-claim textarea', '.walk-to', '.close']
        .map((sel) => el.querySelector<HTMLElement>(sel))
        .find((x): x is HTMLElement => x !== null);
      target?.focus({ preventScroll: true });
      el.querySelector('.claim input:checked')?.closest('.claim')?.scrollIntoView({ block: 'nearest' });
    },
    close() {
      if (!open) return;
      open = false;
      ownText = '';
      const typed = content.querySelector<HTMLTextAreaElement>('.own-claim textarea');
      if (typed) typed.value = '';
      conceal(el, ctx.reducedMotion());
      ctx.layers.closed('whisper');
      ctx.onOpenChange(false);
    },
    isOpen: () => open,
    cover: () => (open && ctx.isPhone() ? el.offsetHeight : 0),
    destroy() { api.close(); },
  };
  return api;
}
