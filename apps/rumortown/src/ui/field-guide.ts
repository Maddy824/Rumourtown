/** The travel atlas and observation notebook share a keyboard-accessible paper surface. */
import type { Simulation, Vec2, VillageMap, WorldSnapshot } from '../sim/types.js';
import { CONDITIONS, eventsCsv, exportRun, observe, pairedExperiment, SOURCES, type Condition, type Factory } from '../research/model.js';
import { h, svg } from './dom.js';
import { closeIcon } from './icons.js';
import type { Layers } from './layers.js';
import { districtAt, districtViews, buildingIcons } from '../content/map/wayfinding.js';
import { CORE_PEOPLE } from './name-labels.js';
import { activityText, tickClock } from './format.js';

type Mode = 'explore' | 'research';
const colours: Record<string, string> = { grass: '#6B8E4E', path: '#E8DCC3', water: '#3F5E8A', bridge: '#b7a785', field: '#a5a25f', floor: '#E8DCC3', door: '#b7a785', wall: '#A3323B', tree: '#5e7d45', well: '#2E2A22' };

export function createFieldGuide(ctx: {
  sim: () => Simulation; snapshot: () => WorldSnapshot; map: VillageMap;
  seed: number; castVersion: string; layers: Layers; make: Factory;
  walkTo: (point: Vec2) => void; inspect: (id: string) => void;
  onOpenChange: (open: boolean, mode: Mode) => void;
}) {
  const heading = h('h2', { id: 'rt-guide-title', tabindex: '-1' }, 'Explore the village');
  const close = h('button', { class: 'close', type: 'button', 'aria-label': 'Close village guide', onclick: () => api.close() }, closeIcon());
  const tabs = h('div', { class: 'guide-tabs', role: 'group', 'aria-label': 'Village guide' });
  const exploreTab = h('button', { class: 'button button-quiet', type: 'button', onclick: () => setMode('explore') }, 'Explore');
  const researchTab = h('button', { class: 'button button-quiet', type: 'button', onclick: () => setMode('research') }, 'Research notebook');
  tabs.append(exploreTab, researchTab);

  const mapEl = svg('svg', { class: 'atlas-map', viewBox: `0 0 ${ctx.map.width * 10} ${ctx.map.height * 10}`, role: 'img', 'aria-label': 'Live village map. Use the destination buttons below to travel by keyboard.' });
  const defs = svg('defs', null,
    svg('pattern', { id: 'atlas-cobbles', width: 8, height: 6, patternUnits: 'userSpaceOnUse' }, svg('rect', { width: 8, height: 6, fill: '#E8DCC3' }), svg('path', { d: 'M0 0H8V6H0Z M4 0V6', fill: 'none', stroke: '#b7a785', 'stroke-width': .6, 'stroke-dasharray': '1 1' })),
    svg('pattern', { id: 'atlas-fields', width: 6, height: 6, patternUnits: 'userSpaceOnUse' }, svg('rect', { width: 6, height: 6, fill: '#89a56e' }), svg('path', { d: 'M0 2H6M0 5H6', stroke: '#6B8E4E', 'stroke-width': 1 })),
    svg('pattern', { id: 'atlas-woods', width: 10, height: 10, patternUnits: 'userSpaceOnUse' }, svg('rect', { width: 10, height: 10, fill: '#5e7d45' }), svg('circle', { cx: 3, cy: 3, r: 2, fill: '#6B8E4E' }), svg('circle', { cx: 8, cy: 8, r: 2.5, fill: '#4c6b37' })));
  mapEl.append(defs);
  // Run-length rows keep the static map small; live markers are updated in place.
  for (let y = 0; y < ctx.map.height; y++) for (let x = 0; x < ctx.map.width;) {
    const tile = ctx.map.tiles[y * ctx.map.width + x]!;
    let end = x + 1;
    const district = districtAt({ x, y });
    while (end < ctx.map.width && ctx.map.tiles[y * ctx.map.width + end] === tile && districtAt({ x: end, y }) === district) end++;
    mapEl.append(svg('rect', { x: x * 10, y: y * 10, width: (end - x) * 10, height: 10, fill: tile === 'grass' ? district === 'commons' ? 'url(#atlas-fields)' : district === 'woodland' ? 'url(#atlas-woods)' : districtViews.find(d => d.id === district)!.ground : tile === 'path' && district === 'old-village' ? 'url(#atlas-cobbles)' : colours[tile] ?? colours.grass }));
    x = end;
  }
  for (const district of districtViews) {
    const w = district.name.length * 8 + 16;
    mapEl.append(svg('g', { class: 'atlas-district', 'data-destination': district.id, transform: `translate(${district.tag.x * 10} ${district.tag.y * 10})` },
      svg('rect', { x: -w / 2, y: -12, width: w, height: 23, rx: 2, fill: '#F6F0E4', stroke: '#2E2A22', 'stroke-width': .8, 'stroke-dasharray': '2 2' }),
      svg('text', { 'text-anchor': 'middle', y: 4, fill: '#2E2A22', 'font-size': 16, 'font-weight': 700 }, district.name)));
  }
  for (const place of ctx.map.places.filter(p => buildingIcons[p.kind])) {
    const name = `${buildingIcons[place.kind]} ${place.name}`;
    const w = name.length * 6.5 + 10;
    const cx = Math.max(w / 2 + 2, Math.min(ctx.map.width * 10 - w / 2 - 2, (place.rect.x + place.rect.w / 2) * 10));
    mapEl.append(svg('g', { class: 'atlas-building', 'data-place': place.id, transform: `translate(${cx} ${(place.rect.y + place.rect.h / 2) * 10})` },
      svg('rect', { x: -w / 2, y: -9, width: w, height: 18, rx: 2, fill: '#F6F0E4', stroke: '#2E2A22', 'stroke-width': .5 }),
      svg('text', { 'text-anchor': 'middle', y: 4, fill: '#2E2A22', 'font-size': 12, 'font-weight': 650 }, name)));
  }
  const markers = new Map<string, { group: SVGGElement; dot: SVGCircleElement; title: SVGTitleElement }>();
  for (const d of ctx.sim().cast.values()) {
    const title = svg('title', null, d.name);
    const dot = svg('circle', { r: 4, fill: '#F6F0E4', stroke: '#2E2A22', 'stroke-width': 1 });
    const group = svg('g', { 'data-villager': d.id, 'data-core': String((CORE_PEOPLE as readonly string[]).includes(d.id)) }, dot, svg('text', { y: -6, 'text-anchor': 'middle', fill: '#2E2A22', 'font-size': 13, 'font-weight': 700, 'paint-order': 'stroke', stroke: '#F6F0E4', 'stroke-width': 2 }, d.name), title);
    markers.set(d.id, { group, dot, title }); mapEl.append(group);
  }
  const player = svg('g', null, svg('circle', { r: 5, fill: '#D9A531', stroke: '#2E2A22', 'stroke-width': 2 }), svg('text', { y: -8, 'text-anchor': 'middle', 'font-size': 9, 'font-weight': 800, fill: '#2E2A22', 'paint-order': 'stroke', stroke: '#F6F0E4', 'stroke-width': 2 }, 'You'));
  mapEl.append(player);
  const nameToggle = h('input', { type: 'checkbox' });
  nameToggle.addEventListener('change', () => { mapEl.dataset.names = String(nameToggle.checked); });
  mapEl.dataset.names = 'false';
  const districtNote = h('p', { class: 'district-note' }, 'Tap a district tag to walk there. Choose a neighbourhood below for a closer look.');
  const districtButtons = h('div', { class: 'district-tabs', role: 'group', 'aria-label': 'Neighbourhoods' });
  const districts = [{ id: '', name: 'Whole town', description: 'Explore both riverbanks and meet the neighbours along the way.' }, ...(ctx.map.districts ?? []).map(d => ({ ...d, name: districtViews.find(v => v.id === d.id)?.name ?? d.name }))];
  for (const district of districts) {
    districtButtons.append(h('button', { type: 'button', class: 'button button-quiet', 'aria-pressed': String(!district.id),
      'data-district': district.id, onclick: () => selectDistrict(district.id) }, district.name));
  }
  function selectDistrict(id: string): void {
    for (const b of districtButtons.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.district === id));
    districtNote.textContent = districts.find(d => d.id === id)?.description ?? '';
    const places = ctx.map.places.filter(p => !id || p.district === id);
    let x = 0, y = 0, right = ctx.map.width, bottom = ctx.map.height;
    if (id && places.length) {
      x = Math.max(0, Math.min(...places.map(p => p.rect.x)) - 2);
      y = Math.max(0, Math.min(...places.map(p => p.rect.y)) - 2);
      right = Math.min(ctx.map.width, Math.max(...places.map(p => p.rect.x + p.rect.w)) + 2);
      bottom = Math.min(ctx.map.height, Math.max(...places.map(p => p.rect.y + p.rect.h)) + 2);
    }
    mapEl.setAttribute('viewBox', `${x * 10} ${y * 10} ${(right - x) * 10} ${(bottom - y) * 10}`);
    for (const button of travel.querySelectorAll('button')) button.hidden = !!id && button.dataset.district !== id;
    for (const row of peopleList.querySelectorAll('li')) row.hidden = !!id && !row.dataset.districts?.split(' ').includes(id);
    peopleSummary.textContent = id ? `Meet people from ${districts.find(d => d.id === id)?.name}` : `Meet all ${ctx.sim().cast.size} people`;
  }
  const whereabouts = h('p', { class: 'guide-location' });
  const travel = h('div', { class: 'travel-grid' });
  for (const place of ctx.map.places.filter(p => p.kind !== 'home' && p.id !== 'well')) {
    travel.append(h('button', { type: 'button', class: 'button button-quiet', 'data-district': place.district ?? '', onclick: () => { api.close(); ctx.walkTo(place.door); } }, place.name));
  }
  const peopleList = h('ul', { class: 'guide-people' });
  const peopleStatus = new Map<string, HTMLElement>();
  for (const d of ctx.sim().cast.values()) {
    const status = h('span'); peopleStatus.set(d.id, status);
    peopleList.append(h('li', { 'data-districts': ctx.map.places.filter(p => p.id === d.home || p.id === d.workplace).map(p => p.district).join(' ') },
      h('button', { type: 'button', class: 'text-button', onclick: () => { api.close(); ctx.inspect(d.id); } }, `${d.name}, ${d.role}`), status));
  }
  const peopleSummary = h('summary', null, `Meet all ${ctx.sim().cast.size} people`);
  const conversations = h('ul', { class: 'guide-conversations' });
  const explore = h('div', { class: 'guide-body' },
    h('p', { class: 'guide-intro' }, 'A village in motion'),
    h('p', null, 'Tap the map or choose a destination to walk there. Tap a person to meet them. Gold is you; red marks someone speaking.'),
    districtButtons, districtNote, h('label', { class: 'atlas-name-toggle' }, nameToggle, 'Show everyone’s name'), mapEl, whereabouts,
    h('h3', null, 'Where would you like to go?'), travel,
    h('details', { class: 'guide-people-list' }, peopleSummary, peopleList),
    h('h3', null, 'Conversations around the village'), conversations,
    h('p', { class: 'empty' }, 'Click the ground to walk. Hold W, A, S, D or an arrow key to keep moving. Enter meets someone nearby; Space pauses time. Water and walls block walking. Cross the river at the old bridge or the commons bridge.'));

  const metrics = h('p', { class: 'guide-metrics' });
  const noteStatus = h('p', { class: 'guide-status', role: 'status', 'aria-live': 'polite' });
  const results = h('div', { class: 'experiment-results' });
  const condition = h('select', { id: 'rt-experiment-condition' }, Object.entries(CONDITIONS).map(([value, item]) => h('option', { value }, item.label)));
  const count = h('select', { id: 'rt-experiment-count' }, h('option', { value: '1' }, 'This seed'), h('option', { value: '5' }, 'Five consecutive seeds'));
  const run = h('button', { type: 'button', class: 'button button-primary', onclick: () => void experiment() }, 'Compare three days');
  const cancel = h('button', { type: 'button', class: 'button button-quiet', hidden: true, onclick: () => { job++; resetJob('Comparison cancelled.'); } }, 'Cancel comparison');
  const downloadResult = h('button', { type: 'button', class: 'button button-quiet', hidden: true, onclick: () => download('experiment.json', JSON.stringify(lastResult, null, 2), 'application/json') }, 'Download comparison');
  const research = h('div', { class: 'guide-body', hidden: true },
    h('p', { class: 'guide-intro' }, 'Watch a story become a belief'),
    h('p', null, 'This is a research-informed, synthetic world for exploring hypotheses. Its characters and coefficients are authored. It has not been calibrated or validated against human behaviour.'),
    metrics,
    h('h3', null, 'Save your observations'),
    h('p', null, 'JSON includes the seed, inputs, map, character motives, parameters, beliefs, relationships and event log. Spoken lines record their location. CSV contains the event table.'),
    h('div', { class: 'guide-actions' },
      h('button', { type: 'button', class: 'button button-quiet', onclick: () => download('observation.json', JSON.stringify(exportRun(ctx.sim(), ctx.seed, ctx.castVersion, ctx.map), null, 2), 'application/json') }, 'Download run JSON'),
      h('button', { type: 'button', class: 'button button-quiet', onclick: () => download('events.csv', eventsCsv(ctx.sim()), 'text/csv') }, 'Download events CSV')),
    h('h3', null, 'Change one assumption'),
    h('p', null, 'Run the same inputs for three days with one rule changed. The ordinary village stays where you left it. Several seeds help reveal how much results vary.'),
    h('label', { for: 'rt-experiment-condition' }, 'Compare ordinary rules with'), condition,
    h('label', { for: 'rt-experiment-count' }, 'Seed sample'), count,
    h('div', { class: 'guide-actions' }, run, cancel, downloadResult), noteStatus, results,
    h('p', { class: 'empty' }, 'Harmful beliefs means negative claims held above 50% confidence, whether true or false. Claim tellings counts spoken lines carrying a claim, including corrections. These are simulated outcomes, not human effect sizes. Paired seeds do not keep random draws aligned after runs diverge.'),
    h('h3', null, 'Research behind the rules'),
    h('ul', { class: 'guide-sources' }, SOURCES.map(source => h('li', null, h('a', { href: source.url, target: '_blank', rel: 'noopener noreferrer' }, source.title), h('p', null, source.use)))),
    h('p', null, 'The model also tracks source credibility, repetition, first-hand evidence, affinity bias, corrections and fading source memory. Exact weights and their limitations are documented in docs/research-model.md in the repository.'));

  const el = h('section', { class: 'field-guide', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'rt-guide-title', hidden: true },
    h('div', { class: 'guide-paper' }, h('header', { class: 'sheet-head' }, heading, close), tabs, explore, research));
  let mode: Mode = 'explore';
  let open = false;
  let lastTick = -1;
  let job = 0;
  let destroyed = false;
  let lastResult: unknown = null;

  function download(suffix: string, content: string, mime: string): void {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const a = h('a', { href: url, download: `rumortown-${ctx.seed}-${suffix}` });
    document.body.append(a); a.click(); a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function resetJob(message: string): void {
    run.disabled = false; condition.disabled = false; count.disabled = false; cancel.hidden = true;
    noteStatus.textContent = message;
  }
  async function experiment(): Promise<void> {
    const token = ++job;
    run.disabled = true; condition.disabled = true; count.disabled = true; cancel.hidden = false; downloadResult.hidden = true;
    results.replaceChildren();
    const selected = condition.value as Condition;
    const setup = exportRun(ctx.sim(), ctx.seed, ctx.castVersion, ctx.map);
    try {
      const result = await pairedExperiment(ctx.make, ctx.seed, ctx.sim().interventions(), selected, Number(count.value), (done, total) => {
        if (token === job && !destroyed) noteStatus.textContent = `Comparing villages… ${Math.round(done / total * 100)}%`;
      }, () => destroyed || token !== job);
      if (!result || destroyed || token !== job) return;
      lastResult = { setup, experiment: result };
      const table = h('table', null, h('caption', null, 'At the end of three days'),
        h('thead', null, h('tr', null, ['Seed', 'Rules', 'Harmful beliefs', 'Claim tellings', 'Trust in you'].map(label => h('th', { scope: 'col' }, label)))),
        h('tbody', null, result.runs.flatMap(row => ([['Ordinary', row.baseline], ['Changed', row.comparison]] as const).map(([label, data]) =>
          h('tr', null, h('td', null, row.seed), h('td', null, label), h('td', null, data.harmfulBeliefs), h('td', null, data.claimTellings), h('td', null, `${Math.round(data.meanTrustInStranger * 100)}%`))))));
      results.append(table); downloadResult.hidden = false;
      resetJob(`Comparison finished for ${result.runs.length} seed${result.runs.length === 1 ? '' : 's'}.`);
    } catch {
      if (token === job && !destroyed) resetJob('The comparison could not finish. Your village is unchanged.');
    }
  }
  function placeName(pos: Vec2): string {
    let best: VillageMap['places'][number] | undefined;
    for (const p of ctx.map.places) if (pos.x >= p.rect.x && pos.x < p.rect.x + p.rect.w && pos.y >= p.rect.y && pos.y < p.rect.y + p.rect.h && (!best || p.rect.w * p.rect.h < best.rect.w * best.rect.h)) best = p;
    return best?.name ?? (pos.y >= 33 ? 'Commons lanes' : pos.x >= 43 ? 'Eastbank lanes' : pos.x >= 39 ? 'Riverside lane' : 'Village lanes');
  }
  function setMode(next: Mode): void {
    mode = next;
    explore.hidden = next !== 'explore'; research.hidden = next !== 'research';
    exploreTab.setAttribute('aria-pressed', String(next === 'explore'));
    researchTab.setAttribute('aria-pressed', String(next === 'research'));
    (next === 'explore' ? explore : research).scrollTop = 0;
    heading.textContent = next === 'explore' ? 'Explore the village' : 'Research notebook';
    if (open) { ctx.onOpenChange(true, next); lastTick = -1; api.update(); }
  }
  mapEl.addEventListener('click', ev => {
    const target = ev.target as Element;
    const destination = target.closest('[data-destination]')?.getAttribute('data-destination');
    if (destination) { const district = districtViews.find(d => d.id === destination); if (district) { api.close(); ctx.walkTo(district.door); return; } }
    const placeId = target.closest('[data-place]')?.getAttribute('data-place');
    if (placeId) { const place = ctx.map.places.find(p => p.id === placeId); if (place) { api.close(); ctx.walkTo(place.door); return; } }
    const id = target.closest('[data-villager]')?.getAttribute('data-villager');
    if (id) { api.close(); ctx.inspect(id); return; }
    const transform = mapEl.getScreenCTM();
    if (!transform) return;
    const point = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(transform.inverse());
    const tile = { x: Math.floor(point.x / 10), y: Math.floor(point.y / 10) };
    const building = ctx.map.places.find(p => buildingIcons[p.kind] && tile.x >= p.rect.x && tile.x < p.rect.x + p.rect.w && tile.y >= p.rect.y && tile.y < p.rect.y + p.rect.h);
    if (building) { api.close(); ctx.walkTo(building.door); return; }
    const kind = ctx.map.tiles[tile.y * ctx.map.width + tile.x];
    if (!kind || ['water', 'wall', 'tree', 'well'].includes(kind)) return;
    api.close(); ctx.walkTo(tile);
  });
  const api = {
    el,
    show(next: Mode, opener: Element): void {
      open = true; setMode(next); el.hidden = false;
      // Reset after revealing: hidden panes retain their old scroll position in Chrome.
      (next === 'explore' ? explore : research).scrollTop = 0;
      ctx.layers.open({ id: 'guide', el, modal: true, close: () => api.close() }, opener);
      heading.focus({ preventScroll: true });
    },
    close(): void {
      if (!open) return;
      open = false; el.hidden = true;
      ctx.layers.closed('guide'); ctx.onOpenChange(false, mode);
    },
    isOpen: () => open,
    update(): void {
      const snapshot = ctx.snapshot();
      if (!open || snapshot.tick === lastTick) return;
      lastTick = snapshot.tick;
      if (mode === 'research') {
        const m = observe(ctx.sim());
        metrics.textContent = `Seed ${ctx.seed}. ${m.harmfulBeliefs} harmful beliefs across ${m.harmfulBelievers} people. ${m.claimTellings} claim tellings so far.`;
        return;
      }
      player.setAttribute('transform', `translate(${snapshot.player.pos.x * 10} ${snapshot.player.pos.y * 10})`);
      whereabouts.textContent = `You are at ${placeName(snapshot.player.pos)}. ${snapshot.villagers.filter(v => v.moving).length} villagers are on the move.`;
      for (const v of snapshot.villagers) {
        const marker = markers.get(v.id); if (!marker) continue;
        marker.group.setAttribute('transform', `translate(${v.pos.x * 10} ${v.pos.y * 10})`);
        marker.dot.setAttribute('fill', v.bubble ? '#A3323B' : '#F6F0E4');
        const status = `${v.moving ? 'Walking' : activityText(v.activity)}, ${placeName(v.pos)}`;
        marker.title.textContent = `${v.name}: ${status}`;
        const row = peopleStatus.get(v.id); if (row) row.textContent = status;
      }
      // Preserve focus while someone uses a live conversation's control.
      if (conversations.contains(document.activeElement)) return;
      const lines = ctx.sim().events(Math.max(0, snapshot.tick - 8)).filter(e => e.kind === 'line').slice(-5);
      conversations.replaceChildren(...lines.map(line => h('li', null,
        h('button', { type: 'button', class: 'text-button', onclick: () => { api.close(); ctx.inspect(line.speaker); } }, `${ctx.sim().cast.get(line.speaker)?.name ?? line.speaker} at ${line.at ? placeName(line.at) : 'the village'}, ${tickClock(line.tick)}`),
        h('p', null, line.text))));
      if (!lines.length) conversations.append(h('li', null, 'A quiet moment. People are getting on with their day.'));
    },
    destroy(): void { destroyed = true; job++; api.close(); },
  };
  return api;
}
