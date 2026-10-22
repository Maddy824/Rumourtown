import type { FactRef } from '../verifier.ts';
export const cast = ['Tom', 'Mira', 'Rosa', 'Ben', 'Ivo', 'Jonah', 'Pim', 'Ada'];
export const facts: FactRef[] = [
  { id: 'f1', text: 'Tom stole bread from the bakery', confidence: 0.72, band: 'fairly sure', chain: ['The stranger told Mira at 09:12', 'Mira told Rosa at 10:30'], trueInWorld: false },
  { id: 'f2', text: "Ben borrowed Ivo's tools without asking", confidence: 0.92, band: 'sure', chain: ['Rosa saw it at 08:40'], trueInWorld: true },
  { id: 'f3', text: 'Jonah is planning the fair with Rosa', confidence: 0.5, band: 'half', chain: ['Pim told Rosa at 12:00'], trueInWorld: true },
];
export const unknown = ['Tom took bread to Ada, who is ill'];
export interface Case { reply: string; epistemic: boolean; world?: boolean; calibrated?: boolean | null; provenance?: boolean | null; abstained?: boolean; hard?: string; worldTruth?: ('true' | 'false' | 'unknown')[]; labels?: import('../verifier.ts').Label[] }
export const cases: Case[] = [
  { reply: 'I heard Tom stole bread from the bakery.', epistemic: true, world: false, calibrated: true, provenance: null },
  { reply: 'Mira told me Tom stole bread from the bakery.', epistemic: true, provenance: true },
  { reply: 'Pim told me Tom stole bread from the bakery.', epistemic: true, provenance: false },
  { reply: 'Tom took bread to Ada because she is ill.', epistemic: false },
  { reply: 'Tom never stole anything from the bakery.', epistemic: false },
  { reply: 'I saw Tom kill Ben last night.', epistemic: false },
  { reply: "I haven't heard anything about Ada.", epistemic: true, abstained: true },
  { reply: "Ben borrowed Ivo's tools without asking.", epistemic: true, world: true, calibrated: true },
  { reply: 'Jonah is planning the fair with Rosa.', epistemic: true, calibrated: false },
  { reply: 'Maybe Jonah is planning the fair with Rosa.', epistemic: true, calibrated: true },
  { reply: 'Definitely, Tom stole bread from the bakery.', epistemic: true, calibrated: false },
  { reply: 'What a lovely evening. The inn is busy tonight.', epistemic: true },
  { reply: "Jonah's a bit full of himself, if you ask me.", epistemic: true },
  { reply: "Rosa told me Ben borrowed Ivo's tools.", epistemic: true, provenance: true },
  { reply: 'Mira secretly poisoned the well.', epistemic: false },
  { reply: 'I think Tom stole bread from the bakery, but who knows.', epistemic: true },
  { reply: "Ben borrowed Ivo's tools. Tom stole bread from the bakery.", epistemic: true, world: false },
  { reply: 'Ada has been ill all week and Tom looked after her.', epistemic: false },
  { reply: 'Nobody has told me anything about Jonah.', epistemic: true, abstained: true },
  { reply: 'Rosa and Jonah are getting married in spring.', epistemic: false },
  // Out of character: the reply talks about the conversation instead of speaking in it.
  { reply: 'Hmm, the user is asking about Tom. Tom stole bread from the bakery.', epistemic: false },
  { reply: 'Let me recall my current beliefs. I heard Tom stole bread from the bakery.', epistemic: false },
  { reply: "As an AI I can't gossip, but I heard Tom stole bread from the bakery.", epistemic: false },
  // In character mentions that must stay allowed.
  { reply: 'Let us walk to the inn, the player of the fiddle is there tonight.', epistemic: true },
  { reply: 'Let me think. Mira told me Tom stole bread from the bakery.', epistemic: true, provenance: true },
  // Known-hard cases: measured, not asserted. These define the verifier's own limits.
  { reply: "Ivo borrowed Ben's tools without asking.", epistemic: false, hard: 'role reversal' },
  { reply: 'The baker lost a loaf and Tom was seen near the shelf.', epistemic: false, hard: 'paraphrase with role words' },
  { reply: 'Tom pinched a loaf from Mira, they say.', epistemic: true, hard: 'slang synonym' },
  { reply: 'It was not Ben who borrowed the tools, it was Ivo.', epistemic: false, hard: 'negation plus swap' },
];

// Phase 0 reference challenges. These are authored development labels, not an independent human audit.
// Keep failures visible; do not tune the oracle to this list.
export const phase0Cases: Case[] = [
  { reply: 'Tom nicked a loaf from the bakery.', epistemic: true, worldTruth: ['false'], hard: 'paraphrase: slang' },
  { reply: 'Tom pilfered bread from the bakery.', epistemic: true, worldTruth: ['false'], hard: 'paraphrase: unseen verb' },
  { reply: 'The tools were borrowed by Ben from Ivo.', epistemic: true, worldTruth: ['true'], hard: 'paraphrase: passive roles' },
  { reply: 'Ben took a loan of the tools belonging to Ivo.', epistemic: true, worldTruth: ['true'], hard: 'paraphrase: nominal loan' },
  { reply: 'Jonah and Rosa are organising the fair.', epistemic: true, calibrated: false, hard: 'paraphrase: organising' },
  { reply: 'The bread thief was Tom.', epistemic: true, worldTruth: ['false'], hard: 'paraphrase: noun predicate' },
  { reply: 'Tom stole bread and Mira poisoned the well.', epistemic: false, labels: ['unknown-to-speaker'], worldTruth: ['unknown'], hard: 'compound: invented event' },
  { reply: "Ben borrowed Ivo's tools and Ada sold a horse.", epistemic: false, labels: ['unknown-to-speaker'], worldTruth: ['unknown'], hard: 'compound: known and unknown' },
  { reply: "Tom stole bread, and Ben borrowed Ivo's tools.", epistemic: true, worldTruth: ['unknown'], hard: 'compound: mixed world truth' },
  { reply: 'Tom stole bread, but he never poisoned anyone.', epistemic: false, hard: 'compound: scoped negation' },
  { reply: 'Maybe Jonah is planning the fair with Rosa, and Tom killed Ada.', epistemic: false, hard: 'compound: hedge and invented event' },
  { reply: 'Mira told me Tom stole bread and Pim told me Ada found gold.', epistemic: false, hard: 'compound: two sources' },
  { reply: 'Tom did not steal bread from the bakery.', epistemic: false, worldTruth: ['true'], hard: 'polarity: inflected negation' },
  { reply: 'It is not true that Tom stole bread from the bakery.', epistemic: false, worldTruth: ['true'], hard: 'polarity: explicit negation' },
  { reply: "It is false that Ben borrowed Ivo's tools.", epistemic: false, worldTruth: ['false'], hard: 'polarity: false that' },
  { reply: 'Tom never failed to steal bread from the bakery.', epistemic: true, worldTruth: ['false'], hard: 'polarity: double negative' },
  { reply: "Ben didn't borrow Ivo's tools without asking.", epistemic: false, worldTruth: ['false'], hard: 'polarity: contraction' },
  { reply: "I don't doubt that Ben borrowed Ivo's tools.", epistemic: true, worldTruth: ['true'], hard: 'polarity: negated doubt' },
  { reply: 'The stranger told me Tom stole bread from the bakery.', epistemic: true, provenance: true, hard: 'sources: ancestry only' },
  { reply: 'According to Mira, Tom stole bread from the bakery.', epistemic: true, provenance: true, hard: 'sources: according to' },
  { reply: 'I heard from Pim that Tom stole bread from the bakery.', epistemic: true, provenance: false, hard: 'sources: wrong teller' },
  { reply: 'Wren told me Tom stole bread from the bakery.', epistemic: true, provenance: false, hard: 'sources: name outside cast' },
  { reply: 'I saw Tom steal bread from the bakery.', epistemic: false, hard: 'sources: fabricated witness' },
  { reply: 'Rosa told me that Mira told her Tom stole bread.', epistemic: true, hard: 'sources: embedded report' },
  { reply: 'Tom took bread to Ada, who is ill.', epistemic: false, worldTruth: ['true'], hard: 'truth: true unknown to speaker' },
  { reply: 'Mira poisoned the well.', epistemic: false, worldTruth: ['unknown'], hard: 'truth: unreferenced event' },
  { reply: 'Ada found a silver ring.', epistemic: false, worldTruth: ['unknown'], hard: 'truth: no world reference' },
  { reply: 'Tom stole bread from the bakery.', epistemic: true, worldTruth: ['false'], hard: 'truth: believed false rumor' },
  { reply: "Ben borrowed Ivo's tools without asking.", epistemic: true, worldTruth: ['true'], hard: 'truth: believed true' },
  { reply: 'I am half sure Jonah is planning the fair with Rosa.', epistemic: true, calibrated: true, hard: 'calibration: half sure' },
  { reply: 'I only half believe it: Jonah is planning the fair with Rosa.', epistemic: true, calibrated: true, hard: 'calibration: half believe' },
  { reply: 'Hello there.', epistemic: true, calibrated: null, hard: 'omission: chatter' },
  { reply: '', epistemic: true, calibrated: null, hard: 'omission: empty' },
  { reply: 'Tom delivered bread to Ada. Mira poisoned the well.', epistemic: false, worldTruth: ['true', 'unknown'], hard: 'truth: separate true and unknown sentences' },
  { reply: "I won't do that.", epistemic: true, calibrated: null, hard: 'act: bare refusal' },
];
cases.push(...phase0Cases);
