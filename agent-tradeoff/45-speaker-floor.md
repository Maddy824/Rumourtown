# 45: Prepare the speaker-floor experiment, for an unattended GPU run

Read `agent-tradeoff/CONTINUE.md` section 3 first; every rule binds. Then read:
- `/Users/maddy/B2B/rumortown-audit/debate/verdict.md` (plan item 5);
- `/Users/maddy/B2B/rumortown-audit/debate/round1-fable-on-how-small.md` and `/Users/maddy/B2B/rumortown-audit/how-small/round2-codex-reply.md` (the agreed design);
- `bench/slm/finetune/{train.sh,confirmation.ts,make-data.ts}`;
- `bench/slm/run.ts`;
- `bench/slm/providers.ts` (the `mlx:` provider);
- `agent-tradeoff/reports/43-report.md` (checker v2).

## Goal

Build `bench/slm/finetune/speaker-floor.sh` (and any TypeScript or Python helper it needs). The GPU controller will run it unattended this weekend, with no human present. It must:

1. **Train the same act-arm data** (`bench/slm/data/confirmation-37/arms/act/{train,valid}.jsonl`) with the same LoRA recipe (rank 8; q, k, v, o; 2 epochs; seed 7; epoch checkpoints; validation-selected epoch) on:
   - `HuggingFaceTB/SmolLM2-360M-Instruct` (Apache-2.0);
   - `google/gemma-3-270m-it` (Gemma terms);
   - `LiquidAI/LFM2-350M` (licence has a revenue threshold; research only), only if mlx-lm 0.32.2 supports its architecture; check this from the installed source under `~/.venvs/rt-mlx/lib/python3.12/site-packages/mlx_lm/models/`;
   - Qwen3-0.6B, already trained as `confirmation-37/runs/qwen06b-act-7`; reuse it, do not retrain.

   Each model gets its own chat template; check that the training data renders correctly under it (Gemma has no system role).
2. **Evaluate** each selected student and each untrained base at best-of-1, temperature 0.7, seeded, on the `confirm`, `test-mechanism` and `wording` splits of `confirmation-37` (same limit). Include the existing `template` deterministic baseline on the same probes. Write everything to `bench/slm/data/speaker-floor-45/`, the only place under `bench/slm/data` you may write.
3. **Measure energy and latency per evaluation:**
   - wall time;
   - tokens per second for prefill and decode separately;
   - with and without a cached ledger prefix, if mlx-lm supports prompt caching through the server;
   - package power from `sudo powermetrics` is not available without a password. Use `ioreg` or `pmset -g batt` instantaneous power if available, otherwise record wall time and tokens only, and say so.
4. **Rescore** all outputs with checker v2 (`--verifier-version v2 --out <new dir>`), and print a summary table: model, parameters, Q, F, act-macro Q, leakage, tokens per second, per split.
5. **Be resumable** (rerun skips finished work) and safe to run unattended: log to a file; on any failure, stop that model, continue with the next and record the error; never retry forever.

## Constraints

- Download the model weights now (network is allowed for this task) so the weekend run needs no network. Never run inference or training now; the GPU is busy. A one-step dry run of the training command with `--iters 0`, or argument parsing only, is allowed if it does not load weights onto the GPU. Prefer checking the configuration by reading code.
- No new runtime dependencies in the repository. Do not edit `apps/`.
- Run `npm run bench:slm:smoke`, and `npm run typecheck` if you changed TypeScript.

Do not commit. Write `agent-tradeoff/reports/45-report.md` covering:
- the exact command for the controller;
- an estimated GPU time per model from the confirmation-37 validation timings;
- licence notes;
- anything unsupported;
- the files to commit;
- a commit message without assistant attribution.

End with `STATUS: DONE` or `STATUS: BLOCKED`.
