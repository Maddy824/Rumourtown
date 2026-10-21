# 28: A path for the fine-tuned villager voice into the live game (flag off)

Read `agent-tradeoff/CONTINUE.md` sections 1c and 3 first; every rule there binds this task. Read `docs/research/finetune-study.md` for the research context.

## Why

The SLM study fine-tunes small models (LoRA, MLX) to stay inside a villager's belief state. Workers AI accepts LoRA adapters for `@cf/meta/llama-3.2-3b-instruct` (rank 32 or below, PEFT files `adapter_config.json` + `adapter_model.safetensors`, `model_type: llama`, uploaded with `npx wrangler ai finetune create <model> <name> <dir>`, used by passing `lora: "<name or id>"` to `env.AI.run`). If the tuned 3B model is good enough, `/play` could use it instead of the 70B model, which is cheaper and faster. Two pieces are missing, and this task builds both. Nothing is enabled in production.

## 1. Training data in the game's own format

The harness prompts (`bench/slm/strategies.ts` `messagesFor`) differ from what `/play` sends the model (`apps/api/src/play.ts`: its system prompt, the JSON user message with `context`, the facts produced by `villagerFacts` in `apps/rumortown/src/agentic/orchestrator.ts`, and the JSON reply `{reply, action, target}`). An adapter must be trained on the format it will serve.

Build `bench/slm/finetune/game-format.ts`:
- Input: the existing `bench/slm/data/finetune/<set>/train.jsonl` and `valid.jsonl` examples (chat messages whose last message is the assistant reply), plus `bench/slm/data/scenarios.jsonl` / `probes.jsonl` to recover the scenario and probe for each example (add the probe id to each example in `make-data.ts filter` if needed; keep the existing output fields).
- Output: `bench/slm/data/finetune/<set>-game/{train,valid}.jsonl` in mlx-lm chat format, where the system and user messages are exactly what `apps/api/src/play.ts` would build for that villager and utterance (import or share the prompt builder rather than copying text; if it is not exported, export it without changing its behaviour), and the assistant message is `{"reply": <teacher reply>, "action": "none", "target": ""}` as compact JSON.
- Facts must be rendered the way the game renders them: first-person sentences with confidence bands and the speaker's own source, as `villagerFacts` does. Reuse that function's logic; do not invent a third format.
- A test that one converted example's system/user messages equal what `/play` builds for the same input.

## 2. An off-by-default LoRA flag on `/play`

- New optional env var `WORKERS_AI_PLAY_LORA` (a fine-tune name). When set **and** the resolved play model is `@cf/meta/llama-3.2-3b-instruct`, pass `lora: <name>` to `env.AI.run` for `/play` only. Any other model ignores it. `/rumor` and `/interpret` never use it.
- If the LoRA call fails or returns invalid output, behave exactly as today when Workers AI fails (existing fallbacks, existing settlement). Money boundaries unchanged: reservation before dispatch, settlement after, caps, fail closed.
- Do not set the variable in `wrangler.toml`. Document it in `docs/credit-controls.md` or the API section of the docs, with the upload command and the rollback (unset the variable).
- Tests in `apps/api/test/play.test.ts`: lora passed only for play with the 3B model; not passed when unset, for other models, or other routes; failure falls back.

## Rules

- No new dependencies. Do not edit `bench/slm/run.ts`, `strategies.ts`, `providers.ts`, `types.ts`, `io.ts`, `probes.ts`, `scenarios.ts`, `rescore.ts`, `apps/rumortown/src/agentic/verifier.ts`, or anything under `bench/slm/results/`: the controller is running experiments with them. You may edit `bench/slm/finetune/make-data.ts` only to add a probe id field to examples.
- Run the checks in CONTINUE.md section 4 plus `npm run bench:slm:smoke`. Timing failures under load are expected tonight (the GPU and CPU are busy); re-run a failing file alone before reporting it.
- You cannot commit. Write `agent-tradeoff/reports/28-report.md` with what you built, the files to commit and a plain commit message without assistant attribution.

End with `STATUS: DONE` or `STATUS: BLOCKED` and a one-line test summary.
