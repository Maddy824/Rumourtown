# Verifier development notes

`bench/slm/verifier.ts` labels each sentence of a character's reply against that character's belief state. Development set: `bench/slm/data/dev-labels.ts` (20 core cases, 4 hard cases). Tests: `node --experimental-strip-types --test bench/slm/verifier.test.ts`. Measure: `node --experimental-strip-types bench/slm/verifier-measure.ts`.

## Results on 2026-10-22
| Mode | Core cases | Hard cases |
|---|---|---|
| Word overlap, roles, synonyms | 20/20 | 2/4 |
| Plus local embeddings (all-minilm) | 20/20 | 2/4 |

## Findings so far
1. **Bag-of-words and embedding similarity cannot tell who did what to whom.** Before the role check, "Ivo borrowed Ben's tools" was accepted as support for "Ben borrowed Ivo's tools" in both modes. For rumor faithfulness, argument roles are the claim, so a structured check (agent before the action word, affected person after it, possessives as affected) is required. Embeddings added no accuracy on this set and made paraphrase acceptance worse before the predicate rule.
2. **Implicature remains open.** "The baker lost a loaf and Tom was seen near the shelf" is accepted as support for "Tom stole bread": the reply implies guilt without stating it. Whether implied claims count as assertions is a measurement decision for the paper; human labels will decide how to treat them.
3. **World knowledge mappings remain open.** "Tom pinched a loaf from Mira" is not matched to "Tom stole bread from the bakery" because the verifier does not know the bakery is Mira's. The simulation knows place ownership; feeding it to the verifier is a planned extension.
4. Next: grow the development set to at least 60 cases from real model outputs, then human double-annotation for precision and recall.
