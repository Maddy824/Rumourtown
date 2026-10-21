# 03: Final whole-branch review (read-only)

Run this as a read-only Codex task and capture the final message as the report:

```sh
codex exec -s read-only -C /Users/maddy/B2B/rumortown -c model_reasoning_effort=high \
  -o agent-tradeoff/reports/03-final-review.md \
  "Read agent-tradeoff/03-final-review.md and perform the review it describes. Your final message is the review."
```

You are the final reviewer of the whole `build/village` branch against the design document `docs/superpowers/specs/2026-10-21-rumortown-design.md`. Produce the diff with `git diff master...HEAD --stat` and read the modules directly. Judge, with file and line for every finding:
1. Does the shipped game match sections 4 (experience), 5 (world), 6 (cast), 7 (architecture), 8 (rules), 9 (dialogue), 11 (visual) and 13 (ethics)? List every requirement that is missing or changed.
2. Determinism end to end: same seed and interventions must give byte-identical event logs; search for `Math.random`, `Date.now`, `performance.now` inside `apps/rumortown/src/sim/**` and `packages/rumormind/**` (the renderer and UI may use the clock for visuals only).
3. The $10 guarantee: trace `apps/api/src/index.ts` from request to response and confirm no path calls the model without a reservation and that every failure is fail-closed.
4. Safety: no typed text can reach the screen, the cache, the URL or the share card.
5. The deferred minors and parked findings listed in `.superpowers/sdd/2026-10-21-village-build/progress.md`: which must be fixed before merge?
6. Dead code, duplicated logic between the engine and the library, oversized files, and tests that cannot fail.
Tag findings Critical, Important or Minor, and end with a verdict: ready to merge, or the list of blockers.
