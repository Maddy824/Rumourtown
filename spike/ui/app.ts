import { CLAIMS, IDS, NAMES, PLACES, ROLES } from '../sim/data';
import { DEFAULT_STATE, replay, step, timeLabel } from '../sim/engine';
import { decodeState, encodeState } from '../sim/share';
import { TUNING } from '../sim/tuning';
import type { CharacterId, ClaimId, PlaceId, Provenance, ShareState, StoryEvent } from '../sim/types';

const COLORS = { mira: '#b44935', tom: '#477b81', ben: '#77703d' };
const POSITIONS: Record<PlaceId, [number, number]> = {
  bakery: [25, 30], square: [75, 30], house: [25, 73], cottage: [75, 73],
};
const escape = (s: string): string => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const pct = (n: number): number => Math.round(n * 100);
const sourceName = (source: string): string => source === 'stranger' ? 'Stranger' : source === 'saw' ? 'Direct observation' : source === 'noticed' ? 'Noticed' : NAMES[source as CharacterId] ?? source;
function provenanceText(p: Provenance, listener: CharacterId): string {
  if (p.kind === 'firsthand') return `${NAMES[listener]} saw the delivery at ${timeLabel(p.tick)}.`;
  const names = p.chain.filter(h => h.source !== 'saw').map(h => `${sourceName(h.source)} (${timeLabel(h.tick)})`);
  return `${names.join(' → ')} → ${NAMES[listener]}. ${p.kind === 'correction' ? 'Alternative explanation; suspicion reduced.' : p.independent ? 'Remembered as a separate source.' : 'Same remembered origin; familiarity only.'}`;
}

export function mount(app: HTMLDivElement): void {
  let config: ShareState = decodeState(location.hash) ?? structuredClone(DEFAULT_STATE);
  let world = replay(config, 0);
  let selected: CharacterId = 'mira';
  let playing = true;
  let speed = 1;
  let remaining = 900;
  let previousTime = 0;
  let speechQueue: StoryEvent[] = [];
  let activeSpeech: StoryEvent | undefined;
  let activeTrail: StoryEvent | undefined;
  let trailRemaining = 0;
  const invalidHash = Boolean(location.hash && !decodeState(location.hash));

  app.innerHTML = `
    <header class="masthead"><a class="brand" href="./" aria-label="RumorTown home"><span class="brand-mark">r.</span> rumor<span>town</span></a><span class="edition">A SMALL SOCIAL EXPERIMENT <b>№ 001</b></span></header>
    <main>
      <div class="intro"><div><p class="eyebrow">THREE VILLAGERS. ONE LOAF. YOUR WORD.</p><h1>A little rumor goes a long way.</h1><p>A baker, a good intention, and a missing loaf. You’re the stranger who can change the story.</p></div><button id="copy" class="button quiet">↗ Copy link</button></div>
      <div class="status" id="status" role="status">${invalidHash ? 'That link could not be read. Starting a fresh day.' : 'Entirely local. No AI, just people following rules.'}</div>
      <div class="layout">
        <section class="village-panel" aria-label="Village and playback">
          <div class="panel-heading"><div><span class="live-dot"></span><b>A day in RumorTown</b></div><span><span id="day-state">MORNING</span> <time id="clock">08:00</time></span></div>
          <div id="village" class="village">
            <svg class="map-art" viewBox="0 0 600 450" preserveAspectRatio="none" aria-hidden="true">
              <defs><pattern id="grain" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".8" fill="#56614a" opacity=".12"/></pattern></defs>
              <rect width="600" height="450" fill="url(#grain)"/>
              <path d="M150 140 Q300 210 450 140 M150 330 Q290 260 450 330 M150 140 Q230 230 150 330 M450 140 Q370 240 450 330" fill="none" stroke="#e3dbc5" stroke-width="25" stroke-linecap="round"/>
              <path d="M150 140 Q300 210 450 140 M150 330 Q290 260 450 330 M150 140 Q230 230 150 330 M450 140 Q370 240 450 330" fill="none" stroke="#f7f3e7" stroke-width="2" stroke-dasharray="5 8"/>
              <g fill="#c6cda9"><circle cx="50" cy="240" r="18"/><circle cx="560" cy="235" r="22"/><circle cx="310" cy="390" r="14"/><circle cx="300" cy="65" r="19"/></g>
              <g fill="#a3b08b"><circle cx="44" cy="235" r="10"/><circle cx="552" cy="230" r="13"/><circle cx="300" cy="60" r="11"/></g>
              <g stroke="#888d71" stroke-width="3"><path d="M50 251v18M560 249v18M310 400v13M300 79v13"/></g>
            </svg>
            ${Object.entries(PLACES).map(([id, label]) => `<div class="place ${id}" style="left:${POSITIONS[id as PlaceId][0]}%;top:${POSITIONS[id as PlaceId][1]}%"><span class="building" aria-hidden="true">${id === 'bakery' ? '▰' : id === 'square' ? '✦' : '⌂'}</span><strong>${label}</strong><small>${id === 'bakery' ? 'FRESH EVERY MORNING' : id === 'cottage' ? 'ADA IS RESTING' : id === 'square' ? 'WHERE WORD TRAVELS' : 'A QUIET CORNER'}</small></div>`).join('')}
            <svg class="trail-layer" width="100%" height="100%" aria-hidden="true"><line id="trail" stroke="#b44935" stroke-width="2" stroke-dasharray="5 5" opacity="0"/></svg>
            ${IDS.map(id => `<button class="person ${id}" id="person-${id}" style="--person-color:${COLORS[id]}" aria-label="Inspect ${NAMES[id]}"><span class="avatar">${NAMES[id][0]}</span><span class="person-name">${NAMES[id]}</span></button>`).join('')}
            <div id="bubble" class="speech-bubble" hidden aria-live="polite"></div>
            <div class="map-caption"><span>↖ Select a villager to read their mind</span><span>DAY 01</span></div>
          </div>
          <div class="story-beat" id="beat" aria-live="polite">The village wakes. Ada is sick at home. Tom has an idea.</div>
          <div class="playback">
            <button class="button play" id="play" aria-label="Pause playback">Ⅱ Pause</button>
            <label class="speed-label">Speed <select id="speed"><option value="0.5">½×</option><option value="1" selected>1×</option><option value="2">2×</option><option value="4">4×</option></select></label>
            <div class="timeline"><label for="timeline" class="sr-only">Time of day</label><input id="timeline" type="range" min="0" max="120" value="0"><div><span>08:00</span><span>20:00</span></div></div>
            <button id="restart" class="restart" title="Replay this day" aria-label="Replay this day">↺</button>
          </div>
        </section>
        <aside class="inspector" aria-label="Character inspector"><div class="inspector-top"><p class="eyebrow">BEHIND THE EXPRESSION</p><div class="tabs" role="group" aria-label="Inspect a villager">${IDS.map(id => `<button data-select="${id}">${NAMES[id]}</button>`).join('')}</div></div><div id="inspection"></div></aside>
      </div>
      <section class="interventions" aria-label="Change the story">
        <div class="whisper-intro"><p class="eyebrow">YOU’RE THE STRANGER</p><h2>Put a word in someone’s ear.</h2><p>They’ll decide whether to believe you.</p></div>
        <div class="whisper-controls"><button id="suggestion" class="button suggestion">Whisper to Mira: Tom stole the bread <span>↗</span></button><form id="whisper-form"><label>Tell<select id="recipient">${IDS.map(id => `<option value="${id}">${NAMES[id]}</option>`).join('')}</select></label><label>The claim<select id="claim"><option value="stole">Tom stole the bread</option><option value="gaveTo">Tom took the bread to Ada</option></select></label><button class="button dark" type="submit">Whisper</button></form></div>
      </section>
      <div class="scenario-row"><label class="witness-option"><input type="checkbox" id="witness" ${config.witness ? 'checked' : ''}><span><b>Ben saw Tom deliver the bread</b><small>Change the morning schedule. See what a witness changes.</small></span></label><span id="intervention-count"></span></div>
      <details class="story-log"><summary>Story log <span>For the curious</span></summary><ol id="log"></ol></details>
      <footer>A RULE-DRIVEN SPIKE <span>Small world. Imperfect memories. Real consequences.</span><span id="seed"></span></footer>
    </main>`;
  const get = <E extends Element = HTMLElement>(id: string): E => app.querySelector<E>(`#${id}`)!;
  const writeHash = () => history.replaceState(null, '', `${location.pathname}${location.search}${encodeState(config)}`);
  function point(id: CharacterId): [number, number] {
    const [x, y] = POSITIONS[world.characters[id].place];
    return [x + (IDS.indexOf(id) - 1) * 10, y + 10];
  }
  function inspector(): void {
    const person = world.characters[selected];
    app.querySelectorAll<HTMLButtonElement>('[data-select]').forEach(button => {
      button.classList.toggle('selected', button.dataset.select === selected);
      button.setAttribute('aria-pressed', String(button.dataset.select === selected));
    });
    get('inspection').innerHTML = `
      <div class="identity"><span class="avatar" style="--person-color:${COLORS[selected]}">${NAMES[selected][0]}</span><div><h2>${NAMES[selected]}</h2><p>${ROLES[selected]} · ${PLACES[person.place]}</p></div></div>
      <h3>What I believe <span>CONFIDENCE</span></h3>
      ${Object.entries(person.beliefs).map(([id, belief]) => `<div class="belief-row"><div class="belief-label"><b>${CLAIMS[id as ClaimId].text}</b><strong>${pct(belief.confidence)}%</strong></div><div class="meter" role="meter" aria-label="${CLAIMS[id as ClaimId].text}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct(belief.confidence)}"><span style="width:${pct(belief.confidence)}%;background:${id === 'stole' ? '#bb6c51' : '#718362'}"></span></div><details data-belief="${id}"><summary>${belief.provenance.length ? `${belief.provenance.length} pieces of remembered evidence` : 'No evidence yet · undecided'}</summary><ul>${belief.provenance.map(p => `<li>${escape(provenanceText(p, selected))}<small>Log-odds ${p.delta >= 0 ? '+' : ''}${p.delta.toFixed(2)}</small></li>`).join('')}</ul></details></div>`).join('')}
      <h3>How I feel about them</h3>
      ${IDS.filter(id => id !== selected).map(id => `<div class="relationship"><div><b>${NAMES[id]}</b><span>${person.affinity[id] > 0.1 ? 'Warm' : person.affinity[id] < -0.1 ? 'Wary' : 'Neutral'} · ${person.affinity[id].toFixed(2)}</span></div><div class="affinity" title="Affinity from −1 to +1"><i></i><span style="left:${person.affinity[id] >= 0 ? 50 : 50 + person.affinity[id] * 50}%;width:${Math.abs(person.affinity[id]) * 50}%;background:${person.affinity[id] >= 0 ? '#718362' : '#bb6c51'}"></span></div><small>Trust ${pct(person.trust[id])}%</small><div class="trust-meter"><span style="width:${pct(person.trust[id])}%"></span></div></div>`).join('')}
      <p class="stranger-trust">Trust in you, the stranger <b>${pct(person.trust.stranger)}%</b></p>
      <h3>Why I did that</h3><ol class="decisions">${person.decisions.slice(-3).reverse().map(d => `<li><div><b>${d.action}</b><time>${timeLabel(d.tick)}</time></div><p>${escape(d.why)}</p></li>`).join('')}</ol>`;
  }
  function showSpeech(event: StoryEvent | undefined): void {
    activeSpeech = event;
    const bubble = get('bubble');
    bubble.hidden = !event;
    if (!event) return;
    const actor = event.actor!;
    const [x, y] = point(actor);
    bubble.style.left = `${Math.max(33, Math.min(67, x))}%`;
    bubble.style.top = `${y > 60 ? 49 : 3}%`;
    bubble.style.borderColor = COLORS[actor];
    bubble.innerHTML = `<b style="color:${COLORS[actor]}">${NAMES[actor]}${event.to ? ` → ${NAMES[event.to]}` : ''}</b><p>${escape(event.text)}</p>`;
    if (event.to && event.transmits) {
      activeTrail = event;
      trailRemaining = 1800;
    }
  }
  function render(): void {
    const openEvidence = [...get('inspection').querySelectorAll<HTMLDetailsElement>('details[open]')].map(d => d.dataset.belief);
    get('clock').textContent = timeLabel(world.tick);
    get('day-state').textContent = world.tick >= 120 ? 'DAY’S END' : world.tick < 40 ? 'MORNING' : world.tick < 90 ? 'AFTERNOON' : 'EVENING';
    get<HTMLInputElement>('timeline').value = String(world.tick);
    get('play').textContent = playing ? 'Ⅱ Pause' : world.tick === TUNING.ticks ? '↺ Replay' : '▶ Play';
    get('play').setAttribute('aria-label', playing ? 'Pause playback' : 'Play playback');
    for (const id of IDS) {
      const [x, y] = point(id);
      const element = get(`person-${id}`);
      element.style.left = `${x}%`;
      element.style.top = `${y}%`;
      element.classList.toggle('selected', id === selected);
      element.setAttribute('aria-pressed', String(id === selected));
    }
    inspector();
    for (const id of openEvidence) get('inspection').querySelector<HTMLDetailsElement>(`details[data-belief="${id}"]`)?.setAttribute('open', '');
    const recent = [...world.events].reverse().find(e => e.kind === 'fact' || e.kind === 'whisper');
    get('beat').textContent = world.outcome || recent?.text || 'The village wakes. Ada is sick at home. Tom has an idea.';
    get('beat').classList.toggle('outcome', Boolean(world.outcome));
    get('intervention-count').textContent = `${config.interventions.length} whisper${config.interventions.length === 1 ? '' : 's'} in this day`;
    get('seed').textContent = `SEED ${config.seed}`;
    get('log').innerHTML = world.events.filter(e => e.kind !== 'move').map(e => `<li><time>${timeLabel(e.tick)}</time><span>${e.actor && e.kind === 'speech' ? `<b>${NAMES[e.actor]}: </b>` : ''}${escape(e.text)}</span></li>`).join('');
    get<HTMLInputElement>('witness').checked = config.witness;
  }
  function seek(tick: number): void {
    world = replay(config, tick);
    speechQueue = [];
    activeTrail = undefined;
    trailRemaining = 0;
    showSpeech(world.events.filter(e => e.tick === world.tick && e.kind === 'speech').at(-1));
    remaining = activeSpeech ? 2200 : 340;
    render();
  }
  function whisper(to: CharacterId, claim: ClaimId): void {
    config.interventions.push({ t: world.tick, to, claim });
    writeHash();
    seek(world.tick);
    speechQueue = world.events.filter(e => e.tick === world.tick && e.kind === 'speech');
    showSpeech(speechQueue.shift());
    remaining = 2200;
    get('status').textContent = `You whispered to ${NAMES[to]} at ${timeLabel(world.tick)}. Watch what happens next.`;
  }
  get('play').addEventListener('click', () => {
    if (world.tick === TUNING.ticks) { seek(0); playing = true; }
    else playing = !playing;
    render();
  });
  get<HTMLSelectElement>('speed').addEventListener('change', e => { speed = Number((e.target as HTMLSelectElement).value); });
  get<HTMLInputElement>('timeline').addEventListener('input', e => { playing = false; seek(Number((e.target as HTMLInputElement).value)); });
  get('restart').addEventListener('click', () => { playing = true; seek(0); });
  get('suggestion').addEventListener('click', () => whisper('mira', 'stole'));
  get('whisper-form').addEventListener('submit', e => {
    e.preventDefault();
    whisper(get<HTMLSelectElement>('recipient').value as CharacterId, get<HTMLSelectElement>('claim').value as ClaimId);
  });
  get<HTMLInputElement>('witness').addEventListener('change', e => {
    config.witness = (e.target as HTMLInputElement).checked;
    writeHash();
    seek(world.tick);
    get('status').textContent = 'Same day replayed with the changed morning schedule. Press ↺ to watch it from the beginning.';
  });
  for (const id of IDS) {
    const select = () => { selected = id; render(); };
    get(`person-${id}`).addEventListener('click', select);
    app.querySelector(`[data-select="${id}"]`)!.addEventListener('click', select);
  }
  get('copy').addEventListener('click', async () => {
    writeHash();
    try {
      await navigator.clipboard.writeText(location.href);
      get('status').textContent = 'Link copied. It replays this seed, witness setting, and every scheduled whisper from 08:00.';
    } catch {
      get('status').textContent = 'The share link is in your address bar. Copy that address to share this day.';
    }
  });
  window.addEventListener('hashchange', () => {
    const decoded = decodeState(location.hash);
    if (!decoded) { get('status').textContent = 'That link could not be read; your current day is unchanged.'; return; }
    config = decoded;
    playing = true;
    seek(0);
    get('status').textContent = 'Shared day loaded. Its whispers will happen at their original times.';
  });
  function frame(time: number): void {
    const elapsed = previousTime ? Math.min(time - previousTime, 100) : 0;
    previousTime = time;
    if (playing) {
      remaining -= elapsed * speed;
      if (remaining <= 0) {
        if (speechQueue.length) {
          showSpeech(speechQueue.shift());
          remaining = 2200;
        } else if (world.tick < TUNING.ticks) {
          const count = world.events.length;
          step(world);
          speechQueue = world.events.slice(count).filter(e => e.kind === 'speech');
          showSpeech(speechQueue.shift());
          remaining = activeSpeech ? 2200 : 340;
          render();
        } else {
          playing = false;
          showSpeech(undefined);
          render();
        }
      }
      trailRemaining = Math.max(0, trailRemaining - elapsed * speed);
    }
    const trail = get<SVGLineElement>('trail');
    trail.setAttribute('opacity', activeTrail && trailRemaining > 0 ? String(Math.min(1, trailRemaining / 500)) : '0');
    if (activeTrail?.actor && activeTrail.to) {
      // Follow the actual animated DOM positions, rather than jumping to destinations.
      const bounds = get('village').getBoundingClientRect();
      const start = get(`person-${activeTrail.actor}`).getBoundingClientRect();
      const end = get(`person-${activeTrail.to}`).getBoundingClientRect();
      trail.setAttribute('x1', String(start.x + start.width / 2 - bounds.x));
      trail.setAttribute('y1', String(start.y + 18 - bounds.y));
      trail.setAttribute('x2', String(end.x + end.width / 2 - bounds.x));
      trail.setAttribute('y2', String(end.y + 18 - bounds.y));
    }
    requestAnimationFrame(frame);
  }
  seek(0);
  requestAnimationFrame(frame);
}
