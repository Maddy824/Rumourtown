# 29: Human audit labelling tool

STATUS: DONE

Built the requested tools in `bench/slm/label/`. No dependency, application, simulation, harness configuration or existing benchmark source changes were made for this task. No files were staged, committed or pushed. Work stayed on `build/village`; concurrent task 28/controller work was preserved.

## What was built

- `sample.ts`: reads result directories recursively or explicit result files, preferring rescored outputs per run. Defaults to 500 items and seed 7; supports `--n`, `--seed`, `--scenarios`, `--probes`, and a required new `--out` directory. Seeded hash ranking and balanced rounds cover model × axis × oracle-verdict strata, exhaust rare strata and redistribute capacity. A separate rank shuffles presentation.
- `schema.ts`: versioned item/key/annotation contracts, shared label categories, reply-verdict precedence, and strict CLI option parsing.
- `index.html`: standalone offline page with inline JavaScript/CSS, file selection, an annotator-chosen id, one item at a time, exact verifier sentence splitting, five sentence labels and both reply questions. Includes plain-language worked examples, radio controls, keyboard shortcuts, responsive layout, progress, per-sample/per-annotator browser storage, partial JSON export and export import for moving devices. It rejects private-key files and unexpected item fields. It displays model/player text literally and has a no-network CSP.
- `agreement.ts`: Cohen’s kappa for two independent annotators, nominal Krippendorff’s alpha for more, overall and one-versus-rest agreement. Reports strict-majority reference coverage, per-label oracle precision/recall/F1 and TP/FP/FN/support, confusion matrices, and breakdowns pooled, by model, by axis and by model × axis. Includes sentence labels, derived reply verdicts, task completion and confidence. Outputs Markdown without overwriting an existing report.
- `label.harness.test.ts`: 13 tests picked up by the existing recursive harness include pattern. Includes the hand-computed kappa (1/2), F1 (4/5 and 2/3), and missing-data alpha (9/16) fixtures, plus sampling, blinding, context, report and CLI checks. Checks the inline page’s label values and sentence splitting against the real verifier.
- `README.md`: commands, file handling and blinding, full annotation guidelines, worked examples, independent annotation/adjudication workflow, metric definitions and limitations.

## Data and scoring decisions

1. Public items use an explicit allowlist. They carry only opaque ids, speaker name/role/voice, effective belief text/bands/sources, displayed distractors, player utterance/history and the unedited reply. No model/strategy, oracle, world-truth, axis/split, fact-id or source-path fields are exported. The separate private key keeps these scoring details, source hashes and per-stratum population/sample counts. Its filesystem mode is 0600 where supported. Give annotators only `items.json` and `index.html`.
2. Beliefs use `factsFor(scenario, probe)`, including counterfactual confidence/provenance/correction settings. Distractors come from the probe, not the entire village ledger; persona-only strategies have no displayed distractors. The page shows the canonical knowledge boundary even when a strategy was not given the complete belief list.
3. Reply strata/verdicts give out-of-character precedence, then unfaithful for contradiction/unknown, otherwise faithful. Confidence is scored separately. Empty replies have no sentence units and are narrowly faithful under this definition; task-completion labels expose their failure to answer.
4. Last records supersede earlier records per row key in each run. Errors/skips are excluded. Overlapping run copies with duplicate generation keys are rejected. Context linkage and manifest dataset hashes are checked. Incomplete JSON and incompatible stored sentence segmentation fail visibly. Inputs and existing results are never rewritten.
5. Human references require at least two available ratings and a strict majority. With two annotators, only matching judgments are resolved. Lone votes, ties and pluralities remain in an explicit adjudication queue. The oracle never breaks a tie. Missing ratings are omitted; undefined agreement/metric denominators are `n/a`. Both the report and README explain that agreed-only scores can be optimistic and that disputed units should be resolved before claiming a complete audit.
6. Metrics are unweighted statistics of the deliberately stratified audit sample, with coverage and stratum counts shown. They are not full-population accuracy estimates or world-truth judgments. Human partly/no maps to negative for the binary speech-act proxy; confidence not applicable is excluded from oracle scoring but retained in reliability statistics.
7. Blinding removes structured study metadata. Unedited model replies can still contain self-identification or other textual clues; silently censoring those would change the material being audited. This limitation is documented for the study owner.

## Verification

- `npm run bench:slm:smoke`: **36 tests passed across 7 files**, including all 13 new label tests and the concurrent task 28 harness test.
- `npm run typecheck`: passed; repeated after the concurrent application changes had landed.
- Additional strict TypeScript checking of all four new `.ts` files passed, using the existing local Node type declarations; no types/dependencies were installed in this repository.
- Initial `npm test`: 1,001 passed, 10 failed, all existing wall-time thresholds/timeouts in simulation, replay, research, agent environment or rendering tests under parallel load.
- `npm test -- --maxWorkers=1`: **1,011 tests passed across 78 files**, with the existing thresholds unchanged. This retry distinguishes the parallel timing failures from a functional regression.
- `npm run build`: passed. Existing Vite configuration/chunk-size warnings remain.
- `node .github/workflows/check-bundle.mjs`: passed, **353,365 gzip bytes / 400,000-byte budget**.
- A separate temporary four-reply fixture exercised the actual sampler and Markdown scoring CLI, including an empty reply. Generated files remain outside the repository at `/var/folders/3b/_1c9rr812rs3ynkpf_hqmgw40000gn/T/rt-label29-browser-ksVANu/`. Its labels are synthetic test data, not human audit results.
- The inline page script was exercised with a dependency-free DOM double: sentence/reply controls, keyboard label selection, navigation, saved answers/position, separate annotator ids, JSON export/import, rejecting an invalid import without destroying current answers, private-key rejection, exporting despite storage failure and shortcut guards while typing all passed. Safe literal rendering and responsive CSS were reviewed statically. This is not a real browser layout test.
- Actual Chrome/Playwright `file://` checks were attempted but the sandbox aborted Chrome at launch (`SIGABRT`, permission denial/`EPERM`). No successful desktop/tablet/360 px screenshots or actual-browser download/accessibility results are claimed.
- Runtime execution used the available Node **25.8.2**. The scripts use erasable TypeScript and Node APIs supported by Node 22; execution under Node 22 itself was not available here.
- Whitespace checks and a requirement-by-requirement self-review passed. Review fixes included preserving an active session on failed file loads, omitting nonexistent persona distractors, and rejecting duplicated generations across copied runs.

## Follow-up for the owner

- Open the page from disk in a browser and check desktop, tablet and 360 px layout, Tab/radio/shortcut operation, saving, import and an actual JSON download. Browser rendering is the remaining unverified UI requirement because of the sandbox launch failure.
- Recruit at least two independent annotators, draw the actual study sample, collect independent exports and resolve the reported adjudication queue. No human labels or empirical oracle-accuracy claims were fabricated by this task.
- Use the original datasets for historical runs. Every result manifest currently found locally differed from the current dataset hashes; the sampler correctly refuses to silently audit those replies against changed historical context. No real historical sample was generated from mismatched inputs.
- Run one sampler/scoring fixture with Node 22 when that runtime is available.

## Files to commit

Stage only these seven paths for this implementation (the untracked task brief is separate controller-owned work):

```text
bench/slm/label/schema.ts
bench/slm/label/sample.ts
bench/slm/label/index.html
bench/slm/label/agreement.ts
bench/slm/label/label.harness.test.ts
bench/slm/label/README.md
agent-tradeoff/reports/29-report.md
```

Plain commit message:

```text
29: add a blinded human audit for the epistemic verifier
```

No commit was made. When committing, use the required owner attribution: `Madhav Sunil <94164709+Maddy824@users.noreply.github.com>`.

STATUS: DONE
Tests: 36 SLM smoke and 1,011 serialized root tests passed; typecheck, build and bundle gate passed; real browser visual checks and Node 22 execution remain unverified.
