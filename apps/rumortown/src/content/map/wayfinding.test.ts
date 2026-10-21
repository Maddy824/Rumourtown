import { expect, it } from 'vitest';
import { villageMap } from './index.js';
import { districtAt, districtTiles, signposts } from './wayfinding.js';
it('assigns every visual tile a stable district without changing the simulation map', () => {
  const before = JSON.stringify(villageMap);
  const tiles = districtTiles(villageMap);
  expect(tiles).toHaveLength(villageMap.width * villageMap.height);
  expect(new Set(tiles.map(t => t.district)).size).toBe(4);
  expect(districtTiles(villageMap)).toEqual(tiles);
  expect(JSON.stringify(villageMap)).toBe(before);
  expect(districtAt({ x: 50, y: 13.99 })).toBe('woodland');
  expect(districtAt({ x: 50, y: 14 })).toBe('eastbank');
  expect(districtAt({ x: 17, y: 32.99 })).toBe('old-village');
  expect(districtAt({ x: 17, y: 33 })).toBe('commons');
});
it('keeps at most eight signs at walkable junctions', () => {
  expect(signposts.length).toBeLessThanOrEqual(8);
  for (const sign of signposts) {
    expect(['path', 'bridge']).toContain(villageMap.tiles[sign.y * villageMap.width + sign.x]);
    expect(sign.arms.length).toBeGreaterThanOrEqual(2);
  }
});

it('uses readable words for distant public signs without relying on symbol fonts', async () => {
  const { buildingSignText } = await import('./wayfinding.js');
  for (const kind of ['bakery', 'inn', 'mill', 'chapel', 'school', 'smithy', 'shop'] as const) {
    expect(buildingSignText({ kind, name: 'A public building' }, 10)).toMatch(/^[A-Z][a-z]+$/);
    expect(buildingSignText({ kind, name: 'A public building' }, 40)).toBe('A public building');
  }
});
