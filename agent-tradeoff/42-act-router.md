# 42: Build the act router (validate act, then speak) and act-aware best-of-n

Read `agent-tradeoff/CONTINUE.md` section 3 first; every rule binds. Then `agent-tradeoff/reports/41-strategies/report.md` (your own ranking: ranks 1, 4 and 5), `agent-tradeoff/reports/40-failures/report.md`, `bench/slm/{types,strategies,run,verifier,scenarios,probes,baselines}.ts`, `bench/slm/README.md`, and `docs/research/methods-formal.md` sections 1 to 3.

## Goal

Two new harness strategies in `bench/slm/strategies.ts`, buildable and testable with no model (the GPU is reserved; the CPU is running a state capture). Evaluation runs later from the controller.

1. **`route`** (rank 1): two calls. Call 1 asks the model for a JSON plan `{ target: <fact id or null>, act: <assert|hedge|deny|abstain|refuse|name-source|propose-action>, band: <sure|fairly sure|half|doubt|null>, teller: <name or null> }`, with real ids shown as in the `cite` prompt. A deterministic validator checks the plan against the **visible** ledger only (never gold or world truth): the target must exist in the rendered ledger or be null; the band must equal the target's band; the teller must be the direct teller in the target's chain; `name-source` and confidence questions must carry a target; `refuse` and `abstain` carry no target. One retry with the validator's reason, then fall back to the abstain plan. Call 2 realises one in-character sentence from the validated plan, with the ledger text for the target quoted into the prompt and nothing else. Record the plan, validity and retries in the row so `rescore.ts` can still score the final reply.
2. **`route-template`** (rank 4): the same router, but call 2 is replaced by the existing deterministic `template` baseline realiser given the plan.
3. **`best-of-act`** (rank 5): best-of-4 where the selector requires verifier acceptance **and** a match to the act inferred from the public request text and ledger. Write `inferRequestedAct(request, ledger)` from the request wording and whether the target is in the ledger; it must not call `surfaceBehaviour`, read `gold`, or touch world truth. Document its rules and report its agreement with gold on the training split as a diagnostic only.

## Rules

- No new dependencies. Do not edit `apps/`, `bench/slm/neural/`, `bench/slm/finetune/`, or anything under `bench/slm/results/` (a symlink to live results; read-only).
- Keep every existing strategy byte-identical in behaviour; the smoke tests pin them.
- Tests: extend the harness smoke tests with a fake provider that returns scripted plans (valid, invalid target, wrong band, wrong teller, retry success, retry failure) and scripted realisations; cover `inferRequestedAct` on at least 30 request wordings drawn from `bench/slm/data/probes.jsonl` across all seven acts. `npm run bench:slm:smoke` and `npx tsc -p bench/slm/tsconfig.json` (or the root typecheck if that is how bench is checked) must pass.
- You cannot commit. Write `agent-tradeoff/reports/42-report.md`: what was built, the validator's exact rules, the exact commands the controller runs to evaluate `route`, `route-template` and `best-of-act` on qwen3:0.6b and qwen3:1.7b over the three splits, files to commit and a plain commit message without assistant attribution.

End with `STATUS: DONE` or `STATUS: BLOCKED` and a one-line test summary.
