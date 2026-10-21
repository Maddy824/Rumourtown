import { describe, expect, it } from 'vitest';
import { AGENT_LIMITS, createAgentEnvironment, replayAgentRun } from './environment.js';

// Includes a complete three-day run; give shared CI CPUs room without dropping steps.
describe('local agent environment', { timeout: 20_000 }, () => {
  it('replays movement, approach, written whispers and full hidden research state exactly', () => {
    const env = createAgentEnvironment(731);
    expect(env.call('move', { placeId: 'square' }).ok).toBe(true);
    let listener: string | undefined;
    for (let i = 0; i < 20 && !listener; i++) {
      env.call('wait', { ticks: 10 });
      const person = env.observe().nearby.find(v => v.id !== 'tom');
      if (person) {
        const result = env.call('approach', { villagerId: person.id, ticks: 20 });
        if (result.ok && result.reached) listener = person.id;
      }
    }
    expect(listener).toBeDefined();
    expect(env.call('whisper', { listener, text: 'Tom brought bread for Ada.', about: 'tom', kind: 'kindness', severity: 1 }).ok).toBe(true);
    env.call('wait', { ticks: 120 });
    const replay = replayAgentRun(env.replay());
    expect(replay.observe()).toEqual(env.observe());
    expect(replay.research()).toEqual(env.research());
    expect(replay.replay()).toEqual(env.replay());
  });
  it('does not leak hidden beliefs, schedules or secrets through observations or metadata', () => {
    const env = createAgentEnvironment();
    const text = JSON.stringify([env.observe(), env.describe()]);
    for (const key of ['beliefs', 'secrets', 'schedule', 'trustInStranger']) expect(text).not.toContain(`"${key}"`);
    expect(env.observe().creditsUsedUsd).toBe(0);
  });
  it('invalid and out-of-range requests do not mutate a run', () => {
    const env = createAgentEnvironment();
    const before = env.research();
    for (const [tool, args] of [
      ['wait', { ticks: 121 }], ['wait', { ticks: NaN }], ['wait', { ticks: 1.5 }], ['wait', { ticks: -1 }],
      ['move', { placeId: 'missing' }], ['move', { placeId: 'square', extra: 1 }], ['approach', { villagerId: 'missing', ticks: 10 }],
      ['whisper', { listener: 'mira', text: 'x', about: 'mira', kind: 'theft', severity: 1 }], ['run-shell', {}], ['wait', null],
    ] as const) expect(env.call(tool, args).ok).toBe(false);
    expect(env.research()).toEqual(before);
    expect(env.replay().actions).toHaveLength(0);
  });
  it('returns detached data and enforces a total action budget', () => {
    const env = createAgentEnvironment();
    const observation = env.observe(); observation.player.pos.x = -100;
    expect(env.observe().player.pos.x).not.toBe(-100);
    const args = { placeId: 'square' };
    env.call('move', args); args.placeId = 'missing';
    expect(env.replay().actions[0]?.arguments.placeId).toBe('square');
    for (let i = 1; i < AGENT_LIMITS.actions; i++) expect(env.call('move', { placeId: 'square' }).ok).toBe(true);
    expect(env.call('move', { placeId: 'square' }).ok).toBe(false);
    expect(env.call('observe').ok).toBe(true);
  });
  it('rejects a nearby sleeping listener before registering an unrecorded claim', () => {
    const env = createAgentEnvironment(731);
    env.call('move', { placeId: 'home-mira' });
    while (env.observe().tick < 1020) env.call('wait', { ticks: Math.min(120, 1020 - env.observe().tick) });
    const before = env.research();
    const actions = env.replay();
    const result = env.call('whisper', { listener: 'mira', text: 'Tom brought bread for Ada.', about: 'tom', kind: 'kindness', severity: 1 });
    expect(result.ok).toBe(false);
    expect(env.research()).toEqual(before);
    expect(env.replay()).toEqual(actions);
    expect(replayAgentRun(actions).research()).toEqual(before);
  });
  it('stops at three days and rejects incompatible replays', () => {
    const env = createAgentEnvironment();
    for (let i = 0; i < Math.ceil(AGENT_LIMITS.ticks / AGENT_LIMITS.stepsPerCall); i++) env.call('wait', { ticks: 120 });
    expect(env.observe()).toMatchObject({ tick: 4320, done: true });
    expect(env.call('wait', { ticks: 1 }).ok).toBe(false);
    expect(() => replayAgentRun({ ...env.replay(), modelVersion: 'other' })).toThrow();
    expect(() => createAgentEnvironment(-1)).toThrow();
  });
});
