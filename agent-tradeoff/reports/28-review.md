# Task 28 working-tree review

Reviewed the task's implementation diff, new converter/runtime/test files, and `CONTINUE.md` section 3. This is a read-only self-review of uncommitted work; no commits were made.

| Requirement | Result | Evidence |
| --- | --- | --- |
| Existing teacher chats plus scenarios/probes become `<set>-game` train/valid chats | Met | `convertSet` resolves ids or exact legacy prompts, preserves input order and split, and writes only the new output directory. CLI integration test covers both id-bearing and legacy examples. |
| Training and serving share system/user messages | Met | Both use `playMessages` from `apps/api/src/play.ts`; a test compares converted messages to the actual binding inputs of a successful `/play` request. |
| Facts use the game renderer, confidence bands and speaker's own sources | Met | Converter calls `villagerFacts`, applying `factsFor` and `directSources`. Tests cover bands, clipping to four visible beliefs, omission below 0.35 and exclusion of a different listener's chain links. |
| Assistant is compact JSON with teacher reply, no action and empty target | Met | `convertExample` preserves teacher text and uses `JSON.stringify` with the required fields. |
| LoRA defaults off and is restricted to `/play` with the exact 3B model | Met | Route and resolved-model conditions surround the optional `lora` input; tests cover unset/empty values, default 70B, another model, and other routes using 3B. Wrangler configuration is unchanged. |
| Failure and invalid output retain existing fallback/settlement and caps | Met | Only the inference input changed. Tests exercise thrown errors, error envelopes, malformed JSON, invalid actions, funding/settlement and exhaustion of the lifetime cap. |
| Upload and rollback documented | Met | Credit controls describe PEFT files, upload command, activation and unsetting the variable to roll back. |
| Protected benchmark files/results and simulation stay unchanged | Met | Explicit `git diff --quiet` check passed. `make-data.ts` changes only the addition of `probeId`. No dependency or replay-pin changes. |
| Real uploaded adapter quality and live serving | Cannot verify | Intentionally no upload, remote inference, deployment or production activation in this task. |

No Critical or Important findings remain. During review, ambiguous legacy matches across snapshots were changed to fail explicitly rather than choosing a snapshot arbitrarily; a regression assertion covers this case.

Minor follow-ups: audit preserved teacher replies against the game's four visible beliefs and 240-character reply limit before training; consider exporting the remaining live context fields with scenarios after the running experiments finish, to remove the need for deterministic replay. These are recorded in `28-report.md`.
