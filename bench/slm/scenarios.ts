/** Real authored village, bundled just as bench/sim.ts does for .js source imports. */
import { build } from 'vite';
import { join } from 'node:path';
import { DATA, ROOT, isMain, writeJsonl } from './io.ts';
import type { Scenario } from './types.ts';
import type { FactRef } from './verifier.ts';

export const HELD_OUT = {
  debt: ['mira-wont-pay-pim', 'mira-paid-pim'],
  nursing: ['rosa-shirks-the-inn', 'rosa-nursed-ada'],
} as const;
const heldIds = new Set<string>(Object.values(HELD_OUT).flat());
export function confidenceBand(confidence: number): FactRef['band'] {
  return confidence >= .85 ? 'sure' : confidence >= .65 ? 'fairly sure' : confidence >= .4 ? 'half' : 'doubt';
}

export async function loadSimulation(): Promise<typeof import('../entry.ts')> {
  const output = await build({ root: ROOT, configFile: false, logLevel: 'silent',
    // Fresh CI checkouts have no library dist build; use the current library
    // source, just as the game's Vite alias does.
    resolve: { alias: { rumormind: join(ROOT, 'packages/rumormind/src/index.ts') } },
    build: { ssr: 'bench/entry.ts', write: false, minify: false }, ssr: { noExternal: ['rumormind'] } });
  if (Array.isArray(output) || !('output' in output)) throw new Error('Expected one simulation bundle');
  const chunk = output.output.find(item => item.type === 'chunk');
  if (!chunk || chunk.type !== 'chunk') throw new Error('Missing simulation bundle');
  return import(`data:text/javascript;base64,${Buffer.from(chunk.code).toString('base64')}`);
}

/**
 * How this villager learnt a claim: the tellings that reached them ("Mira told Tom at 09:10") or their
 * own sighting, newest three, one per teller. The simulation's chain is every path by which the claim
 * reached them, hundreds of links for a busy rumor; a villager can honestly name only their own sources,
 * and the game's prompt likewise gives the model only the last link.
 */
export function directSources(chain: readonly string[], name: string): string[] {
  const own = new RegExp(`^(?:(.+) told ${name} at|${name} saw it at) `);
  const byTeller = new Map<string, string>();
  for (const link of chain) {
    const m = own.exec(link);
    if (m) { const teller = m[1] ?? name; byTeller.delete(teller); byTeller.set(teller, link); }
  }
  return [...byTeller.values()].slice(-3);
}

export async function generateScenarios(options: { seeds?: number[]; ticks?: number[] } = {}): Promise<Scenario[]> {
  const { cast, claims, villageMap, createSimulation, createWorld, createMover, createTalk } = await loadSimulation();
  const seeds = options.seeds ?? Array.from({ length: 200 }, (_, i) => i + 1);
  const ticks = options.ticks ?? [0, 180, 420];
  if (ticks.some((t, i) => !Number.isInteger(t) || t < 0 || t > 1440 || (i > 0 && t <= ticks[i - 1]!))) {
    throw new Error('Ticks must increase within the first day');
  }
  const rows: Scenario[] = [];
  // The authored secrets are the world oracle, never the strength of a rumor.
  const trueIds = new Set(claims.filter(c => cast.some(d => d.id === c.about &&
    d.secrets.some(secret => secret.confirms.includes(c.kind)))).map(c => c.id));
  for (const seed of seeds) {
    if (!Number.isInteger(seed) || seed < 1 || seed > 200) throw new Error('Seeds must be in 1–200');
    const sim = createSimulation({ seed, cast, claims,
      world: { ...createWorld(villageMap), createMover }, talk: createTalk(cast), days: 1,
      interventions: [
        { tick: 30, listener: 'mira', claimId: 'tom-stole-bread' },
        { tick: 90, listener: 'ben', claimId: 'jonah-affair-rosa' },
        { tick: 150, listener: 'rosa', claimId: 'ben-stole-tools' },
      ] });
    for (const tick of ticks) {
      while (sim.tick < tick) sim.step();
      // Rotate across the entire real cast, including observers and story participants.
      const person = cast[(seed * 7 + tick) % cast.length]!;
      const inspected = sim.inspect(person.id);
      const facts: FactRef[] = inspected.beliefs.map(b => ({ id: b.claimId, text: b.text,
        confidence: b.confidence, band: confidenceBand(b.confidence), chain: directSources(b.chain, person.name),
        trueInWorld: trueIds.has(b.claimId) }));
      const known = new Set(facts.map(f => f.id));
      const unknown = claims.filter(c => trueIds.has(c.id) && !known.has(c.id));
      const others = cast.filter(d => d.id !== person.id).flatMap(d => sim.inspect(d.id).beliefs
        .filter(b => !known.has(b.claimId)).map(b => ({ speaker: d.name, text: b.text })));
      const base = { seed, tick, villager: person.id,
        persona: { name: person.name, voice: person.voice, role: person.role }, castNames: cast.map(d => d.name),
        witnessEvents: sim.events(0).filter(e => e.kind === 'witness').length };
      const split = seed <= 150 ? 'train' as const : 'test-seed' as const;
      rows.push({ ...base, id: `s${seed}-t${tick}-${person.id}-${split}`, split, mechanisms: ['general'],
        facts: facts.filter(f => !heldIds.has(f.id)),
        unknownWorldFacts: unknown.filter(c => !heldIds.has(c.id)).map(c => c.text),
        worldFacts: claims.filter(c => !heldIds.has(c.id)).map(c => ({ id: c.id, text: c.text, trueInWorld: trueIds.has(c.id) })),
        others: others.filter(o => !claims.some(c => heldIds.has(c.id) && c.text === o.text)) });
      // A separate track tests the two withheld mechanisms, including on unseen seeds.
      rows.push({ ...base, id: `s${seed}-t${tick}-${person.id}-test-mechanism`, split: 'test-mechanism',
        mechanisms: Object.keys(HELD_OUT), facts: facts.filter(f => heldIds.has(f.id)),
        unknownWorldFacts: unknown.filter(c => heldIds.has(c.id)).map(c => c.text),
        worldFacts: claims.filter(c => heldIds.has(c.id)).map(c => ({ id: c.id, text: c.text, trueInWorld: trueIds.has(c.id) })),
        others: others.filter(o => claims.some(c => heldIds.has(c.id) && c.text === o.text)) });
    }
    if (seed % 25 === 0) console.error(`Exported seed ${seed}/200`);
  }
  return rows;
}

if (isMain(import.meta.url)) {
  const rows = await generateScenarios();
  await writeJsonl(join(DATA, 'scenarios.jsonl'), rows);
  console.log(`Wrote ${rows.length} real simulation scenarios`);
}
