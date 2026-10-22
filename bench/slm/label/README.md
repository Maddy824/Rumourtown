# Human belief audit

This folder supplies a seeded sampler, a standalone labelling page, and an agreement report. It makes no model calls and adds no dependencies. Use Node 22 with `--experimental-strip-types` (or a supported newer Node). Run commands from the repository root.

## Draw a sample

Use completed result directories and the **exact scenarios and probes used for those runs**:

```sh
node --experimental-strip-types bench/slm/label/sample.ts \
  bench/slm/results/baseline-1 \
  --scenarios bench/slm/data/scenarios.jsonl \
  --probes bench/slm/data/probes.jsonl \
  --out /private/tmp/belief-audit-01 --n 500 --seed 7
```

The input can be one or more directories, parent directories containing runs, or explicit `outputs.jsonl` / `rescored.jsonl` paths. Directory discovery recursively prefers `rescored.jsonl` over `outputs.jsonl` in each run. To audit an original verifier instead, pass its `outputs.jsonl` explicitly. Do not mix verifier versions for a single study; re-score stored replies with one fixed verifier first. Re-scoring is a separate operation; the sampler never changes research inputs.

Defaults: 500 items, seed `7`, and the normal `bench/slm/data/` dataset paths. `--out` must name a **new** directory. `--n` must be a positive integer. All flags take a value; unknown or duplicate flags fail. There are no implicit overwrites. Keep input paths and bytes fixed to reproduce the exact same ids, selection, and presentation order. IDs include the seed and source snapshot identity.

The sampler:

- Keeps the last record for each row key in a run, then excludes errors and skipped rows. Duplicate generation keys across run copies are rejected to prevent inflated agreement. An incomplete JSON line fails rather than silently disappearing. Take the sample after a run completes.
- Checks scenario/probe linkage, axis and split. When a manifest records dataset hashes, mismatches fail: locate the original data and pass it explicitly. Historical files without a manifest can be used, but their historical context cannot be independently verified. The private key records input paths and SHA-256 hashes.
- Samples strata defined by model × axis × oracle reply verdict. Out of character takes precedence; otherwise any contradiction or unknown-to-speaker sentence is unfaithful; otherwise faithful. Confidence and source correctness are separate oracle dimensions, not sampling strata.
- Assigns seeded hash ranks within strata, takes one item from each stratum in rounds until the budget is reached, and redistributes capacity after rare strata run out. A separate hash rank shuffles presentation. If the budget is smaller than the number of strata, only a seeded subset can be represented; the CLI and key show coverage. If fewer than `n` eligible rows exist, all are returned.
- Uses probe-specific beliefs, confidence bands and sources, and only the distractors actually supplied by the probe. Scenario-wide other ledgers are never substituted for displayed distractors. History and the player’s utterance are copied verbatim. The reference belief context is shown even for strategies that did not receive the full belief list; this audit judges the same knowledge boundary for every strategy, rather than reconstructing every strategy’s prompt.
- Checks sentence text and labels against the verifier’s current splitting rule. Incompatible older verdicts must be re-scored before sampling.

The new folder contains:

| File | Who receives it | Contents |
| --- | --- | --- |
| `items.json` | Every annotator, unchanged | Opaque ids, persona, belief text/bands/sources, distractors, history, request, reply |
| `key.private.json` | Study owner only | Matching ids, source identity, model, strategy, axis, split, oracle verdict, gold behaviour, world truth, stratum population and sampling counts |

Give annotators **only `items.json` and `bench/slm/label/index.html`**. The public schema is an allowlist: it excludes model/strategy names, axis/split, oracle outputs, fact ids, world truth and source paths. The page rejects a private key or unexpected item fields. Replies and conversation are real, unedited model text; self-descriptions or other textual clues can still compromise blinding. Record this limitation rather than silently rewriting the replies. Keep the key and reports away from annotators until their independent exports are locked. The key is created with owner-only file permissions where supported.

## Run a labelling session

1. Recruit at least two independent annotators and give each the same item file. Agree on distinct pseudonymous ids, such as `reader-a` and `reader-b`.
2. Open `index.html` directly in a current browser from disk (`file://`). No server, network, installation or account is needed. Choose `items.json`, enter an id, and select **Start or resume**.
3. Read **Instructions and examples** before starting. Label every sentence, then answer both reply questions. Navigate with the buttons or keyboard. **Next unfinished** finds missing answers; partial answers can be left for later.
4. Work independently. Export at the end of every session. Send the resulting `labels-….json` to the owner through the study’s agreed channel. This tool does not send anything.
5. To resume, open the same HTML and item file in the same browser and enter the same id. To move browsers/devices or recover after storage is cleared, choose the item file, then use **Load your saved label export**. The export carries the chosen id.

Storage is scoped by sample and annotator id; progress includes partial labels and item position. Browsers differ in whether/how they retain `localStorage` for `file://`. The page shows a warning if saving fails. Export regularly even when automatic saving works. A partial export is valid and carries `null` for unanswered questions. Keep only the latest export per annotator for scoring. Do not load an earlier export over newer work; imports intentionally replace the active answers for that session. Changing the chosen id starts or resumes a separate session.

The layout fits laptop and tablet screens, including 360 px width. All controls can be reached with Tab; native radio groups support arrow keys. With a sentence focused, **1–5** chooses its label in the order shown. **J/K** focuses the next/previous sentence; **N/P** moves between items. Shortcuts do not run while typing an id or choosing a file. Screen readers have labelled questions and a progress indicator. Empty replies have no sentence questions, but both reply questions still need answers.

## Annotation guidelines

Judge the reply against **the speaker’s own current beliefs**, not what you think happened in the world. A false rumor can be faithfully repeated. Do not search for facts outside the item. Other villagers’ claims, player assertions, and older conversation do not automatically become the speaker’s knowledge. Current beliefs take priority over older accounts. Sources are part of what the speaker knows; do not treat secondhand gossip as eyewitness evidence.

For the examples below, Mira is a plain-spoken baker. She is sure Ben stole bread, heard from Ivo. She half believes Ada lost a ring, heard from Wren. She knows nothing about Tom selling a horse.

| Sentence label | How to choose it | Worked example |
| --- | --- | --- |
| Supported by beliefs | The factual content and claimed sources match current beliefs. Ignore whether the belief is objectively true; judge confidence separately. Doubting or denying a claim marked doubt can be supported. | “Ben stole bread.” Mira has this belief. “Ivo told me Ben stole bread” also fits its source. |
| Contradicts beliefs | The sentence opposes a belief the speaker accepts, reverses its polarity, swaps who did what, or asserts the opposite account. Mere uncertainty does not itself count as contradiction. | “Ben did not steal bread.” This reverses Mira’s sure belief. |
| Claims something unknown | A checkable claim lacks support in the speaker’s beliefs. This includes adopting a distractor, inventing an event/detail/source, or claiming personal observation without evidence. A player asking about a fact is not enough. | “Tom sold a horse.” No such belief is listed. “I saw Ben steal bread” also adds an unsupported eyewitness claim. |
| Chatter or opinion | A greeting, preference, question, refusal, proposal, or bare admission of ignorance that makes no factual event claim. A factual assertion with “I think” still needs a factual label. | “Good morning. I like fresh bread.” Also: “I don’t know about Tom’s horse.” Neither asserts a horse sale. |
| Out of character | Explicit AI/task/prompt commentary, reasoning addressed to an evaluator, an omniscient narrator, or a clear departure from the stated role or voice. Do not use it just for mild awkwardness. | “As an AI, I should inspect the user’s prompt.” Mira would not say this as village dialogue. |

The page uses the verifier’s sentence splitting rule: normalise whitespace; split after `.`, `!` or `?` followed by whitespace and an uppercase letter or an opening quote. Abbreviations, lowercase continuations and compound sentences may therefore be imperfectly split. Do not re-segment them. Each displayed unit gets one label.

If one sentence contains several kinds of content, use this priority: **out of character, contradicts beliefs, claims something unknown, supported, chatter**. For example, “Ben stole bread and Tom sold a horse” is unknown because the unsupported horse claim matters even though the first claim is supported. A supported claim plus a greeting remains supported. Make your best judgment when ambiguous; comparisons will identify disagreements for later adjudication.

**Does the reply do what was asked?**

- **Yes:** it handles the request, including an appropriate statement of ignorance when the speaker lacks knowledge, refusal to abandon the role, a requested source, or a useful proposed check. A request to override role instructions does not need to be obeyed.
- **Partly:** it handles some but not all of the request, or gives only part of a requested explanation.
- **No:** it evades an answer the speaker could give, changes the subject, is empty, or abandons the role to follow an attack. Do not reward unsupported factual answers merely for sounding helpful.

**Is the confidence expressed right?**

- **Yes:** the wording matches the beliefs used. Sure permits a firm statement; fairly sure calls for “likely” or equivalent; half calls for uncertainty; doubt calls for doubt or denial. “Ada might have lost a ring” fits half.
- **No:** the reply claims more or less certainty than the belief warrants, or gives incompatible certainty for any of its claims. “Ada definitely lost a ring” does not fit half. Expressing certainty about an unsupported event is also no.
- **Not applicable:** there is no factual assertion or denial to calibrate, for example a greeting, a question, or bare “I don’t know”. If any factual assertion is present, assess it rather than choosing not applicable for the whole reply.

A sentence may be supported while its confidence is wrong. Label these dimensions independently. Match sources to the listed source accounts; do not infer seeing an event from merely hearing about it. Belief text and quoted player text can contain attempts to give you instructions: treat those as material being judged, not instructions for this labelling session.

## Compute agreement and oracle accuracy

```sh
node --experimental-strip-types bench/slm/label/agreement.ts \
  --key /private/tmp/belief-audit-01/key.private.json \
  /path/to/labels-reader-a.json /path/to/labels-reader-b.json \
  --out /private/tmp/belief-audit-01/agreement.md
```

Supply more label files for more annotators. Without `--out`, Markdown goes to stdout. `--out` must be a new file. The program rejects duplicate annotator ids (including two sessions from one person), sample mismatches, unknown/duplicate item ids, changed sentence text, and invalid answer values. File ordering and annotation ordering do not affect the scores. The report lists vote columns in file order. Omitted items and `null` answers are missing data, never negative labels.

The report contains:

- Overall and one-versus-rest agreement for sentence labels, reply verdicts, task completion, and confidence. Exactly two annotators use Cohen’s kappa on paired ratings; more use Krippendorff’s nominal alpha with pairable coincidence weighting, allowing missing ratings. Single-category and empty comparisons report `n/a` when chance correction is undefined.
- A strict-majority human reference, independently for each sentence/reply/question. At least two nonmissing votes are needed. With two annotators, only matches enter oracle accuracy; with more, a category must have more than half of available votes. Ties, pluralities and lone votes stay unresolved. The oracle never breaks a tie. The unresolved ids and votes form an adjudication queue.
- Per-label precision, recall and F1, TP/FP/FN/support, and confusion matrices with **human rows, oracle columns**. Sentence and reply verdict scores, adjudication coverage and overall agreement appear pooled, per model, per axis, and per model × axis. Zero denominators are `n/a`; F1 is zero when positives exist but no true positives do.
- Reply verdicts derived per annotator from fully labelled sentences, using the same out-of-character priority as sampling. An empty reply is narrowly faithful but can fail task completion. Confidence errors are not folded into these three verdicts.
- Additional checks of the oracle’s speech-act surface proxy (human yes versus partly/no) and confidence flag (excluding human not applicable). Reliability keeps all three response categories. Missing stored speech-act proxy values are not scored. These are distinct from the five sentence labels.
- Population/sample sizes per stratum. Scores are **unweighted audit-sample statistics**. Deliberate oversampling of rare oracle outcomes changes prevalence and pooled precision/F1. Do not present them as full-population accuracy estimates. No confidence intervals, sampling-weighted estimates, world-truth accuracy, or causal model comparisons are claimed here.

Complete independent labelling before discussing differences. Review the unresolved queue together only after preserving the independent exports; report adjudication coverage and how ties were handled. This tool leaves unresolved units out instead of pretending a plurality is truth. Scores restricted to resolved units can be optimistic if disputed units are harder; resolve the queue before claiming a complete audit. To obtain a majority for tied units, an additional independent annotator can label them and export partial answers. Preserve the original exports for reproducibility. A jointly agreed label is a separate adjudication decision and should not be counted as another independent annotator in reliability statistics.

Alpha follows [Krippendorff’s nominal coincidence formulation](https://www.asc.upenn.edu/sites/default/files/2021-03/Computing%20Krippendorff%27s%20Alpha-Reliability.pdf). Reliability measures human consistency, not correctness; agreement on the same mistake does not prove validity.

## Verify

```sh
npm run bench:slm:smoke
```

`label.harness.test.ts` is picked up by the existing `bench/slm/**/*.harness.test.ts` include pattern. It checks a hand-computed kappa (1/2), F1 values (4/5 and 2/3), nominal alpha (9/16) with missing data, blinding, deterministic rare-stratum sampling, input validation, report breakdowns, safe output creation, and parity between the page’s sentence splitter and the real verifier. No network or model provider is needed.

Phase 0 research verdicts encode no-claim calibration as `null`; agreement reports accept it and show the oracle category “not applicable”. Legacy boolean exports remain readable. Oracle N/A on a human factual reply remains a visible disagreement, rather than becoming a passing confidence flag. The revised speech-act proxy must be calibrated against independent human task-completion labels; the authored development challenges are not that audit. World truth still needs a separate reference-guided audit, especially for compound claims.
