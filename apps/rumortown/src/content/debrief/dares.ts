import type { Ending, VillagerId } from '../../sim/types.js';

export interface DareCondition {
  readonly ending: Ending;
  readonly notCaught?: boolean;
  readonly byDay?: 1 | 2 | 3;
  readonly target?: VillagerId;
  readonly minBelievers?: number;
}

export interface Dare {
  readonly id: string;
  readonly text: string;
  readonly condition: DareCondition;
}

/**
 * Each field must hold at day end. Days are one-based deadlines, not exact days.
 * Target and believer count refer to the claim being evaluated, not the whisper's listener.
 * notCaught means the stranger has not been exposed during the run so far.
 */
export const dares: readonly Dare[] = [
  {
    id: 'jonah-unblamed',
    text: 'Turn the village on Jonah without anyone blaming you.',
    condition: { ending: 'grudge', notCaught: true, target: 'jonah', minBelievers: 8 },
  },
  {
    id: 'tom-first-day',
    text: 'Leave Tom with a grudge hanging over him by the first evening.',
    condition: { ending: 'grudge', byDay: 1, target: 'tom' },
  },
  {
    id: 'mira-two-camps',
    text: 'Have the village take sides over Mira by the second evening.',
    condition: { ending: 'split', byDay: 2, target: 'mira' },
  },
  {
    id: 'rosa-quiet-repair',
    text: 'Let the truth about Rosa come out quietly before the run ends.',
    condition: { ending: 'reconciled', byDay: 3, target: 'rosa' },
  },
  {
    id: 'ben-public-exposure',
    text: 'Get caught spreading a lie about Ben by the first evening.',
    condition: { ending: 'exposed', byDay: 1, target: 'ben' },
  },
  {
    id: 'ada-story-dies',
    text: 'Whisper about Ada and have the story die without being passed on.',
    condition: { ending: 'died', target: 'ada' },
  },
  {
    id: 'pim-lingering-story',
    text: 'Leave an unchallenged story about Pim with at least six believers by the second evening.',
    condition: { ending: 'grudge', byDay: 2, target: 'pim', minBelievers: 6 },
  },
  {
    id: 'sol-hidden-split',
    text: 'Split the village over Sol without being exposed.',
    condition: { ending: 'split', notCaught: true, target: 'sol' },
  },
  {
    id: 'elin-early-repair',
    text: 'Have the truth about Elin come out privately by the first evening.',
    condition: { ending: 'reconciled', byDay: 1, target: 'elin' },
  },
  {
    id: 'ivo-exposed',
    text: 'Have your lie about Ivo exposed before the third evening is over.',
    condition: { ending: 'exposed', byDay: 3, target: 'ivo' },
  },
  {
    id: 'wren-story-dies',
    text: 'Start a story about Wren that goes no further, and stay out of blame.',
    condition: { ending: 'died', notCaught: true, target: 'wren' },
  },
  {
    id: 'nell-quiet-repair',
    text: 'Have the truth about Nell come out privately by the second evening without being exposed.',
    condition: { ending: 'reconciled', notCaught: true, byDay: 2, target: 'nell' },
  },
];
