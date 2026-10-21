/** Secondary tools and short instructions, kept out of the walking controls. */
import { h } from './dom.js';
import { closeIcon } from './icons.js';
import type { Layers } from './layers.js';

export function createTools(ctx: {
  layers: Layers;
  actions: HTMLButtonElement[];
  onAgent: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const title = h('h2', { id: 'rt-tools-title', tabindex: '-1' }, 'More');
  const close = h('button', { type: 'button', class: 'close', 'aria-label': 'Close tools', onclick: () => api.close() }, closeIcon());
  const help = h('section', { hidden: true },
    h('p', { class: 'guide-intro' }, 'A walk, a whisper, a story'),
    h('ol', { class: 'control-steps' },
      h('li', null, h('strong', null, 'Walk. '), 'Tap a path, or open Explore and choose a place. You are the traveller in gold. Walking resumes time if it is paused.'),
      h('li', null, h('strong', null, 'Meet someone. '), 'Tap a person, then choose “Walk over and whisper”. You will follow them and stop nearby.'),
      h('li', null, h('strong', null, 'Write. '), 'Whisper opens a writing sheet. Choose a nearby listener, type a sentence, and set who and what it is about.'),
      h('li', null, h('strong', null, 'Follow it. '), 'Follow a rumor shows each telling. Use Previous and Next to take it one step at a time.')),
    h('h3', null, 'Take your time'),
    h('p', null, 'Pause stops the village. Time changes the speed or rewinds to a moment you have already seen. Your dare is optional.'),
    h('h3', null, 'Keyboard'),
    h('p', null, 'Focus the village, then use arrow keys or W, A, S, D to walk. Enter meets the nearest person. Space pauses or resumes. Tab moves between controls; Escape closes a panel.'));
  const repo = 'https://github.com/Maddy824/Rumourtown/blob/build/village/';
  const developers = h('section', { hidden: true },
    h('p', { class: 'guide-intro' }, 'Give your agent a town to explore'),
    h('p', null, 'A local environment for testing an agent’s choices: observe nearby people, follow paths, approach someone, whisper, and watch what happens.'),
    h('button', { type: 'button', class: 'button button-primary', onclick: () => { api.close(); ctx.onAgent(); } }, 'Try a local agent'),
    h('p', null, 'Let a local planner take your traveller on a tour. A visible notice shows when it is running. Take over at any time. This agent and the town use $0 in AI credits.'),
    h('div', { class: 'developer-loop', 'aria-label': 'Agent loop' }, 'Observe → choose a tool → act → observe again'),
    h('h3', null, 'Try the working example'),
    h('p', null, 'From a checkout of the repository, install dependencies with npm install, then run:'),
    h('pre', null, h('code', null, 'npm run agent:demo')),
    h('p', null, 'The example walks to the square, approaches a neighbour, writes a whisper and saves a replay plus research data. It uses a scripted policy and runs without an API key.'),
    h('h3', null, 'Connect your own agent'),
    h('pre', null, h('code', null, 'npm run --silent agent:serve')),
    h('p', null, 'Send JSON tool calls over standard input. Tool schemas and a TypeScript adapter are included. Your agent controls the traveller; the townspeople keep their authored social rules.'),
    h('p', null, h('a', { href: `${repo}docs/agents.md`, target: '_blank', rel: 'noopener noreferrer' }, 'Read the agent guide and protocol')),
    h('h3', null, 'Keep credits under control'),
    h('p', null, 'The local agent uses no AI credits. Optional AI interpretation is off by default, with daily pacing, a $7 total live allowance and phone alerts before requests. Phone alerts need a one-time setup.'),
    h('p', null, h('a', { href: `${repo}docs/credit-controls.md`, target: '_blank', rel: 'noopener noreferrer' }, 'Set up the $10 budget and phone alerts')),
    h('h3', null, 'Build with the belief engine'),
    h('p', null, 'Use Rumormind separately for trust, beliefs, source memory, gossip and corrections in your own characters. It has no runtime dependencies.'),
    h('p', null, h('a', { href: `${repo}packages/rumormind/README.md`, target: '_blank', rel: 'noopener noreferrer' }, 'Read the TypeScript library guide')),
    h('h3', null, 'Compare and reproduce'),
    h('p', null, 'Keep the same seed and action log to reproduce an agent run. The research notebook exports events, beliefs and paired comparisons. These are synthetic experiments, not validated predictions of people.'));
  const helpBtn = h('button', { class: 'button button-quiet', type: 'button', onclick: () => show('help') }, 'How to play');
  const devBtn = h('button', { class: 'button button-quiet', type: 'button', onclick: () => show('developers') }, 'For developers');
  const menu = h('div', { class: 'tools-menu' }, helpBtn, ...ctx.actions, devBtn);
  const back = h('button', { class: 'button button-quiet', type: 'button', hidden: true, onclick: () => { show('menu'); (last === 'help' ? helpBtn : devBtn).focus(); } }, 'Back to tools');
  const body = h('div', { class: 'guide-body' }, menu, back, help, developers);
  const el = h('section', { class: 'field-guide tools', hidden: true, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'rt-tools-title' },
    h('div', { class: 'guide-paper' }, h('header', { class: 'sheet-head' }, title, close), body));
  let last = 'help';
  function show(mode: 'menu' | 'help' | 'developers'): void {
    menu.hidden = mode !== 'menu'; back.hidden = mode === 'menu';
    help.hidden = mode !== 'help'; developers.hidden = mode !== 'developers';
    if (mode !== 'menu') last = mode;
    title.textContent = mode === 'menu' ? 'More' : mode === 'help' ? 'How to play' : 'For developers';
    body.scrollTop = 0;
    title.focus();
  }
  const api = {
    el,
    isOpen: () => !el.hidden,
    open(opener: Element) {
      el.hidden = false;
      ctx.layers.open({ id: 'tools', el, modal: true, close: () => api.close() }, opener);
      show('menu'); ctx.onOpenChange(true);
    },
    close() {
      if (el.hidden) return;
      el.hidden = true; ctx.layers.closed('tools'); ctx.onOpenChange(false);
    },
  };
  return api;
}
