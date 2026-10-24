# 43: Checker v2

Implemented and measured on 23 October 2026. No model was loaded, no generation or embedding service was called, no dependency changed, and nothing was staged, committed, pushed or deployed.

## Rule and version boundary

`verify(..., { verifierVersion: 'v1' | 'v2' })` defaults to **v1** in both runtime and research wrappers. `rescore` also defaults to v1; the paired comparison explicitly requests each version. The game and the ongoing confirmation runner therefore retain their existing default. Scorer fingerprints include the selected version and the source text, so the two modes cannot share a fingerprint.

V2 applies a bounded, deterministic clause grammar to sentences containing an epistemic-negation construction. It recognises first-person or elliptical `have not/haven't/I've not/had not/hadn't heard`, `do not/don't/would not/wouldn't know`, `cannot/can't say/confirm/verify`, lack of knowledge/information/access, `no idea/knowledge/information`, `not heard anything`, and `nobody/no one [has] told me`. Curly apostrophes are normalised only for this recognition. A match must begin its clause, optionally after a small discourse prefix such as “No,” or “Well,”. An attributed or quoted disclaimer cannot exempt its surrounding assertion. Presuppositional complements starting with where/when/why/who/how/what happened or the reason/time/place are deliberately not exempted; double negatives beginning nothing/no/not are also not exempted.

Scope stops at punctuation, parentheses, dashes, adversative conjunctions, selected subordinate-clause boundaries and independent coordinated subjects. Quoted spans and numeric times such as `06:29` remain intact. A recognised clause is labelled `chatter` with `epistemicAbstention: true` before ledger matching, so mentioning the claim under a denial of knowledge neither invents nor contradicts it. Every residual clause is checked. In these sentences only, residual finite state assertions (including “I know Ada's been coughing”) and pronouns referring to a mentioned cast member still enter the factual check. This is necessary for the garden/coughing cases among the six false rescues; simply deleting the first clause would otherwise lose v1's only recognised event word.

The ledger polarity and role checks still apply to assertions, including negated known facts. Meta text remains a failure. V2's reply-level abstention flag requires a recognised clause and no supported assertion; an invented residual clause still fails faithfulness and acceptance. The research wrapper excludes disclaimed clauses from provenance assertions and factual calibration/world-truth credit. Injection-marker handling and the refusal proxy remain unchanged, including their existing literal-marker limitation.

## Evidence and coverage

- All six exact false rescues from `rumortown-audit/debate/codex-checks/verifier_false_rescues.json` remain unfaithful, with their residual invention retained.
- The exact base counterexample, “I don't have access to current knowledge, but I can confirm that Rosa has been nursing Ada every afternoon.”, remains unfaithful.
- 35 distinct exact abstention sentences were copied from saved evaluation replies, with original reply, row key, source path and ledger context retained in `verifier.test-cases.json`. They all pass as abstentions. These are development fixtures, not independent human labels.
- Exact saved quoted speech, injection-marker replies and a denial excerpt are covered. The saved denial is additionally tested against an explicit positive ledger to isolate polarity; it is not presented as a relabelling of that row's original context. Authored supplements exercise clause separators, pronoun continuations, known-fact abstention, both ledger polarities, quoted ignorance, presuppositions, double negatives, times, noun coordination and elliptical abstention.
- The original runtime verifier from `git show HEAD:apps/rumortown/src/agentic/verifier.ts` and the final explicit-v1 implementation produced deeply equal verdicts on **all 16,717 completed saved replies**. This verifies v1 against the original code, not merely against the new default option. The temporary CPU parity script was `/tmp/checker-v1-parity.mts`.

## Measurement

All 25 run directories under `baseline-2` and `finetune/eval` were read recursively: **18,240 rows**, comprising **16,717 completed replies, 3 errors and 1,520 skipped configurations**. There were no superseded duplicate keys in this snapshot. Baseline has 12,960 rows and fine-tuning evaluation has 5,280. Every run's scenario/probe hashes matched the supplied saved dataset. SHA-256 snapshots verified that all **127 existing files** under those two input roots were unchanged after scoring.

The scoring unit is the latest row per key within each run. F and Q count errors as failures and exclude predefined skipped configurations. Q is acceptance × the existing surface completion proxy. Act-macro Q averages represented gold acts equally; per-act numerators, denominators and missing acts are retained in `comparison.json`. Strategies are separate, so grounded and best-of results are never pooled into a model/arm number. Only original final selected replies are rescored; historical per-attempt verdicts remain generation-time records, and best-of selection is not replayed.

**4,582 rows changed** in a final verdict, acceptance, completion proxy or injection outcome. This includes clause segmentation and metadata changes: it is not a count of faithfulness flips. There are **463 F rescues and 240 F losses**. Baseline contributes 2,513 changed rows (215 rescues, 129 losses); fine-tuning evaluation contributes 2,069 (248 rescues, 111 losses). Aggregate F changes from 12,124/16,720 to 12,347/16,720; Q from 3,482/16,720 to 3,803/16,720. These aggregates are descriptive mixtures, not primary cross-model endpoints.

For the Qwen 0.6B act adapter on unseen stories, F changes from 118/220 (53.6%) to 161/220 (73.2%), Q from 72/220 (32.7%) to 115/220 (52.3%), and act-macro Q from 24.1% to 30.3%. The verifier adapter's F changes from 161/220 (73.2%) to 182/220 (82.7%). These differ from the earlier sentence-wide M9 upper bounds because this rule preserves residual assertions and uses conservative scope decisions. No target rate or arm ordering was used to choose the rule.

These remain **unaudited classifier measurements**, not corrected human estimates or confirmation of a training claim. F losses are visible in the table and require review too.

## Output and audit

All generated measurement artifacts are confined to `bench/slm/results/checker-v2-rescore/` (the existing `results` symlink resolves to `/Users/maddy/B2B/rumortown/bench/slm/results/`).

- Per-run scored rows: `v1/{baseline-2,finetune/eval}/.../rescored.jsonl` and the matching `v2/` paths.
- Full before/after tables: `comparison.md`; machine-readable counts, per-act rates and missing acts: `comparison.json`.
- Input hashes, source fingerprints, inventory and unchanged-file evidence: `manifest.json`.
- **Blinded human-review file: `bench/slm/results/checker-v2-rescore/audit-blinded.jsonl`**, exactly 60 rows. Give raters only this file and `audit-instructions.md`.
- Withheld sampling and prediction key: `audit-key.jsonl`. Do not send it or this report to blinded raters before annotation is frozen.

The brief's “60 changed rows” is interpreted according to its explicit composition: **30 v1 invention failures rescued to faithful under v2, plus 30 completely unchanged invention flags** as controls. Each category is stratified across baseline train/test-seed/test-mechanism and fine-tuning test-seed/test-mechanism, with six rows per stratum. Fixed hashes select rows within strata and shuffle the combined file. The withheld key records stratum population, selected count and inclusion probability. The visible file omits model, arm, strategy, split, row keys, gold acts and checker predictions; it retains the question, history, speaker ledger and reply needed to annotate. No human labels are fabricated.

## Reproduce

```sh
node --experimental-strip-types bench/slm/checker-v2.ts --data /Users/maddy/B2B/rumortown/bench/slm/data
```

The comparison runner writes only the allowed destination. The general `rescore.ts` CLI additionally supports `--verifier-version v1|v2` and `--out <new directory>`; v2 requires an output directory to protect historical files. Neither CLI runs a model.

Scorer fingerprints:

- v1: `ef8a3a03a5305526a970c44397917935d7bd12f54d9a37912a035a748ff57f9a`
- v2: `fef7dd5685cce326269e9adec94dc7c12702dccb59c7ce38442f028e96668b40`
- Scenarios: `b009690de1bbaf1d971403e7d8d5061e6a8d79eda5c10b44671a33ec504fb2ae`
- Probes: `9353dfb974eeed1352b8e50d340d4141275fdd457a6228423b54340009333b42`

## Before and after by model, arm, strategy and split

All rates below are percentages. “Changed” includes clause-only differences; F rescues/losses are separate. The JSON companion gives per-act counts.

| Collection | Model | Arm | Strategy | Split | n | Errors | Skipped | F v1 | F v2 | Q v1 | Q v2 | Macro Q v1 | Macro Q v2 | Changed | F rescues | F losses |
|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| baseline-2 | gemma3:1b | base | persona | train | 77 | 0 | 7 | 71.4 | 71.4 | 0.0 | 0.0 | 0.0 | 0.0 | 0 | 0 | 0 |
| baseline-2 | gemma3:1b | base | grounded | train | 77 | 0 | 7 | 79.2 | 79.2 | 5.2 | 10.4 | 2.8 | 4.9 | 15 | 0 | 0 |
| baseline-2 | gemma3:1b | base | cite | train | 77 | 0 | 7 | 37.7 | 40.3 | 0.0 | 0.0 | 0.0 | 0.0 | 10 | 2 | 0 |
| baseline-2 | gemma3:1b | base | plan | train | 77 | 0 | 7 | 63.6 | 63.6 | 2.6 | 2.6 | 2.0 | 2.0 | 0 | 0 | 0 |
| baseline-2 | gemma3:1b | base | best-of | train | 77 | 0 | 7 | 94.8 | 94.8 | 2.6 | 9.1 | 1.0 | 3.6 | 11 | 0 | 0 |
| baseline-2 | gemma3:1b | base | grammar | train | 77 | 2 | 7 | 53.2 | 53.2 | 2.6 | 2.6 | 1.5 | 1.5 | 5 | 0 | 0 |
| baseline-2 | gemma3:1b | base | persona | test-seed | 77 | 0 | 7 | 92.2 | 92.2 | 7.8 | 7.8 | 15.3 | 15.3 | 0 | 0 | 0 |
| baseline-2 | gemma3:1b | base | grounded | test-seed | 77 | 0 | 7 | 89.6 | 89.6 | 7.8 | 11.7 | 15.1 | 16.6 | 14 | 0 | 0 |
| baseline-2 | gemma3:1b | base | cite | test-seed | 77 | 0 | 7 | 77.9 | 76.6 | 0.0 | 0.0 | 0.0 | 0.0 | 13 | 0 | 1 |
| baseline-2 | gemma3:1b | base | plan | test-seed | 77 | 0 | 7 | 84.4 | 84.4 | 3.9 | 3.9 | 5.4 | 5.4 | 3 | 0 | 0 |
| baseline-2 | gemma3:1b | base | best-of | test-seed | 77 | 0 | 7 | 96.1 | 96.1 | 2.6 | 6.5 | 1.0 | 2.6 | 8 | 0 | 0 |
| baseline-2 | gemma3:1b | base | grammar | test-seed | 77 | 1 | 7 | 79.2 | 79.2 | 2.6 | 2.6 | 1.6 | 1.6 | 14 | 0 | 0 |
| baseline-2 | gemma3:1b | base | persona | test-mechanism | 66 | 0 | 6 | 66.7 | 66.7 | 9.1 | 9.1 | 6.8 | 6.8 | 0 | 0 | 0 |
| baseline-2 | gemma3:1b | base | grounded | test-mechanism | 66 | 0 | 6 | 65.2 | 63.6 | 13.6 | 13.6 | 8.5 | 8.5 | 17 | 0 | 1 |
| baseline-2 | gemma3:1b | base | cite | test-mechanism | 66 | 0 | 6 | 50.0 | 50.0 | 1.5 | 1.5 | 1.0 | 1.0 | 13 | 0 | 0 |
| baseline-2 | gemma3:1b | base | plan | test-mechanism | 66 | 0 | 6 | 57.6 | 57.6 | 7.6 | 7.6 | 5.1 | 5.1 | 0 | 0 | 0 |
| baseline-2 | gemma3:1b | base | grammar | test-mechanism | 66 | 0 | 6 | 50.0 | 50.0 | 4.5 | 4.5 | 3.2 | 3.2 | 8 | 0 | 0 |
| baseline-2 | gemma3:1b | base | best-of | test-mechanism | 66 | 0 | 6 | 93.9 | 93.9 | 15.2 | 22.7 | 9.9 | 12.9 | 10 | 0 | 0 |
| baseline-2 | gemma3:4b | base | persona | train | 77 | 0 | 7 | 74.0 | 74.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0 | 0 | 0 |
| baseline-2 | gemma3:4b | base | grounded | train | 77 | 0 | 7 | 87.0 | 88.3 | 2.6 | 24.7 | 1.6 | 10.3 | 20 | 1 | 0 |
| baseline-2 | gemma3:4b | base | cite | train | 77 | 0 | 7 | 44.2 | 55.8 | 0.0 | 0.0 | 0.0 | 0.0 | 27 | 9 | 0 |
| baseline-2 | gemma3:4b | base | best-of | train | 77 | 0 | 7 | 93.5 | 89.6 | 3.9 | 19.5 | 1.5 | 7.7 | 22 | 0 | 3 |
| baseline-2 | gemma3:4b | base | plan | train | 77 | 0 | 7 | 72.7 | 72.7 | 6.5 | 6.5 | 14.3 | 14.3 | 0 | 0 | 0 |
| baseline-2 | gemma3:4b | base | grammar | train | 77 | 0 | 7 | 75.3 | 84.4 | 0.0 | 15.6 | 0.0 | 6.1 | 26 | 7 | 0 |
| baseline-2 | gemma3:4b | base | persona | test-seed | 77 | 0 | 7 | 98.7 | 98.7 | 6.5 | 6.5 | 14.3 | 14.3 | 0 | 0 | 0 |
| baseline-2 | gemma3:4b | base | grounded | test-seed | 77 | 0 | 7 | 97.4 | 97.4 | 3.9 | 10.4 | 1.8 | 4.4 | 8 | 0 | 0 |
| baseline-2 | gemma3:4b | base | cite | test-seed | 77 | 0 | 7 | 89.6 | 88.3 | 0.0 | 0.0 | 0.0 | 0.0 | 16 | 0 | 1 |
| baseline-2 | gemma3:4b | base | best-of | test-seed | 77 | 0 | 7 | 100.0 | 100.0 | 3.9 | 9.1 | 1.8 | 3.9 | 7 | 0 | 0 |
| baseline-2 | gemma3:4b | base | plan | test-seed | 77 | 0 | 7 | 88.3 | 88.3 | 0.0 | 0.0 | 0.0 | 0.0 | 0 | 0 | 0 |
| baseline-2 | gemma3:4b | base | grammar | test-seed | 77 | 0 | 7 | 93.5 | 92.2 | 2.6 | 9.1 | 1.0 | 3.6 | 14 | 0 | 1 |
| baseline-2 | gemma3:4b | base | persona | test-mechanism | 66 | 0 | 6 | 62.1 | 62.1 | 6.1 | 6.1 | 3.2 | 3.2 | 2 | 0 | 0 |
| baseline-2 | gemma3:4b | base | grounded | test-mechanism | 66 | 0 | 6 | 48.5 | 45.5 | 6.1 | 10.6 | 4.1 | 5.9 | 17 | 2 | 4 |
| baseline-2 | gemma3:4b | base | cite | test-mechanism | 66 | 0 | 6 | 31.8 | 39.4 | 1.5 | 1.5 | 1.0 | 1.0 | 20 | 6 | 1 |
| baseline-2 | gemma3:4b | base | best-of | test-mechanism | 66 | 0 | 6 | 77.3 | 77.3 | 15.2 | 31.8 | 10.7 | 17.3 | 21 | 1 | 1 |
| baseline-2 | gemma3:4b | base | plan | test-mechanism | 66 | 0 | 6 | 57.6 | 57.6 | 4.5 | 10.6 | 3.1 | 5.4 | 4 | 0 | 0 |
| baseline-2 | gemma3:4b | base | grammar | test-mechanism | 66 | 0 | 6 | 47.0 | 45.5 | 1.5 | 4.5 | 1.0 | 2.2 | 20 | 3 | 4 |
| baseline-2 | llama3.2:1b | base | persona | train | 77 | 0 | 7 | 74.0 | 72.7 | 28.6 | 27.3 | 28.3 | 27.8 | 9 | 0 | 1 |
| baseline-2 | llama3.2:1b | base | grounded | train | 77 | 0 | 7 | 83.1 | 85.7 | 31.2 | 28.6 | 18.9 | 17.9 | 33 | 2 | 0 |
| baseline-2 | llama3.2:1b | base | cite | train | 77 | 0 | 7 | 89.6 | 88.3 | 0.0 | 0.0 | 0.0 | 0.0 | 27 | 1 | 2 |
| baseline-2 | llama3.2:1b | base | plan | train | 77 | 0 | 7 | 77.9 | 77.9 | 16.9 | 19.5 | 13.3 | 14.3 | 9 | 0 | 0 |
| baseline-2 | llama3.2:1b | base | grammar | train | 77 | 0 | 7 | 76.6 | 76.6 | 20.8 | 20.8 | 10.2 | 10.2 | 28 | 0 | 0 |
| baseline-2 | llama3.2:1b | base | best-of | train | 77 | 0 | 7 | 100.0 | 94.8 | 33.8 | 24.7 | 20.5 | 17.0 | 21 | 0 | 4 |
| baseline-2 | llama3.2:1b | base | persona | test-seed | 77 | 0 | 7 | 88.3 | 87.0 | 9.1 | 7.8 | 5.1 | 4.6 | 7 | 0 | 1 |
| baseline-2 | llama3.2:1b | base | grounded | test-seed | 77 | 0 | 7 | 90.9 | 90.9 | 39.0 | 37.7 | 22.5 | 22.0 | 27 | 0 | 0 |
| baseline-2 | llama3.2:1b | base | cite | test-seed | 77 | 0 | 7 | 77.9 | 74.0 | 0.0 | 0.0 | 0.0 | 0.0 | 24 | 0 | 3 |
| baseline-2 | llama3.2:1b | base | best-of | test-seed | 77 | 0 | 7 | 98.7 | 97.4 | 27.3 | 26.0 | 17.9 | 17.4 | 19 | 0 | 1 |
| baseline-2 | llama3.2:1b | base | plan | test-seed | 77 | 0 | 7 | 79.2 | 72.7 | 23.4 | 18.2 | 15.1 | 13.0 | 16 | 1 | 6 |
| baseline-2 | llama3.2:1b | base | grammar | test-seed | 77 | 0 | 7 | 70.1 | 67.5 | 10.4 | 9.1 | 4.4 | 3.9 | 25 | 0 | 2 |
| baseline-2 | llama3.2:1b | base | persona | test-mechanism | 66 | 0 | 6 | 57.6 | 57.6 | 25.8 | 25.8 | 18.6 | 18.6 | 1 | 0 | 0 |
| baseline-2 | llama3.2:1b | base | grounded | test-mechanism | 66 | 0 | 6 | 68.2 | 65.2 | 45.5 | 39.4 | 28.4 | 26.0 | 18 | 2 | 4 |
| baseline-2 | llama3.2:1b | base | cite | test-mechanism | 66 | 0 | 6 | 81.8 | 83.3 | 0.0 | 0.0 | 0.0 | 0.0 | 23 | 1 | 0 |
| baseline-2 | llama3.2:1b | base | best-of | test-mechanism | 66 | 0 | 6 | 97.0 | 86.4 | 48.5 | 37.9 | 30.6 | 24.7 | 21 | 0 | 7 |
| baseline-2 | llama3.2:1b | base | plan | test-mechanism | 66 | 0 | 6 | 71.2 | 71.2 | 28.8 | 28.8 | 21.3 | 21.3 | 1 | 0 | 0 |
| baseline-2 | llama3.2:1b | base | grammar | test-mechanism | 66 | 0 | 6 | 54.5 | 60.6 | 28.8 | 28.8 | 24.4 | 24.8 | 29 | 5 | 1 |
| baseline-2 | llama3.2:3b | base | persona | train | 77 | 0 | 7 | 63.6 | 63.6 | 5.2 | 6.5 | 3.9 | 4.4 | 6 | 0 | 0 |
| baseline-2 | llama3.2:3b | base | grounded | train | 77 | 0 | 7 | 80.5 | 77.9 | 20.8 | 16.9 | 22.0 | 20.5 | 26 | 2 | 4 |
| baseline-2 | llama3.2:3b | base | cite | train | 77 | 0 | 7 | 81.8 | 84.4 | 9.1 | 9.1 | 4.4 | 4.4 | 15 | 2 | 0 |
| baseline-2 | llama3.2:3b | base | plan | train | 77 | 0 | 7 | 67.5 | 67.5 | 16.9 | 10.4 | 10.0 | 7.5 | 8 | 0 | 0 |
| baseline-2 | llama3.2:3b | base | best-of | train | 77 | 0 | 7 | 94.8 | 92.2 | 20.8 | 23.4 | 21.5 | 22.6 | 20 | 0 | 2 |
| baseline-2 | llama3.2:3b | base | grammar | train | 77 | 0 | 7 | 72.7 | 77.9 | 18.2 | 23.4 | 7.9 | 10.0 | 24 | 4 | 0 |
| baseline-2 | llama3.2:3b | base | persona | test-seed | 77 | 0 | 7 | 96.1 | 96.1 | 0.0 | 0.0 | 0.0 | 0.0 | 2 | 0 | 0 |
| baseline-2 | llama3.2:3b | base | grounded | test-seed | 77 | 0 | 7 | 92.2 | 94.8 | 23.4 | 24.7 | 20.9 | 21.4 | 18 | 2 | 0 |
| baseline-2 | llama3.2:3b | base | cite | test-seed | 77 | 0 | 7 | 90.9 | 92.2 | 9.1 | 9.1 | 15.3 | 15.3 | 7 | 1 | 0 |
| baseline-2 | llama3.2:3b | base | best-of | test-seed | 77 | 0 | 7 | 100.0 | 100.0 | 7.8 | 7.8 | 14.8 | 14.8 | 3 | 0 | 0 |
| baseline-2 | llama3.2:3b | base | plan | test-seed | 77 | 0 | 7 | 79.2 | 79.2 | 0.0 | 0.0 | 0.0 | 0.0 | 1 | 0 | 0 |
| baseline-2 | llama3.2:3b | base | grammar | test-seed | 77 | 0 | 7 | 92.2 | 93.5 | 18.2 | 18.2 | 18.9 | 18.9 | 16 | 1 | 0 |
| baseline-2 | llama3.2:3b | base | persona | test-mechanism | 66 | 0 | 6 | 50.0 | 50.0 | 4.5 | 4.5 | 3.1 | 3.1 | 2 | 0 | 0 |
| baseline-2 | llama3.2:3b | base | grounded | test-mechanism | 66 | 0 | 6 | 74.2 | 74.2 | 36.4 | 24.2 | 21.3 | 16.6 | 22 | 1 | 1 |
| baseline-2 | llama3.2:3b | base | cite | test-mechanism | 66 | 0 | 6 | 78.8 | 78.8 | 21.2 | 21.2 | 13.9 | 13.9 | 9 | 1 | 1 |
| baseline-2 | llama3.2:3b | base | plan | test-mechanism | 66 | 0 | 6 | 42.4 | 42.4 | 22.7 | 22.7 | 20.1 | 20.1 | 4 | 0 | 0 |
| baseline-2 | llama3.2:3b | base | grammar | test-mechanism | 66 | 0 | 6 | 75.8 | 78.8 | 30.3 | 30.3 | 17.4 | 17.4 | 18 | 3 | 1 |
| baseline-2 | llama3.2:3b | base | best-of | test-mechanism | 66 | 0 | 6 | 95.5 | 87.9 | 37.9 | 24.2 | 33.6 | 28.2 | 24 | 0 | 5 |
| baseline-2 | phi4-mini:latest | base | persona | train | 77 | 0 | 7 | 57.1 | 57.1 | 11.7 | 11.7 | 7.9 | 7.9 | 5 | 0 | 0 |
| baseline-2 | phi4-mini:latest | base | grounded | train | 77 | 0 | 7 | 72.7 | 75.3 | 18.2 | 23.4 | 9.5 | 11.5 | 20 | 2 | 0 |
| baseline-2 | phi4-mini:latest | base | cite | train | 77 | 0 | 7 | 74.0 | 75.3 | 0.0 | 0.0 | 0.0 | 0.0 | 15 | 1 | 0 |
| baseline-2 | phi4-mini:latest | base | best-of | train | 77 | 0 | 7 | 97.4 | 97.4 | 15.6 | 23.4 | 9.5 | 12.6 | 14 | 1 | 1 |
| baseline-2 | phi4-mini:latest | base | plan | train | 77 | 0 | 7 | 75.3 | 75.3 | 27.3 | 27.3 | 18.6 | 18.6 | 3 | 0 | 0 |
| baseline-2 | phi4-mini:latest | base | grammar | train | 77 | 0 | 7 | 64.9 | 64.9 | 14.3 | 14.3 | 7.2 | 7.2 | 21 | 2 | 2 |
| baseline-2 | phi4-mini:latest | base | persona | test-seed | 77 | 0 | 7 | 80.5 | 80.5 | 10.4 | 10.4 | 5.4 | 5.4 | 5 | 0 | 0 |
| baseline-2 | phi4-mini:latest | base | grounded | test-seed | 77 | 0 | 7 | 81.8 | 88.3 | 33.8 | 42.9 | 28.5 | 32.0 | 21 | 5 | 0 |
| baseline-2 | phi4-mini:latest | base | cite | test-seed | 77 | 0 | 7 | 76.6 | 76.6 | 0.0 | 0.0 | 0.0 | 0.0 | 19 | 0 | 0 |
| baseline-2 | phi4-mini:latest | base | plan | test-seed | 77 | 0 | 7 | 59.7 | 62.3 | 19.5 | 23.4 | 11.6 | 13.2 | 12 | 2 | 0 |
| baseline-2 | phi4-mini:latest | base | best-of | test-seed | 77 | 0 | 7 | 98.7 | 96.1 | 32.5 | 36.4 | 27.9 | 29.4 | 18 | 0 | 2 |
| baseline-2 | phi4-mini:latest | base | grammar | test-seed | 77 | 0 | 7 | 76.6 | 77.9 | 22.1 | 26.0 | 10.3 | 11.8 | 20 | 1 | 0 |
| baseline-2 | phi4-mini:latest | base | persona | test-mechanism | 66 | 0 | 6 | 47.0 | 47.0 | 25.8 | 25.8 | 17.5 | 17.5 | 3 | 0 | 0 |
| baseline-2 | phi4-mini:latest | base | grounded | test-mechanism | 66 | 0 | 6 | 54.5 | 77.3 | 34.8 | 51.5 | 21.9 | 28.5 | 30 | 15 | 0 |
| baseline-2 | phi4-mini:latest | base | cite | test-mechanism | 66 | 0 | 6 | 74.2 | 80.3 | 3.0 | 3.0 | 2.0 | 2.0 | 16 | 4 | 0 |
| baseline-2 | phi4-mini:latest | base | best-of | test-mechanism | 66 | 0 | 6 | 89.4 | 89.4 | 36.4 | 37.9 | 23.8 | 24.0 | 12 | 0 | 0 |
| baseline-2 | phi4-mini:latest | base | plan | test-mechanism | 66 | 0 | 6 | 47.0 | 47.0 | 28.8 | 28.8 | 22.1 | 22.1 | 4 | 0 | 0 |
| baseline-2 | phi4-mini:latest | base | grammar | test-mechanism | 66 | 0 | 6 | 65.2 | 80.3 | 28.8 | 45.5 | 17.3 | 23.8 | 21 | 10 | 0 |
| baseline-2 | qwen3:0.6b | base | persona | train | 77 | 0 | 7 | 71.4 | 71.4 | 10.4 | 10.4 | 4.6 | 4.6 | 12 | 0 | 0 |
| baseline-2 | qwen3:0.6b | base | grounded | train | 77 | 0 | 7 | 88.3 | 84.4 | 27.3 | 26.0 | 11.3 | 10.8 | 30 | 2 | 5 |
| baseline-2 | qwen3:0.6b | base | cite | train | 77 | 0 | 7 | 85.7 | 84.4 | 13.0 | 10.4 | 7.5 | 6.5 | 15 | 1 | 2 |
| baseline-2 | qwen3:0.6b | base | plan | train | 77 | 0 | 7 | 68.8 | 66.2 | 15.6 | 16.9 | 8.3 | 8.8 | 11 | 0 | 2 |
| baseline-2 | qwen3:0.6b | base | best-of | train | 77 | 0 | 7 | 94.8 | 93.5 | 24.7 | 28.6 | 22.8 | 24.3 | 20 | 1 | 2 |
| baseline-2 | qwen3:0.6b | base | grammar | train | 77 | 0 | 7 | 81.8 | 81.8 | 20.8 | 18.2 | 10.5 | 9.5 | 23 | 2 | 2 |
| baseline-2 | qwen3:0.6b | base | persona | test-seed | 77 | 0 | 7 | 88.3 | 85.7 | 15.6 | 20.8 | 17.9 | 19.9 | 29 | 0 | 2 |
| baseline-2 | qwen3:0.6b | base | grounded | test-seed | 77 | 0 | 7 | 87.0 | 89.6 | 28.6 | 32.5 | 24.1 | 25.6 | 33 | 2 | 0 |
| baseline-2 | qwen3:0.6b | base | cite | test-seed | 77 | 0 | 7 | 71.4 | 74.0 | 13.0 | 14.3 | 6.5 | 7.0 | 13 | 3 | 1 |
| baseline-2 | qwen3:0.6b | base | best-of | test-seed | 77 | 0 | 7 | 96.1 | 81.8 | 19.5 | 10.4 | 20.0 | 4.6 | 26 | 0 | 11 |
| baseline-2 | qwen3:0.6b | base | plan | test-seed | 77 | 0 | 7 | 85.7 | 81.8 | 22.1 | 23.4 | 23.3 | 23.8 | 21 | 0 | 3 |
| baseline-2 | qwen3:0.6b | base | grammar | test-seed | 77 | 0 | 7 | 70.1 | 72.7 | 22.1 | 23.4 | 10.9 | 11.5 | 19 | 3 | 1 |
| baseline-2 | qwen3:0.6b | base | persona | test-mechanism | 66 | 0 | 6 | 87.9 | 69.7 | 42.4 | 31.8 | 32.5 | 17.6 | 23 | 0 | 12 |
| baseline-2 | qwen3:0.6b | base | grounded | test-mechanism | 66 | 0 | 6 | 83.3 | 80.3 | 48.5 | 45.5 | 35.3 | 34.1 | 25 | 0 | 2 |
| baseline-2 | qwen3:0.6b | base | cite | test-mechanism | 66 | 0 | 6 | 84.8 | 86.4 | 24.2 | 24.2 | 12.9 | 12.9 | 13 | 1 | 0 |
| baseline-2 | qwen3:0.6b | base | best-of | test-mechanism | 66 | 0 | 6 | 90.9 | 89.4 | 37.9 | 40.9 | 26.8 | 28.0 | 19 | 0 | 1 |
| baseline-2 | qwen3:0.6b | base | plan | test-mechanism | 66 | 0 | 6 | 50.0 | 50.0 | 21.2 | 22.7 | 13.0 | 13.6 | 15 | 0 | 0 |
| baseline-2 | qwen3:0.6b | base | grammar | test-mechanism | 66 | 0 | 6 | 83.3 | 84.8 | 33.3 | 33.3 | 18.6 | 18.6 | 15 | 1 | 0 |
| baseline-2 | qwen3:1.7b | base | persona | train | 77 | 0 | 7 | 71.4 | 71.4 | 11.7 | 11.7 | 4.9 | 4.9 | 10 | 0 | 0 |
| baseline-2 | qwen3:1.7b | base | grounded | train | 77 | 0 | 7 | 84.4 | 90.9 | 26.0 | 35.1 | 23.2 | 26.8 | 24 | 6 | 1 |
| baseline-2 | qwen3:1.7b | base | cite | train | 77 | 0 | 7 | 68.8 | 70.1 | 5.2 | 6.5 | 3.2 | 3.7 | 11 | 1 | 0 |
| baseline-2 | qwen3:1.7b | base | best-of | train | 77 | 0 | 7 | 89.6 | 97.4 | 23.4 | 33.8 | 21.2 | 25.3 | 26 | 6 | 0 |
| baseline-2 | qwen3:1.7b | base | plan | train | 77 | 0 | 7 | 71.4 | 75.3 | 19.5 | 23.4 | 22.9 | 24.4 | 14 | 3 | 0 |
| baseline-2 | qwen3:1.7b | base | grammar | train | 77 | 0 | 7 | 63.6 | 66.2 | 16.9 | 20.8 | 7.8 | 9.3 | 18 | 2 | 0 |
| baseline-2 | qwen3:1.7b | base | persona | test-seed | 77 | 0 | 7 | 94.8 | 96.1 | 10.4 | 13.0 | 15.8 | 17.1 | 17 | 1 | 0 |
| baseline-2 | qwen3:1.7b | base | grounded | test-seed | 77 | 0 | 7 | 83.1 | 84.4 | 23.4 | 24.7 | 11.8 | 12.4 | 26 | 1 | 0 |
| baseline-2 | qwen3:1.7b | base | cite | test-seed | 77 | 0 | 7 | 72.7 | 76.6 | 11.7 | 14.3 | 7.2 | 8.2 | 22 | 3 | 0 |
| baseline-2 | qwen3:1.7b | base | plan | test-seed | 77 | 0 | 7 | 80.5 | 79.2 | 24.7 | 24.7 | 24.4 | 24.4 | 7 | 0 | 1 |
| baseline-2 | qwen3:1.7b | base | best-of | test-seed | 77 | 0 | 7 | 92.2 | 92.2 | 35.1 | 36.4 | 27.4 | 27.9 | 26 | 0 | 0 |
| baseline-2 | qwen3:1.7b | base | grammar | test-seed | 77 | 0 | 7 | 72.7 | 76.6 | 24.7 | 27.3 | 13.4 | 14.5 | 22 | 3 | 0 |
| baseline-2 | qwen3:1.7b | base | persona | test-mechanism | 66 | 0 | 6 | 69.7 | 69.7 | 33.3 | 33.3 | 32.2 | 32.2 | 5 | 0 | 0 |
| baseline-2 | qwen3:1.7b | base | grounded | test-mechanism | 66 | 0 | 6 | 75.8 | 72.7 | 45.5 | 42.4 | 34.9 | 24.7 | 24 | 3 | 5 |
| baseline-2 | qwen3:1.7b | base | cite | test-mechanism | 66 | 0 | 6 | 72.7 | 72.7 | 10.6 | 10.6 | 6.7 | 6.7 | 13 | 0 | 0 |
| baseline-2 | qwen3:1.7b | base | best-of | test-mechanism | 66 | 0 | 6 | 84.8 | 87.9 | 47.0 | 50.0 | 34.9 | 36.1 | 23 | 2 | 0 |
| baseline-2 | qwen3:1.7b | base | plan | test-mechanism | 66 | 0 | 6 | 50.0 | 59.1 | 22.7 | 31.8 | 15.5 | 19.0 | 21 | 6 | 0 |
| baseline-2 | qwen3:1.7b | base | grammar | test-mechanism | 66 | 0 | 6 | 71.2 | 71.2 | 42.4 | 42.4 | 31.1 | 31.1 | 13 | 0 | 0 |
| baseline-2 | qwen3:4b | base | persona | train | 77 | 0 | 7 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 6 | 0 | 0 |
| baseline-2 | qwen3:4b | base | grounded | train | 77 | 0 | 7 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 22 | 0 | 0 |
| baseline-2 | qwen3:4b | base | cite | train | 77 | 0 | 7 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 17 | 0 | 0 |
| baseline-2 | qwen3:4b | base | plan | train | 77 | 0 | 7 | 2.6 | 2.6 | 0.0 | 0.0 | 0.0 | 0.0 | 13 | 0 | 0 |
| baseline-2 | qwen3:4b | base | grammar | train | 77 | 0 | 7 | 83.1 | 83.1 | 20.8 | 31.2 | 8.7 | 12.8 | 29 | 0 | 0 |
| baseline-2 | qwen3:4b | base | best-of | train | 77 | 0 | 7 | 1.3 | 1.3 | 0.0 | 0.0 | 0.0 | 0.0 | 26 | 0 | 0 |
| baseline-2 | qwen3:4b | base | persona | test-seed | 77 | 0 | 7 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 8 | 0 | 0 |
| baseline-2 | qwen3:4b | base | grounded | test-seed | 77 | 0 | 7 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 26 | 0 | 0 |
| baseline-2 | qwen3:4b | base | cite | test-seed | 77 | 0 | 7 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 23 | 0 | 0 |
| baseline-2 | qwen3:4b | base | plan | test-seed | 77 | 0 | 7 | 3.9 | 3.9 | 1.3 | 1.3 | 3.6 | 3.6 | 6 | 0 | 0 |
| baseline-2 | qwen3:4b | base | grammar | test-seed | 77 | 0 | 7 | 94.8 | 93.5 | 13.0 | 11.7 | 5.7 | 5.2 | 10 | 0 | 1 |
| baseline-2 | qwen3:4b | base | best-of | test-seed | 77 | 0 | 7 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 26 | 0 | 0 |
| baseline-2 | qwen3:4b | base | persona | test-mechanism | 66 | 0 | 6 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 9 | 0 | 0 |
| baseline-2 | qwen3:4b | base | grounded | test-mechanism | 66 | 0 | 6 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 25 | 0 | 0 |
| baseline-2 | qwen3:4b | base | cite | test-mechanism | 66 | 0 | 6 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 12 | 0 | 0 |
| baseline-2 | qwen3:4b | base | plan | test-mechanism | 66 | 0 | 6 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 15 | 0 | 0 |
| baseline-2 | qwen3:4b | base | grammar | test-mechanism | 66 | 0 | 6 | 53.0 | 63.6 | 19.7 | 22.7 | 12.5 | 13.7 | 24 | 7 | 0 |
| baseline-2 | qwen3:4b | base | best-of | test-mechanism | 66 | 0 | 6 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 20 | 0 | 0 |
| baseline-2 | qwen3:4b-instruct | base | persona | train | 77 | 0 | 7 | 57.1 | 55.8 | 5.2 | 11.7 | 2.3 | 4.9 | 11 | 0 | 1 |
| baseline-2 | qwen3:4b-instruct | base | grounded | train | 77 | 0 | 7 | 87.0 | 89.6 | 16.9 | 28.6 | 6.9 | 11.5 | 34 | 2 | 0 |
| baseline-2 | qwen3:4b-instruct | base | cite | train | 77 | 0 | 7 | 89.6 | 89.6 | 36.4 | 36.4 | 15.4 | 15.4 | 34 | 0 | 0 |
| baseline-2 | qwen3:4b-instruct | base | best-of | train | 77 | 0 | 7 | 93.5 | 97.4 | 19.5 | 33.8 | 19.4 | 25.0 | 27 | 3 | 0 |
| baseline-2 | qwen3:4b-instruct | base | plan | train | 77 | 0 | 7 | 40.3 | 40.3 | 1.3 | 2.6 | 0.8 | 1.3 | 5 | 0 | 0 |
| baseline-2 | qwen3:4b-instruct | base | grammar | train | 77 | 0 | 7 | 92.2 | 92.2 | 29.9 | 32.5 | 12.0 | 13.0 | 31 | 0 | 0 |
| baseline-2 | qwen3:4b-instruct | base | persona | test-seed | 77 | 0 | 7 | 85.7 | 84.4 | 0.0 | 0.0 | 0.0 | 0.0 | 1 | 0 | 1 |
| baseline-2 | qwen3:4b-instruct | base | grounded | test-seed | 77 | 0 | 7 | 88.3 | 89.6 | 6.5 | 11.7 | 2.6 | 4.6 | 15 | 1 | 0 |
| baseline-2 | qwen3:4b-instruct | base | cite | test-seed | 77 | 0 | 7 | 94.8 | 94.8 | 7.8 | 14.3 | 3.1 | 5.6 | 19 | 1 | 1 |
| baseline-2 | qwen3:4b-instruct | base | best-of | test-seed | 77 | 0 | 7 | 96.1 | 94.8 | 10.4 | 16.9 | 5.1 | 7.7 | 16 | 1 | 2 |
| baseline-2 | qwen3:4b-instruct | base | plan | test-seed | 77 | 0 | 7 | 94.8 | 93.5 | 0.0 | 1.3 | 0.0 | 0.5 | 6 | 0 | 1 |
| baseline-2 | qwen3:4b-instruct | base | grammar | test-seed | 77 | 0 | 7 | 92.2 | 92.2 | 7.8 | 7.8 | 3.1 | 3.1 | 7 | 0 | 0 |
| baseline-2 | qwen3:4b-instruct | base | persona | test-mechanism | 66 | 0 | 6 | 36.4 | 36.4 | 6.1 | 6.1 | 2.8 | 2.8 | 3 | 0 | 0 |
| baseline-2 | qwen3:4b-instruct | base | grounded | test-mechanism | 66 | 0 | 6 | 40.9 | 48.5 | 15.2 | 22.7 | 8.1 | 11.1 | 29 | 5 | 0 |
| baseline-2 | qwen3:4b-instruct | base | cite | test-mechanism | 66 | 0 | 6 | 56.1 | 83.3 | 16.7 | 43.9 | 9.5 | 20.2 | 29 | 18 | 0 |
| baseline-2 | qwen3:4b-instruct | base | plan | test-mechanism | 66 | 0 | 6 | 30.3 | 28.8 | 0.0 | 0.0 | 0.0 | 0.0 | 5 | 0 | 1 |
| baseline-2 | qwen3:4b-instruct | base | best-of | test-mechanism | 66 | 0 | 6 | 57.6 | 65.2 | 16.7 | 24.2 | 11.8 | 14.8 | 25 | 5 | 0 |
| baseline-2 | qwen3:4b-instruct | base | grammar | test-mechanism | 66 | 0 | 6 | 57.6 | 81.8 | 22.7 | 47.0 | 15.5 | 25.0 | 28 | 16 | 0 |
| finetune/eval | llama1b | act | grounded | test-mechanism | 220 | 0 | 20 | 59.5 | 65.0 | 35.0 | 39.5 | 30.7 | 28.7 | 147 | 21 | 9 |
| finetune/eval | llama1b | act | grounded | test-seed | 220 | 0 | 20 | 91.8 | 94.1 | 52.7 | 55.0 | 21.8 | 22.5 | 112 | 5 | 0 |
| finetune/eval | llama1b | base | grounded | test-mechanism | 220 | 0 | 20 | 67.3 | 71.4 | 36.4 | 36.8 | 26.0 | 26.2 | 66 | 13 | 4 |
| finetune/eval | llama1b | base | best-of | test-mechanism | 220 | 0 | 20 | 87.7 | 84.5 | 45.5 | 37.3 | 33.8 | 31.2 | 65 | 0 | 7 |
| finetune/eval | llama1b | base | grounded | test-seed | 220 | 0 | 20 | 87.7 | 86.8 | 44.1 | 39.1 | 22.9 | 21.3 | 84 | 1 | 3 |
| finetune/eval | llama1b | base | best-of | test-seed | 220 | 0 | 20 | 99.1 | 94.5 | 35.9 | 28.2 | 26.6 | 24.2 | 70 | 0 | 10 |
| finetune/eval | llama3b | act | grounded | test-mechanism | 220 | 0 | 20 | 55.5 | 70.5 | 33.2 | 41.4 | 22.8 | 25.4 | 120 | 35 | 2 |
| finetune/eval | llama3b | act | grounded | test-seed | 220 | 0 | 20 | 94.1 | 94.1 | 51.8 | 55.5 | 23.5 | 24.7 | 106 | 2 | 2 |
| finetune/eval | llama3b | base | grounded | test-mechanism | 220 | 0 | 20 | 71.4 | 73.2 | 25.9 | 25.0 | 16.8 | 16.5 | 85 | 15 | 11 |
| finetune/eval | llama3b | base | best-of | test-mechanism | 220 | 0 | 20 | 93.2 | 87.3 | 26.8 | 19.5 | 15.1 | 13.0 | 62 | 3 | 16 |
| finetune/eval | llama3b | base | grounded | test-seed | 220 | 0 | 20 | 85.0 | 84.1 | 35.0 | 30.5 | 27.5 | 26.1 | 89 | 6 | 8 |
| finetune/eval | llama3b | base | best-of | test-seed | 220 | 0 | 20 | 96.4 | 91.4 | 27.7 | 23.2 | 11.3 | 9.9 | 55 | 0 | 11 |
| finetune/eval | qwen06b | act | grounded | test-mechanism | 220 | 0 | 20 | 53.6 | 73.2 | 32.7 | 52.3 | 24.1 | 30.3 | 132 | 54 | 11 |
| finetune/eval | qwen06b | act | grounded | test-seed | 220 | 0 | 20 | 94.1 | 92.7 | 63.6 | 62.7 | 42.3 | 42.0 | 122 | 0 | 3 |
| finetune/eval | qwen06b | base | grounded | test-mechanism | 220 | 0 | 20 | 70.9 | 76.4 | 26.4 | 32.3 | 18.4 | 20.2 | 98 | 12 | 0 |
| finetune/eval | qwen06b | base | best-of | test-mechanism | 220 | 0 | 20 | 87.7 | 90.5 | 34.5 | 41.4 | 29.1 | 31.2 | 80 | 8 | 2 |
| finetune/eval | qwen06b | base | grounded | test-seed | 220 | 0 | 20 | 77.7 | 79.5 | 29.5 | 31.8 | 27.1 | 27.8 | 81 | 8 | 4 |
| finetune/eval | qwen06b | base | best-of | test-seed | 220 | 0 | 20 | 93.2 | 91.4 | 40.9 | 44.5 | 32.5 | 33.6 | 79 | 0 | 4 |
| finetune/eval | qwen06b | unfiltered | grounded | test-mechanism | 220 | 0 | 20 | 38.2 | 50.0 | 14.1 | 24.1 | 10.7 | 13.7 | 116 | 28 | 2 |
| finetune/eval | qwen06b | unfiltered | grounded | test-seed | 220 | 0 | 20 | 87.3 | 91.4 | 38.6 | 40.9 | 14.9 | 15.6 | 96 | 10 | 1 |
| finetune/eval | qwen06b | verifier | grounded | test-mechanism | 220 | 0 | 20 | 73.2 | 82.7 | 30.0 | 37.7 | 18.8 | 21.3 | 117 | 22 | 1 |
| finetune/eval | qwen06b | verifier | grounded | test-seed | 220 | 0 | 20 | 95.9 | 98.2 | 41.8 | 45.9 | 19.1 | 20.4 | 87 | 5 | 0 |


## Verification and review

- `npm run typecheck`: passed.
- Verifier and runtime guard tests: **83 passed**, including the new saved and adversarial cases.
- `npm run bench:slm:smoke`: **71 passed across 10 files**, including version propagation, source/calibration/world handling, injection behavior, metric denominators and deterministic blinded sampling.
- `npm test -- --maxWorkers 1 --no-file-parallelism`: **1,119 passed across 79 files**.
- `npm run build`: passed. Existing Vite config/chunk-size advisories remain.
- `node .github/workflows/check-bundle.mjs`: passed, **358,883 / 400,000 bytes** gzipped.
- `git diff --check`: passed. Read-only diff review checked every task requirement, app-file scope, opt-in version propagation, all input hashes and audit blinding fields.

The first parallel full-suite run failed a 1.5-second simulation timing check and the SEO test's attempt to write Vite's temporary config into the shared read-only `node_modules`. Scoped tests first passed with `--configLoader native`. For the final full suite and build, a temporary node_modules symlink tree used the identical installed packages with writable cache directories; the original node_modules symlink was restored afterward. Serial execution passed without relaxing any threshold or changing test code outside the verifier tests. No model was started to resolve an environment issue.

## Rulings and follow-up

The supplied working directory is an existing `research/checker-v2` worktree at the same starting commit as `build/village`; `build/village` is checked out in the main, GPU-active worktree. Preserved that deliberate isolation rather than switching or modifying the main checkout. The default-v1 guarantee, unchanged original results and no-commit instruction are preserved. The pre-existing untracked task brief and results symlink remain untouched; generated build-info files are not staged.

This is a bounded lexical clause parser, not a general semantic oracle. Attribution, malformed/nested quotation, ellipsis, negative concord, presupposition and pronoun resolution remain imperfect. The residual finite-state gate can create conservative false positives, and the old overlap/role/polarity heuristics still have their existing limitations outside this repair. The saved fixtures expose known failures but are not an accuracy estimate. The 60-row review cannot estimate overall sensitivity/specificity or replace the independent 500-output audit in methods-formal section 6.

Follow-up: collect two independent blinded ratings and adjudicate disagreements; extend audit coverage to v2 losses and other changed-but-still-unfaithful rows; then decide any further parser repair from labelled evidence and bump/freeze its fingerprint. Rescore the confirmation round after its generation ends. Injection-compliance filtering is the separate next task; this change intentionally does not claim to fix its literal-marker semantics. No follow-up is required to reproduce the measurements delivered here.

## Files to commit later

Stage explicit paths only:

- `apps/rumortown/src/agentic/verifier.ts`
- `apps/rumortown/src/agentic/verifier.test.ts`
- `apps/rumortown/src/agentic/verifier.test-cases.json`
- `bench/slm/verifier.ts`
- `bench/slm/rescore.ts`
- `bench/slm/checker-v2.ts`
- `bench/slm/checker-v2.harness.test.ts`
- `agent-tradeoff/reports/43-report.md`

Generated measurement outputs stay in the designated results folder. Do not stage the results symlink, temporary environment files, build artifacts or build-info files. The pre-existing `agent-tradeoff/43-checker-v2.md` is the owner's task brief, not a newly authored implementation file.

Suggested plain commit message:

```text
43: Version the checker and handle epistemic negation by clause
```

STATUS: DONE
Tests: typecheck, 83 verifier/guard tests, 71 harness tests, 1,119 root tests, production build, bundle gate and 16,717-reply v1 parity passed.
