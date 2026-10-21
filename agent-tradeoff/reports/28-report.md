# Task 28: Game-format training data and optional play LoRA

## Built

- Exported `playMessages` from the API's existing play module and used it in `/play`, preserving the original messages byte for byte.
- Added `bench/slm/finetune/game-format.ts`, with a Vite-bundled runtime bridge for the game's existing TypeScript/JSON imports. It reads a teacher set and scenario/probe exports, recovers each probe, and writes mlx-lm chats to `<set>-game/{train,valid}.jsonl` without changing source data or split assignments.
- Reconstructed missing activity, mood, relationship, trust and authored voice fields by replaying the original seeded snapshots and interventions. Probe beliefs and confidence overrides go through the existing `factsFor`, `directSources` and `villagerFacts` functions. Context keeps the addressed villager, the game's places and the last three complete exchanges. The assistant target preserves the teacher's exact reply inside compact JSON with `action: "none"` and `target: ""`.
- Added only `probeId` to `make-data.ts filter` examples; all existing fields remain. Older examples can match by their full original prompts. Unknown or ambiguous matches, held-out snapshots, split overlap and invalid context bounds stop conversion before output writes.
- Added optional `WORKERS_AI_PLAY_LORA`, passed to the binding only for `/play` with resolved model `@cf/meta/llama-3.2-3b-instruct`. Other routes/models omit it. Existing fallback, reservation, funding, settlement and caps remain in place.
- Documented conversion, PEFT upload, activation and rollback in `docs/credit-controls.md`. Neither Wrangler environment was edited; nothing is enabled in production.

## Usage

```sh
node --experimental-strip-types bench/slm/finetune/game-format.ts --set act
# Alternative inputs: append --data /path/to/data.
# Outputs: bench/slm/data/finetune/act-game/{train,valid}.jsonl.
```

The standalone CLI was exercised against a temporary dataset containing a real snapshot, an id-bearing training example and a legacy validation example. It produced both output files and preserved the source file. The parity test submits the converted context and utterance to a real worker handler with a mocked AI binding, then checks the exact system/user messages sent to the binding.

## Validation

- `npm run typecheck`: passed.
- `npx vitest run apps/api/test/play.test.ts`: 57 passed, including adapter selection, route isolation, failure/invalid-output fallback, reservation ordering, settlement and exhausted lifetime cap.
- Converter harness: 4 passed, including the actual Node CLI, prompt parity, own-source provenance, game confidence bands, history bounds, split isolation and ambiguous legacy rejection.
- Initial `npm test`: 1001 passed, 10 timing failures in 7 existing files during parallel CPU load. Each failing file was rerun alone with its original timeouts/thresholds: all 142 tests passed. No timing limits were changed. The replay file passed its original pinned raw hash.
- `npm test -- --fileParallelism=false`: passed all 1,011 tests in 78 files with original test timeouts and performance thresholds.
- `npm run bench:slm:smoke`: passed all 35 tests in 7 files in the final working tree, including the converter tests and concurrently added task 29 harness coverage. The earlier run passed 23 tests before that additional coverage appeared.
- `npm run build`: passed, with the existing Vite configuration/chunk-size warnings.
- `node .github/workflows/check-bundle.mjs`: passed, 353,365 bytes gzipped against the 400,000-byte budget.
- `git diff --check`: passed. Explicit diff check confirmed no changes in the protected benchmark files/results, game verifier or Wrangler configuration.
- Read-only working-tree review: [28-review.md](28-review.md). No remaining Critical or Important findings.

## Rulings and follow-up

- The task is implementation only: no model training, fine-tune upload, remote model request, deployment, environment/secret change, staging, commit or push was performed. Live adapter quality and compatibility with a real uploaded artifact remain unmeasured.
- The existing local `smoke` teacher set predates the current scenario/probe exports, including the provenance cleanup and changed claim ids. An attempted conversion correctly stopped with `Cannot recover probe`; it wrote no output. Regenerate stale sets through `make-data.ts filter` after the controller's sampling finishes. The active samples, source sets and experiment results were left untouched.
- Legacy prompts that match several probe levels within one snapshot are equivalent and can use the first match. Matches spanning different snapshots are rejected rather than guessing the training/validation identity. Wrongly guessing would compromise evaluation; carrying `probeId` removes the ambiguity.
- Replay uses the same fixed inputs and interventions as the current scenario exporter. After the running experiments finish, consider exporting the missing live context fields with scenarios, so subsequent conversions need no replay. No exporter changes were made during the experiment freeze.
- The training context lists only the addressed villager in `nearby`, while using real mood/activity and full place/voice fields. Other nearby people are not recoverable from the stored visitor position as a conversation with an arbitrary sampled villager; this bounded context is accepted unchanged by `/play` and does not invent nearby observers.
- Teacher prose is preserved, as requested. Before training, audit targets against the four visible beliefs, clipping/confidence rules and the 240-character serving limit. Conversion intentionally does not silently shorten, re-score or alter the research sets. This is a remaining data-quality check, not evidence that the tuned student is ready to serve.
- There are no UI, simulation, dependency or replay-pin changes, so desktop/360 px/keyboard checks are not applicable to this diff. The unrelated task 29 brief and `bench/slm/label/` work appeared during the run and were preserved.

## Files to commit

Stage these explicit paths only, preserving any unrelated concurrent work and ignored build-info files:

```text
apps/api/src/index.ts
apps/api/src/play.ts
apps/api/src/types.ts
apps/api/src/workers-ai.ts
apps/api/test/play.test.ts
bench/slm/finetune/make-data.ts
bench/slm/finetune/game-format.ts
bench/slm/finetune/game-format-runtime.ts
bench/slm/finetune/game-format.harness.test.ts
docs/credit-controls.md
agent-tradeoff/reports/28-report.md
agent-tradeoff/reports/28-review.md
```

The owner-supplied `agent-tradeoff/28-lora-in-game.md` remains untouched and untracked; include it separately if desired. Do not include task 29 or generated training/build files in this task's commit.

Plain commit message: `28: Add game-format training chats and optional play LoRA`

Use `Madhav Sunil <94164709+Maddy824@users.noreply.github.com>` for any later commit; this task made none.

STATUS: DONE
Tests: typecheck, 1,011 root tests, 35 SLM smoke tests, production build, bundle gate and diff checks passed; initial load-related failures passed in isolation and in the full serial rerun.
