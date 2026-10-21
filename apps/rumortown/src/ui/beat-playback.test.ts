import { describe, expect, it } from 'vitest';
import type { SimEvent } from '../sim/types.js';
import { createFakeSimulation } from '../sim/fake.js';
import { createExchanges, followsExchange, longestChain } from './exchanges.js';
import { advanceToBeat, createBeatPlayback, PLAY_RATES } from './beat-playback.js';
import { advanceTicks } from './loop.js';
const sim = createFakeSimulation(731);
const claimId = 'stole';
const line = (tick: number, speaker: string, listener: string, act: Extract<SimEvent, { kind: 'line' }>['act'], claim?: string): SimEvent => ({ kind: 'line', tick, speaker, listeners: listener ? [listener] : [], act, text: `${speaker} says ${act}`, lineId: `${speaker}-${tick}`, claimId: claim });
const recorded: SimEvent[] = [
  { kind: 'whisper', tick: 60, listener: 'mira', claimId, witnesses: [] },
  line(60, 'mira', '', 'reactToWhisper', claimId),
  line(75, 'mira', 'ben', 'greet'), line(77, 'mira', 'ben', 'gossip', claimId),
  line(79, 'ben', 'mira', 'doubt', claimId), line(81, 'mira', 'ben', 'farewell'),
  line(85, 'ben', 'rosa', 'gossip', claimId), line(90, 'rosa', 'ben', 'defend', claimId),
  line(101, 'tom', 'ada', 'deny', claimId),
  { kind: 'witness', tick: 105, villager: 'ben', subject: 'tom', what: 'Tom paying for bread' },
];
function exchange() { const history = createExchanges(sim); return history.push(recorded.slice(0, 2))[0]!; }

describe('recorded rumor exchanges', () => {
  it('joins reactions, retains greetings and replies, and closes at farewell or twelve minutes', () => {
    const history = createExchanges(sim);
    history.push(recorded);
    expect(history.all).toHaveLength(5);
    expect(history.all[0]!.people).toEqual(['stranger', 'mira']);
    expect(history.all[0]!.lines).toHaveLength(2);
    expect(history.all[1]!.lines.map(l => l.text)).toEqual(['mira says greet', 'mira says gossip', 'ben says doubt', 'mira says farewell']);
    expect(history.all[1]).toMatchObject({ end: 81, closed: true });
    expect(history.all[2]).toMatchObject({ end: 97, closed: true });
    expect(history.all[4]!.beat.kind).toBe('exposure');
    expect(followsExchange(history.all[1]!, '', history.introduced)).toBe(true);
    expect(followsExchange(history.all[1]!, 'another-story', history.introduced)).toBe(false);
  });
  it('never creates beats for unrelated small talk', () => {
    const history = createExchanges(sim);
    expect(history.push([line(1, 'ada', 'ben', 'greet'), line(3, 'ben', 'ada', 'smalltalk'), line(4, 'ada', 'ben', 'farewell')])).toEqual([]);
  });
  it('does not count earlier village chatter as beats of a later player whisper', () => {
    const history = createExchanges(sim);
    history.push([line(10, 'ben', 'rosa', 'gossip', claimId)]);
    history.push(recorded.slice(0, 2));
    expect(history.all.filter(e => followsExchange(e, '', history.introduced))).toHaveLength(1);
  });
  it('starts watching when an existing exchange first carries the followed rumor', () => {
    const history = createExchanges(sim), playback = createBeatPlayback();
    history.push(recorded.slice(0, 2));
    history.push([line(126, 'wren', 'sol', 'news', 'gaveTo')]);
    playback.ignore(history.all.filter(e => followsExchange(e, claimId, history.introduced)));
    let tick = 126;
    advanceToBeat(() => {
      tick++;
      const changed = history.push(tick === 128 ? [line(tick, 'wren', 'sol', 'gossip', claimId)] : []);
      for (const e of changed) if (followsExchange(e, claimId, history.introduced)) playback.offer(e);
    }, () => !!playback.active, () => tick >= 140);
    expect(tick).toBe(128);
    expect(playback.active?.lines).toHaveLength(2);
  });
  it('keeps simultaneous witness exposures distinct in history and playback', () => {
    const history = createExchanges(sim), playback = createBeatPlayback();
    history.push(recorded.slice(0, 2));
    const witnesses: SimEvent[] = ['hal', 'dag', 'cass', 'dara'].map(villager => ({ kind: 'witness', tick: 265, villager, subject: 'tom', secretId: 'bread', what: 'Tom paying for bread' }));
    const changed = history.push(witnesses);
    expect(new Set(changed.map(e => e.id)).size).toBe(4);
    for (const e of changed) playback.offer(e);
    expect(playback.pending).toBe(3);
    expect(changed.map(e => history.byEvent.get(e.id))).toEqual(changed);
  });
  it('keeps the full script when a third participant joins and takes a turn', () => {
    const history = createExchanges(sim);
    const group = (tick: number, speaker: string, listeners: string[], act: Extract<SimEvent, { kind: 'line' }>['act']): SimEvent => ({ ...line(tick, speaker, listeners[0]!, act, act === 'warn' ? claimId : undefined), kind: 'line', tick, speaker, listeners, act, text: `${speaker} says ${act}`, lineId: `${speaker}-${tick}` });
    const events: SimEvent[] = [line(103, 'mira', 'wren', 'greet'), group(104, 'mira', ['rosa', 'wren'], 'warn'), group(105, 'rosa', ['mira', 'wren'], 'agree'), group(106, 'mira', ['rosa', 'wren'], 'explain'), group(107, 'wren', ['mira', 'rosa'], 'doubt'), group(108, 'rosa', ['mira', 'wren'], 'farewell')];
    history.push(events);
    expect(history.all).toHaveLength(1);
    expect(history.all[0]!.lines.map(l => l.tick)).toEqual([103, 104, 105, 106, 107, 108]);
    expect(history.all[0]).toMatchObject({ closed: true, end: 108 });
    expect([...history.all[0]!.participants].sort()).toEqual(['mira', 'rosa', 'wren']);
  });
  it('stops Next beat on the exact first relevant tick, without advancing once more', () => {
    const history = createExchanges(sim); history.push(recorded.slice(0, 2));
    let tick = 60, found = false;
    const stopped = advanceToBeat(() => {
      tick++;
      found = history.push(recorded.filter(e => e.tick === tick)).some(e => followsExchange(e, claimId, history.introduced));
    }, () => found, () => tick >= 1440);
    expect(stopped).toBe(true); expect(tick).toBe(77);
  });
  it('counts the longest actual first-arrival chain without loops or unrelated branches', () => {
    const route = (from: string, to: string, tick: number) => ({ from, to, tick, claimId });
    expect(longestChain([route('stranger', 'mira', 1), route('mira', 'ben', 2), route('ben', 'mira', 3), route('ben', 'rosa', 4), route('ada', 'tom', 5)])).toBe(3);
  });
});

describe('readable playback', () => {
  it('keeps a line for 3.5 seconds, freezes it when paused, and keeps the final line for two extra seconds', () => {
    const playback = createBeatPlayback(), beat = exchange(); beat.closed = true;
    playback.offer(beat);
    const first = playback.line;
    playback.advance(3499, true, 1); expect(playback.line).toBe(first);
    playback.advance(9000, false, 1); expect(playback.line).toBe(first);
    playback.advance(1, true, 1); expect(playback.line?.speaker).toBe('mira');
    playback.advance(3500, true, 1); expect(playback.active).toBe(beat);
    playback.advance(1999, true, 1); expect(playback.active).toBe(beat);
    playback.advance(1, true, 1); expect(playback.active).toBeNull();
  });
  it('allows Next to advance immediately while retaining every line in the history', () => {
    const playback = createBeatPlayback(), beat = exchange(); playback.offer(beat);
    playback.next(1); expect(playback.line?.speaker).toBe('mira');
    expect(beat.lines).toHaveLength(2);
    playback.skip(1); expect(playback.active).toBeNull();
    playback.offer(beat); expect(playback.active).toBeNull();
  });
  it.each([.5, 1, 2, 8] as const)('slows speed %s during a beat and eases back over two seconds', speed => {
    const playback = createBeatPlayback(), beat = exchange(); playback.offer(beat);
    const rate = speed === 8 ? 1 / .6 : 1 / 1.2;
    expect(advanceTicks(0, 6, playback.rate(speed), 100).steps).toBe(speed === 8 ? 10 : 5);
    beat.closed = true;
    expect(playback.rate(speed)).toBe(rate);
    playback.advance(1000, true, speed);
    expect(playback.rate(speed)).toBeCloseTo((rate + PLAY_RATES[speed]) / 2);
    playback.advance(1000, true, speed);
    expect(playback.rate(speed)).toBe(PLAY_RATES[speed]);
    expect(playback.rate(0)).toBe(0);
  });
});
