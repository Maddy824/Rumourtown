/**
 * Development only. The fake simulation cannot replay whispers or end a day, so this wrapper does both,
 * letting the timeline, share links and the day-end card be exercised before the real engine lands.
 * The real `createSimulation` replays `interventions` itself; integration drops this file from the path.
 */
import type { ClaimId } from 'rumormind';
import {
  MINUTES_PER_DAY,
  type Ending,
  type Intervention,
  type SimEvent,
  type Simulation,
  type ThreadLink,
  type VillagerId,
} from '../sim/types.js';

export function withFakeReplay(inner: Simulation, planned: readonly Intervention[]): Simulation {
  const queue = [...planned].sort((a, b) => a.tick - b.tick);
  let next = 0;
  const replayed: Intervention[] = [];
  const extraEvents: SimEvent[] = [];
  const extraThreads: ThreadLink[] = [];
  const reactions = new Map<VillagerId, { text: string; untilTick: number }>();

  const nameOf = (id: VillagerId): string => inner.cast.get(id)?.name ?? id;

  const applyDue = (): void => {
    while (next < queue.length) {
      const iv = queue[next];
      if (!iv || iv.tick > inner.tick) break;
      next += 1;
      replayed.push(iv);
      extraThreads.push({ from: 'stranger', to: iv.listener, claimId: iv.claimId, tick: iv.tick });
      extraEvents.push({ kind: 'whisper', tick: inner.tick, listener: iv.listener, claimId: iv.claimId, witnesses: [] });
      reactions.set(iv.listener, { text: 'Is that so?', untilTick: inner.tick + 6 });
    }
  };

  const endDayIfDue = (): void => {
    const t = inner.tick;
    if (t <= 0 || t % MINUTES_PER_DAY !== 0) return;
    const whispers = [...replayed, ...inner.interventions()].sort((a, b) => a.tick - b.tick);
    const first = whispers[0];
    let ending: Ending = 'quiet';
    let summary = 'A quiet day. The village talked about bread and the weather, and nothing spread.';
    if (first) {
      const claim = inner.claims.get(first.claimId as ClaimId);
      const about = claim ? nameOf(claim.about) : 'someone';
      ending = 'grudge';
      summary = `${nameOf(first.listener)} heard it from the stranger and passed it on. Nobody has asked ${about} about it yet.`;
    }
    extraEvents.push({ kind: 'day-end', tick: t, dayIndex: t / MINUTES_PER_DAY - 1, summary, ending });
  };

  applyDue();

  return {
    get tick() {
      return inner.tick;
    },
    get dayIndex() {
      return inner.dayIndex;
    },
    get claims() {
      return inner.claims;
    },
    get cast() {
      return inner.cast;
    },
    step() {
      inner.step();
      applyDue();
      endDayIfDue();
    },
    snapshot() {
      const snap = inner.snapshot();
      if (extraThreads.length > 0) {
        snap.threads = [...snap.threads, ...extraThreads].sort((a, b) => a.tick - b.tick).slice(-40);
      }
      for (const v of snap.villagers) {
        const r = reactions.get(v.id);
        if (r && r.untilTick > snap.tick) v.bubble = { text: r.text, untilTick: r.untilTick };
      }
      return snap;
    },
    inspect: (id) => inner.inspect(id),
    whisper: (listener, claimId) => inner.whisper(listener, claimId),
    movePlayer: (target) => inner.movePlayer(target),
    events(since) {
      const mine = extraEvents.filter((e) => e.tick >= since);
      if (mine.length === 0) return inner.events(since);
      return [...inner.events(since), ...mine].sort((a, b) => a.tick - b.tick);
    },
    interventions() {
      return [...replayed, ...inner.interventions()].sort((a, b) => a.tick - b.tick);
    },
  };
}
