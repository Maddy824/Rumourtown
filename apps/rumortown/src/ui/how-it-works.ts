import { h } from './dom.js';
export const RULES_URL = 'https://github.com/Maddy824/Rumourtown#how-the-villagers-think';
export const AGENT_COPY = 'Rumourtown is an agentic game. Each of its 36 villagers is an autonomous agent with goals, a routine, memory, beliefs and decisions. Their actions emerge from those rules; no sequence of actions is scripted.';
export const HOW_IT_WORKS = [
  { glyph: '◷', title: 'Your village clock', text: 'The village keeps your clock. Arrive at your local time, then choose Slow, 1×, 2× or 8×. Turn on Read conversations in More to slow exchanges for reading. Pause and press the period key for the next beat. Shared links keep the original arrival time.' },
  { glyph: '♧', title: 'What you do', text: 'Tap a path to walk. Use Talk or act to speak naturally or choose an action. Spread a rumor to watch it travel. Read people’s tags for their beliefs and reasons. Each villager has goals, routines and memory. At the end of the day, see what changed.' },
  { glyph: '✉', title: 'How villagers think', text: 'Villagers remember beliefs and who told them. Trust and repetition change what they believe. Corrections help but leave a residue. Seeing beats hearing. People take sides and make up. Every social rule draws on published research; some numbers are tuned for this game. The README’s rule table explains the evidence and limits.' },
  { glyph: '〰', title: 'What the thread shows', text: 'Turn Rumor lines on in More to see who told whom. Leave them off to watch the village without lines. Faces follow the actual tellings of the rumor you choose. Tap a face to find that person. Hearing a story does not mean believing it.' },
  { glyph: '♧', title: 'Sharing', text: 'A shared link replays the exact same days, with the same seed and whispers. Your typed words never travel in the link. Only the village rumor they become is shared.' },
  { glyph: '✉', title: 'Your typed whisper and the budget', text: 'Talk or act uses AI for brief, improvised replies and action suggestions. You choose whether to perform a suggested action. Spread a rumor uses a separate interpretation step. Both share a fixed allowance. Village routines, gossip and walking run locally. Conversations are not included in shared links.' },
] as const;
export function howItWorksContent(): HTMLElement {
  return h('div', { class: 'how-it-works' }, HOW_IT_WORKS.map((section) => h('section', null,
    h('h3', null, h('span', { class: 'guide-glyph', 'aria-hidden': 'true' }, section.glyph), section.title),
    h('p', null, section.text), section.title === 'How villagers think' ? h('a', { href: RULES_URL, target: '_blank', rel: 'noopener noreferrer' }, 'Read the rule table and research') : null)));
}
