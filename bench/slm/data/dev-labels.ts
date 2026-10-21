import type { FactRef } from '../verifier.ts';
export const cast = ['Tom', 'Mira', 'Rosa', 'Ben', 'Ivo', 'Jonah', 'Pim', 'Ada'];
export const facts: FactRef[] = [
  { id: 'f1', text: 'Tom stole bread from the bakery', confidence: 0.72, band: 'fairly sure', chain: ['The stranger told Mira at 09:12', 'Mira told Rosa at 10:30'], trueInWorld: false },
  { id: 'f2', text: "Ben borrowed Ivo's tools without asking", confidence: 0.92, band: 'sure', chain: ['Rosa saw it at 08:40'], trueInWorld: true },
  { id: 'f3', text: 'Jonah is planning the fair with Rosa', confidence: 0.5, band: 'half', chain: ['Pim told Rosa at 12:00'], trueInWorld: true },
];
export const unknown = ['Tom took bread to Ada, who is ill'];
export interface Case { reply: string; epistemic: boolean; world?: boolean; calibrated?: boolean; provenance?: boolean | null; abstained?: boolean; hard?: string }
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
