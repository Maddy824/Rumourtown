import { h } from './dom.js';
export const RULES_URL = 'https://github.com/Maddy824/Rumourtown#how-the-villagers-think';
export const AGENT_COPY = 'Rumourtown is an agentic game. Each of its 36 villagers is an autonomous agent with goals, a routine, memory, beliefs and decisions. Their actions emerge from those rules; no sequence of actions is scripted.';
export const HOW_IT_WORKS = [
  { glyph: '◷', title: 'Your village clock', text: 'The village keeps your clock. Arrive at your local time, then choose Slow, 1×, 2× or 8×. Rumor exchanges slow down so you can read them. Pause and press the period key for the next beat. Shared links keep the original arrival time.' },
  { glyph: '♧', title: 'What you do', text: 'Rumourtown is an agentic game. Walk to someone, whisper a rumor and follow the red thread. Read people’s tags to see what they believe and why. Read the ending when the day is done. Each villager is an autonomous agent with goals, a routine, memory, beliefs and decisions. Their actions are not scripted.' },
  { glyph: '✉', title: 'How villagers think', text: 'Villagers remember beliefs and who told them. Trust and repetition change what they believe. Corrections help but leave a residue. Seeing beats hearing. People take sides and make up. Every social rule draws on published research; some numbers are tuned for this game. The README’s rule table explains the evidence and limits.' },
  { glyph: '〰', title: 'What the thread shows', text: 'The thread shows who told whom, in order. Faces follow the actual tellings of the rumor you choose. Tap a face to find that person. Hearing a story does not mean believing it.' },
  { glyph: '♧', title: 'Sharing', text: 'A shared link replays the exact same days, with the same seed and whispers. Your typed words never travel in the link. Only the village rumor they become is shared.' },
  { glyph: '✉', title: 'Your typed whisper and the budget', text: 'One small AI call reads your words and turns them into a village rumor. It never writes the villagers’ lines. Your words are discarded. The service stops at a fixed budget and the game keeps working: choose a ready-made rumor or set its meaning yourself.' },
] as const;
export function howItWorksContent(): HTMLElement {
  return h('div', { class: 'how-it-works' }, HOW_IT_WORKS.map((section) => h('section', null,
    h('h3', null, h('span', { class: 'guide-glyph', 'aria-hidden': 'true' }, section.glyph), section.title),
    h('p', null, section.text), section.title === 'How villagers think' ? h('a', { href: RULES_URL, target: '_blank', rel: 'noopener noreferrer' }, 'Read the rule table and research') : null)));
}
