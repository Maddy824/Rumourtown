# Task 23 manual review

The requested separate `codex exec -s read-only` review failed to initialize its app server with `Operation not permitted`. This is the main run’s manual review, not an independent model review. Concurrent research and reply-guard changes are excluded from the reviewed task scope.

| Requirement | Result | Evidence or limit |
| --- | --- | --- |
| 5: Meet an awake person and give night walking choices | Met in code and event tests | Distance-ordered awake selection, sleeping-person rejection, awake empty-state list. |
| 5: Stranger does not path into private homes | Met | Every home redirects to its outside door; public inn remains reachable. A replay already inside a home can leave. |
| 6: Plain landing explanation and three steps | Met | Landing subtitle, ordered walk/whisper/follow steps, scrollable welcome surface. |
| 7: Player stories by default, village toggle | Met | Timeline/Now filtering, rail toggle regression, chronological introduction filtering, eyewitness retention. |
| 7: Retire stale statuses | Met | Six-second UI-clock expiry, replacement and modal retirement, idle/replacement tests. |
| 7: Blank building signs | Code fix met; raster result cannot verify | Far-view text replaces symbol glyphs; all public sign labels tested. QA did not identify the exact two tags. |
| 8: Phone half sheet and Slow time | Met in source and event tests; browser geometry cannot verify | Half viewport height, postbox clearance, camera cover, Slow/restored speed, edit-only holds with idle/composition/close tests. |
| 9: Block obfuscated typed/shared text | Met | Worker/browser normalization, canonical guards, QA fixture and variants, no inference/registration/export on a hit, rejected malicious replay payloads. |
| 1b: Library beats name the rumor | Met | Every library claim checked against the Now sentence; meaningful fallback when a claim is missing. |
| Section 3: Determinism, replay and dependencies | Met | No random or clock additions in simulation; raw pin unchanged after inspection; task adds no dependencies. |
| Section 3: Caps, raw prose and coordinates | Met | No ledger/provider limit changes, no logging/cache additions, no new hand-computed renderer anchors. |
| Section 3: Explicit staging and attribution | Allowed fallback used | Explicit path staging denied by `.git/index.lock` permissions. No commits created. Requested Madhav Sunil identity supplied to Git commands. No assistant trailers. |
| Section 3: Desktop/360 px and keyboard | Cannot verify in a browser | Preview bind denied, Chrome aborted. Event tests verify phone opening focus; existing modal Escape/Tab handling retained. |
| Protected files | Met for this run | No edits to `agentic/` or API `play.ts`. Another run changed `agentic/` and inserted a guard into UI `play.ts`; those changes are preserved. |
| Deployment | Met | No deployment or push performed by this run. |

Important findings fixed during review:

- `ui/story.ts`: the first rail filter dropped custom eyewitness exchanges. Preserve exchange-derived witnesses and test their visibility after the player whisper.
- `sim/engine.ts`: a replay could start inside a home and become unable to leave under the new path guard. Permit exiting the origin home and test reaching the public square.
- `ui/play.ts`: initial phone focus on a non-tab-stop heading was a poor starting point for the existing boundary-based Tab trap. Focus the first close button while keeping the virtual keyboard closed.

No remaining Critical code findings. Remaining verification findings are the browser checks above and Node 22 replay confirmation, unavailable in this sandbox. These are recorded for follow-up, without claiming them as passes.
