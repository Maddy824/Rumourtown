import { describe, expect, it } from 'vitest';
import { dares } from '../content/debrief/index.js';
import { createFakeSimulation } from '../sim/fake.js';
import type { Intervention, SimEvent } from '../sim/types.js';
import { debriefSummary, evaluateDare, reflectionParagraphs, runReflection } from './debrief.js';

const end = (dayIndex: number, ending: 'grudge' | 'exposed' | 'died' = 'grudge', summary = 'Mira still believes Tom stole bread from the bakery') =>
  ({ kind: 'day-end', tick: (dayIndex + 1) * 900, dayIndex, ending, summary } as const);
const fixture = (events: SimEvent[], interventions: Intervention[] = [{ tick: 60, listener: 'mira', claimId: 'stole' }]) => {
  const sim = createFakeSimulation(731);
  return Object.assign(sim, { events: () => events, interventions: () => interventions });
};

describe('run reflection', () => {
  it('selects one dare and two distinct checks reproducibly without stepping the game', () => {
    const selection = runReflection(731);
    expect(selection).toEqual(runReflection(731));
    expect(dares).toContain(selection.dare);
    expect(selection.checks).toHaveLength(2);
    expect(selection.checks[0]?.id).not.toBe(selection.checks[1]?.id);
  });

  it('credits the target and deadline, retains success, and rejects an unrelated winning ending', () => {
    const dare = dares.find((d) => d.id === 'tom-first-day')!;
    const first = end(0);
    const third = end(2, 'exposed');
    expect(evaluateDare(fixture([first]), dare, first)).toBe('Dare met.');
    expect(evaluateDare(fixture([first, third]), dare, third)).toBe('Dare met.');
    const late = end(1);
    expect(evaluateDare(fixture([late]), dare, late)).toBe('Dare missed this run.');
    const other = end(0, 'grudge', 'Mira still believes Ben stole tools');
    expect(evaluateDare(fixture([other]), dare, other)).toBe('Dare missed this run.');
  });

  it('requires the believer count and no exposure at the qualifying day end', () => {
    const dare = dares.find((d) => d.id === 'jonah-unblamed')!;
    const sim = fixture([]);
    sim.registerClaim({ id: 'jonah', kind: 'theft', about: 'jonah', text: 'Jonah stole coins', severity: 2, valence: -1 });
    const last = end(0, 'grudge', 'Mira still believes Jonah stole coins');
    const beliefs: SimEvent[] = [...sim.cast.keys()].filter((id) => id !== 'jonah').slice(0, 8).map((villager) => ({
      kind: 'belief', tick: 80, villager, claimId: 'jonah', before: 0.5, after: 0.8, source: 'stranger', independent: true,
    }));
    sim.interventions = () => [{ tick: 60, listener: 'mira', claimId: 'jonah' }];
    sim.events = () => [...beliefs, last];
    expect(evaluateDare(sim, dare, last)).toBe('Dare met.');
    sim.events = () => [...beliefs.slice(1), last];
    expect(evaluateDare(sim, dare, last)).toBe('Dare still open.');
    sim.events = () => [...beliefs, { kind: 'mood', tick: 100, villager: 'mira', label: 'lied to by the stranger', delta: -0.1, untilTick: 300 }, last];
    expect(evaluateDare(sim, dare, last)).toBe('Dare still open.');
  });

  it('builds authored paragraphs from whispers already made, including repetition and exposure', () => {
    const last = end(2, 'exposed');
    const sim = fixture([
      end(0), end(1), { kind: 'mood', tick: 2000, villager: 'mira', label: 'lied to by the stranger', delta: -0.1, untilTick: 2400 }, last,
    ], [{ tick: 60, listener: 'mira', claimId: 'stole' }, { tick: 65, listener: 'ben', claimId: 'stole' },
      { tick: 2800, listener: 'rosa', claimId: 'stole' }]);
    const summary = debriefSummary(sim, last);
    expect(summary.interventions).toHaveLength(2);
    expect(summary.exploits.repetition).toBe(true);
    expect(summary.exploits.exposed).toBe(true);
    expect(summary.endings).toEqual(['grudge', 'grudge', 'exposed']);
    const paragraphs = reflectionParagraphs(sim, last);
    expect(paragraphs.length).toBeGreaterThanOrEqual(3);
    expect(paragraphs.some((p) => p.includes('You used repetition'))).toBe(true);
  });
});
