# 29: Human audit of the epistemic verifier: sampler, labelling page, agreement report

Read `agent-tradeoff/CONTINUE.md` sections 1c and 3, `docs/research/finetune-study.md` and `docs/research/literature-finetune-2026-10-22.md` ("Baselines reviewers will demand") first.

## Why

The study uses a rule-based oracle (`apps/rumortown/src/agentic/verifier.ts`) both to score models and to filter fine-tuning data. Reviewers will ask how often it is wrong. We need blinded human labels on a stratified sample of real model replies and the oracle's precision/recall against them. The owner will recruit annotators (at least two); this task builds everything they need.

## Build, under `bench/slm/label/`

1. `sample.ts`: draws a stratified, seeded sample from result directories (rows in `outputs.jsonl` or `rescored.jsonl`, harness `Row` format in `bench/slm/run.ts`). Strata: model × axis × oracle verdict (faithful / unfaithful / out-of-character) so rare labels are represented; default 500 items, `--n` and `--seed` flags. Each item carries: an opaque item id, the villager's name, role and voice, their beliefs (text, band, sources), the other villagers' claims shown as distractors, the player's utterance and history, and the reply. **Never** include the model name, strategy, oracle labels or world truth in the item file given to annotators (blinding). Keep a separate key file with those, for scoring.
2. `index.html` (+ inline JS/CSS, no dependencies, works from `file://`): loads an item file the annotator picks, shows one item at a time, splits the reply into sentences (same splitting rule as the verifier's `sentences()`), and asks per sentence: supported by the speaker's beliefs / contradicts them / claims something the speaker does not know / chatter or opinion / out of character. Per reply: does it do what was asked (yes/partly/no), and is the confidence expressed right (yes/no/not applicable). Keyboard shortcuts, progress saved in `localStorage`, export to JSON with the annotator's chosen id. Plain, readable layout; sentence case; works on a laptop and a tablet. Include a short instructions panel with one worked example per label, written for a non-technical annotator.
3. `agreement.ts`: reads two or more exported label files and the key file; reports inter-annotator agreement (Cohen's kappa for two annotators, Krippendorff's alpha for more; per-label and overall), then the oracle's precision, recall and F1 per label against the adjudicated majority, plus a confusion matrix, broken down by model and axis. Markdown output. Include a small fixture test with hand-computed expected kappa and F1.
4. `README.md` in that folder: how to draw a sample, how to run a labelling session, how to compute agreement, and the annotation guidelines in full.

## Rules

- No new dependencies. Node 22 `--experimental-strip-types` scripts like the rest of `bench/slm/`.
- Do not edit any other file under `bench/slm/` or `apps/`. Another Codex run (task 28) and the controller's experiments are active.
- Tests: add `bench/slm/label/*.harness.test.ts` so `npm run bench:slm:smoke` picks them up (check `bench/slm/vitest.config.ts` include pattern without editing it; if it does not match, use a pattern it does match).
- You cannot commit. Write `agent-tradeoff/reports/29-report.md` with what you built, the files to commit and a plain commit message without assistant attribution.

End with `STATUS: DONE` or `STATUS: BLOCKED` and a one-line test summary.
