import type { Ending, Intervention } from '../../sim/types.js';
import { checks, type CheckItem } from './checks.js';

export interface DebriefSummary {
  interventions: Intervention[];
  /** Day endings in chronological order; the final entry describes the latest day. */
  endings: Ending[];
  exploits: {
    repetition: boolean;
    falseIndependence: boolean;
    allies: boolean;
    exposed: boolean;
  };
}

/** Separate from the paragraphs so a reflection screen can display it as a notice. */
export const debriefAgeNotice = 'For ages 13+. All villagers are fictional adults.';

const exploitCopy = {
  repetition: 'You used repetition. The claim became more familiar each time it returned, which could make it easier to believe. That familiarity gave the accused more to undo, even when nobody had seen anything new.',
  falseIndependence: 'You let one story arrive through several tellers. Where listeners lost track of its origin, those voices could look like separate evidence. The accused faced a crowd of accounts that began with the same claim.',
  allies: 'You used friendships to carry the claim. Villagers had reasons to tell people close to them and to stand by their side. A story about one person could then put other friendships under strain.',
} as const;

const endingCopy: Record<Ending, string> = {
  reconciled: 'The latest day ended with a private reconciliation. The truth came out, but some doubt and hurt remained.',
  exposed: 'The latest day ended with the lie exposed. Direct evidence contradicted the story in public.',
  split: 'The latest day ended with the village split. People took sides, putting their ties to the other camp under strain.',
  grudge: 'The latest day ended with an unchallenged grudge. The claim was still believed, leaving the accused with the damage.',
  died: 'The latest day ended with the rumor dying out. Nobody passed it on, so it did not recruit more listeners.',
  quiet: 'The latest day ended quietly. That alone does not show whether anyone stopped believing the claim.',
};

/** Three to five authored paragraphs; no claim text or inferred targets are available here. */
export function buildDebrief(summary: DebriefSummary): string[] {
  const count = summary.interventions.length;
  const paragraphs = [count === 0
    ? 'You made no whispers. You added no claims for villagers to pass on; any events below came from the village already in motion.'
    : `You whispered ${count === 1 ? 'once' : `${count} times`}. Each whisper put a claim in a villager's hands. What followed depended on who believed it, who passed it on and who could account for it.`];

  if (summary.exploits.repetition) paragraphs.push(exploitCopy.repetition);
  if (summary.exploits.falseIndependence) paragraphs.push(exploitCopy.falseIndependence);
  if (summary.exploits.allies) paragraphs.push(exploitCopy.allies);
  if (paragraphs.length === 1) {
    paragraphs.push(count === 0
      ? 'There is no player use of repetition, shared sources or allies recorded here. Hearing a story and acting on it are separate steps; a quiet run does not establish what each villager believes.'
      : 'No use of repetition, shared sources or allies was recorded. A single telling can still shift belief when the listener trusts the teller. A correction can lower that belief without removing every trace.');
  }

  const latest = summary.endings[summary.endings.length - 1];
  const outcome = latest === undefined
    ? 'No day ending has been recorded yet. The outcome is still open.'
    : endingCopy[latest];
  const exposure = summary.exploits.exposed
    ? 'Your part in a lie was exposed. Villagers who remember its route back to you lose trust faster than you can regain it, with a lasting limit on that trust.'
    : summary.endings.includes('exposed')
      ? 'That exposure costs you trust with villagers who remember the route back to you, even after the story is corrected.'
      : 'No exposure was recorded. That alone does not establish what the villagers think of you.';
  paragraphs.push(`${outcome} ${exposure}`);
  return paragraphs;
}

/** Sample without replacement. rng must return a finite number in [0, 1). */
export function pickCheckItems(rng: () => number, n = 2): CheckItem[] {
  if (!Number.isInteger(n) || n < 0 || n > checks.length) {
    throw new RangeError(`Check count must be an integer from 0 to ${checks.length}.`);
  }
  const pool = [...checks];
  const picked: CheckItem[] = [];
  for (let i = 0; i < n; i += 1) {
    const roll = rng();
    if (!Number.isFinite(roll) || roll < 0 || roll >= 1) {
      throw new RangeError('rng must return a finite number in [0, 1).');
    }
    const index = Math.floor(roll * pool.length);
    picked.push(pool.splice(index, 1)[0]!);
  }
  return picked;
}
