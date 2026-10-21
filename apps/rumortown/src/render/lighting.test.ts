import { describe, expect, it } from 'vitest';
import { daylight, drawShadow } from './daylight.js';
import { occupiedBuildings } from './lighting.js';
import { findBuildings } from './buildings.js';
import { createFakeMap, createFakeSimulation } from '../sim/fake.js';

describe('clock-lit standing pieces', () => {
  it('moves the same footprint 1.5 times farther toward the bottom right at 18:00', () => {
    const centres: number[][] = [];
    const ctx = { fillStyle: '', beginPath() {}, fill() {}, ellipse(x: number, y: number) { centres.push([x, y]); } };
    for (const minute of [720, 1080]) drawShadow(ctx, 0, 0, 12, 4, 40, daylight(minute));
    expect(centres[1]![0]).toBeCloseTo(centres[0]![0]! * 1.5);
    expect(centres[1]![1]).toBeCloseTo(centres[0]![1]! * 1.5);
  });

  it('counts the stranger indoors and removes occupancy when everyone leaves', () => {
    const buildings = findBuildings(createFakeMap());
    const room = buildings[0]!;
    const snapshot = createFakeSimulation(1).snapshot();
    snapshot.villagers = [];
    snapshot.player.pos = { x: room.x + 1.5, y: room.y + 1.5 };
    expect(occupiedBuildings(buildings, snapshot).has(room.id)).toBe(true);
    snapshot.player.pos = { x: -10, y: -10 };
    expect(occupiedBuildings(buildings, snapshot).size).toBe(0);
  });
});
