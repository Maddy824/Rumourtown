# Agent handoff: tasks for Codex

This folder is the work queue for Codex when the Claude session is unavailable. Each task file is self-contained: it says what exists, what to build, how to verify, and what to write in its report. Run them in number order unless a file says otherwise.

## How to run one task

From the repository root, on branch `build/village`:

```sh
codex exec -s workspace-write -C /Users/maddy/B2B/rumortown \
  -c model_reasoning_effort=high \
  "Read agent-tradeoff/01-integration.md and complete it exactly. Then write your report to agent-tradeoff/reports/01-report.md and finish with STATUS: DONE or STATUS: BLOCKED."
```

Change the file name for each task. Review tasks use `-s read-only` and `-o <report path>` instead, as their files say.

## Rules for every task

- Stay on branch `build/village`. Commit when a task's verification passes, using `git add <the directories the task names>` (never `git add -A`) and a message that starts with the task number.
- Run `npm run typecheck`, `npm test` and `npm run build` from the root before committing. All three must pass.
- No new dependencies unless the task file says so.
- Keep every simulation module deterministic: no `Math.random`, no `Date`, no order-dependent iteration.
- Copy rules: sentence case, plain words, no all-caps labels, no middle-dot separators, no arrows in button text.
- Write the report the task asks for; the next task may read it.

## Where things are

- Design document (the authority): `docs/superpowers/specs/2026-10-21-rumortown-design.md`
- Build plan with every task brief: `docs/superpowers/plans/2026-10-21-village-build.md`
- Progress ledger with rulings: `.superpowers/sdd/2026-10-21-village-build/progress.md`
- Contract every module codes against: `apps/rumortown/src/sim/types.ts`
- Library: `packages/rumormind`; game: `apps/rumortown`; AI endpoint: `apps/api`

## Status

| # | Task | Status |
|---|---|---|
| 01 | Integration: wire the real engine, cast, dialogue, renderer and UI | blocked on Git writes; implementation verified; see reports/01-report.md |
| 02 | Verify and commit any uncommitted fix rounds | done; residual engine findings carried to 04 |
| 03 | Final whole-branch review (read-only) | done; 10 Important findings, see report |
| 04 | Fix the final review's findings | fixes verified; rereview in progress |
| 05 | Benchmarks | pending |
| 06 | Library publish preparation | pending |
| 07 | Accessibility pass | pending |
| 08 | Launch copy | pending |

Update this table as tasks complete. Things only the owner can do are in `owner-checklist.md`.
