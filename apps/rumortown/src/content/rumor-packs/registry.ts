/** Reviewed content add-ons. Loading a pack never changes a running village. */
import { createWrittenClaim } from '../../sim/registered-claim.js';
import type { Dossier, GameClaim, VillagerId } from '../../sim/types.js';

export interface RumorPack {
  id: string;
  version: number;
  title: string;
  stories: { id: string; claim: GameClaim }[];
}
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const slug = (value: unknown): value is string => typeof value === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(value);

/** Fail a content check rather than silently shipping a partly understood pack. */
export function readRumorPack(value: unknown, cast: ReadonlyMap<VillagerId, Dossier>): RumorPack {
  if (!object(value) || !exact(value, ['schema', 'id', 'version', 'title', 'stories']) || value.schema !== 1 ||
      !slug(value.id) || !Number.isSafeInteger(value.version) || (value.version as number) < 1 ||
      typeof value.title !== 'string' || !value.title.trim() || value.title.length > 64 ||
      /[<>\u0000-\u001f\u007f]/u.test(value.title) || !Array.isArray(value.stories) ||
      value.stories.length < 1 || value.stories.length > 48) throw new Error('Invalid rumor pack');
  const ids = new Set<string>();
  const stories = value.stories.map(story => {
    if (!object(story) || !exact(story, ['id', 'text', 'about', 'kind', 'severity']) || !slug(story.id) ||
        ids.has(story.id) || typeof story.text !== 'string' || typeof story.about !== 'string' ||
        typeof story.kind !== 'string' || typeof story.severity !== 'number' ||
        !cast.has(story.about) || !story.text.startsWith(`${cast.get(story.about)!.name} `) ||
        /[<>\u0000-\u001f\u007f]/u.test(story.text)) throw new Error('Invalid rumor pack story');
    ids.add(story.id);
    const claim = createWrittenClaim(story.text, story.about, story.kind as GameClaim['kind'],
      story.severity as GameClaim['severity'], cast);
    return { id: story.id, claim };
  });
  return { id: value.id, version: value.version as number, title: value.title.trim(), stories };
}

export function readRumorLibrary(sources: Record<string, unknown>, cast: ReadonlyMap<VillagerId, Dossier>): RumorPack[] {
  const ids = new Set<string>();
  return Object.keys(sources).sort().map(path => {
    const pack = readRumorPack(sources[path], cast);
    if (ids.has(pack.id)) throw new Error('Duplicate rumor pack id');
    ids.add(pack.id);
    return pack;
  });
}
