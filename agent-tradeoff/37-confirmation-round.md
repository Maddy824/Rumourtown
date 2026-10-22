# 37: Build the confirmation round of the SLM study

Read `agent-tradeoff/CONTINUE.md` section 3 first; every rule binds. Then read `docs/research/methods-formal.md` (the merged methods: this task implements sections 4, 5, 7, 8 and 9), `agent-tradeoff/reports/33-report.md` (Phase 0, now merged), `bench/slm/README.md`, `bench/slm/{run,strategies,rescore,pairs,baselines}.ts`, `bench/slm/finetune/{make-data.ts,train.sh,run-study.sh}`, and `docs/research/finetune-study.md` (screening results and their caveats).

## Goal

Everything the confirmation run needs, so that one script can execute it on the GPU unattended. No model is run in this task except mock providers in tests.

## Build

1. **Residual mixture data** in `make-data.ts filter`: a fourth set family `mix-<mu>` for $\mu \in \{0, 0.5, 1\}$ implementing $w_\mu = R[A + \mu(1 - A)]$ from methods section 5, where $R$ is the Phase 0 acceptance (protocol, faithfulness, calibration and source gates) and $A$ the substantive act completion. $\mu = 0$ must reproduce the `act` set and $\mu = 1$ the `verifier` set exactly; a test proves both. Sampling of the residual at $\mu = 0.5$ is seeded and reproducible.
2. **Act balancing and matched arms.** A `--balance` option that reweights by $\tau(a)/\rho(a)$ as in section 5, emitting per-example weights that `train.sh` passes to mlx-lm (or, if mlx-lm cannot take weights, by seeded resampling to the target act mix, documented as such). A `--match <set>` option that restricts any set to the common-prompt subset of another and truncates to equal counts, so arms can be count- and prompt-matched. Report survival by act and state, retained counts and rejected teacher tokens in `stats.json`.
3. **Boundary pairs quota.** From the Phase 0 `pairs.ts` training-split generator, a frozen quota of ledger-grounded boundary pairs (a warranted answer against the same query after removal, correction or loss of permission) added to every arm at equal count, with the count recorded.
4. **Same-temperature selection control** in `run.ts` and `strategies.ts`: `--temperature <t>` applied to `grounded` as well as `best-of`, and `--best-of 1` accepted, so best-of-1 and best-of-4 are drawn from the same base; record every candidate, rejection and exhaustion (already stored) plus the temperature in the manifest.
5. **Null interventions** in `pairs.ts`: for each family, a matched null pair that changes something irrelevant (an unrelated belief, distractor order, formatting or wording that preserves warranted speech) so invariance can be measured (section 8). Export the semantic projection fields the sensitivity measure needs (target proposition and polarity, confidence, source, act) alongside each side.
6. **Fresh confirmation data.** Extend `scenarios.ts` to accept a seed range (for example `--seeds 201-260`) and a split label `confirm`, with the same held-out story exclusions, so confirmation roots are disjoint from every seed used so far. Add a withheld-wording split: hold out two probe templates per axis from training data generation and tag their probes `wording`.
7. **Training protocol** in `train.sh` and a new `bench/slm/finetune/run-confirmation.sh`: two epochs, root-seed validation, validation-selected checkpoint, three training seeds per arm (`--seed`), arms = {verifier-only, act, mix-0.5, unfiltered-control}, students = {Qwen3-0.6B screen with one seed first, then Llama-3.2-3B with three seeds for the selected comparison}; evaluation through the mlx provider on the `confirm`, `test-mechanism` and `wording` splits with best-of-1 and best-of-4 at the same temperature; then `rescore.ts`. The script must be resumable and must stop, not guess, if any arm's data is missing.
8. **Analysis** in `bench/slm/analyse.ts`: the paired macro estimator, the crossed root/run cluster bootstrap (10,000 replicates, seeded), the one-sided bootstrap margin tests with Holm over the four elementary hypotheses of the two primary contrasts, the McNemar diagnostic on one probe per root, pair success with its bounds, change sensitivity and invariance, and the retention contrasts; Markdown output with every denominator. Unit tests with synthetic rows where the correct answer is known (for example, a constructed dataset with a planted 0.08 effect and a known cluster structure).
9. **Reconcile the screening rows:** a script that re-scores `bench/slm/results/finetune/eval/*` under the locked Phase 0 scorer and regenerates the screening table in `docs/research/finetune-study.md` from raw rows, so the prose and the table cannot disagree again.

## Rules

- No new dependencies. No simulation changes; the replay pin must not change. Do not edit `apps/`. Keep every existing CLI flag working; the smoke test must still pass.
- Every metric or estimator you implement cites the equation number in `docs/research/methods-formal.md` in a comment.
- Run `npm run bench:slm:smoke`, root typecheck and the verifier dev test. Timing failures under GPU load are expected; re-run a failing file alone before reporting it.
- You cannot commit. Write `agent-tradeoff/reports/37-report.md`: what changed, how to launch the confirmation run, files to commit and a plain commit message without assistant attribution.

End with `STATUS: DONE` or `STATUS: BLOCKED` and a one-line test summary.
