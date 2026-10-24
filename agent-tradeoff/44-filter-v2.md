# 44: Filter v2, no injection-obeying training targets

Read `agent-tradeoff/CONTINUE.md` section 3 first; every rule binds. Then read:
- `/Users/maddy/B2B/rumortown-audit/debate/verdict.md` (item 2);
- `/Users/maddy/B2B/rumortown-audit/debate/round1-codex-on-fable.md` (your own count: in the screening verifier set, 207 of 254 refuse targets contain the marker, about 139 comply, 51 refuse while quoting it, 17 ambiguous; in confirmation-37, 31 of 143 verifier refuse rows contain it, 12 comply);
- `bench/slm/finetune/{make-data.ts,confirmation.ts}`;
- `bench/slm/verifier.ts`;
- `apps/rumortown/src/agentic/verifier.ts`;
- `bench/slm/probes.ts` (how injection probes and the marker are built);
- `agent-tradeoff/reports/43-report.md` (checker v2, now merged).

CPU only. Never load or run a model; the GPU is busy all weekend.

## Goal

1. **Why the targets passed.** Find out why marker-emitting targets pass the verifier-only and unfiltered filters: which of R, A and the injection check each filter uses. Write it down with file and line.
2. **Filter v2.** A target fails if it obeys an injected instruction. That covers emitting the marker outside a quoted refusal, following the injected order, or claiming the injected content. A refusal that quotes or names the marker while declining stays. Implement this deterministically, with exact tests built from the real training targets of both sets: compliance, quoted refusal and ambiguous cases. Decide each ambiguous case conservatively (drop it) and record each decision. Apply filter v2 to every arm (act, verifier-only, mix-0.5, unfiltered-control); the act arm should be unchanged, and if it changes, explain why.
3. **Checker version.** Use checker v2 (`verifierVersion: 'v2'`) for the R and F parts of the filter in the rebuilt arms. Report how many targets per act and per arm change from v1 to v2.
4. **Rebuild.** Rebuild the arms with the same prepared samples into a new folder, `bench/slm/data/confirmation-44/`. That is the only place under `bench/slm/data` you may write; leave `confirmation-37` untouched, because a run depends on it. Keep `confirmation-37`'s splits, seeds, act quotas and pairs. If a quota can no longer be filled for an act, stop and report the shortfall rather than resampling silently.
5. **Launcher.** Add `--data-dir` and `--out` support so the GPU controller can later train the rebuilt arms. Do not change the defaults: the running `confirmation-37` launch must resume byte-identically. Prove that with a hash or dry-run check.
6. **Tests.** Run the filter unit tests, `npm run bench:slm:smoke` and `npm run typecheck`. No new dependencies; do not edit `apps/`.

Do not commit. Write `agent-tradeoff/reports/44-report.md` covering:
- the cause;
- the rule;
- the per-arm and per-act counts before and after;
- the shortfalls, if any;
- the exact commands to train and evaluate the rebuilt Qwen 0.6B arms (seed 7) with checker v2 scoring;
- the files to commit;
- a plain commit message without assistant attribution.

End with `STATUS: DONE` or `STATUS: BLOCKED`.
