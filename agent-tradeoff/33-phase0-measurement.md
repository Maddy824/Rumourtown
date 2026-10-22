# 33: Phase 0, make the SLM measurement valid

You are working in a separate git worktree, `/Users/maddy/B2B/rumortown-phase0`, on branch `research/phase0`. Another Codex run is changing the game UI in the main checkout, and a GPU experiment is running there; never touch `/Users/maddy/B2B/rumortown`.

Read first: `agent-tradeoff/CONTINUE.md` section 3; `docs/research/research-plan-2026-10.md` (Phase 0 and "Corrections after cross-review"); `agent-tradeoff/reports/30-strategy-review.md` ("Measurement problems to settle first", "Experimental rigour checklist"); `bench/slm/README.md`; `bench/slm/{types,probes,strategies,run,rescore}.ts`; `bench/slm/finetune/make-data.ts`; `apps/rumortown/src/agentic/verifier.ts` and `guard.ts`; `bench/slm/label/README.md`.

## Build

1. **World truth independent of belief.** Add claim-level world truth to the verdict, decided separately from epistemic fidelity: for each factual sentence, whether it matches a world-true claim, a world-false claim, or neither. Publish the four cells (believed and true, believed and false, unknown and true, unknown and false) and unanswered rates. Keep the current `worldFaithful` under its original definition, renamed or documented as `worldFaithfulLegacy`, so earlier numbers stay comparable. Do not change what the live game guard keeps or drops.
2. **No credit for omission.** Provenance: required-source coverage (a source was asked for and given), exact direct teller, and valid ancestry, as three separate measures with explicit denominators; a missing source fails when one was requested. Calibration: "not applicable" when no factual claim was made, instead of an automatic pass.
3. **Silence loses.** In `run.ts` summaries and `rescore.ts`, report answerable coverage, unnecessary abstention, appropriate abstention, abstention precision and recall, act-macro success with per-act denominators, and claim recall where a gold fact exists. An empty or chatter-only reply scores zero on an answerable request. Primary endpoint: useful-and-compliant (faithful and performs the gold act), act-macro averaged.
4. **Speech-act check.** Widen the surface proxy where it is plainly wrong (for example "I am half sure", "I only half believe it" are hedges; "I won't do that" is a refusal), with a test per change. Keep the old proxy available for comparison. Note in the README that it must be calibrated against the human audit.
5. **Whole-seed splits.** In `make-data.ts`, split training and validation by root simulation seed, never by snapshot. Add a test that no seed appears in both.
6. **Minimal pairs.** `bench/slm/pairs.ts`: from held-out scenarios, build pairs that keep state and question fixed and change one thing: the speaker knows or does not, source A or B, confidence high or low, current or corrected belief. Pilot size 100 pairs per held-out split, seeded and reproducible, with a JSONL export and a pair-level score (both sides right).
7. **Free baselines** as strategies: `abstain` (always says they have not heard), `template` (deterministic state-to-text reply from the speaker's facts: assert, hedge, deny, name source, abstain, refuse, as the gold act requires, with no access to world truth or gold labels at inference: it must infer the act from the utterance with simple rules), `perspective` (a SimToM-style two-step prompt: first list what this villager knows, then answer from that list), `fewshot` (a fixed development few-shot prompt). Mock-provider tests for each.
8. **Verifier validation set.** Extend `bench/slm/data/dev-labels.ts` with at least 30 new hand-labelled cases covering paraphrase, compound claims, polarity, sources and unknown truth, including cases the current oracle gets wrong; report which fail rather than tuning the oracle to pass them.

## Rules

- No new dependencies. Do not change the simulation or the replay pin. Do not edit `apps/api/` or any UI file.
- Every metric definition goes in `bench/slm/README.md`, with its denominator.
- Run `npm run bench:slm:smoke`, root typecheck and the verifier dev test (`node --experimental-strip-types --test bench/slm/verifier.test.ts`). Do not run models or the full GPU benchmark.
- You cannot commit. Write `agent-tradeoff/reports/33-report.md`: what changed, each metric's definition, what the validation set revealed, files to commit and a plain commit message without assistant attribution.

End with `STATUS: DONE` or `STATUS: BLOCKED` and a one-line test summary.
