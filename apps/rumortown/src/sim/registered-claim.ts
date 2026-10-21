/** Canonical typed claims: the id carries taxonomy fields so v1 links can replay them offline. */
import type { Dossier, GameClaim, VillagerId } from './types.js';

type ClaimFields = Pick<GameClaim, 'kind' | 'about' | 'target' | 'object' | 'severity' | 'valence'>;

const kinds: readonly string[] = [
  'theft', 'cheating', 'romance', 'lying', 'broken-promise', 'insult',
  'hoarding', 'shirking', 'boasting', 'kindness', 'paid-debt', 'nursed',
];
const objects = ['bread', 'loaf', 'flour', 'sack', 'tools', 'coins', 'letter', 'ring', 'wool', 'cloth',
  'honey', 'wheel', 'boat', 'fish', 'eggs', 'milk', 'candle', 'book', 'cart', 'key'];

export function createRegisteredClaim(fields: ClaimFields, cast: ReadonlyMap<VillagerId, Dossier>): GameClaim {
  const subject = cast.get(fields.about);
  if (!subject || (fields.target !== undefined && (!cast.has(fields.target) || fields.target === fields.about))) {
    throw new Error('A claim must be about the village cast.');
  }
  const object = fields.object;
  const target = fields.target ? cast.get(fields.target)!.name : undefined;
  const detail: Record<GameClaim['kind'], string> = {
    theft: `stole ${object ?? 'something'}${target ? ` from ${target}` : ''}`,
    cheating: `cheated ${target ?? 'someone'}${object ? ` over ${object}` : ''}`,
    romance: `has a secret romance${target ? ` with ${target}` : ''}`,
    lying: `lied${target ? ` to ${target}` : ''}${object ? ` about ${object}` : ''}`,
    'broken-promise': `broke a promise${target ? ` to ${target}` : ''}`,
    insult: `insulted ${target ?? 'someone'}`,
    hoarding: `is hoarding ${object ?? 'supplies'}`,
    shirking: 'shirked work', boasting: `boasted${object ? ` about ${object}` : ''}`,
    kindness: `did a kindness${target ? ` for ${target}` : ''}`,
    'paid-debt': `paid a debt${target ? ` to ${target}` : ''}`, nursed: `nursed ${target ?? 'someone'}`,
  };
  return {
    id: `typed_${fields.kind}_${fields.about}_${fields.target ?? 'none'}_${fields.object ?? 'none'}_${fields.severity}`,
    kind: fields.kind, about: fields.about, severity: fields.severity, valence: fields.valence,
    ...(fields.target !== undefined ? { target: fields.target } : {}),
    ...(fields.object !== undefined ? { object: fields.object } : {}),
    text: `${subject.name} ${detail[fields.kind]}`,
    contradicts: [],
  };
}

/** Link data is untrusted. Rebuild only a bounded, valid taxonomy claim, never arbitrary text. */
export function readRegisteredClaim(id: string, cast: ReadonlyMap<VillagerId, Dossier>): GameClaim | null {
  const parts = id.split('_');
  if (parts.length !== 6 || parts[0] !== 'typed') return null;
  const [, kind, about, target, object, severity] = parts;
  if (!kind || !kinds.includes(kind) || !about || !cast.has(about) ||
      !['1', '2', '3'].includes(severity ?? '') ||
      (target !== 'none' && (!target || !cast.has(target) || target === about)) ||
      (object !== 'none' && !objects.includes(object ?? ''))) return null;
  return createRegisteredClaim({
    kind: kind as GameClaim['kind'], about,
    ...(target !== 'none' ? { target } : {}), ...(object !== 'none' ? { object } : {}),
    severity: Number(severity) as GameClaim['severity'],
    valence: ['kindness', 'paid-debt', 'nursed'].includes(kind) ? 1 : -1,
  }, cast);
}
