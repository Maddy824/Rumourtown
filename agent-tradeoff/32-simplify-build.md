# 32: Make the first visit simple, keeping every feature

Read `agent-tradeoff/CONTINUE.md` section 3 first; every rule binds this task. Then read the three reviews: `agent-tradeoff/reports/32-ux-review-controller.md`, `agent-tradeoff/reports/32-ux-review-codex.md` and the merged list in `agent-tradeoff/reports/32-cross-review-codex.md`.

## Build

Implement the six steps of "Final merged two-day build, in order" in `32-cross-review-codex.md`, exactly as written there. Acceptance target: a first-time visitor on a 360 px phone can find Whisper, pick a person, see three ready-made stories without opening anything, send one, read the listener's actual reply, and know where later tellings will appear, without scrolling to discover a control.

Decisions already made (do not reopen):

- Names: **Map**, **Rumors**, **Menu** at the top; a primary **Whisper** postbox and a separate **Talk** button at the bottom; Time shows **Paused** (not Held) with the reason.
- Welcome: one sentence and one primary action, "Start a rumor"; dismissal and free exploring remain available but not as a competing big button. Suggested sentence: "Everyone here remembers who told them what. Start a rumor and see what people think."
- Listener first, then stories: keep the existing walk-then-compose flow (`walkToVillager(id, true)`), with awake, reachable choices, a visible walking status and Cancel. On arrival, three existing stories are visible as cards with their exact text, then "Write my own", then the full collections.
- After sending: the listener's actual recorded reply, the honest line "He heard it. That doesn't mean he believes it." when appropriate, and "Heard by N people since your whisper" computed as described in the cross-review (unique `to` IDs from the trail history for the selected claim since the player's first telling). No believe/doubt totals in this build.
- Rumors panel: the selected rumor's three newest moments first (with the reply), then "More detail" holding the full history, the selector, the optional challenge, the chain ("Each pair shows a telling. Hearing is not believing.", the player called "You") and watching options. Fix the bug where events are not filtered by the selected claim.
- Menu groups: Play (How to play, Watch the arrival again, Share this village), Settings (Music, Show rumor paths, Slow down for conversations, Follow the speaker), For the curious (Research notebook, How it works inside, Developer guide, About).
- How to play text: "You're visiting a village. Tell one person a story, then watch who repeats it, doubts it or takes sides. People remember who told them and decide what to believe. A rumor doesn't make something true. Talk, explore or try another story; there's no single right ending."
- The postbox is never covered, in any panel state, at 360 px and 390 px.

## Rules

- Keep every existing feature reachable. Keep the typed-story preview, disclosure and explicit send exactly as they work now.
- No simulation changes; the replay pin must not change. No new dependencies. Copy: sentence case, plain words, no middle dots, no arrows in buttons, no exclamation marks, no all-caps.
- Do not touch `bench/`, `apps/api/`, or `apps/rumortown/src/agentic/verifier.ts` (experiments are running on this machine; the GPU is busy, so expect slow tests and re-run a timing failure alone before reporting it).
- Update or add tests as listed in step 6. Run root typecheck, tests, production build and `.github/workflows/check-bundle.mjs`.
- You cannot commit or use a browser. Write `agent-tradeoff/reports/32-report.md`: what changed, screens to check, files to commit, and a plain commit message without assistant attribution.

End with `STATUS: DONE` or `STATUS: BLOCKED` and a one-line test summary.
