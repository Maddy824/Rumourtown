/** Secondary tools and short instructions, kept out of the walking controls. */
import { h } from './dom.js';
import { AGENT_COPY, howItWorksContent } from './how-it-works.js';
import { closeIcon } from './icons.js';
import type { Layers } from './layers.js';

export function createTools(ctx: {
  layers: Layers;
  actions: HTMLButtonElement[];
  onAgent: () => void;
  onReplayArrival: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const title = h('h2', { id: 'rt-tools-title', tabindex: '-1' }, 'More');
  const close = h('button', { type: 'button', class: 'close', 'aria-label': 'Close tools', onclick: () => api.close() }, closeIcon());
  const help = howItWorksContent(); help.hidden = true;
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
    h('p', null, h('a', { href: `${repo}apps/rumortown/src/agent/environment.ts`, target: '_blank', rel: 'noopener noreferrer' }, 'Read agent/environment.ts')),
    h('h3', null, 'Connect your own agent'),
    h('pre', null, h('code', null, 'npm run --silent agent:serve')),
    h('p', null, 'Send JSON tool calls over standard input. Tool schemas and a TypeScript adapter are included. Your agent controls the traveller; the townspeople keep their authored social rules.'),
    h('p', null, h('a', { href: `${repo}docs/agents.md`, target: '_blank', rel: 'noopener noreferrer' }, 'Read the agent guide and protocol')),
    h('h3', null, 'Write once, reuse across the town'),
    h('p', null, 'Add stories as JSON packs for every visitor to reuse without AI calls. A local development command can ask a coding agent to draft new stories or behaviors in a separate worktree, then run the checks.'),
    h('p', null, 'Drafting uses the developer’s Codex account, separately from the game’s AI allowance. New behavior code needs review before release.'),
    h('p', null, h('a', { href: `${repo}docs/rumor-addons.md`, target: '_blank', rel: 'noopener noreferrer' }, 'Build a rumor or behavior add-on')),
    h('h3', null, 'Keep credits under control'),
    h('p', null, 'The local agent uses no AI credits. AI interpretation has daily pacing and a $7 total live allowance. It is off in local defaults and enabled in production. Optional phone digests report daily use.'),
    h('p', null, h('a', { href: `${repo}docs/credit-controls.md`, target: '_blank', rel: 'noopener noreferrer' }, 'Set up the $10 budget and phone alerts')),
    h('h3', null, 'Build with the belief engine'),
    h('p', null, 'Use Rumormind separately for trust, beliefs, source memory, gossip and corrections in your own characters. It has no runtime dependencies.'),
    h('p', null, h('a', { href: `${repo}packages/rumormind/README.md`, target: '_blank', rel: 'noopener noreferrer' }, 'Read the TypeScript library guide')),
    h('h3', null, 'Compare and reproduce'),
    h('p', null, 'Keep the same seed and action log to reproduce an agent run. The research notebook exports events, beliefs and paired comparisons. These are synthetic experiments, not validated predictions of people.'));
  const helpBtn = h('button', { class: 'button button-quiet', type: 'button', onclick: () => show('help') }, 'How it works');
  const devBtn = h('button', { class: 'button button-quiet', type: 'button', onclick: () => show('developers') }, 'Developer guide');
  const about = h('section', { hidden: true }, h('h3', null, 'An agentic village'), h('p', null, AGENT_COPY),
    h('p', null, h('a', { href: '/about', target: '_blank', rel: 'noopener noreferrer' }, 'Read about Rumourtown')),
    h('p', null, 'AI agents can play too through the published agent protocol. Open the developer guide for agent/environment.ts and npm run agent:demo.'),
    h('p', null, 'For ages 13 and up. Fictional adult villagers. A research-informed game, with tuned numbers, rather than a predictor of real people.'),
    h('p', null, 'Made by ', h('a', { href: 'https://github.com/Maddy824', target: '_blank', rel: 'noopener noreferrer' }, 'Madhav'), ', who likes to hear gossip.'));
  const aboutBtn = h('button', { class: 'button button-quiet', type: 'button', onclick: () => show('about') }, 'About');
  const replayBtn = h('button', { class: 'button button-quiet', type: 'button', onclick: () => { api.close(); ctx.onReplayArrival(); } }, 'Replay the arrival');
  const menu = h('div', { class: 'tools-menu' }, helpBtn, replayBtn, ...ctx.actions, devBtn, aboutBtn);
  const back = h('button', { class: 'button button-quiet', type: 'button', hidden: true, onclick: () => { show('menu'); (last === 'help' ? helpBtn : last === 'about' ? aboutBtn : devBtn).focus(); } }, 'Back to tools');
  const body = h('div', { class: 'guide-body' }, menu, back, help, developers, about);
  const el = h('section', { class: 'field-guide tools', hidden: true, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'rt-tools-title' },
    h('div', { class: 'guide-paper' }, h('header', { class: 'sheet-head' }, title, close), body));
  let last = 'help';
  function show(mode: 'menu' | 'help' | 'developers' | 'about'): void {
    menu.hidden = mode !== 'menu'; back.hidden = mode === 'menu';
    help.hidden = mode !== 'help'; developers.hidden = mode !== 'developers'; about.hidden = mode !== 'about';
    if (mode !== 'menu') last = mode;
    title.textContent = mode === 'menu' ? 'More' : mode === 'help' ? 'How it works' : mode === 'about' ? 'About' : 'Developer guide';
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
    showHelp(opener: Element) { api.open(opener); show('help'); },
    close() {
      if (el.hidden) return;
      el.hidden = true; ctx.layers.closed('tools'); ctx.onOpenChange(false);
    },
  };
  return api;
}
