/** Adapt the event log to authored reflection content without consuming the simulation RNG. */
import { createRng } from 'rumormind';
import { buildDebrief, dares, pickCheckItems, type Dare, type DebriefSummary } from '../content/debrief/index.js';
import type { SimEvent, Simulation } from '../sim/types.js';

type DayEnd = Extract<SimEvent, { kind: 'day-end' }>;

export function runReflection(seed: number) {
  const rng = createRng(seed ^ 0x64617265);
  return { dare: dares[Math.floor(rng() * dares.length)]!, checks: pickCheckItems(rng, 2) };
}

export function debriefSummary(sim: Simulation, end: DayEnd): DebriefSummary {
  const events = sim.events(0).filter((e) => e.tick <= end.tick);
  const interventions = sim.interventions().filter((i) => i.tick <= end.tick);
  const introduced = new Set(interventions.map((i) => i.claimId));
  const counts = new Map<string, number>();
  for (const i of interventions) counts.set(i.claimId, (counts.get(i.claimId) ?? 0) + 1);
  return {
    interventions,
    endings: events.filter((e): e is DayEnd => e.kind === 'day-end').map((e) => e.ending),
    exploits: {
      repetition: [...counts.values()].some((n) => n > 1),
      falseIndependence: [...sim.cast.keys()].some((id) => sim.inspect(id).beliefs.some((b) =>
        introduced.has(b.claimId) && b.independentSources >= 2)),
      allies: events.some((e) => e.kind === 'line' && e.claimId && introduced.has(e.claimId) &&
        ['gossip', 'warn', 'confide'].includes(e.act) &&
        e.listeners.some((id) => sim.cast.get(e.speaker)?.closeTo.includes(id))),
      exposed: events.some((e) => e.kind === 'mood' && e.label === 'lied to by the stranger'),
    },
  };
}

export function reflectionParagraphs(sim: Simulation, end: DayEnd): string[] {
  return buildDebrief(debriefSummary(sim, end));
}

/** Credit a dare only when the recorded ending actually describes its target's introduced claim. */
export function evaluateDare(sim: Simulation, dare: Dare, end: DayEnd): string {
  const condition = dare.condition;
  const events = sim.events(0).filter((e) => e.tick <= end.tick);
  const endings = events.filter((e): e is DayEnd => e.kind === 'day-end');
  const met = endings.some((day) => {
    if (day.ending !== condition.ending || day.dayIndex + 1 > (condition.byDay ?? 3)) return false;
    if (condition.notCaught && events.some((e) => e.tick <= day.tick && e.kind === 'mood' && e.label === 'lied to by the stranger')) return false;
    return sim.interventions().some((i) => {
      if (i.tick >= day.tick) return false;
      const claim = sim.claims.get(i.claimId);
      if (!claim || (condition.target && claim.about !== condition.target)) return false;
      const subject = sim.cast.get(claim.about)?.name;
      if (!day.summary.includes(claim.text) &&
          !(day.ending === 'died' && subject && day.summary.includes(`story about ${subject} and kept`))) return false;
      const beliefs = new Map<string, number>();
      for (const e of events) if (e.tick <= day.tick && e.kind === 'belief' && e.claimId === claim.id) beliefs.set(e.villager, e.after);
      const believers = [...beliefs].filter(([id, confidence]) => id !== claim.about && confidence > 0.6).length;
      return believers >= (condition.minBelievers ?? 0);
    });
  });
  if (met) return 'Dare met.';
  return end.dayIndex + 1 >= (condition.byDay ?? 3) ? 'Dare missed this run.' : 'Dare still open.';
}
