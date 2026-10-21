import type { LineSet } from './types.js';

/**
 * Clause-only templates are safe in all three persons: the filler supplies I/you/the name and verb
 * agreement. Reuse those authored words for missing person variants; never adapt prose that says
 * "around {subject}" or assumes the subject is someone else. Explicitly authored variants win.
 */
export function withAddressing(sets: readonly LineSet[]): LineSet[] {
  const result = [...sets];
  for (const set of sets) {
    if (!['gossip', 'warn', 'confide', 'explain'].includes(set.act)) continue;
    if (set.toSubject || set.selfSubject || set.anySubject) continue;
    const lines = set.lines.filter((line) => line.includes('{claim}') && !/\{subject(?:Obj|Poss)?\}/.test(line));
    if (lines.length === 0) continue;
    for (const person of ['toSubject', 'selfSubject'] as const) {
      const exists = sets.some((other) => other[person] && other.act === set.act && other.speaker === set.speaker
        && other.voice === set.voice && other.valence === set.valence && other.hedged === set.hedged
        && other.listenerRelation === set.listenerRelation && other.firsthand === set.firsthand);
      if (!exists) result.push({ ...set, [person]: true, lines: [...lines] });
    }
  }
  return result;
}
