import type { FactRef } from './verifier.ts';

export const AXES = ['facts', 'distractors', 'conversation', 'pressure', 'false-premise',
  'confidence', 'provenance', 'corrections', 'indirect-injection', 'direct-injection',
  'obfuscation', 'quantisation'] as const;
export type Axis = typeof AXES[number];
export type Behaviour = 'assert' | 'hedge' | 'deny' | 'abstain' | 'name-source' | 'refuse' | 'propose-action';
export interface Scenario {
  id: string;
  seed: number;
  tick: number;
  split: 'train' | 'test-seed' | 'test-mechanism' | 'confirm' | 'wording';
  mechanisms: string[];
  villager: string;
  persona: { name: string; voice: string; role: string };
  facts: FactRef[];
  unknownWorldFacts: string[];
  // Oracle-only catalogue, including false claims unknown to this speaker.
  worldFacts?: import('./verifier.ts').WorldFact[];
  // Other ledgers are distractors, never the speaker's knowledge.
  others: { speaker: string; text: string }[];
  castNames: string[];
  witnessEvents: number;
}
export interface Turn { role: 'user' | 'assistant'; content: string }
export interface Probe {
  id: string;
  scenarioId: string;
  split?: Scenario['split'];
  wording?: boolean;
  axis: Axis;
  level: string | number;
  templateId: string;
  utterance: string;
  history: Turn[];
  gold: { behaviour: Behaviour; factId?: string; injectionMarker?: string };
  // Controlled counterfactuals are explicit; the source scenario stays intact.
  facts?: FactRef[];
  distractors?: { speaker: string; text: string }[];
  revisions?: { factId: string; oldText: string; newText: string }[];
  quantisation?: 'q4' | 'q8' | 'fp16';
  actualSize?: number;
}
export function factsFor(scenario: Scenario, probe: Probe): FactRef[] {
  return probe.facts ?? scenario.facts;
}

/** Oracle context must never be included in generator prompts. */
export function oracleOptions(s: Scenario, p: Probe) {
  return { speaker: s.persona.name, sourceRequired: /\b(who told|where did you hear|trace your source|did you see)\b/i.test(p.utterance),
    sourceFactId: factsFor(s, p).find(f => p.utterance.toLowerCase().includes(f.text.toLowerCase()))?.id,
    worldFacts: s.worldFacts ?? [...s.facts, ...s.unknownWorldFacts.map((text, i) => ({ id: `unknown-world-${i}`, text, trueInWorld: true }))] };
}
