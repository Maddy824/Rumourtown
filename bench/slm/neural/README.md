# Neural-track harness

Implements the tools in [the design](../../../docs/research/neural-track.md), sections 0–8. This package imports no checkpoint and makes no network requests at import time. Checkpoint stages require an explicit `--execute`. The grid command defaults to writing manifests only. No packages need to be installed.

Run from the repository root with `~/.venvs/rt-mlx/bin/python`. Commands below that include `--execute` are for the controller **after the reserved GPU is released**. They were not run during implementation. The test suite never loads weights or constructs a language model; its tiny MLX tests exercise affine residual blocks and attention modules on `mx.cpu` only.

## Model-free verification

```sh
~/.venvs/rt-mlx/bin/python -m pytest bench/slm/neural -q
# If pytest is absent (the current venv), use the standard library; do not install it:
~/.venvs/rt-mlx/bin/python -m unittest discover -s bench/slm/neural/tests -v
npm run bench:slm:smoke
npm run typecheck
npx tsc -p bench/slm/neural/tsconfig.json
```

The local TypeScript config checks the fixture and its imports; root workspace typechecking does not include `bench/`. `node-minimal.d.ts` describes the small Node surface they use, without adding `@types/node`. `fixture.ts` calls the unchanged `messagesFor` on ten distinct probe axes. Python compares every message byte to its stdout. An additional test uses only the cached Qwen tokenizer, covering 100 prompts spread across the export. Missing cached tokenizers are skipped without a download. MLX tests explicitly skip when its native runtime cannot initialize; record these skips and rerun them where MLX is available. FP32 synthetic fused/slow attention tolerance is absolute and relative `2e-5` for both prefill and cached decode.

## Step 0: lock and validate

1. Lock the Phase 0 scorer and exports. Create explicit root-disjoint `fit`, `selection`, and `confirmation` lists in `partitions.json`. Keep story and wording families reserved as specified by the formal methods. The legacy export has no genuine pair IDs: do not infer pairs from text or invent roots. Use the controller's paired export, retaining `pairId`, `rootSeed`, and `storyFamily`, when fitting steering directions. `analyze.lock_partitions` rejects overlapping or empty root partitions.
2. Point `NEURAL_MODEL` at a **local** checkpoint snapshot directory, containing config, tokenizer and weights. Export prompts; this command loads only tokenizer files:

```sh
~/.venvs/rt-mlx/bin/python -m bench.slm.neural.prompts \
  --tokenizer "$NEURAL_MODEL" --out bench/slm/neural/artifacts/export
```

The exporter accepts `--scenarios` and `--probes` for locked paired exports. It writes `prompts/prompts.jsonl` (messages, chat text, IDs, UTF-8 byte offsets, token offsets and named spans), `evaluator/sidecar.jsonl` (gold, effective-world-truth metadata, root, pair, story, wording and probe labels), and separate hash manifests. Policy input contains the `factsFor` overrides, fact cards without truth labels, and only `probe.distractors`, never `scenario.others`. Empty fact overrides stay empty. Qwen thinking is disabled. Offset tokenization is checked against the tokenizer's actual chat-template IDs with `return_dict=False`.

Byte ranges are half-open UTF-8 ranges in the complete templated text. Token lists include every overlapping token (including boundary-crossing tokens). `token_span` is their enclosing half-open range; `history` is a union of per-turn content ranges. The suffix starts after the final user content and includes its terminator and the assistant generation prefix. Content trimming is mapped to visible characters; other template content transformations fail closed. `generated_claim_spans` maps audited generated-claim byte ranges to original token positions and their predicting queries; noncanonical re-tokenization fails rather than changing IDs.

3. Once compute is available, run on 100 locked prompts for every base/adapter/architecture contrast:

```sh
~/.venvs/rt-mlx/bin/python -m bench.slm.neural.run validate \
  --model "$NEURAL_MODEL" --prompts bench/slm/neural/artifacts/export/prompts/prompts.jsonl \
  --out bench/slm/neural/artifacts/validation-base --execute
```

Use `--adapter <directory>` for historical MLX or explicit grid adapters. `validation.json` reports per-prompt no-op logits, full-prefill versus cached last-position logits, slow versus fused prefill/decode logits, greedy token agreement and prefill/decode throughput. `passed_100_prompt_gate` is false for smaller diagnostic samples. Default absolute checkpoint tolerance is `2e-5`; choose and freeze an appropriate precision-specific tolerance before inspection, record it with `--tolerance`, and investigate deviations. Do not use tolerance changes to hide different greedy replies. `frozen-weights.json` verifies equal in-memory parameter hashes before and after. Check spans against the rendered prompt manually, especially aliases, revisions, Unicode and repeated history text. Check adapter-versus-fused equivalence separately using the same validation export. Throughput estimates replace the planning ranges only after this gate passes.

Full nonrotating KV caches and full attention are supported. Sliding/rotating/quantized KV caches are rejected rather than misaligning absolute positions. Frozen base and adapter comparisons must share tokenizer, chat template, precision, cap and non-thinking settings.

## Step 1: states, probes, transfer, drift and bands

```sh
~/.venvs/rt-mlx/bin/python -m bench.slm.neural.run states \
  --model "$NEURAL_MODEL" --prompts bench/slm/neural/artifacts/export/prompts/prompts.jsonl \
  --out bench/slm/neural/artifacts/base --execute
~/.venvs/rt-mlx/bin/python -m bench.slm.neural.analyze \
  --states bench/slm/neural/artifacts/base/pooled \
  --sidecar bench/slm/neural/artifacts/export/evaluator/sidecar.jsonl \
  --partitions partitions.json --out bench/slm/neural/artifacts/probes
```

Repeat states for act and verifier adapters. `pooled/states.f16` is `[capacity, embeddings + L blocks + final norm, 3 positions, hidden width]`. `layout.json` labels dimensions; durable `index.jsonl` commits each memmap slot after flushing. Positions are last prompt token, mean final-utterance tokens and the position before the first generated claim token. `base-continuations/continuations.jsonl` caches greedy tokens with EOS and truncation. For claim pooling, pass `--claims claims.json` with `probeId -> {"tokens": [...], "first_claim_token": absolute_index}`. Without an audited claim position the third pool is missing (NaNs); it is never silently imputed. The run journal records missing-claim counts. A claimless or not-yet-aligned row must remain distinguishable in audit metadata; missing rate alone is not proof of a claimless reply.

`analyze` runs five outer/four inner root folds over `C={.001,.01,.1,1,10}`, fitting scalers only on each training fold. It writes source-scaled probe fits (`.npz`), root/fold/class manifests, AUROC/log loss, fixed-prediction root-bootstrap intervals, separately bootstrapped refit uncertainty on selection roots, structured root-label permutation nulls, emergence and sensitivity thresholds. Defaults are 10,000 root replicates, 20 structured null permutations and 100 refits; freeze larger null counts before confirmation. Missing classes are explicit and insufficient fitting support fails. Confidence probes exclude absent targets; faithfully held false beliefs remain known. `--label band|act` and `--position 1|2` select other probes/positions. Incomplete layers do not participate in emergence selection.

Structured nulls exchange whole root label vectors within identical ordered descendant layouts. Keep descendants aligned by public template/act/pair layout across roots. Nonexchangeable singleton structures are reported; a null with no exchangeable roots fails. It is not an independent row shuffle. Freeze emergence and `steer.candidate_layers` using development results only.

Add `--target-states <tuned/pooled>` for paired CKA (identical, row-permuted, sample-size and unbiased-HSIC controls), both frozen-scaler transfer directions on held-out outer roots, and the within-target refit ceiling. Fits never use confirmation roots. Explicit matched known/absent pairs on fitting roots produce mean and inverse-scale probe directions, oriented towards known, with unit vectors and projected SDs saved as `direction-block-<l>-{mean,probe}.npz`. Each checkpoint needs its own fit; base-to-tuned direction transfer is a separately labelled intervention.

For policy drift, use only the base continuation cache (the driver checks its checkpoint provenance and absence of an adapter):

```sh
~/.venvs/rt-mlx/bin/python -m bench.slm.neural.run drift \
  --model "$NEURAL_MODEL" --adapter "$NEURAL_ADAPTER" --base "$NEURAL_MODEL" \
  --continuations bench/slm/neural/artifacts/base/base-continuations/continuations.jsonl \
  --prompts bench/slm/neural/artifacts/export/prompts/prompts.jsonl \
  --out bench/slm/neural/artifacts/drift --execute
```

`outputs.jsonl` holds conditional KL, per-token KL and EOS/cap flags. `drift.conditional_kl` uses two full-vocabulary FP32 passes in vocabulary chunks; the driver teacher-forces identical base prefixes into both checkpoints. This is unsigned conditional divergence, not sequence KL. `drift_regression` supplies signed paired faithfulness associations on all rows with root intervals; `analysis.crossed_bootstrap` adds training-run resampling when runs are available.

For band geometry, run the `calibration` stage with `--alternatives alternatives.json`. The frozen tokenizer-specific file has `stem_tokens` and `groups` (or a `by_probe` map with those fields for each target-specific stem), mapping `assert`, `hedge`, `deny` to complete token-sequence alternatives. First-token sets must be disjoint. Shared prefixes within a group are evaluated once by the trie; cross-group prefix overlap fails. Output includes first-token and trie masses and uncovered probability. Join confidence-rule labels from the evaluator only after scoring; call `calibration.policy_ece` for ten fixed bins, Brier, bin counts and uncovered rows, and `geometry` for the assertion/hedge log ratio. Show absent claims separately. This diagnoses policy agreement, not truth calibration.

## Step 2: steering rescue and attention controls

```sh
~/.venvs/rt-mlx/bin/python -m bench.slm.neural.run steer \
  --model "$NEURAL_MODEL" --adapter "$NEURAL_ADAPTER" \
  --direction bench/slm/neural/artifacts/probes/direction-block-14-mean.npz --layer 14 --alpha -1 \
  --prompts bench/slm/neural/artifacts/export/prompts/prompts.jsonl \
  --out bench/slm/neural/artifacts/steer-l14-minus1 --execute
```

Each invocation uses fresh caches and injects once after the specified 1-based block at the last prompt position and every decode position. `--first-only` limits it to the first decision. `Injection(replacement=...)` provides matched-pair activation replacement. `random_directions` produces 20 seeded unit controls with the same projected-SD scale. Screen 256 development prompts over `steer.ALPHAS` and the frozen candidate layers, then freeze one layer/direction using `select_condition` with development faithfulness/leakage/error guards. Ties prefer smaller absolute alpha then shallower layers; no eligible point retains alpha zero. Run nine-alpha curves, rescue and controls on the untouched probes. Report all formal outcomes, errors, length and latency; audit fluency rather than treating token length as a fluency score.

The `attention` stage takes `--attention-options options.json`, e.g. `{"14":{"block_section":"distractors","decode_only":false}}`. Named spans resolve separately for each prompt; use `distractor:0` for a particular entry. Omit masking for attribution/no-op controls, set `decode_only:true` for transport sensitivity, or use `ablate_heads:[...]` to zero query-head outputs before the output projection. `swaps:[{"section":"distractor:0","tokens":[...]}]` requires exactly the original token count. Options are per 1-based layer and captured in the condition manifest. Use a new output directory per condition.

`--claims` can include `factual_token_positions` for online masses at queries `j-1`; positions must be audited for the actual condition/reply. `SpanMass` retains only reduced per-head/query masses, not attention tensors. `span_statistics` reports raw, per-token and log-ratio preferences, returning N/A for empty spans. `random_spans` generates twenty fixed-seed, equal-length controls from specified matched ranges excluding ledger, distractor and special tokens. Freeze the top 5% query-head list and random equal-count head controls on development, recording `query_head // (n_heads/n_kv_heads)` as the GQA map. `causal_statistic` computes `S_L`, and can also compute `S_Q`/`S_U`, on the same error-inclusive opportunity set. Bootstrap all conditions together by root. Attention preference alone is descriptive; a leaked-content swap result is needed for a copying claim.

Steer and attention stages write harness-compatible `outputs.jsonl`. The initial verdict is deliberately fail-closed and marked `needsRescore`; **never analyze it**. Re-score only after the Phase 0 scorer is locked:

```sh
node --experimental-strip-types bench/slm/rescore.ts bench/slm/neural/artifacts/steer-l14-minus1
```

Use `rescored.jsonl`, and the formal/audited outcome export, for analysis. Gold is joined only after generation, never passed to `greedy`, injection, masks or calibration. Empty replies are protocol-invalid. Generation errors stay as rows with a fixed local reason. Keep skipped IDs fixed across conditions before execution.

## Step 3: grid and repeats

```sh
zsh bench/slm/finetune/train-grid.sh --config "$NEURAL_MODEL/config.json" \
  --data bench/slm/data/finetune/act/train.jsonl --out bench/slm/neural/artifacts/grid
# Later, same arguments plus --model "$NEURAL_MODEL" --execute actually train.
```

The 22 manifests enumerate every trainable tensor and its shape/count, block indices, rank, scale, PEFT alpha, dropout, input-embedding freeze, data hash and fixed updates. Counts are asserted against section 3 before loading weights, and actual unquantized linear dimensions and exact trainable names are asserted again before optimizer creation. Bottom/top halves use explicit paths, never `num_layers`. A changed Qwen config is refused. Norm-only includes block RMSNorm, Qwen q/k RMSNorm and final RMSNorm (65,536 scales). Output-only attaches an untied low-rank logits delta while the shared base embedding remains frozen on the input path.

Every cell uses file-order batches of four (last partial batch retained), two complete epochs, Adam at `1e-4`, scale 20, dropout .05, seed 7 and masked prompt loss. `train.jsonl` records loss, update norm, elapsed time, batch row IDs and peak memory each update. Explicit adapters and completion hashes are written on success; use `grid.load_grid_adapter` for all grid controls. A completed matching cell is skipped. Interrupted training is refused and requires a fresh run directory; inference/state journals are resumable, optimizer training is not silently restarted. Norm/output controls use the custom loader rather than the stock MLX LoRA loader.

After development selection, pass the two exact cell names through `--cells` and `--seed 17`, then `--seed 29`, in separate grid directories. The repeat command requires exactly two cells. Do not call the one-seed grid confirmatory. Evaluate the unchanged frozen base on the same IDs as the zero-update comparator.

`analysis.grid_associations(counts, outcomes, base, roots, acts=...)` recomputes act-macro erosion and both Spearman and tau-b under one shared root resample. `paired_contrasts` accepts prespecified row-level paired contrasts and margins, recomputes fixed act means, and applies Holm within the supplied family. Supply seed strata when needed to preserve act support. Never form Q from products of aggregate F and U. Each leakage or over-abstention denominator must use its fixed opportunity set.

## Steps 4–5: mapped curves and replication

`analysis.monotone_mapping` fits a development-only monotone alpha(mu) by least squared per-prompt propensity error on the steering grid, considering both orientations. Freeze its returned indices. `mapped_equivalence` compares aligned confirmation arrays `[row, alpha/mu, outcome]`, using a simultaneous bootstrap sup-norm band over all mu/outcomes with provisional ±.02 margins. For outcomes with different denominators, use `mapped_rate_equivalence` with a `reducer(sampled_data, original_row_indices)` that recomputes each fixed denominator and act mean from the sampled rows. `crossed_bootstrap` resamples run blocks and one common root sample across arms, supporting paired or independent run randomizations. At least three training seeds are needed for training-effect claims.

Repeat selected checks on the existing 1B/3B checkpoints, preserve untouched roots/stories and reconcile the two-person blinded audit before any confirmatory statement. The harness does not create new splits, audit labels, train new checkpoints or choose research margins on its own.

All inference/state journals lock checkpoint, adapter, tokenizer, config, data and source hashes, reject incompatible resumes, repair torn final JSONL writes and prevent duplicate keys. State memmaps flush before index commits. Journals are single-writer; run conditions sequentially. Generated artifacts belong under ignored `artifacts/`, outside the historical results tree.
