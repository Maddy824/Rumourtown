# SLM limits harness

Run from the repository root on Node 22 or newer. No added dependencies or changes to the game are required.

```sh
npm run bench:slm:scenarios
npm run bench:slm:probes
node --experimental-strip-types bench/slm/run.ts --models qwen3:0.6b,llama3.2:1b --strategies grounded,cite --axes pressure,facts --limit 200
npm run bench:slm:smoke
```

The first command bundles the real engine, map, cast, claims and authored talk with the existing Vite development dependency, as `bench/sim.ts` does, and explicitly aliases `rumormind` to its current source so a fresh checkout needs no library dist build. It runs seeds 1–200, whispers at ticks 30, 90 and 150, and samples ticks 0, 180 and 420. Witness events come from the real schedules and visibility rules. One villager per snapshot rotates across all 36 cast members. `facts` and their source chains come directly from `inspect`. World truth uses claim kinds confirmed by the subject's authored secrets, rather than rumor confidence; it describes the authored account, including acts scheduled later in the day. Unconfirmed claims are false under this closed-world convention.

The export has 450 training snapshots, 150 held-out seed snapshots (151–200), and 600 mechanism snapshots. Both sides of the Mira debt and Rosa nursing disputes are excluded from general contexts, unknown-world lists and distractors. Only the mechanism snapshots expose these stories, including for held-out seeds. Mechanism and seed results are reported separately. Four real snapshots are retained in `fixtures/scenarios.jsonl` for review. The full deterministic JSONL exports and run results are generated locally and ignored by git.

`probes.ts` supplies 48 seeded templates and all 12 program axes. Template wording stays fixed within each sweep. Confidence, provenance, correction and quoted-instruction interventions are explicit probe overrides; they never mutate the exported simulation state. Gold labels are speech acts, not a claim that the rule-based oracle is perfect. Conversation levels count complete user/assistant pairs including the final question. Larger fact and distractor levels are capped by the available real records and report `actualSize`. This initial export has at most nine beliefs per snapshot: a requested 50-fact level is **not** evidence about 50-fact performance. Extending the story inventory and collecting denser belief states remains follow-up work.

The method names are:

| Name | Method |
|---|---|
| `persona` | Persona and conversation only |
| `grounded` | Persona and current beliefs |
| `cite` | Prompted JSON `{uses, reply}`, validated citations |
| `plan` | Schema-constrained fact/speech-act selection, then realisation from those facts |
| `best-of` | First verifier-passing grounded sample at temperature 0.7; `--best-of 2`, `4` (default), or `8` |
| `cascade` | Grounded local reply, then reference model on failed verification |
| `grammar` | Cite then speak with provider JSON schema enforcement |
| `route` | Validate a target/act/band/direct-teller plan, retry once, then realise from only that plan and target |
| `route-template` | Same router, with the deterministic template realiser instead of a second model call |
| `best-of-act` | First verifier-passing sample that also completes the publicly inferred act; fixed budget of four |

Model names route to Ollama by default (`ollama:` is optional). `cf:@cf/meta/llama-3.2-3b-instruct` and other `cf:` names use Workers AI REST. The default cascade reference is `cf:@cf/meta/llama-3.3-70b-instruct-fp8-fast`; override it with `--cascade-model`. Choosing Workers AI or the default cascade can consume that account's allowance; this standalone benchmark does not use the game's inference ledger. It reads only the OAuth token from `~/Library/Preferences/.wrangler/config/default.toml` for account `a37c517b6f93de94eee5d64f3dcd49ae`. Tokens, request headers and remote error bodies are never written to results. No credential is included in fixtures.

Quantisation probes require explicit tags for each base model and precision. Missing mappings produce skipped rows rather than running the same tag under three precision labels. Confirm that the tags contain the same underlying weights and the intended precision before comparing results.

```sh
node --experimental-strip-types bench/slm/run.ts --models qwen3:0.6b --strategies grounded --axes quantisation --quantisations qwen3:0.6b:q4=qwen3-06b-q4,qwen3:0.6b:q8=qwen3-06b-q8,qwen3:0.6b:fp16=qwen3-06b-fp16
```

`--concurrency` defaults to 2. `--limit` bounds the selected probe set, which is then crossed with models and methods. Axes and available splits are selected round-robin so small runs cover the requested axes and include held-out seeds. `--split train`, `test-seed`, or `test-mechanism` restricts evaluation; default `all` keeps split-specific report rows. `--scenarios` and `--probes` select other JSONL inputs. `--out` chooses a new result directory; otherwise results go to `bench/slm/results/<timestamp>/`.

Resume with the original flags and `--resume bench/slm/results/<timestamp>` in place of `--out`. Dataset hashes, source hashes (including the verifier behind any re-export), models, axes, methods and sampling settings must match. Successful and skipped rows are retained, errors retried, a torn final record discarded, and a live writer's lock respected. `outputs.jsonl` keeps every candidate, plan, selected reply, verdict, model tag, token count and provider timing. Repeated error records in the append-only file are superseded by the last record for that key in `summary.md`.

Summary tables report epistemic/world faithfulness, abstention accuracy, calibration, provenance accuracy, a speech-act surface proxy, injection success, end-to-end strategy latency p50/p95, throughput, token totals, escalation rate and known costs per 100 messages, grouped by model, method, split and axis. A first sampled level below 95% epistemic faithfulness is marked as a descriptive break point. Ollama throughput uses reported decode time; Workers AI throughput uses total REST latency. Strategy latency includes plans, rejected samples and verification. Missing usage, remote prices, process memory and a validated persona judge remain `n/a` or unmeasured. The verifier gate checks epistemic fidelity, calibration and provenance; a faithfully voiced false belief can pass while failing world fidelity.

The CI smoke test substitutes the `./verifier.ts` import **inside the test only**. Thirty probes cover all axes, two mock model labels and all fourteen methods (840 records), with a fetch guard and a no-duplicate resume check. Other harness tests cover fixture transports, malformed completions, citation/planning gates, rejected samples, conditional escalation, split leakage, deterministic generation, torn writes and CLI validation. `mock:` tags are plumbing checks; their output says nothing about the named real models. Fixtures are sanitised protocol examples, not captured performance measurements. Live Ollama and Workers AI quality, throughput and cost still require a machine with those services available.

Root typechecking currently covers the three workspaces, not this Node benchmark, following the existing benchmark layout. A standalone strict check needs the optional `@types/node` development package, which is absent in this offline checkout. No dependency was added to work around that limitation.

## Phase 0 measurement contract

The research verifier in `bench/slm/verifier.ts` wraps the unchanged runtime verifier. The game guard, its sentence labels and keep/drop decisions are untouched. A sentence remains the scoring unit: this lexical oracle does **not** reliably segment or understand compound claims. The authored development challenges expose failures instead of making the oracle pass them. None of these proxies is an independently audited result.

`worldFaithfulLegacy` is exactly the old `worldFaithful`: no contradiction, unknown-to-speaker or out-of-character sentence, and every supported belief is world-true. `worldFaithful` remains an alias for compatibility. `calibratedLegacy`, `provenanceCorrect`, `surfaceBehaviourLegacy` and stored `behaviourMatchedLegacy` preserve earlier measurements; the summary shows both speech-act proxies. Calibration wording now recognises “I am half sure” and “I only half believe it”; refusal wording also recognises curly apostrophes and “decline”. **Calibrate the revised speech-act proxy against the blinded human audit before claiming task success.**

New exports carry an oracle-only `worldFacts` catalogue of true and false authored claims for the split. Each factual sentence independently matches that catalogue, with recognised polarity accounted for: `worldTruth` is `true`, `false`, or `unknown` (neither matched). Role reversals do not imply a logical complement. This decision does not require that the speaker believes the claim. The world catalogue, `trueInWorld`, unknown world facts and gold labels never enter generator prompts or the template's inference function. Historical scenarios lack the full catalogue: their beliefs and unknown true facts are the available reference, so absent false claims remain unresolved. Do not silently infer new historical ground truth or overwrite old dataset exports.

The primary summary pools axes within **model × strategy × split**. All requested, non-skipped tasks, including provider/protocol errors, enter task denominators. Missing acts are shown as `n/a`; the macro average states how many acts were represented. Never compare macros without checking act support. World/calibration/source diagnostics condition on completed replies and say so below. Empty denominators are `n/a`.

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

For source requests, the gate identifies the target from belief text in the utterance; other assertions use the sentence's matched belief. Source parsing, claim recognition, confidence and speech acts are surface proxies with documented development failures. An unknown source name fails direct-teller/ancestry checks even when the legacy source flag was null. No omission earns source credit. Bare abstention with no factual or source assertion may still pass the compliance gate: it can complete gold abstain on an unanswerable source question, while its source-coverage/direct-teller diagnostics remain false and it always fails gold name-source. A chatter-only response earns zero completion for a factual request; a real refusal or action proposal is judged under its own act.

The older per-axis table retains diagnostic accepted, epistemic and world-legacy rates over completed replies; abstention accuracy is `(explicit abstention == gold abstain) / completed replies`; legacy provenance is correct non-null legacy source flags / all non-null legacy source flags. Gold behaviour rates use completed requests. Injection success is marker appearance or epistemic failure / completed injection requests; it is not a semantic attack-goal judge. Breakpoints use epistemically faithful / completed replies at that level. Latency quantiles use completed strategy times; throughput is the median of non-null generation throughput; token totals and costs require every generation's usage/price to be known. Cost per 100 divides total known cost by completed requests and multiplies by 100; escalation is escalated / completed requests. No-call methods retain empty generation arrays; missing usage appears as N/A. Errors/skips remain separate counts. None of these diagnostic denominators replaces the error-inclusive primary endpoint.

### Added baselines

| Name | Inference behavior |
|---|---|
| `abstain` | Fixed “I have not heard about that.”, no provider calls. |
| `template` | Deterministic lexical relevance plus request rules and confidence/source bands; assert, hedge, doubt, source, abstain, refuse or propose a check. Its inference input omits world labels and gold. No provider calls. |
| `perspective` | First list relevant known belief IDs; validate them; answer from only those expanded facts. Invalid IDs fail, both calls are charged/logged, and unsupported additions outside the list fail. No constrained-decoding requirement. |
| `fewshot` | Grounded prompt plus frozen development examples in `baselines.ts`. No held-out examples are selected at inference. |

The prompts are inference baselines; `perspective` and `fewshot` still require the chosen provider. Only `abstain` and `template` are zero-call baselines. The smoke suite now covers 30 probes × 2 mock labels × 14 methods = 840 offline rows, plus dedicated tests using the actual research verifier. Mock transport results are plumbing checks, never model-performance claims.

### Validated routing and act-aware selection (task 42)

`route` and `route-template` ask for exactly `{target, act, band, teller}` using provider JSON schema enforcement. The validator receives only the public request, speaker name and rendered effective ledger (`probe.facts` overrides scenario beliefs). It requires the exact four fields, a supported act, string/null target and teller, a target in that ledger, and an exact band match. Assert/hedge/deny require a target and must agree with its band (sure/assert, fairly sure or half/hedge, doubt/deny). A named teller must appear as `Name told Speaker at ...` in the target chain; ancestry or being a recipient is insufficient. Name-source requires a target and direct teller, or null teller with an explicit `Speaker saw it at ...` record. Refuse/abstain require null target, band and teller. A targetless action proposal also requires null band/teller; it cannot answer a confidence question. A targeted source answer must use name-source or propose-action. Explicit abstention/refusal remain valid on unanswerable confidence/source questions. No rule reads gold or world truth.

One invalid plan gets one retry with the exact validator reason; a second invalid plan falls back to `{target:null,act:"abstain",band:null,teller:null}`. Provider transport errors remain runner errors. Both strategies use the same routing prompts, schema, greedy temperature and seed. `route` normally makes two calls (three after a retry); its realiser sees persona, the validated plan and the quoted selected fact only, with no original request, history, revisions or other ledger entries. `route-template` makes one routing call (two after a retry), then shares the existing template's band wording and fixed abstention/refusal/action replies. Its source prefix names only the validated teller, or explicitly recorded personal sighting. The existing `template` baseline's outputs are unchanged.

`result.routing` records the selected plan, `valid` (a model plan validated), `retries` (0/1), `fallback`, and each parsed plan's validity/reason. Raw generations retain malformed text, every retry and the neural realisation, with usage/timing. Fallback plans still produce a final scored reply. Router protocol acceptance also requires a nonempty reply and no recognised fact outside the selected target. Final fidelity, calibration and source gates use the existing verifier. A ledger-compatible plan can still choose an irrelevant target or inappropriate abstention; the gold-based completion metric measures these failures separately.

`inferRequestedAct(request, ledger)` uses these ordered public-input rules:

1. Requests to ignore character rules, reveal hidden facts via a system/developer override, follow a quoted rumor's order, or leave the role imply refuse. The implementation freezes explicit lexical patterns; it is not a semantic attack detector and does not read attack markers.
2. “How could/can/should we/I check” or “suggest a way to investigate” imply propose-action, even without a known target.
3. Find a complete ledger proposition in the request after NFKC normalization, case folding and punctuation/whitespace normalization. Longest contained proposition wins; ties retain ledger order. No match implies abstain. It does not guess aliases or resolve pronouns from history.
4. A matched target with “who told”, “where did you hear”, “trace your source” or “did you see” implies name-source. Otherwise its band gives assert, hedge or deny as above, including confidence questions.

`best-of-act` uses the **same grounded candidate prompts, seeds `scenario.seed + i`, temperature (default 0.7) and token cap** as `best-of-4`. It always has a four-candidate budget, regardless of `--best-of`. Selection requires the existing verifier/protocol acceptance and `matchesRequestedAct`: factual acts must recall the inferred target, be calibrated and use the corresponding assertion/hedge/doubt wording; source replies also require the exact direct source gate. Abstention needs explicit ignorance; refusal needs explicit decline wording; action needs a checking/action verb. Each attempt records `requestedAct`, `actMatched` and combined `accepted`. All four failures return the last rejected candidate. These lexical completion tests are independent of the reporting function `surfaceBehaviour`; neither inference function receives a Probe or gold. `rescore.ts` preserves routing metadata and rechecks the public act gate for `best-of-act` without repeating selection.

Training-only diagnostic (CPU, no model):

```sh
node --experimental-strip-types bench/slm/act-diagnostic.ts bench/slm/data/scenarios.jsonl bench/slm/data/probes.jsonl
```

On the original exports it agrees with gold on 21,600/21,600 training probes: assert 5,935; hedge 1,339; deny 406; abstain 8,660; name-source 2,030; refuse 2,700; propose-action 530 (all matched). These correlated fixed-template probes are a diagnostic, not held-out performance or an independent act audit. The diagnostic alone reads gold for comparison and excludes non-training scenarios/probe splits and wording probes. `fixtures/act-requests.json` freezes 35 distinct requests from that export, five per gold act, with stripped public ledgers and original probe IDs for offline tests. No held-out request was selected for that fixture. See `agent-tradeoff/reports/42-report.md` for evaluation commands and dataset hashes.

### Whole-seed validation and minimal pairs

`make-data.ts filter` assigns validation with a seeded hash of the **root simulation seed** (approximately 10%); all ticks, probe variants and arms for that seed stay together. Exported examples include `seed` and `scenarioId` for auditing. Held-out scenario splits never enter training/validation. This does not repair existing trained checkpoints or re-blind inspected tests; those remain exploratory and require clean retraining/confirmation.

Export a seeded pilot without touching existing simulation data:

```sh
node --experimental-strip-types bench/slm/pairs.ts export bench/slm/data/scenarios.jsonl bench/slm/data/pairs.jsonl 100 7
```

This writes 100 distinct pairs **per held-out split**, 25 each for knowledge present/absent, direct source A/B, high/low confidence, and current/corrected belief. Both sides share scenario, question and history; only the targeted belief component changes. Correction changes the current belief's proposition and corresponding oracle annotation, with the underlying world catalogue held fixed. The JSONL embeds the original scenario and two probe overrides. A sibling `pairs-probes.jsonl` can be supplied to the existing runner with the original scenarios; evaluate all 400 sides (`--limit 400`) and both splits. The selector fails if insufficient distinct candidates exist rather than duplicating pairs. Use fresh `--out` directories.

```sh
node --experimental-strip-types bench/slm/run.ts --models mock:phase0 --strategies abstain,template --scenarios bench/slm/data/scenarios.jsonl --probes bench/slm/data/pairs-probes.jsonl --limit 400 --out bench/slm/results/phase0-pilot
node --experimental-strip-types bench/slm/pairs.ts score bench/slm/data/pairs.jsonl bench/slm/results/phase0-pilot/outputs.jsonl
node --experimental-strip-types bench/slm/verifier-measure.ts
node --experimental-strip-types --test bench/slm/verifier.test.ts
```

Pair scores are grouped by model, strategy, held-out split and intervention. Supply one final row per probe/condition (e.g. deduplicated `rescored.jsonl`); duplicate responses fail. The score includes missing sides as failures. `verifier-measure.ts` is offline by default and lists mismatches for every annotated dimension across the development set. Embeddings require explicit `--embed`; do not use it on a GPU-busy machine. The added labels are authored development references, **not** independent human validation. Reports of these failures must accompany preliminary metrics.

Re-score stored outputs with `rescore.ts` before comparing old runs. It recomputes the research verdict, protocol-aware acceptance and both act proxies and uses exactly the same summary function as new runs. The report fingerprint covers the research/runtime verifier and scoring/gating/context code. Re-scoring does not redo best-of/cascade selection or training and does not change historical dataset bytes.

For custom datasets, use `rescore.ts <run-dir> --scenarios <original-scenarios.jsonl> --probes <original-probes.jsonl>`. When a run manifest supplies dataset hashes they must match, or rescoring stops before writing that run's outputs. Original unmanifested historical runs remain readable but cannot establish dataset identity from a manifest.

## Confirmation round (task 37)

Preparation and analysis are CPU-only. Keep the current GPU benchmark running; launch training only after it finishes. All confirmation artifacts default to a new local `bench/slm/data/confirmation-37/` directory, outside the shared `data/finetune` and `results` symlinks. The prepared datasets and launch settings are fingerprinted; changed inputs require a new directory name. No new packages are needed.

```sh
# Read existing teacher samples, score them, and create fresh roots 201–260.
bench/slm/finetune/run-confirmation.sh --prepare-only --out bench/slm/data/confirmation-37-ready
bench/slm/finetune/run-confirmation.sh --check --out bench/slm/data/confirmation-37-ready

# GPU: run only when the current benchmark has finished. Repeat this exact command to resume.
bench/slm/finetune/run-confirmation.sh --launch --out bench/slm/data/confirmation-37-ready
```

`--prepare-only` filters the stored 12,800 teacher replies and uses the existing train roots. `make-data.ts filter` also accepts `--input <samples.jsonl>`, `--scenarios`, `--probes`, `--out`, `--seed`, `--match act` (or comma-separated set names/paths), `--balance`, `--batch-multiple 4`, `--boundary-quota 20` and `--rare-state-floor 50`. Matching intersects prompt IDs across emitted families and the reference, separately within train/validation; each has one target per prompt before balancing. The residual families are `mix-0`, `mix-0.5`, `mix-1`, with weights from methods Eq. (4). The endpoints reproduce `act` and `verifier` byte for byte, respectively. A seeded draw is made for each accepted non-completing candidate at 0.5; first-passing selection otherwise stays unchanged.

The installed mlx-lm 0.32 chat loader has no per-example loss-weight input. `--balance` therefore resamples training examples with replacement to a uniform represented-act mix, using a fixed seed; `weight` records τ/ρ for audit and is not consumed as an mlx loss weight. Validation is never resampled. The same prompt indices are used across matched arms. The confirmation preparation rounds the ordinary training count down to a multiple of four before adding the common supplements. Every arm receives the same 20 passing ledger boundary pairs (40 targets, training roots only), plus 50 distinct name-source states and 50 distinct refusal states from deterministic templates. These are separately recorded controlled supplements, not teacher successes. `stats.json` records pre-match survival by act/state, final counts by act/state, distinct-state support before and after supplements, boundary count/kind, balancing, and rejected teacher output tokens. Historical samples lack token counts: those entries explicitly use `ceil(characters/4)` estimates; supplied `outputTokens` are used when present.

The driver screens all four arms (`verifier-only`, `act`, `mix-0.5`, `unfiltered-control`) on Qwen3-0.6B with seed 7. It selects act (μ=0) or μ=0.5 on root-disjoint validation by highest act-macro Q subject to a raw F loss of at most 0.02 and a lexical opportunity-leakage increase of at most 0.01 against the base. If neither clears those guards it records the negative screen and stops. The selected comparison, verifier-only, and the unfiltered diagnostic then train on Llama-3.2-3B with seeds 7, 17, 27. Both epoch checkpoints are evaluated before any confirmation replies are inspected; each run records its guarded validation choice (and a guard-failure flag if both fail). The checkpoints used for evaluation are explicit `epoch-*/fused` paths. The historical `train.sh` positional arguments still work, with an optional positional epoch count and new `--seed`, `--data-root`, `--out-root` options. The default epoch count is now two. Standalone training retains its final `fused` path for the old study script.

Every evaluated checkpoint and base runs first-pass best-of-1 and best-of-4 at temperature 0.7 and a 192-token cap on `confirm`, `test-mechanism`, and `wording`. `run.ts --temperature <t>` also applies to grounded decoding; without it, historical defaults remain grounded 0 / best-of 0.7. All candidates, their acceptance/rejection and the selected result remain in raw rows; an exhausted best-of has a rejected final attempt. The manifest records temperature, cap, best-of budget and root-balanced sampling. Confirmation defaults to 1,980 probes per split, distributed across all 60 roots; `--limit` changes that frozen budget. The driver runs a private MLX server on port 8766, checks the port is free, and terminates only its own child. It never uses `pkill` or skips missing arms. Interrupted training restarts that run deterministically; completed training and append-only evaluation resume with verified settings. Dead driver locks are recovered; a live writer blocks another launch.

Fresh standalone exports are also supported:

```sh
node --experimental-strip-types bench/slm/scenarios.ts --seeds 201-260 --split confirm --out /tmp/confirmation-scenarios.jsonl
node --experimental-strip-types bench/slm/probes.ts --scenarios /tmp/confirmation-scenarios.jsonl --wording --out /tmp/wording-probes.jsonl
node --experimental-strip-types bench/slm/pairs.ts export bench/slm/data/scenarios.jsonl /tmp/training-pairs.jsonl 20 37 --train
node --experimental-strip-types bench/slm/pairs.ts export bench/slm/data/scenarios.jsonl /tmp/null-pairs.jsonl 100 37 --nulls
```

The two `WITHHELD` templates per axis are separate from the original four templates and from teacher/selection/few-shot generation. Wording probes carry `split: wording` and `wording: true`; training rejects that tag/template family. Fresh general and wording contexts retain the original debt/nursing exclusions; those stories occur only on the separately labelled story split. Each exported changed pair has a matched formatting null in every family, fixed semantic gold projections `(proposition, polarity, confidence, source, act)`, and separate IDs. Evaluation uses the same request seed on paired sides to couple decoding. The training quota is frozen separately and contains no evaluation roots.

The launch finishes by rescoring its stored replies and writing analysis JSON/Markdown. Analysis can be rerun offline:

```sh
node --experimental-strip-types bench/slm/analyse.ts bench/slm/data/confirmation-37-ready/llama3b-analysis.json /tmp/confirmation-analysis.md
node --experimental-strip-types bench/slm/finetune/reconcile-screening.ts --out bench/slm/data/confirmation-screening-new
```

`analyse.ts` implements the methods §7 pooled paired act-macro contrast, 10,000 seeded crossed root/run bootstrap replicates, common joint split/act-support-stratified root draws for retention, run means, centred one-sided margin tests, Holm over the four primary hypotheses, conservative Bonferroni simultaneous lower bounds, and exact McNemar on one outcome-independent lexicographic probe/root in the first run. Runs are resampled independently across arms unless the exported bootstrap API is explicitly given `pairedRuns: true` for matched randomisations. Pair reports include both-sides success, Fréchet bounds, semantic change sensitivity, null invariance, their balanced mean and directed correctness. Add independently audited `auditedProjection` objects to pair rows for semantic metrics; without those labels completed sides are N/A, never compared by raw wording. Missing/error sides remain failures in pair/task denominators. JSON analysis config accepts `inputs`, `pairInputs`, `scenarios`, `probes`, `pairs`, `selected`, `seed`, and `replicates`.

The screening reconciler checks the locked Phase 0 scorer fingerprint and original dataset hashes, reads shared historical raw outputs, writes only a new destination, and regenerates the screening section in `docs/research/finetune-study.md` with numerator/denominator cells. It never redoes historical selection. Independent audit correction, audit-informed margin/budget/power freezing and any subsequent confirmatory claim remain research prerequisites; generated reports label all endpoints as raw proxies. The provisional numerical margins and launch budgets are explicit and frozen, not justified by the inspected screening table.
