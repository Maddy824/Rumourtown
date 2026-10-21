# Task 23: Remaining human QA fixes

Branch: `build/village`. Scope: items 5–9 and the section 1b library-rumor naming follow-up. Items 1–4, `apps/rumortown/src/agentic/` and `apps/api/src/play.ts` are outside this change. No deployment or push requested or performed. Runtime dependencies and money limits are unchanged.

## Verification environment

- Node 25.8.2. Node 22 is not installed here. The default fork pool did not complete before a retry; full-suite retries use `npm test -- --pool=threads --maxWorkers=2 --reporter=verbose`. This runs the current root test selection and assertions. Concurrent work later added the offline SLM smoke suite to that selection.
- Local Vite preview denied with `listen EPERM`; Chrome launch aborted under the sandbox. Desktop/360 px visual geometry and real-browser keyboard verification cannot be completed here. UI event tests and source review cover what can be verified without a browser.
- The section 7 read-only `codex exec` review was attempted and failed during app-server initialization with `Operation not permitted`. Manual read-only diff review is recorded in [23-review.md](23-review.md).
- The three pre-existing generated `tsconfig.tsbuildinfo` changes are preserved and excluded from staging.

## Item 5: Night guidance

- The guide chooses the nearest awake core villager, then an awake inn regular or another awake resident if no core villager is available. Its button names the current choice.
- The whisper empty state lists awake people by distance even when nearby people are asleep. At night it gives the requested inn guidance; if nobody is awake it explains that the village is asleep.
- New visits to sleepers stop immediately. Following stops if the target falls asleep. Player movement requests into private homes stop outside; public building interiors remain reachable.
- Replay inspected with `node agent-tradeoff/reports/22-replay.mjs /tmp/rumortown-23-replay.json`. The raw event hash remains `6137d96970f7a28e05e2fb37b57b9495274d1c256208d084818a336332994184`; there is no event difference to re-pin. Only requested player paths change. The existing pin is retained.
- Tests cover awake selection, sleeping-listener empty states, every private home, public inn entry, and replay stability.

## Item 6: First screen

- Landing copy explains walking, whispering, watching the story spread, and villagers thinking for themselves.
- One welcome card contains three short ordered steps: Walk, Whisper, Follow the thread. First-run copy has no rumor-line or conversation-reading jargon.
- Desktop and phone CSS retains the existing welcome surface and keyboard buttons. Real browser verification remains blocked by the sandbox.

## Item 7: Noise

- Timeline pins, the Now strip, and the Story rail show only stories introduced by the player by default, beginning at the whisper rather than exposing earlier tellings. Corrections of those claims remain relevant. The keyboard-accessible “Include village stories” toggle reveals the other stories in all three views.
- Loading and walking guidance expires after six seconds of UI time, including while paused, and clears when replaced or covered by a sheet. Arrival and keyboard movement retire superseded walking notes.
- Far-view building signs use short words in place of font-dependent symbols. This removes reliance on unsupported icon glyphs; the human report did not identify the two buildings, and raster verification remains blocked.
- Focused tests cover filtering before/after introduction, the toggle, status expiry/replacement, and textual public signs.

## Item 8: Phone Talk

- Phone Talk occupies half the viewport height, stays above the postbox, and scrolls internally with a visible close button. Camera framing includes its actual cover; the village remains visible above a light scrim.
- Opening Talk switches to Slow (0.5×); closing restores the prior speed. Input holds time, including IME composition. Blur, submit, close, and 1.5 seconds without editing release the hold. Waiting for a reply does not hold time.
- On phones the close button receives initial focus, leaving the keyboard closed until the player selects the writing field. Escape and the existing modal focus trap remain available.
- Event tests cover opening focus, typing, idle release, composition, sending, closing, and timer cleanup. Browser layout and actual virtual-keyboard behavior remain unverified under the sandbox.

## Item 9: Shared text moderation

- Browser and Worker use one comparison normalization: lowercase, compatibility normalization, punctuation removal, and folding spaces/apostrophes inside blocklisted words. Word boundaries prevent matches inside “grapes”, “scrap” and “Essex”. The accepted text itself stays unchanged.
- The writing sheet rejects blocked drafts before inference or registration, retains the editable draft on the device, and explains how to continue. Canonical open/written story creation and replay restoration also reject blocked text, so alternate entry paths cannot create simulation events or shared/exported stories.
- Tests include the QA security example `f.u.c.k`, uppercase, spaces, mixed chunks, hyphens, dotted sexual terms/slurs, and fullwidth forms. No separate security-review fixture file was found in the repository or the referenced reports directory; the QA example and systematic variants provide the regression set.
- Tests verify no inference, claim, whisper, replay intervention or research-export text on a hit, and successful sharing after editing to safe wording. Malicious story payloads cannot register or emit events.
- The authored replay pin remains unchanged; this adds input validation without changing accepted replay events.

## Section 1b: Name library rumors

- Long telling beats in the Now strip name the actual rumor using its canonical text instead of “a village rumor”. The strip already wraps text without clipping; camera insets follow its measured height.
- For a missing claim, keep the meaningful full beat instead of substituting generic gossip. Social actions such as apologies retain their compact summaries.
- A regression checks every library rumor, plus the existing missing-claim fallback case.

## Rulings

- When everybody is asleep, avoid promising an available listener; show morning guidance instead. The guide offers exploration. Cost if wrong: very late visitors wait until villagers wake rather than approaching a sleeping resident.
- A blocked typed draft will remain editable locally without registration or simulation events. It must be edited before it can spread; this prevents links and research exports from acquiring the text through the event stream.

## Per-item checks and commits

All four gates ran after each item: root typecheck, the complete root test suite, production build, and `.github/workflows/check-bundle.mjs`.

| Checkpoint | Tests passed | Gzipped game bytes |
| --- | ---: | ---: |
| Item 5 | 896 | 351,214 |
| Item 6 | 896 | 351,276 |
| Item 7 | 900 | 351,623 |
| Item 8 | 901 | 351,835 |
| Item 9 | 932 | 352,129 |
| Section 1b naming | 937 | 352,426 |
| Review fixes, before final repeat | 940 | 352,470 |
| Final verified tree | 952 | 352,470 |

The count also includes the concurrent run’s reply-guard and offline smoke tests once those entered the root suite. Item 9 and final replay inspections matched the unchanged raw pin.

Explicit staging was attempted at every item boundary using only named files and `Madhav Sunil <94164709+Maddy824@users.noreply.github.com>`. Each attempt failed with `.git/index.lock: Operation not permitted`. No commits or staged files were created by this run; all changes are left in the working tree as authorized. Generated build-info files were never included in a staging command. No assistant bylines or co-author trailers were added.

Intended separate commit subjects:

1. `23: Guide night visitors to awake villagers`
2. `23: Explain walking and whispering on the first screen`
3. `23: Focus the timeline and retire stale guidance`
4. `23: Keep phone conversations half height and time at Slow`
5. `23: Keep blocked story drafts out of shared data`
6. `23: Name stories in library rumor beats`

Review fixes belong with their respective items (5, 7 and 8). Split overlapping files by hunk when committing outside the sandbox; retain the separate run’s changes and attribution.

## Preserved work

Unrelated `bench/slm/` and `agentic/` work appeared during this session, including a reply guard inserted into the shared `ui/play.ts` file by the other run. I did not edit the protected `agentic/` directory or API `play.ts`, and preserved those concurrent additions. They must not be attributed to task 23. No files from that work were staged by this run. Concurrent root package-script, Vitest selection and CI changes also remain untouched.

## Final manual review

The separate read-only Codex review could not initialize in this sandbox. Manual diff review found and fixed an Important regression in the item 7 rail filter: custom eyewitness exchanges related to the player’s rumor needed to remain visible even though `storyBeat` alone does not classify them. A DOM regression now checks that case. A second Important edge case was fixed: older replay interventions can place the stranger inside an awake resident’s home, so the movement guard now permits leaving that starting home while still preventing entry into others. A replay regression checks the exit. Phone initial focus also moved to the close button, keeping the keyboard closed while placing focus at the first control in the existing Tab trap. No Critical code findings remain. Desktop/360 px raster and keyboard checks, including the exact previously blank signs, remain cannot-verify findings rather than claimed passes.

## Follow-up verification

Run the local desktop/360 px browser and keyboard checks outside the sandbox before release. No live service requests or paid inference are needed for these changes.

## Final result

Items 5–9 and the section 1b naming change are implemented. All four final checks pass on Node 25.8.2 after the review fixes. The last full run passed 81 test files and 952 tests; the asset gate measured 352,470 gzipped bytes against 400,000. The replay hash is unchanged. `git diff --check` passes. Browser verification, an independent Codex review and Git writes remain sandbox limitations; they are not reported as successful checks. No deployment or push was performed by this run.

Final local logs: `/tmp/rumortown-23-verified-tests.log`, `/tmp/rumortown-23-verified-build.log`, and `/tmp/rumortown-23-final-replay-inspection.json`.

STATUS: DONE
Tests: typecheck, 952 tests, production build and bundle gate passed; browser QA unavailable in the sandbox.
