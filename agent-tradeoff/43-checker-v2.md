# 43: Checker v2, epistemic negation handled at clause level

Read `agent-tradeoff/CONTINUE.md` section 3 first; every rule binds. Then read:
- `/Users/maddy/B2B/rumortown-audit/debate/verdict.md` (item 1);
- `/Users/maddy/B2B/rumortown-audit/debate/round1-codex-on-fable.md` (your own verification, including the six false rescues in `codex-checks/verifier_false_rescues.json`);
- `/Users/maddy/B2B/rumortown-audit/breakdown-fable/report.md` (the M9 measurement);
- `apps/rumortown/src/agentic/verifier.ts`;
- `bench/slm/verifier.ts`;
- `bench/slm/rescore.ts`;
- `docs/research/methods-formal.md` sections 2 and 6.

**Time box: about two hours of work. CPU only.** Never load or run a model; the GPU is evaluating the confirmation round.

## Goal

The verifier labels a sentence that denies or disclaims knowledge of a claim (for example "I have not heard of Rosa nursing Ada", "I don't know whether Tom took the bread", "Nobody told me that") as `unknown-to-speaker`, which counts as invention.

Fix it at **clause** level:
- An epistemic-negation clause whose scope covers the claim is an abstention about that claim, not an assertion of it.
- Every other clause in the same sentence is still checked. So "I have not heard that, but Mira owes Ada a farthing" must still flag the second clause.
- A disclaimer followed by a confirmation ("I don't have access... but I can confirm that Rosa has been nursing Ada") must still flag.
- Negations of known facts that contradict the ledger must still be caught as contradictions.

## Rules

- **Version the checker.** Keep v1 reachable (`verifierVersion: 'v1' | 'v2'`, default v2 only where the harness explicitly opts in) so old results stay reproducible. Record the version in the scorer fingerprint in `rescore.ts`.
- **Tests.** Every one of the six false rescues, the base-model counterexample above, at least 25 true epistemic abstentions drawn from saved replies, contradiction cases, quoted speech and injection markers. Use exact sentences from the result files.
- **Measure, do not tune to a target.** Rescore all saved outputs under `bench/slm/results/{baseline-2,finetune/eval}` with v1 and v2 into a new folder, `bench/slm/results/checker-v2-rescore/`. This is the one place under results you may write; do not modify existing files. Report per model, arm and split: F, Q and act-macro Q under v1 and v2, the number of changed rows, and a stratified sample of 60 changed rows (30 v1→v2 rescues, 30 unchanged invention flags) written to an audit file for blinded human review.
- **Scope.** Do not edit `apps/` beyond the verifier and its tests. Run `npm run typecheck`, the app tests that cover the verifier, and `npm run bench:slm:smoke`. No new dependencies.
- **Do not commit.** Write `agent-tradeoff/reports/43-report.md` covering:
  - the exact rule;
  - before and after tables;
  - the audit file path;
  - the files to commit;
  - a plain commit message without assistant attribution.

End with `STATUS: DONE` or `STATUS: BLOCKED` and a one-line test summary.
