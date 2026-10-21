/** Canonical typed claims: the id carries taxonomy fields so v1 links can replay them offline. */
import type { Dossier, GameClaim, VillagerId } from './types.js';

type ClaimFields = Pick<GameClaim, 'kind' | 'about' | 'target' | 'object' | 'severity' | 'valence'>;

const kinds: readonly string[] = [
  'theft', 'cheating', 'romance', 'lying', 'broken-promise', 'insult',
  'hoarding', 'shirking', 'boasting', 'kindness', 'paid-debt', 'nursed',
];
const objects = ['bread', 'loaf', 'flour', 'sack', 'tools', 'coins', 'letter', 'ring', 'wool', 'cloth',
  'honey', 'wheel', 'boat', 'fish', 'eggs', 'milk', 'candle', 'book', 'cart', 'key'];

/** A recorded act can only support a typed version of the same authored fact. */
export function matchesAuthoredFact(claim: GameClaim, fact: GameClaim): boolean {
  // A player's category is not evidence that their sentence describes an authored event.
  if (claim.id.startsWith('written_')) return false;
  return claim.about === fact.about && claim.kind === fact.kind && claim.object === fact.object &&
    (claim.target === undefined || claim.target === fact.target);
}

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

/** Link data is untrusted. Validate bounded taxonomy fields and player-written payloads. */
export function readRegisteredClaim(id: string, cast: ReadonlyMap<VillagerId, Dossier>): GameClaim | null {
  if (id.startsWith('written_')) return readWrittenClaim(id, cast);
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

export const MAX_WRITTEN_TEXT = 100;

/** Player-supplied prose and explicit meaning, carried together for offline replay. */
export function createWrittenClaim(text: string, about: VillagerId, kind: GameClaim['kind'],
  severity: GameClaim['severity'], cast: ReadonlyMap<VillagerId, Dossier>): GameClaim {
  const clean = text.trim().normalize('NFC');
  if (!clean || clean.length > MAX_WRITTEN_TEXT || /[\u0000-\u001f\u007f]/.test(clean) ||
      !cast.has(about) || !kinds.includes(kind) || ![1, 2, 3].includes(severity)) {
    throw new Error('Write a short sentence and choose who and what it is about.');
  }
  const bytes = new TextEncoder().encode(JSON.stringify([clean, about, kind, severity]));
  const payload = btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return { id: `written_${payload}`, text: clean, about, kind, severity,
    valence: ['kindness', 'paid-debt', 'nursed'].includes(kind) ? 1 : -1, contradicts: [] };
}

function readWrittenClaim(id: string, cast: ReadonlyMap<VillagerId, Dossier>): GameClaim | null {
  if (!/^written_[A-Za-z0-9_-]{1,1024}$/.test(id)) return null;
  try {
    const encoded = id.slice(8).replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(encoded + '='.repeat((4 - encoded.length % 4) % 4));
    const data: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true })
      .decode(Uint8Array.from(binary, c => c.charCodeAt(0))));
    if (!Array.isArray(data) || data.length !== 4 || typeof data[0] !== 'string' ||
        typeof data[1] !== 'string' || typeof data[2] !== 'string' || typeof data[3] !== 'number') return null;
    const claim = createWrittenClaim(data[0], data[1], data[2] as GameClaim['kind'], data[3] as GameClaim['severity'], cast);
    return claim.id === id ? claim : null;
  } catch { return null; }
}
