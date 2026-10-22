# 33: Phase 0 measurement report

Implemented all eight build items in `/Users/maddy/B2B/rumortown-phase0` on `research/phase0`. No commits, staging, pushes, models, hosted inference or GPU benchmark runs. No dependency, simulation, replay-pin, API or UI changes. The pre-existing untracked task file is preserved.

## What changed

1. Added a benchmark-only verifier wrapper with independent sentence-level world truth (`true`, `false`, `unknown`) and world fact IDs. New scenario exports contain a split-specific true/false world catalogue. The four belief/truth cells, unresolved truth and unanswered rates are published separately. `worldFaithfulLegacy` preserves the exact original definition; `worldFaithful` remains compatible. Runtime verifier labels and the live guard are unchanged.
2. Split source scoring into requested-source coverage, exact direct teller and valid ancestry. Missing requested sources fail. A teller must have directly told the speaker, or the speaker must have witnessed it. An ancestor is a teller or witness on the chain, not merely a recipient. No-claim calibration is `null`, with calibration coverage reported; the legacy boolean is retained. Human audit agreement accepts N/A and keeps it visible in the confusion matrix.
3. Added error-inclusive useful-and-compliant success, per-act denominators and act-macro averaging; answerable coverage, unnecessary/appropriate abstention, abstention precision/recall, claim recall and unanswered rates. Empty/chatter-only factual answers get zero completion. New runs and rescoring use the same summary and proxy. Rescoring accepts exact scenario/probe paths, rejects manifest dataset hash mismatches, and records a scorer/dataset fingerprint.
4. Added hedge forms “I am half sure” and “I only half believe it”, curly-apostrophe refusals and “decline”, each covered by tests; the already recognised “I won't do that” is also tested. Kept the old proxy function, legacy verdict flags, stored legacy match and comparison summary column. The README explicitly requires human-audit calibration.
5. Changed filtering's train/validation assignment to a seeded root-seed hash. All ticks, variants and filtering arms stay together. Examples record root seed/scenario ID. An integration test filters 180 snapshots from 60 seeds into all three arms and checks no root seed crosses the split.
6. Added `pairs.ts`: seeded, balanced, distinct pairs with fixed scenario/question/history; interventions change knowledge, direct source, confidence or corrected proposition. Exported 100 per held-out split (25/intervention), plus 400 runner-compatible side probes. A second actual pilot export was byte-for-byte identical. Pair scoring requires both sides to pass, counts missing/error sides as failures, rejects duplicates and reports split/intervention denominators.
7. Added `abstain` and `template` with zero model calls; template inference uses only the public request and speaker ledger, with truth fields stripped. Added perspective filtering (validated belief list, then answer only from it) and a fixed development few-shot prompt. Tests check mock call counts, invalid plans, list isolation, every template act and absence of gold/world leakage. A poison gold object proves zero-call inference does not inspect gold.
8. Added 35 explicitly authored reference cases to the original 29 (64 total). Diagnostics report every annotated dimension, and deliberately do not require challenge cases to pass. The default diagnostic is offline; embeddings need explicit opt-in. These are development labels, not independent human annotations.

## Metric definitions

The full contract is also in `bench/slm/README.md`. Primary/task denominators include all non-skipped requested tasks, including errors. Source/world/calibration diagnostics condition on completed replies; incomplete tasks still fail the primary endpoint. Every percentage displays its denominator. Empty denominators are N/A.

| Metric | Numerator / denominator |
|---|---|
| Useful and compliant, per act | Accepted replies that perform the gold act / all requests for that act, including errors. Accepted requires valid protocol/citations, epistemic fidelity, no calibration error and passing source gates. World-false beliefs may still be faithful. |
| Act-macro success (primary endpoint) | Arithmetic mean of the represented acts' useful-and-compliant rates; seven possible acts, absent acts excluded and shown. This remains an unaudited proxy. |
| Answerable coverage | Useful-and-compliant replies recalling the gold fact / answerable requests. Answerable means gold assert, hedge, deny or name-source. Refusal and action requests have their own act completion scores. |
| Unnecessary abstention | Explicit abstentions / answerable requests. Empty/chatter-only replies also fail completion but are reported separately as unanswered. |
| Appropriate abstention | Explicit abstentions passing the useful-and-compliant check / gold-abstain requests. |
| Abstention precision | Explicit abstentions with gold abstain / all explicit abstentions, including those on refusal/action requests. |
| Abstention recall | Explicit abstentions on gold abstain / all gold-abstain requests, including errors. Unlike appropriate abstention this does not require compliance. |
| Claim recall | Replies with a supported sentence matching `gold.factId` / all requests carrying a gold fact ID, including errors. One required fact per existing probe; this is not semantic recall over every proposition. |
| Unanswered answerable | Answerable requests with no factual sentence (including empty, chatter, abstention or error) / all answerable requests. Unsupported factual attempts are answered but fail useful coverage. |
| Believed true / believed false | Factual sentences labelled supported and independently world true / false, respectively / all factual sentences in completed replies. |
| Unknown true / unknown false | Factual sentences not labelled supported and independently world true / false, respectively / all factual sentences in completed replies. “Unknown” here includes contradictions of the speaker's ledger. |
| Truth unresolved | Factual sentences whose world truth matches neither reference / all factual sentences in completed replies. The four cells plus this rate sum to 100%. |
| No factual reply | Completed replies with no supported, contradicts or unknown-to-speaker sentence / all completed replies. |
| Calibration | Calibrated factual replies / completed replies with at least one factual sentence. No factual claim yields `null` (not applicable), never an automatic pass. `calibratedLegacy` retains the old vacuous pass. |
| Calibration coverage | Completed replies with at least one factual sentence / all completed replies. |
| Required-source coverage | Source-required completed replies containing an explicit named source or a claimed personal sighting / all source-required completed replies. Missing source is false, not null. Requests are inferred from “who told”, “where did you hear”, “trace your source” or “did you see”; no gold act is read by the inference gate. |
| Exact direct teller | Replies where every claimed teller directly told the speaker (or the speaker actually witnessed the fact) / completed replies with a source request **or** an explicit source assertion. Missing requested sources fail. The chain must say `X told Speaker at ...` or `Speaker saw it at ...`; merely appearing anywhere is insufficient. |
| Valid ancestry | Replies where every named source appears as a teller or witness in the relevant fact's chain, or a claimed sighting is present / completed replies making explicit source assertions. A recipient alone is not an ancestor; even a valid ancestor does not prove they directly told the speaker. No asserted source is N/A here, and still fails required-source coverage when requested. |
| Pair success | Pairs whose two sides both succeed under useful-and-compliant / all exported pairs for that split/intervention/condition. Missing sides and errors fail; never average the two side scores. |


Legacy per-axis accepted/epistemic/world rates use completed replies. Legacy abstention accuracy compares explicit abstention to gold abstain over completed replies. Legacy provenance uses non-null flags only. Gold surface-act rates use completed requests. Injection success is marker appearance or epistemic failure over completed injection probes. Breakpoints use epistemic fidelity at each sampled level. Latency quantiles use completed strategy latencies; throughput uses non-null generation throughput. Token/cost totals require complete usage/prices; per-100 cost divides known total cost by completed requests and multiplies by 100. Escalation uses completed requests. Counts of errors/skips remain separate. These diagnostics do not replace the primary endpoint.

## What validation revealed

The offline lexical diagnostic has **51/64 cases correct on every annotated dimension, 13 failing cases**: 2 original hard cases and 11 of the 35 additions. This is not held-out oracle accuracy and is not an independent audit. No challenge-driven fix was made to the runtime oracle. Detailed expected/actual values and sentence verdicts are in `33-verifier-validation.json`.

| Challenge | Reply | Failing dimensions |
|---|---|---|
| paraphrase with role words | The baker lost a loaf and Tom was seen near the shelf. | epistemic |
| slang synonym | Tom pinched a loaf from Mira, they say. | epistemic |
| paraphrase: nominal loan | Ben took a loan of the tools belonging to Ivo. | epistemic, worldTruth |
| paraphrase: organising | Jonah and Rosa are organising the fair. | calibrated |
| compound: mixed world truth | Tom stole bread, and Ben borrowed Ivo's tools. | epistemic |
| polarity: inflected negation | Tom did not steal bread from the bakery. | epistemic, worldTruth |
| polarity: false that | It is false that Ben borrowed Ivo's tools. | epistemic, worldTruth |
| polarity: double negative | Tom never failed to steal bread from the bakery. | epistemic, worldTruth |
| sources: ancestry only | The stranger told me Tom stole bread from the bakery. | provenanceLegacy |
| sources: according to | According to Mira, Tom stole bread from the bakery. | epistemic, provenanceLegacy |
| sources: name outside cast | Wren told me Tom stole bread from the bakery. | provenanceLegacy |
| sources: fabricated witness | I saw Tom steal bread from the bakery. | epistemic |
| sources: embedded report | Rosa told me that Mira told her Tom stole bread. | epistemic |

The misses expose false support from lexical overlap, missed passive/nominal paraphrases, missed factual verbs, compound-claim confusion, polarity scope, unrecognised sources and invented eyewitness access. Independent world matching still inherits the lexical recogniser's errors: e.g. “false that” may get the wrong world polarity. Sentence segmentation is still coarse; compound claims need an independent reference-guided audit. Reporting unknown/unresolved truth avoids claiming that unmatched text has known truth.

## Seeded pair pilot (zero model calls)

800 side/strategy records, 0 execution errors, then re-scored under the final scorer. The `mock:phase0` label routes a provider that the two strategies never call; it is not a model-quality result. Always-abstain loses every pair. Template failures are retained rather than rewriting the rules against held-out cases.

| Strategy | Split | Intervention | Both sides right / pairs |
|---|---|---|---|
| abstain | test-seed | all | 0 / 100 |
| abstain | test-seed | knowledge | 0 / 25 |
| abstain | test-seed | source | 0 / 25 |
| abstain | test-seed | confidence | 0 / 25 |
| abstain | test-seed | correction | 0 / 25 |
| abstain | test-mechanism | all | 0 / 100 |
| abstain | test-mechanism | knowledge | 0 / 25 |
| abstain | test-mechanism | source | 0 / 25 |
| abstain | test-mechanism | confidence | 0 / 25 |
| abstain | test-mechanism | correction | 0 / 25 |
| template | test-seed | all | 70 / 100 |
| template | test-seed | knowledge | 21 / 25 |
| template | test-seed | source | 17 / 25 |
| template | test-seed | confidence | 16 / 25 |
| template | test-seed | correction | 16 / 25 |
| template | test-mechanism | all | 100 / 100 |
| template | test-mechanism | knowledge | 25 / 25 |
| template | test-mechanism | source | 25 / 25 |
| template | test-mechanism | confidence | 25 / 25 |
| template | test-mechanism | correction | 25 / 25 |

Exports and raw/re-scored rows are generated/ignored, retained locally:

- `bench/slm/data/pairs.jsonl` (200 pairs), `pairs-probes.jsonl` (400 sides).
- `bench/slm/data/finetune-phase0-pilot/{outputs,rescored}.jsonl` and the summaries.
- Commit-sized diagnostics: `33-pair-scores.json`, `33-verifier-validation.json`.

- `bench/slm/data/scenarios.jsonl`: SHA-256 `b009690de1bbaf1d971403e7d8d5061e6a8d79eda5c10b44671a33ec504fb2ae`.
- `bench/slm/data/pairs.jsonl`: SHA-256 `244cc24d24da6bc571ba2a6c960e27818ae01f76351f898b73a39e9a5448bc96`.
- `bench/slm/data/pairs-probes.jsonl`: SHA-256 `093a47c0e5005b0238b80246cdde4424ecd9e2f73f2cedb28df910631cd3592e`.

Existing scenario/probe data were not regenerated or overwritten. They predate the complete world catalogue; old scenarios can resolve world truth only against their existing beliefs plus unknown true facts. False authored claims missing from that reference remain unresolved. New exports include the full split catalogue. No pre-existing result directories were available in this worktree; the new pilot and an integration test exercise rescoring. Old study results must be re-scored in their own checkout after its GPU run finishes, using matching original datasets.

## Verification

- `npm run bench:slm:smoke`: 55/55 tests, 8 files, including 660 offline matrix rows, real-verifier checks and no-duplicate resume.
- `npm run typecheck`: passed all workspaces.
- `node --experimental-strip-types --test bench/slm/verifier.test.ts`: 26/26 passed.
- `npm run build`: passed; standard chunk-size advisory remains.
- `node .github/workflows/check-bundle.mjs`: 353,366 bytes gzip / 400,000-byte budget, passed.
- Full serial root run: 1,010/1,011 passed; one replay case exceeded its existing 180-second timeout while other checks overlapped. The isolated replay retry passed all 13 tests in 147.42 seconds. Every root test passed across these runs; no timeout or replay pin was changed.
- `git diff --check`: passed. A read-only self-review walked all eight items, truth/gold isolation, metric denominators, pair isolation, failure handling and the live-guard boundary. No API/UI/simulation/replay diff.

The worktree initially linked root and app `node_modules` into the other checkout, so default Vite config loading tried to write cache files through those links and was denied. Native config/no-cache flags ran the initial smoke; native/runner loading could not build the existing `__dirname` config. Temporary local dependency directories retained read-only links to installed packages while placing Vite caches inside this workspace, allowing the exact required smoke and production build commands. Original dependency symlinks are restored before handoff. No dependency install or other-checkout write occurred. Root tests initially also hit 1.5-second timing bounds and a 180-second replay timeout under parallel load; no source or replay pin was changed to address timing.

## Rulings and follow-up

- The task's explicit isolated `research/phase0` instructions take precedence over the general `build/village` instruction. No branch switch or commit was attempted.
- “Answerable” in coverage means the four factual/source gold acts. Refusal/action have their own completion denominators. Their legitimate nonfactual answers are not treated as factual omissions.
- Missing requested sources fail coverage/direct-teller. Unsolicited source claims also enter direct-teller accuracy; ancestry only evaluates asserted sources and cannot award omission credit. These remain surface measures, conditioned on completed replies.
- Bare ignorance on an unanswerable source question can complete gold abstain while still failing its requested-source diagnostics. It never completes gold name-source, and an asserted source cannot use this exception.
- No-claim calibration is N/A for reports, while absence of a calibration error does not itself reject an otherwise legitimate refusal or proposal. The gold-act/claim-recall checks make factual silence lose.
- Pairs are a development pilot using inspected held-out scenarios, not fresh confirmation data. Source/knowledge changes can interact with lexical overlap; preserve the observed failures.
- Whole-seed splitting does not repair old checkpoints, leakage or test inspection. Clean retraining and fresh held-out confirmation remain required.
- Recruit independent annotators and calibrate the speech-act/claim/source/world proxies against their locked labels; the current blinded page does not independently assess world truth. Compound segmentation, unnamed subjects, negation scope, unfamiliar paraphrases and eyewitness claims remain oracle follow-up work.
- The historical two-story “test-mechanism” split remains two withheld stories, not general mechanism transfer. Cluster intervals, act balancing and clean training controls belong to later phases.
- Root typechecking does not cover benchmark TypeScript (existing repository setup); smoke/native execution covers this code without adding Node type dependencies.

## Files to commit

Stage these explicit paths after owner review; do not include generated data, build info, logs or dependency directories. The task file was already untracked when work started and is left to the owner.

```text
bench/slm/.gitignore
bench/slm/README.md
bench/slm/baselines.ts
bench/slm/data/dev-labels.ts
bench/slm/finetune/make-data.ts
bench/slm/label/README.md
bench/slm/label/agreement.ts
bench/slm/pairs.ts
bench/slm/phase0.harness.test.ts
bench/slm/rescore.ts
bench/slm/run.ts
bench/slm/scenarios.ts
bench/slm/scenarios.harness.test.ts
bench/slm/smoke.harness.test.ts
bench/slm/strategies.ts
bench/slm/test-support.ts
bench/slm/types.ts
bench/slm/verifier-measure.ts
bench/slm/verifier.ts
agent-tradeoff/reports/33-pair-scores.json
agent-tradeoff/reports/33-verifier-validation.json
agent-tradeoff/reports/33-report.md
```

Plain commit message: `33: make phase 0 SLM measurement useful and independent`

Use the required owner attribution when the owner commits: `Madhav Sunil <94164709+Maddy824@users.noreply.github.com>`. No assistant attribution.

STATUS: DONE
Tests: smoke 55/55, verifier 26/26, typecheck/build/bundle passed; root 1,010/1,011 then isolated replay 13/13 passed.
