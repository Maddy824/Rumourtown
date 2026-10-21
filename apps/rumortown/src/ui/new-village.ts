import { encodeShare } from './share-link.js';

/** Keep the game mode while replacing the old run and removing development fast-forward. */
export function newVillageUrl(current: string, seed: number, cast: string): string {
  const url = new URL(current);
  url.searchParams.delete('t');
  url.hash = encodeShare({ v: 1, seed, cast, interventions: [] });
  return url.href;
}
