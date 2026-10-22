# 32: Make the first visit simple

Implemented on `build/village`. No commit, push, deployment or browser use.

## What changed

1. The welcome has the agreed short explanation and one primary **Start a rumor** action. Quiet exploration and help remain available. Top controls read **Map**, **Rumors**, **Menu**. The postbox opens **Whisper** directly; **Talk** has its own button.
2. Whisper starts with three awake, reachable listener choices and retains the rest under **More people**. Choosing one uses the existing walk-and-reopen route, with a persistent destination and **Cancel**. Private-home interiors, sleeping people and disconnected destinations are excluded. Moving or sleeping listeners are checked again while walking. A temporarily resumed walk restores the previous playback speed on arrival or cancellation.
3. On arrival, three existing stories display their exact claim text as unselected cards. **Write my own**, the complete shared library and authored village stories remain available. Selecting a card never sends it. The listener cannot receive a claim about themselves. Typed wording, meaning/reputation preview, sharing disclosure, editing and listener invalidation, neutral fallback, moderation and a separate explicit send are preserved. Review/send and local fallback actions sit outside the scrolling content. Camera following is explained beside those actions.
4. Sending opens the selected rumor with the listener's recorded reply visible, the confirmed story, and the pronoun-appropriate hearing-is-not-believing explanation. Waiting copy tells visitors that later tellings and replies appear in Rumors. A previously paused village stays paused and offers **Resume village**. Following defaults on for the first whisper; Stop and manual takeover remain respected through later whispers. Reading speed and paths remain independent settings.
5. Rumors shows the selected claim's three newest moments first. **More detail** contains earlier moments, the selector, all-village view, optional challenge, chain and watching options. The chain calls the player **You** and explains that hearing is not believing. Supported corrections, eyewitness events and precisely matched exposure events stay connected to their selected claim. Claim-aware event keys distinguish different stories told to the same listener at one paused tick.
6. Hearing totals use retained transmission history, starting at the first matching `stranger` link in recorded order, and count unique matching recipients. Earlier same-tick tellings, repeated hearers, self-links and other claims cannot inflate the total. Rewind replaces history. Counts update on simulation ticks and sends, with no belief inspection or simulation writes.
7. Menu groups are **Play**, **Settings**, **For the curious**. How to play uses the agreed text. Research exports, comparisons, sources, arrival replay, sharing, local agent play and every developer link remain reachable. The Time control says **Paused** with the reason, preserving all speeds, timeline scrubbing, replay pins and next-event stepping.
8. Phone styles reserve the bottom control area for every sheet, compact/expanded Rumors, tags, welcome and scrim. Whisper and Talk keep their action footers outside scrolling content. Visual viewport changes adjust the panels and controls for the phone keyboard; the postbox becomes compact while typing.

## Validation

Passed on Node `v25.8.2`:

- `npm run typecheck`: all workspaces passed.
- `npm test -- --maxWorkers=1`: **78 files, 1,028 tests passed**, including the unchanged pinned raw replay hash. Duration 226.78 seconds.
- `npm run build`: production build passed. Vite retains its existing native-config and large-chunk advisory warnings.
- `node .github/workflows/check-bundle.mjs`: **356,956 bytes gzipped across 7 game files**, below the 400,000-byte budget.
- `git diff --check`: passed.

The initial parallel run found old network-sheet expectations, which were updated to use the explicit listener/composer entry and first-card focus. It also exceeded the two existing simulation speed budgets and the long replay-sample timeout under load. The fallback timing case passed when run alone; the complete single-worker run then passed every test, including both speed checks and the 20-seed replay sample. No timing thresholds or simulation files were changed.

Regression coverage includes the real simulation running through welcome, listener choice, walking, three cards, explicit send, its actual reply, restoring a prior pause, and preserving Stop on a later whisper. Additional checks cover typed confirmation and fallback, listener/text invalidation, blocked drafts, two-story selection and corrections, same-tick ordering, repeated-hearer deduplication and rewind, awake/reachable choices, Tab/Shift-Tab trapping, Escape/focus return, menu destinations and retained Time controls.

These are source and event/DOM checks. They do not measure browser layout.

## Screens to check

Browser use was forbidden for this task. The following device checks remain unverified and should be completed before release:

- Desktop, 360 px and 390 × 844: enter, Start a rumor, choose a listener, watch or cancel the walk, see all three cards, choose one and send without scrolling to discover an action. Inspect the actual reply and the line saying where later tellings appear.
- At both phone widths, open each panel: compact and expanded Rumors, Whisper, Talk, Map, Research notebook, Menu and help/developer/about subpages, Share, Time, person tags and day-end results. Confirm the postbox stays uncovered and there is no horizontal scroll. Arrival itself retains its full-screen entrance animation.
- Phone keyboard: open Write my own and Talk; focus, type, review, edit, use fallback, send, dismiss the keyboard, rotate, and verify the action footer, exact-wording preview and postbox remain usable. Check short viewports and safe-area insets.
- Keyboard: Tab/Shift-Tab, Enter/Space activation, Escape and focus return across all panels, including after walking and post-send presentation. The DOM tests cover the layer logic; native browser activation and visible focus still need a device check.
- Start both paused and playing; verify walking's temporary resume, Cancel, post-send pause/Resume village, every speed, scrub, replay pins and next-event stepping.
- Send two different stories, change the selector, open More detail, read corrections and full exchanges, locate people, toggle all-village history, rewind before the first whisper, and inspect the unique hearing count.
- Stop following, whisper again, manually move the camera, whisper again, then resume explicitly. Test reduced motion. Confirm paths and conversation reading can be changed independently and mirrored settings show the same state.

## Rulings and deferred work

- Kept listener/walk first. A story-first wizard with draft transfer across walking and renewed preview is deferred as directed.
- No believe/doubt totals or invented reactions/spread. A belief dashboard with documented thresholds and an unknown state is deferred as directed.
- Reused read-only world pathfinding for listener availability, including the existing private-home travel restriction. No simulation, API, verifier, benchmark, replay-pin or dependency changes.
- Full history means the three newest exchange moments plus older exchange moments under More detail; selecting All village stories deliberately exposes the complete village view. Selecting a rumor returns to that rumor's filtered view.
- No browser, live AI call, account change, commit or deployment was attempted. Screens above remain the release follow-up.

## Files to commit

Stage only these explicit paths. Do not stage generated build-info files or unrelated experiment outputs:

- `apps/rumortown/src/net/whisper-sheet.test.ts`
- `apps/rumortown/src/styles/app.css`
- `apps/rumortown/src/ui/app.ts`
- `apps/rumortown/src/ui/awake.test.ts`
- `apps/rumortown/src/ui/awake.ts`
- `apps/rumortown/src/ui/exchanges.ts`
- `apps/rumortown/src/ui/field-guide.ts`
- `apps/rumortown/src/ui/how-it-works.ts`
- `apps/rumortown/src/ui/opening.ts`
- `apps/rumortown/src/ui/play.ts`
- `apps/rumortown/src/ui/presentation-dom.test.ts`
- `apps/rumortown/src/ui/rumor-library.ts`
- `apps/rumortown/src/ui/rumor-trail.test.ts`
- `apps/rumortown/src/ui/rumor-trail.ts`
- `apps/rumortown/src/ui/story-beats.ts`
- `apps/rumortown/src/ui/story-rail.test.ts`
- `apps/rumortown/src/ui/story.ts`
- `apps/rumortown/src/ui/timebar.ts`
- `apps/rumortown/src/ui/tools.ts`
- `apps/rumortown/src/ui/whisper-dom.fixture.ts`
- `apps/rumortown/src/ui/whisper.test.ts`
- `apps/rumortown/src/ui/whisper.ts`
- `agent-tradeoff/reports/32-report.md`

## Final source review

Reviewed the final diff against all six build steps and the binding rules. Corrected private-home listener availability, welcome dismissal when using the visible bottom controls, paused-speed restoration after a listener walk, same-tick claim identity, the story text attached to replies in the all-village view, and authored-claim selection without a player whisper. Cancel returns focus to Whisper. The real-simulation app test and consent/history regressions pass.

Protected paths (`bench/`, `apps/api/`, `apps/rumortown/src/agentic/verifier.ts`), simulation sources, the replay pin and dependency manifests have no diff. No files were staged. Remaining review work is the explicit device/browser checklist above.

## Suggested commit message

`32: Simplify the first whisper and rumor journey`


STATUS: DONE
Tests: Root typecheck, 1,028 tests, production build, bundle gate and diff check passed; device checks remain unverified.
