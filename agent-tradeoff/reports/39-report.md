# 39: Neural harness implementation

Implemented on `build/village`. No language model was loaded or run, no model weights were read, no training or inference was started, and no dependencies were added. Nothing was staged, committed, pushed or deployed. Existing tracked files, simulation code, `apps/`, historical results and existing `bench/slm/*.ts` were left unchanged. Generated build-info files were preserved.

## What was built

| Requirement | Implementation and evidence |
|---|---|
| Prompt parity and spans | `prompts.py` mirrors effective-ledger overrides and grounded `messagesFor`, strips oracle-only truth from cards, uses the actual tokenizer/chat suffix, and emits UTF-8 and overlapping-token spans for all requested parts. `fixture.ts` calls unchanged `messagesFor` on ten different axes; all ten message sets match byte for byte. An additional tokenizer-only test renders 100 probes across the saved export. Generated-claim byte maps expose absolute token and predicting-query positions, rejecting noncanonical re-tokenization. Evaluator metadata and labels are separate. |
| Pooled states and provenance | `states.py` instruments embeddings, every completed block and final norm at all three specified pools. FP16 memmaps have named layouts, durable duplicate-free indices, per-slot checksums, explicit missing positions and hash-locked resumes. `common.py` records checkpoint, adapter, tokenizer, model config, data, harness/scorer/design sources and installed MLX source hashes/version. |
| Probes and comparison | NumPy L2 logistic GD, binary/OVR classes, fit-only scaling, nested 5×4 root folds and the five-C grid; root bootstrap, structured whole-root permutation nulls, simultaneous emergence rule and sensitivity, CKA controls including unbiased HSIC, held-out frozen-scaler transfer with AUROC/log loss, separately reported refit uncertainty. `analyze.py` locks root partitions and persists fits/manifests/directions. Synthetic separability, transfer, CKA and emergence tests pass. |
| Steering | Matched-pair mean and inverse-scale probe directions, orientation, unit norm and projected SD; all nine alphas, candidate layers and guarded development selection; post-block last-prompt/decode injection, first-decision-only, activation replacement, matched-scale random controls, fresh caches, zero-logit equivalence function and compatible output rows. The tiny two-block MLX residual test is implemented but skipped here because MLX cannot initialize. |
| Attention | Slow Qwen3/Llama paths reproduce head projections, Qwen q/k RMSNorm, model RoPE and GQA. Implements masks for prefill/decode, per-prompt named spans, equal-token content swaps, output ablation before projection, online masses at j−1, descriptive normalized statistics, twenty seeded random-span controls and S_L. Fused-prefill/cached-decode/readout parity and masking tests are implemented but skipped here because MLX cannot initialize. |
| Drift and calibration | Durable greedy continuation caches preserve EOS/truncation; identical teacher-forced base prefixes and chunked full-vocabulary FP32 conditional KL; signed drift regression with root intervals; disjoint first-token masses, shared-prefix trie unions, uncovered mass, ten-bin policy ECE/Brier and target-specific frozen stems. Known-value synthetic tests pass. |
| Grid | New `finetune/train-grid.sh` delegates to `grid.py`, with a manifest-only default and explicit `--execute`. All 22 manifests match the saved Qwen3-0.6B config and section 3 counts, including q-width, bottom/top paths, all RMSNorm scales, and untied output deltas with frozen input embeddings. Actual tensor names/shapes are checked again before optimizer creation. Fixed file order, batch four, two epochs, Adam 1e-4, scale 20 and dropout .05; loss/update norms/timing/memory logs, explicit adapter loading, completion checksums and two-cell seed-17/29 repeat support. |
| Analysis | Shared-root Spearman/tau-b associations, fixed act-macro paired contrasts and Holm, crossed root/run resampling, monotone development alpha(mu) fitting and simultaneous mapped confirmation equivalence. Formal indicator reducer uses row-level Q=FU and error-inclusive opportunity denominators, returning numerators/denominators. Synthetic known-answer tests pass. |
| Run guide and step 0 | `README.md` gives commands in design section 7 order, artifact layouts, controller validation checklist, adapter loading, rescore requirements, audit joins, precision/cap controls, inference resume behavior and study boundaries. `run.py` refuses to load anything without `--execute`. |

## Verification

- Python environment has no pytest. Used the task-authorized standard-library fallback: `~/.venvs/rt-mlx/bin/python -m unittest discover -s bench/slm/neural/tests -v`: **33 tests, 30 passed, 3 skipped**, with no model. The skipped tests are the synthetic MLX two-block intervention and two attention tests. Importing the installed native MLX runtime raises `[metal::load_device] No Metal device available` inside this sandbox, before `mx.cpu` can be selected. Tests select CPU before importing mlx-lm when native MLX is available; no GPU fallback or installation was attempted.
- `npm run bench:slm:smoke`: **36 passed**, seven files.
- `npm run typecheck`: **passed**, all root workspaces.
- `npx tsc -p bench/slm/neural/tsconfig.json`: **passed**. The root config excludes bench files, so the fixture also has this explicit strict check. Local bounded Node declarations avoid adding `@types/node`.
- Python compilation and `zsh -n bench/slm/finetune/train-grid.sh`: **passed**.
- Manifest-only run against the saved real Qwen config and current act training JSONL: **22 cells written**, no MLX import or model load. It records 360 fixed updates for the current 719-example act set. Dry-run output is only in `/tmp/rumortown-neural-39-grid-dry-run`, outside the repository.
- `npm run build`: **passed**. Existing Vite native-config and chunk-size warnings remain.
- `node .github/workflows/check-bundle.mjs`: **passed**, 357,340 gzipped bytes against 400,000.
- Default `npm test`: **1,025 passed, 3 timing failures**, 78 files completed. The two 1.5-second simulation regression checks took about 3.27 and 2.66 seconds, and the third-person talk sweep exceeded five seconds. No behavior assertion failed.
- Full serial rerun, `npm test -- --maxWorkers=1 --fileParallelism=false`: **1,027 passed, 1 timeout**. All three previously failing checks passed. The existing 20-seed replay sweep took about 182.9 seconds against its explicit 180-second timeout; it passed in the default run. There was no fully green root test invocation in this session. No thresholds or application files were changed. Rerun root checks with idle compute before committing/pushing.

## Step 0 after compute is released

The full commands and interpretation checks are in `bench/slm/neural/README.md`. In particular:

1. Lock Phase 0 exports/scorer, root-disjoint fitting/selection/confirmation partitions, story/wording holdouts, true matched-pair IDs and audit metadata. Legacy exports have no genuine pair IDs; directions are not guessed from superficially similar prompts.
2. Run the tokenizer-only `python -m bench.slm.neural.prompts --tokenizer <local snapshot> --out <new artifacts directory>` export. Inspect prompt bytes, all named byte/token spans, suffix, empty ledgers, aliases, revisions, Unicode and repeated history. Gold/truth remain in `evaluator/sidecar.jsonl`.
3. Run `python -m bench.slm.neural.run validate --model <local snapshot> --prompts <export>/prompts/prompts.jsonl --out <validation directory> --execute` on 100 prompts for each architecture/adapter contrast, only after the controller frees the GPU. Freeze a precision-appropriate tolerance before inspection. This checks no-op logits, ordinary/instrumented equivalence, cached versus full-prefix logits, slow/fused prefill and decode logits, greedy agreement and measured throughput; verify before/after parameter hashes.
4. Run the skipped CPU synthetic MLX tests in an environment where native MLX initializes. Validate fusion separately against adapter loading. No checkpoint-dependent validation, fusion, throughput measurement or training has been claimed here.
5. Use fresh per-condition output directories. Re-score generated harness rows with the locked scorer before analyzing them; initial verdicts fail closed. Claim positions must come from an audit of the actual condition/reply. Missing claim alignment is separate from an explicitly audited claimless reply.

## Rulings and follow-up work

- The supplied no-model instruction takes precedence over the general CONTINUE command that would launch another coding model for review. Performed a read-only self-review against all nine build requirements instead; no second agent/model was launched. Fixed tuple/list resume comparison, missing/corrupt memmap detection, generated-token query alignment, held-out transfer, tokenizer return-dictionary differences, generation EOS text stripping, completion checksums, and error-inclusive endpoint denominators.
- The Python venv already contains Transformers as an mlx-lm dependency; only its local tokenizer API is used by model-free export/tests. Nothing was installed. The Qwen test config is a copy of cached snapshot `42096995f6402fde107068cf530136fe64b604f8` for `mlx-community/Qwen3-0.6B-bf16`, read as JSON only.
- Inference/state journals are single-writer and resumable. Interrupted optimizer training deliberately refuses a silent restart and needs a fresh grid run directory. This avoids calling a new optimizer state a continuation of the same run; full optimizer/RNG checkpoint resume remains an optional follow-up.
- Current checkpoint drivers use deterministic greedy decoding and full, nonrotating KV caches. Coupled stochastic sampling, quantized/rotating cache support and automated fluency auditing are follow-up sensitivities, not prerequisites for this greedy harness. Unsupported cache types fail instead of silently changing positional interpretation.
- Actual MLX runtime behavior, tensor-manifest assertions against loaded checkpoints, checkpoint precision-specific tolerances, throughput and GPU memory remain controller step-0 checks. The synthetic tests are present; the sandbox prevented running three of them. No neural results or study claims are produced.
- Formal data locking, development selection, training runs, held-out evaluation, two-person audit, frozen margins and the fresh idle-machine root check remain required before research claims or a push.

## Files to commit

Stage these explicit new paths only, preserving other work and generated build-info files:

```text
bench/slm/finetune/train-grid.sh
bench/slm/neural/.gitignore
bench/slm/neural/README.md
bench/slm/neural/__init__.py
bench/slm/neural/common.py
bench/slm/neural/prompts.py
bench/slm/neural/states.py
bench/slm/neural/probes.py
bench/slm/neural/steer.py
bench/slm/neural/attention.py
bench/slm/neural/drift.py
bench/slm/neural/calibration.py
bench/slm/neural/grid.py
bench/slm/neural/run.py
bench/slm/neural/analyze.py
bench/slm/neural/analysis/__init__.py
bench/slm/neural/analysis/metrics.py
bench/slm/neural/fixture.ts
bench/slm/neural/node-minimal.d.ts
bench/slm/neural/tsconfig.json
bench/slm/neural/tests/__init__.py
bench/slm/neural/tests/test_harness.py
bench/slm/neural/tests/fixtures/qwen3-0.6b-config.json
agent-tradeoff/reports/39-report.md
```

Plain commit message: `39: add neural research harness and grid manifests`

STATUS: DONE

Tests: Python 30 passed/3 MLX skips; SLM smoke 36 passed; root and fixture types, build and bundle passed; full root runs had existing timing failures (1,025/1,028 parallel, 1,027/1,028 serial).
