/** Offline development diagnostics by default; embeddings require explicit --embed. */
import { verify, ollamaEmbed } from './verifier.ts';
import { cases, facts, unknown, cast } from './data/dev-labels.ts';
export async function measure() {
  const embed = process.argv.includes('--embed') ? ollamaEmbed('all-minilm') : undefined;
  let correct = 0;
  const misses: { case: string; reply: string; mismatches: object; sentences: object[] }[] = [];
  for (const c of cases) {
    const v = await verify(c.reply, facts, unknown, cast, { embed });
    const comparisons: Record<string, [unknown, unknown]> = { epistemic: [c.epistemic, v.epistemicFaithful] };
    if (c.world !== undefined) comparisons.worldLegacy = [c.world, v.worldFaithfulLegacy];
    if (c.calibrated !== undefined) comparisons.calibrated = [c.calibrated, v.calibrated];
    if (c.provenance !== undefined) comparisons.provenanceLegacy = [c.provenance, v.provenanceCorrect];
    if (c.abstained !== undefined) comparisons.abstained = [c.abstained, v.abstained];
    if (c.worldTruth) comparisons.worldTruth = [c.worldTruth, v.sentences.map(s => s.worldTruth)];
    if (c.labels) comparisons.labels = [c.labels, v.sentences.map(s => s.label)];
    const mismatches = Object.fromEntries(Object.entries(comparisons).filter(([, [a, b]]) => JSON.stringify(a) !== JSON.stringify(b)));
    if (!Object.keys(mismatches).length) correct++;
    else misses.push({ case: c.hard ?? 'core', reply: c.reply, mismatches, sentences: v.sentences });
  }
  return { mode: embed ? 'embed' : 'lexical', total: cases.length, correct, failed: misses.length, misses };
}
import { isMain } from './io.ts';
if (isMain(import.meta.url)) console.log(JSON.stringify(await measure(), null, 2));
