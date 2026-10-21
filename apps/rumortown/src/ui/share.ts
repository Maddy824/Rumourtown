/**
 * "Pin to the board": copies a link that replays this village exactly and shows the share card, which can
 * be saved as a PNG.
 */
import type { ClaimId } from 'rumormind';
import type { Inspection, Intervention, ShareState, Simulation, VillageMap, VillagerId, WorldSnapshot } from '../sim/types.js';
import { conceal, h, reveal } from './dom.js';
import { KIND_LABEL, dayIndexOfTick, moodWord, percent } from './format.js';
import { closeIcon } from './icons.js';
import type { Layers } from './layers.js';
import { drawShareCard, type ShareCardData, type ShareFace } from './share-card.js';
import { shareUrl } from './share-link.js';

export interface ShareContext {
  sim: () => Simulation;
  snapshot: () => WorldSnapshot;
  map: VillageMap;
  layers: Layers;
  reducedMotion: () => boolean;
  shareState: () => ShareState;
  interventions: () => readonly Intervention[];
  onOpenChange: (open: boolean) => void;
}

export interface SharePanel {
  readonly el: HTMLElement;
  open(opener?: Element | null): void;
  close(): void;
  isOpen(): boolean;
}

function verdictFor(confidence: number | null): string {
  if (confidence === null) return 'Never heard it';
  if (confidence >= 0.75) return 'Sure of it';
  if (confidence >= 0.5) return 'Half believes it';
  if (confidence >= 0.25) return 'Doubts it';
  return 'Not buying it';
}

/** Everything the card shows, worked out from the run as it stands. */
export function shareCardData(sim: Simulation, snap: WorldSnapshot, map: VillageMap, all: readonly Intervention[]): ShareCardData {
  const whispers = all.filter((i) => i.tick <= sim.tick);
  const inspections = new Map<VillagerId, Inspection>();
  for (const v of snap.villagers) {
    try {
      inspections.set(v.id, sim.inspect(v.id));
    } catch {
      /* A villager the engine cannot describe is left off the card. */
    }
  }
  const trusts = [...inspections.values()].map((i) => i.trustInStranger);
  const strangerTrust = trusts.length ? trusts.reduce((a, b) => a + b, 0) / trusts.length : null;
  const lookOf = (id: VillagerId) => snap.villagers.find((v) => v.id === id)?.look ?? sim.cast.get(id)?.look ?? 'stranger';
  const nameOf = (id: VillagerId): string => sim.cast.get(id)?.name ?? id;
  const confidence = (id: VillagerId, claimId: ClaimId): number | null => {
    const b = inspections.get(id)?.beliefs.find((x) => x.claimId === claimId);
    return b ? b.confidence : null;
  };

  // The main claim is the stranger's whisper that travelled furthest.
  const counts = new Map<ClaimId, number>();
  for (const t of snap.threads) counts.set(t.claimId, (counts.get(t.claimId) ?? 0) + 1);
  let main: Intervention | undefined;
  for (const w of whispers) if (!main || (counts.get(w.claimId) ?? 0) > (counts.get(main.claimId) ?? 0)) main = w;
  const claim = main ? sim.claims.get(main.claimId) : undefined;

  const faces: ShareFace[] = [];
  if (main && claim) {
    const ids: VillagerId[] = [main.listener];
    let believer: VillagerId | null = null;
    let best = -1;
    for (const [id] of inspections) {
      if (id === main.listener || id === claim.about) continue;
      const c = confidence(id, claim.id);
      if (c !== null && c > best) {
        best = c;
        believer = id;
      }
    }
    if (!believer) believer = [...snap.threads].reverse().find((t) => t.claimId === claim.id && t.to !== main?.listener && t.to !== claim.about)?.to ?? null;
    if (believer) ids.push(believer);
    if (!ids.includes(claim.about)) ids.push(claim.about);
    for (const id of ids.slice(0, 3)) {
      let verdict: string;
      if (id === claim.about) {
        const mood = inspections.get(id)?.mood ?? 0;
        verdict = claim.valence < 0 ? (mood < -0.35 ? 'Hurt' : mood < -0.1 ? 'Shaken' : 'Unbothered') : mood > 0.2 ? 'Pleased' : 'Unaware';
      } else {
        verdict = verdictFor(confidence(id, claim.id));
      }
      faces.push({ look: lookOf(id), name: nameOf(id), verdict });
    }
  } else {
    const p = snap.player.pos;
    const near = [...snap.villagers]
      .sort((a, b) => (a.tier === 'core' ? 0 : 1) - (b.tier === 'core' ? 0 : 1) || Math.hypot(a.pos.x - p.x, a.pos.y - p.y) - Math.hypot(b.pos.x - p.x, b.pos.y - p.y))
      .slice(0, 3);
    for (const v of near) faces.push({ look: v.look, name: v.name, verdict: moodWord(inspections.get(v.id)?.mood ?? v.mood) });
  }

  return {
    map,
    snapshot: snap,
    claim: claim ? { kind: claim.kind, valence: claim.valence, about: nameOf(claim.about) } : null,
    threads: claim ? snap.threads.filter((t) => t.claimId === claim.id) : snap.threads,
    faces,
    strangerTrust: whispers.length ? strangerTrust : null,
    day: dayIndexOfTick(sim.tick) + 1,
  };
}

function altText(d: ShareCardData): string {
  const parts = [d.claim ? `A rumor card about ${d.claim.about}: ${KIND_LABEL[d.claim.kind].toLowerCase()}.` : 'A card of a quiet village.'];
  for (const f of d.faces) parts.push(`${f.name}: ${f.verdict.toLowerCase()}.`);
  if (d.strangerTrust !== null) parts.push(`The stranger’s word: ${percent(d.strangerTrust)}.`);
  return parts.join(' ');
}

export function createShare(ctx: ShareContext): SharePanel {
  const img = h('img', { class: 'share-img', alt: '', width: 1200, height: 630 });
  const status = h('p', { class: 'share-status', role: 'status' });
  const url = h('input', { class: 'share-url', id: 'rt-share-url', type: 'text', readonly: true, spellcheck: 'false' });
  const copyBtn = h('button', { class: 'button button-primary', type: 'button' }, 'Copy link');
  const download = h('a', { class: 'button button-quiet', download: 'rumortown.png', href: '#' }, 'Download picture');
  const el = h('section', { class: 'card share', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'rt-share-title', hidden: true },
    h('div', { class: 'card-paper' },
      h('header', { class: 'card-head' },
        h('h2', { id: 'rt-share-title', class: 'card-title' }, 'Pin to the board'),
        h('button', { class: 'close', type: 'button', 'aria-label': 'Close', onclick: () => api.close() }, closeIcon())),
      h('figure', { class: 'share-figure' }, img),
      status,
      h('label', { class: 'share-link', for: 'rt-share-url' }, h('span', null, 'Link to this village'), url),
      h('div', { class: 'card-actions' }, copyBtn, download)));

  let open = false;
  let objectUrl: string | null = null;
  const canvas = document.createElement('canvas');

  const copy = async (): Promise<void> => {
    try {
      if (!navigator.clipboard) throw new Error('no clipboard');
      await navigator.clipboard.writeText(url.value);
      status.textContent = 'Link copied. It replays this village exactly, whispers and all.';
    } catch {
      url.focus();
      url.select();
      status.textContent = 'Copy the link below. It replays this village exactly, whispers and all.';
    }
  };
  copyBtn.addEventListener('click', () => void copy());
  url.addEventListener('focus', () => url.select());

  const draw = async (): Promise<void> => {
    try {
      await Promise.all([
        document.fonts.load(`700 24px "Bricolage Grotesque"`),
        document.fonts.load(`800 60px "Bricolage Grotesque"`),
      ]);
    } catch {
      /* The card falls back to the system face. */
    }
    const data = shareCardData(ctx.sim(), ctx.snapshot(), ctx.map, ctx.interventions());
    drawShareCard(canvas, data);
    img.alt = altText(data);
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
    canvas.toBlob((blob) => {
      if (!blob) return;
      objectUrl = URL.createObjectURL(blob);
      img.src = objectUrl;
      download.href = objectUrl;
      download.setAttribute('download', `rumortown-day-${data.day}.png`);
    }, 'image/png');
  };

  const api: SharePanel = {
    el,
    open(opener) {
      url.value = shareUrl(ctx.shareState());
      status.textContent = '';
      if (!open) {
        open = true;
        reveal(el);
        ctx.layers.open({ id: 'share', el, modal: true, close: () => api.close() }, opener);
        ctx.onOpenChange(true);
      }
      copyBtn.focus({ preventScroll: true });
      void copy();
      void draw();
    },
    close() {
      if (!open) return;
      open = false;
      conceal(el, ctx.reducedMotion());
      ctx.layers.closed('share');
      ctx.onOpenChange(false);
    },
    isOpen: () => open,
  };
  return api;
}
