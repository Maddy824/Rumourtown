import { describe, expect, it } from 'vitest';
import { cast } from '../content/cast/index.js';
import { villageMap } from '../content/map/index.js';
import type { Inspection } from '../sim/types.js';
import { orchestrate, villagerFacts, type OrchestratorInput } from './orchestrator.js';

const castMap = new Map(cast.map(d => [d.id, d]));
const rosa: Inspection = {
  id: 'rosa', name: 'Rosa', role: 'innkeeper', activity: 'work', mood: 0.2,
  beliefs: [
    { claimId: 'tom-stole-bread', text: 'Tom stole bread from the bakery', confidence: 0.72, chain: ['The stranger told Mira at 09:12', 'Mira told Rosa at 10:30'], independentSources: 1 },
    { claimId: 'x', text: 'Pim waters the beer', confidence: 0.2, chain: [], independentSources: 0 },
  ],
  relations: [{ to: 'ben', name: 'Ben', trust: 0.8, affinity: 0.7, why: 'Old friends' }, { to: 'pim', name: 'Pim', trust: 0.3, affinity: -0.4 }],
  trustInStranger: 0.7, moods: [{ label: 'A full house tonight', delta: 0.2, untilTick: 999 }], decisions: [],
};
const base = (text: string, speaker: string | null = null, news: string[] = []): OrchestratorInput => ({
  text, speaker, news, map: villageMap,
  sim: { cast: castMap, inspect: () => rosa },
  snapshot: { minuteOfDay: 19 * 60, villagers: cast.map(d => ({ id: d.id, activity: d.id === 'mira' ? 'sleep' : 'work' })) as never },
});

describe('orchestrator', () => {
  it.each([
    ['Take me to the inn', 'move', 'inn'], ['walk me to the smithy please', 'move', 'smithy'], ['how do I get to the old bridge?', 'move', 'bridge'],
    ['go to the commons bridge', 'move', 'bridge-south'], ['where is the tea house', 'move', 'teahouse'], ["take me to Rosa's home", 'move', 'home-rosa'],
    ['bring us to the village square', 'move', 'square'], ['head to the market', 'move', 'east-market'], ['show me the way to the chapel', 'move', 'chapel'],
    ['take me to the pub', 'move', 'inn'], ['Can I visit Rosa?', 'approach', 'rosa'], ['I want to talk to Ben', 'approach', 'ben'],
    ['find Jonah', 'approach', 'jonah'], ['take me to Mira', 'approach', 'mira'], ['go see the miller... I mean Jonah', 'approach', 'jonah'],
    ['pause', 'pause', ''], ['let time flow', 'resume', ''], ['look around', 'look', ''], ['walk to the reading room', 'move', 'reading-room'],
    ['get to the north field', 'move', 'field-north'],
  ])('%s → %s %s without a model call', (text, action, target) => {
    const r = orchestrate(base(text));
    expect(r.kind).toBe('local');
    if (r.kind === 'local') { expect(r.action).toBe(action); expect(r.target).toBe(target); }
  });

  it('says a sleeping villager is asleep but still offers the walk', () => {
    const r = orchestrate(base('visit Mira'));
    expect(r.kind === 'local' && /asleep/.test(r.reply) && r.target === 'mira').toBe(true);
  });

  it('answers "who told you" from the villager’s own remembered chain', () => {
    const r = orchestrate(base('Who told you that?', 'rosa'));
    expect(r.kind === 'local' && r.reply.includes('Mira told Rosa at 10:30')).toBe(true);
  });

  it('answers the narrator’s gossip question from real story beats, and honestly when there are none', () => {
    const r = orchestrate(base("what's everyone gossiping about?", null, ['Mira told Ben that Tom stole the bread.']));
    expect(r.kind === 'local' && r.reply.includes('Mira told Ben')).toBe(true);
    const quiet = orchestrate(base('any news?'));
    expect(quiet.kind === 'local' && /quiet|asleep/.test(quiet.reply)).toBe(true);
  });

  it('sends open conversation to the model with only what the villager knows', () => {
    const r = orchestrate(base('What do you think of Jonah?', 'rosa'));
    expect(r.kind).toBe('model');
    if (r.kind === 'model') {
      expect(r.facts.some(f => f.includes('fairly sure that Tom stole bread') && f.includes('Mira told Rosa at 10:30'))).toBe(true);
      expect(r.facts.some(f => f.includes('Pim waters the beer'))).toBe(false);
      expect(r.facts.some(f => f.includes('close to Ben'))).toBe(true);
      expect(r.facts.length).toBeLessThanOrEqual(12);
      expect(r.facts.every(f => f.length <= 220)).toBe(true);
    }
  });

  it('builds bounded first-person facts', () => {
    const facts = villagerFacts(rosa, 600);
    expect(facts[0]).toMatch(/^I am Rosa, the innkeeper\. It is 10:00/);
    expect(facts.at(-1)).toBe('I trust the stranger I am talking to.');
  });
});
