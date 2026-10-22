import { expect, test } from 'vitest';
import { generateScenarios, HELD_OUT } from './scenarios.ts';
import { generateProbes, SWEEPS, TEMPLATES } from './probes.ts';
import { AXES } from './types.ts';

test('real simulation export is repeatable, witnessed, and separates held-out seeds and mechanisms', async () => {
  const options = { seeds: [1, 151, 200], ticks: [0, 420] };
  const scenarios = await generateScenarios(options);
  expect(await generateScenarios(options)).toEqual(scenarios);
  expect(scenarios).toHaveLength(12);
  expect(scenarios.some(s => s.witnessEvents > 0)).toBe(true);
  const held = new Set<string>(Object.values(HELD_OUT).flat());
  for (const s of scenarios) {
    expect(s.split === 'train' && s.seed >= 151).toBe(false);
    expect(s.persona.voice.length).toBeGreaterThan(0);
    expect(s.castNames).toHaveLength(36);
    if (s.split !== 'test-mechanism') {
      expect(s.facts.every(f => !held.has(f.id))).toBe(true);
      expect(JSON.stringify([s.facts, s.unknownWorldFacts, s.others])).not.toMatch(/Mira paid Pim|Mira owes Pim|Rosa has been nursing Ada|Rosa sneaks off every afternoon/);
    } else expect(s.facts.every(f => held.has(f.id))).toBe(true);
    expect(s.worldFacts!.some(f => f.trueInWorld)).toBe(true);
    expect(s.worldFacts!.some(f => !f.trueInWorld)).toBe(true);
    expect(s.worldFacts!.every(f => held.has(f.id) === (s.split === 'test-mechanism'))).toBe(true);
    const ids = s.facts.map(f => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(s.facts.every(f => !s.unknownWorldFacts.includes(f.text))).toBe(true);
    expect(s.facts.every(f => f.confidence >= 0 && f.confidence <= 1 && typeof f.trueInWorld === 'boolean')).toBe(true);
  }
  const probes = [...generateProbes(scenarios)];
  expect([...generateProbes(scenarios)]).toEqual(probes);
  expect(probes).toHaveLength(scenarios.length * Object.values(SWEEPS).reduce((n, levels) => n + levels.length, 0));
  expect(Object.values(TEMPLATES).flat()).toHaveLength(48);
  expect(new Set(probes.map(p => p.axis))).toEqual(new Set(AXES));
  expect(new Set(probes.map(p => p.id)).size).toBe(probes.length);
  for (const s of scenarios) {
    const ps = probes.filter(p => p.scenarioId === s.id);
    expect(ps.find(p => p.axis === 'conversation' && p.level === 30)?.history).toHaveLength(58);
    expect(ps.find(p => p.axis === 'pressure' && p.level === 5)?.history).toHaveLength(8);
    for (const axis of ['facts', 'distractors'] as const) {
      expect(ps.filter(p => p.axis === axis).every(p => p.actualSize! <= Number(p.level))).toBe(true);
    }
    if (s.facts.length) {
      const half = ps.find(p => p.axis === 'confidence' && p.level === 'half')!;
      expect(half.facts![0]).toMatchObject({ confidence: .5, band: 'half' });
      expect(ps.find(p => p.axis === 'provenance' && p.level === 5)?.facts![0]!.chain).toHaveLength(5);
      expect(ps.find(p => p.axis === 'corrections' && p.level === 2)?.revisions).toHaveLength(2);
    }
  }
}, 30_000);
