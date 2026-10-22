# 37: Confirmation round handoff

Implemented in `/Users/maddy/B2B/rumortown-phase0`, on `research/phase0`. No commits, staging, pushes, deployment, language-model loads, inference, or GPU training runs. The main checkout and its running benchmark were not modified. Shared teacher/results symlinks were read only. No dependency, simulation, replay pin, or `apps/` source changes.

## What changed

1. `make-data.ts filter` emits `unfiltered`, `verifier`, `act`, `mix-0`, `mix-0.5`, and `mix-1`. Eq. (4) uses seeded per-candidate residual sampling. Both endpoints are byte-identical to their corresponding original arms in training and validation, including when matched, balanced and supplemented. Native sample IDs determine stable candidate order.
2. Added separate sample/input/output/context paths, root-preserving common-prompt/count matching, uniform-act seeded resampling, batch multiples, per-example importance-weight metadata, and survival/retention/token/state-support statistics. The installed mlx-lm loader cannot apply sample loss weights; resampling is the documented fallback, not an ignored weighted objective. Validation is never resampled.
3. Every confirmation arm gets the identical frozen quota of 20 training-root ledger boundary pairs (40 targets), selected only when both deterministic targets pass the Phase 0 gate and act proxy. Added separately recorded equal supplements with 50 distinct name-source states and 50 distinct refusal states per arm. These do not relabel teacher outputs. No validation or confirmation root enters these supplements.
4. `run.ts`/`strategies.ts` support best-of-1 and an explicit shared temperature, token cap, root metadata and root-balanced probe budgets. Grounded, best-of-1 and the first best-of-4 candidate have the same prompt, temperature, request seed and cap. Historical omitted-temperature defaults remain unchanged. Manifests record the settings; raw attempts retain candidates, rejected gates and exhaustion.
5. Pair generation now supports training and fresh confirmation splits, matched formatting nulls for every intervention family, and gold semantic projection sidecars containing proposition, polarity, confidence, source and act. Original held-out pair commands still work. Pair analyses require the conjunction of successes and retain missing/error sides in denominators.
6. Scenario generation accepts `--seeds 201-260 --split confirm --out ...`, retaining held-out story exclusions. Two new withheld templates per axis are excluded from teacher/export/selection/few-shot pools. Their probes carry `wording` tags and an evaluation split override. Training explicitly rejects those tags/template families.
7. Added a resumable CPU preparation/check and explicit GPU launch driver, `run-confirmation.sh`. It screens four Qwen3-0.6B arms at seed 7, selects act or μ=0.5 on validation, then trains the selected comparison, verifier-only and the unfiltered diagnostic on Llama-3.2-3B with seeds 7/17/27. All runs use two epochs. Exact epoch snapshots are fused, evaluated and selected by validation macro-Q with fidelity/leakage guards before any confirmation outputs are read. Evaluation uses the MLX provider with best-of-1 and best-of-4 at temperature 0.7 on fresh seeds, withheld stories and withheld wording, plus changed/null pairs, then rescoring and analysis. Missing data, changed frozen settings, a live lock, or an occupied private server port stop the run. The driver manages only its own server child; it never calls `pkill`. Interrupted training restarts that run deterministically; complete runs and append-only evaluation resume.
8. Added `analyse.ts`: pooled paired act-macro contrasts; 10,000 seeded crossed root/run cluster bootstrap replicates; shared root samples across conditions and transfer splits, stratified on joint split/act support; centred one-sided margin tests; Holm over exactly four primary hypotheses; conservative simultaneous lower bounds; one fixed probe/root McNemar diagnostic; pair conjunction, marginal counts and Fréchet bounds; change sensitivity, invariance, balanced mean and directed correctness; retention contrasts. Markdown includes per-act/task/root/run and pair denominators, run estimates, acceptance, errors and an explicitly labelled lexical opportunity-leakage proxy. Synthetic tests establish a planted 0.08 effect, root/run coupling, known exact tails, Holm, retention and semantic pair outcomes.
9. Added a locked Phase 0 screening reconciler. It validates original dataset hashes and scorer fingerprint, reads historical raw rows, writes only a newly named destination, and regenerates the screening section from raw counts. Removed inconsistent numerical interpretations from that generated section. Historical decoding, checkpoint selection and training leakage remain labelled exploratory.

## Prepared data and launch

The final prepared, integrity-checked dataset is **`bench/slm/data/confirmation-37-ready/`**. The earlier local `confirmation-37/` directory is an intermediate preparation from development; use the ready path below. Generated directories are ignored and are not commit candidates.

- Read 1,600 prompts / 12,800 stored teacher samples: 7,942 accepted samples, 3,970 accepted on-act samples.
- Every family: 792 training examples / 97 validation examples. All four confirmation arms have identical prompt multisets/counts after resampling and supplements. Counts are divisible by batch size four, so training uses 198 updates/epoch, 396 updates/run.
- Quota: 20 boundary pairs / arm, plus 50 source and 50 refusal support states / arm. `arms/stats.json` includes the boundary kinds and final distinct-state support.
- Fresh roots: 201–260, disjoint from the original roots 1–200. Validation remains a root-hash subset of original training roots. General and wording contexts exclude both withheld story families.
- Prepared dataset hashes are frozen in `prepared.json`; source/input hashes in `preparation.json`. The launch freezes its own source, sampling, budget, guard and seed settings.

The prepared data is ready now. **Only after the existing GPU benchmark finishes**, launch (and resume) with:

```sh
bench/slm/finetune/run-confirmation.sh --launch --out bench/slm/data/confirmation-37-ready
```

CPU-only readiness check:

```sh
bench/slm/finetune/run-confirmation.sh --check --out bench/slm/data/confirmation-37-ready
```

To rebuild from the same stored teacher samples, choose a new output directory and run `--prepare-only`; then launch with that same `--out`. Default evaluation budget is 1,980 probes per split across all 60 roots; `--limit` is frozen at launch. The private MLX port is 8766. The Python executable defaults to `~/.venvs/rt-mlx/bin/python`, overrideable with `RT_MLX_PYTHON`.

Results, raw/rescored outputs, epoch selections and analysis configs live under the chosen local output directory. A negative 0.6B validation screen is recorded and stops progression, preserving the negative finding. Checkpoint selections that fail development guards are explicitly flagged; no success claim is inferred from them.

## Screening reconciliation

Executed CPU-only against the shared historical `results/finetune/eval/*` inputs. New outputs are in `bench/slm/data/confirmation-screening-37/`, including raw counts and original dataset/scorer fingerprints. No historical result file was rewritten.

The locked scorer fingerprint is `9a57ceaa563cb5bfc3c79288b34442aab6fdacf48290e884ac5f491bd671f708`.

The regenerated table has 11 model/strategy rows, each split cell carrying counts. For example, historical Llama-3.2-3B grounded Q is 77/220 on seeds and 57/220 on stories; best-of-4 Q is 61/220 and 59/220. Historical Qwen act Q is 140/220 and 72/220. These are raw Phase 0 acceptance-plus-act endpoints, not the earlier “Both” proxy. Historical grounded temperature 0 versus best-of temperature 0.7 remains a confound.

Regenerate without inference, choosing another new destination:

```sh
node --experimental-strip-types bench/slm/finetune/reconcile-screening.ts --out bench/slm/data/confirmation-screening-next
```

## Verification and review

- Final `npm run bench:slm:smoke`: **67/67**, nine files, passed. Includes mock-only unattended driver ordering, all selected training seeds, both evaluation budgets, resume without retraining, missing/changed-data refusal, planted-effect inference, endpoint equality and semantic pairs.
- `npm run typecheck`: passed all root workspaces.
- Native verifier development test: **26/26**, passed.
- `npm run build`: passed; existing Vite config/chunk-size advisories remain.
- Bundle gate: **353,366 gzip bytes / 400,000**, passed.
- Root serial tests: **1,010/1,011**; one replay test exceeded its existing 180-second timeout (234.15 seconds). Reran the entire failing file alone: **12/13**, with the same case exceeding that timeout (202.97 seconds). This timing failure remains under the concurrent GPU benchmark. No assertion, timeout or replay pin was changed.
- Final CPU preparation and `--check` passed; all four endpoint comparisons (train/valid at μ=0 and μ=1) match byte for byte. Scorer lock unchanged. Shell syntax, Python compilation and `git diff --check` passed.
- Reviewed all nine task requirements, dataset isolation, public prompt/gold separation, replay/app diff boundaries, crossed resampling, retention coupling, missing-side handling and write destinations. No separate language model or delegated review was launched, following the explicit no-model instruction.
- Vite initially tried to create caches through the root dependency symlink into the main checkout and was denied. Temporarily replaced only the worktree's root/app dependency symlinks with local directories of read-only package links and local cache directories to run the exact required commands. Restored the original symlinks after verification. No package installation or other-checkout cache write occurred.

## Rulings and remaining research steps

- The explicit worktree/`research/phase0` instruction overrides the general `build/village` rule. Nothing was committed.
- Methods numbers Eqs. (1)–(5), but leaves the §7–9 estimator/test/pair/retention expressions unnumbered. Comments cite Eq. (4) and Eqs. (2)–(3) where applicable and identify the exact unnumbered section expression elsewhere rather than inventing equation numbers.
- Simultaneous bounds use conservative Bonferroni inversion, explicitly labelled; the four margin decisions use the specified Holm step-down procedure. Training-run bootstrap sampling is independent across arms by default; the estimator API supports paired runs only with explicitly matched labels/randomisations.
- Gold projection fields are exported; actual semantic projections must be independently audited (`auditedProjection` on pair rows). Completed unaudited pairs produce N/A sensitivity/invariance, not a raw-string surrogate. Missing/error sides still fail. The lexical opportunity-leakage measure is labelled as a proxy.
- Historical teacher rows do not contain token counts. Rejected-token accounting uses supplied `outputTokens` when available; otherwise it explicitly reports character/4 estimates. Exact historical generation-token accounting cannot be recovered from decoded text alone.
- Common deterministic boundary/rare-act supplements are separately controlled additions, identical across arms. Final act proportions include those supplements; they are not misreported as the original uniform resampling target.
- Actual GPU training, fusing, server generation and real model quality were deliberately not exercised. Python interface behavior was checked against the installed mlx-lm source; the orchestration was tested with mocks.
- Independent two-person audit, endpoint correction, development-justified margins/leakage budgets, power/design simulation and any confirmatory claim remain outstanding research prerequisites. Defaults are explicit provisional operating settings; reports do not claim audited confirmation or general mechanism transfer from two held-out story families.

## Files to commit

Stage explicit paths after review. Do not stage dependency directories, shared symlinks, generated data/results, build outputs or build-info files.

```text
bench/slm/.gitignore
bench/slm/README.md
bench/slm/analyse.ts
bench/slm/confirmation.harness.test.ts
bench/slm/finetune/check-data.py
bench/slm/finetune/confirmation.ts
bench/slm/finetune/make-data.ts
bench/slm/finetune/phase0-scorer-lock.json
bench/slm/finetune/reconcile-screening.ts
bench/slm/finetune/run-confirmation.sh
bench/slm/finetune/train-selected.py
bench/slm/finetune/train.sh
bench/slm/pairs.ts
bench/slm/probes.ts
bench/slm/run.ts
bench/slm/scenarios.ts
bench/slm/strategies.ts
bench/slm/types.ts
docs/research/finetune-study.md
agent-tradeoff/reports/37-report.md
```

The supplied `docs/research/methods-formal.md` and `agent-tradeoff/37-confirmation-round.md` remain untracked owner-provided inputs; include them explicitly if they belong in this commit. Existing unrelated work was preserved.

Plain commit message: `37: add the SLM confirmation round`

Required human attribution when committing: `Madhav Sunil <94164709+Maddy824@users.noreply.github.com>`.

STATUS: DONE
Tests: smoke 67/67, verifier 26/26, typecheck/build/bundle and CPU preparation passed; root 1,010/1,011 and isolated replay 12/13, same existing timing timeout.
