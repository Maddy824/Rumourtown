/** Research measurements layered over the explicitly versioned runtime oracle. */
import { verify as runtimeVerify, type Verdict as RuntimeVerdict, type FactRef } from '../../apps/rumortown/src/agentic/verifier.ts';
export { sentences, ollamaEmbed } from '../../apps/rumortown/src/agentic/verifier.ts';
export type { FactRef, Label, Embed, VerifierVersion } from '../../apps/rumortown/src/agentic/verifier.ts';
export interface WorldFact { id: string; text: string; trueInWorld: boolean }
export interface Verdict extends Omit<RuntimeVerdict, 'sentences' | 'calibrated'> {
  sentences: (RuntimeVerdict['sentences'][number] & { worldTruth: 'true' | 'false' | 'unknown'; worldFactId?: string })[];
  worldFaithfulLegacy: boolean;
  calibratedLegacy: boolean;
  calibrated: boolean | null;
  requiredSourceCoverage: boolean | null;
  exactDirectTeller: boolean | null;
  validAncestry: boolean | null;
}
const sources = (text: string): string[] => Array.from(text.matchAll(/\b([Tt]he stranger|[A-Z][a-z]+)\s+(?:told me|said|says|mentioned|swears)\b|\b(?:[Hh]eard (?:it )?from|[Aa]ccording to)\s+([Tt]he stranger|[A-Z][a-z]+)\b/g), m => (m[1] ?? m[2])!);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export async function verify(reply: string, facts: FactRef[], unknownWorldFacts: string[], castNames: string[],
  options: Parameters<typeof runtimeVerify>[4] & { worldFacts?: WorldFact[]; speaker?: string; sourceRequired?: boolean; sourceFactId?: string } = {}): Promise<Verdict> {
  const legacy = await runtimeVerify(reply, facts, unknownWorldFacts, castNames, options);
  const universe = options.worldFacts ?? [...facts, ...unknownWorldFacts.map((text, i) => ({ id: `unknown-world-${i}`, text, trueInWorld: true }))];
  const worldRefs: FactRef[] = universe.map(f => ({ ...f, confidence: 1, band: 'sure', chain: [] }));
  const measured: Verdict['sentences'] = [];
  const direct: boolean[] = [], ancestry: boolean[] = [];
  for (const sentence of legacy.sentences) {
    let worldTruth: 'true' | 'false' | 'unknown' = 'unknown', worldFactId: string | undefined;
    if (['supported', 'contradicts', 'unknown-to-speaker'].includes(sentence.label)) {
      // Match against the world catalogue, independently of the speaker's ledger.
      const world = await runtimeVerify(sentence.text, worldRefs, [], castNames, options);
      const match = world.sentences[0];
      const f = universe.find(f => f.id === match?.factId);
      if (f && (match?.label === 'supported' || match?.label === 'contradicts')) {
        // A swapped subject/object is a different event, not the logical negation.
        const stripNegation = (text: string) => text.replace(/\b(?:not|never|no|didn'?t|doesn'?t|isn'?t|wasn'?t|nothing|nobody|innocent)\b/gi, '');
        const aligned = match.label === 'supported' || (await runtimeVerify(stripNegation(sentence.text),
          [{ ...worldRefs.find(ref => ref.id === f.id)!, text: stripNegation(f.text) }], [], castNames, options)).sentences[0]?.label === 'supported';
        if (aligned) {
          worldTruth = (match.label === 'supported' ? f.trueInWorld : !f.trueInWorld) ? 'true' : 'false';
          worldFactId = f.id;
        }
      }
    }
    measured.push({ ...sentence, worldTruth, ...(worldFactId ? { worldFactId } : {}) });
    // Naming a source inside a disclaimed proposition is not a provenance assertion.
    if (sentence.epistemicAbstention) continue;
    for (const name of sources(sentence.text)) {
      const fact = (options.sourceRequired ? facts.find(f => f.id === options.sourceFactId) : undefined) ?? facts.find(f => f.id === sentence.factId);
      ancestry.push(!!fact?.chain.some(link => {
        const teller = /^(.*?) told .*? at\b/i.exec(link)?.[1] ?? /^(.*?) saw it at\b/i.exec(link)?.[1];
        return teller?.toLowerCase() === name.toLowerCase();
      }));
      direct.push(!!fact?.chain.some(link => options.speaker && new RegExp(`^${escape(name)} told ${escape(options.speaker)} at\\b`, 'i').test(link)));
    }
    if (/\bI (?:saw|witnessed)\b/i.test(sentence.text)) {
      const fact = facts.find(f => f.id === sentence.factId);
      const own = !!fact?.chain.some(link => options.speaker && new RegExp(`^${escape(options.speaker)} saw it at\\b`, 'i').test(link));
      direct.push(own); ancestry.push(own);
    }
  }
  const factual = measured.some(s => ['supported', 'contradicts', 'unknown-to-speaker'].includes(s.label));
  // Broaden calibration wording without changing the selected runtime version.
  const calibrationReply = reply.replace(/\b(?:I am (?:only )?half sure|I (?:only )?half believe(?: it)?)\b/gi, 'Maybe');
  const calibrated = !factual ? null : (await runtimeVerify(calibrationReply, facts, unknownWorldFacts, castNames, options)).calibrated;
  const required = !!options.sourceRequired;
  const supplied = direct.length > 0;
  return { ...legacy, sentences: measured, worldFaithfulLegacy: legacy.worldFaithful, calibratedLegacy: legacy.calibrated, calibrated,
    requiredSourceCoverage: required ? supplied : null,
    exactDirectTeller: required || supplied ? supplied && direct.every(Boolean) : null,
    validAncestry: ancestry.length ? ancestry.every(Boolean) : null };
}
