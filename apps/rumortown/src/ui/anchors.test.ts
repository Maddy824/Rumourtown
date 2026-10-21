import { expect, it } from 'vitest';
import { headAnchor, headLift } from './anchors.js';
import { project } from '../render/camera.js';
import { createFakeMap } from '../sim/fake.js';

it('anchors the bubble within four pixels of the projected head at the actual 40px close tile', () => {
  const map = createFakeMap(), pos = { x: 10, y: 8 };
  const camera = { center: pos, width: 360, height: 800, zoom: 32 };
  const projection = (p: typeof pos) => project(map, p, camera);
  const foot = projection(pos), head = headAnchor(pos, projection, headLift(true));
  expect(Math.abs(head.y - (foot.y - 40 * 1.48 * 1.1))).toBeLessThanOrEqual(4);
  expect(head.x).toBe(foot.x);
});
