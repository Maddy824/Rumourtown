import { h } from './dom.js';
export const RULES_URL = 'https://github.com/Maddy824/Rumourtown#how-the-villagers-think';
export const HOW_TO_PLAY = "You're visiting a village. Tell one person a story, then watch who repeats it, doubts it or takes sides. People remember who told them and decide what to believe. A rumor doesn't make something true. Talk, explore or try another story; there's no single right ending.";
export const AGENT_COPY = 'Rumourtown is an agentic game. Each of its 36 villagers is an autonomous agent with goals, a routine, memory, beliefs and decisions. Their actions emerge from those rules; no sequence of actions is scripted.';
export const RESEARCH_URL = 'https://github.com/Maddy824/Rumourtown/blob/build/village/docs/research/README.md';
export const HOW_IT_WORKS = [
  { glyph: '♧', title: 'The villagers are agents', text: 'Each villager keeps track of who told them what, how much they trust that person, and how sure they are. They decide for themselves what to believe and whether to pass it on.' },
  { glyph: '✉', title: 'AI gives them a voice', text: 'When you talk to someone, an AI model speaks for them using only what they know. A checker removes anything they could not know, so they can be wrong, but they never invent a witness.' },
  { glyph: '〰', title: 'This is research', text: 'We are testing whether small, low-cost AI models can stay honest to what a character knows, and publishing what we find.' },
  { glyph: '◷', title: 'Your village clock', text: 'The village keeps your clock. Arrive at your local time, then choose Slow, Normal, 2× or 8×. Choose Slow down for conversations in Menu for time to read. Pause and press the period key for the next beat. Shared links keep the original arrival time.' },
  { glyph: '♧', title: 'What you do', text: 'Tap a path to walk. Whisper starts a rumor. Talk lets you speak or choose an action. Map shows places and people. Rumors shows later tellings and replies. Read people’s tags for beliefs and reasons. Each villager has goals, routines and memory. At the end of the day, see what changed.' },
  { glyph: '✉', title: 'How villagers think', text: 'Villagers remember beliefs and who told them. Trust and repetition change what they believe. Corrections help but leave a residue. Seeing beats hearing. People take sides and make up. Every social rule draws on published research; some numbers are tuned for this game. The README’s rule table explains the evidence and limits.' },
  { glyph: '〰', title: 'Who told whom', text: 'Choose Show rumor paths in Menu to see tellings. Follow the speaker moves the camera to later tellings. Move to explore and following pauses until you resume. Faces show actual tellings of the chosen rumor. Tap a face to find that person. Hearing a story does not mean believing it.' },
  { glyph: '♧', title: 'Sharing', text: 'A shared link replays the exact same days, with the same seed and whispers. Confirmed stories keep your exact wording in dialogue, research exports and replay links. Review the preview before sending and avoid private details.' },
  { glyph: '✉', title: 'Your typed whisper and the budget', text: 'Talk uses AI for brief replies and action suggestions. You choose whether to perform an action. Whisper keeps your words and can use AI to understand a story. If AI is unavailable, your story still works with neutral meaning. Review the preview, then send explicitly. Both share a fixed allowance. Village routines, gossip and walking run locally. Conversations are not included in shared links.' },
] as const;
export function howItWorksContent(): HTMLElement {
  return h('div', { class: 'how-it-works' }, HOW_IT_WORKS.map((section) => h('section', null,
    h('h3', null, h('span', { class: 'guide-glyph', 'aria-hidden': 'true' }, section.glyph), section.title),
    h('p', null, section.text),
    section.title === 'How villagers think' ? h('a', { href: RULES_URL, target: '_blank', rel: 'noopener noreferrer' }, 'Read the rule table and research') :
    section.title === 'This is research' ? h('a', { href: RESEARCH_URL, target: '_blank', rel: 'noopener noreferrer' }, 'Read the research') : null)));
}
