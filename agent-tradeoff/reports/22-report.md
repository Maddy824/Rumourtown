# 22: A full village night

STATUS: DONE — A–D implemented, reviewed, corrected and verified; continuation recovered browser and Git access.

## A. Simulation

The day starts at 06:00 and lasts 1,440 minutes. Endings, reflection and forgetting run at the following dawn; a three-day run lasts 4,320 ticks. Snapshot, dialogue and UI clocks wrap at midnight. The local agent and research runners use the same full-day limit.

Sleep and authored night duties take priority over social pursuits and daytime needs. Rest falls to zero when a tired resident is still walking home. Sleep begins on arrival indoors. Sleepers cannot speak, hear public conversation, witness secrets or accept live/replayed whispers. Replies queued before bedtime also respect availability.

Schedule entries support optional weekdays in a repeating seven-night week. Night secrets admit only awake residents on authored night routines as witnesses. Cast order, the engine's single seeded random stream and fixed movement maths are preserved.

## B. Content and inspected replay

`content/cast/night.ts` expands every original daytime schedule and secret window by 60 minutes, retaining the authored daytime data. Ordinary residents head home at 20:30 to allow long cross-town walks, then sleep between 21:30 and 22:30. Wake times range from 05:30 to 07:00 by conscientiousness. Authored exceptions cover Rosa's inn, five rotating inn-community regulars, Dag's bridge/square lantern loop until 02:00, Rook and Cass's errands on weekdays 1 and 4, Fen's flock check, and Lio's 23:00 bridge meeting. Mira leaves home at 04:00 to have the bakery ready by 04:30; this allows actual walking time rather than moving her instantly.

Cast version is `v4` and research model version is `v4-night-1`. Older links are recognized as incompatible by the existing UI, rather than silently interpreting their ticks in the new day.

The replay was inspected before re-pinning. Reproduce with:

```sh
node agent-tradeoff/reports/22-replay.mjs /tmp/22-replay.json
```

- Old SHA-256, seed 731 with the tick-60 whisper after the old 900-minute day: `bfe954cc3d9d87c9fd6b6b11e786cdf7ddb22dc784b87615352365144f1d126e`.
- New SHA-256, the same seed and whisper after a full 1,440-minute day: `6137d96970f7a28e05e2fb37b57b9495274d1c256208d084818a336332994184`.
- 7,306 events: 1,765 actions, 3,342 lines, 2,165 belief changes, 1 whisper, 32 witnesses and 1 day end.
- At 23:00, all 27 off-duty residents sleep indoors. The nine awake residents are Ben, Rosa, Jonah, Sol, Ivo, Otto, Dag, Fen and Lio.
- The inn has 66 lines between 21:30 and 00:30, including news, defense and agreement through the normal conversation rules.
- Dag witnesses Lio's bridge meeting at tick 1020 (23:00). The baker is working inside the bakery by 04:30. Dawn is minute 360 and the ending occurs at tick 1440.

The machine-readable inspection is in `22-replay-inspection.json`. Tests retain one raw replay pin, exact event equality, sleeping-whisper rejection including forced replay, weekly rotation, indoor sleep, night witnessing, bakery preparation and the original A* secret walking allowances.

## C. Light and look

Existing daytime keyframes and all exports in `render/daylight.ts` are retained. Appended night, pre-dawn and dawn frames are sorted once; identical 00:00/24:00 endpoints preserve continuity without rewriting interpolation.

New `render/night.ts` supplies 42 deterministic paper stars with slow clock-based twinkling, a paper crescent crossing 21:00–05:00, low-alpha lighter-blend lantern glows at the inn/square/bridges, Dag's carried lantern, warm figure rims and cached river glints. Stars are absent under reduced motion. The existing full-frame daylight pass darkens figures with the scene. Window occupancy excludes sleepers; homes darken at 23:00, the inn closes at 00:30, and the bakery can light from 04:30. Arrival stars/sky and district-banner colours use the village clock.

Task 20's rendering and map work was preserved. The only index integration is the clearly marked two-line patch in `22-render-wiring.patch`, applied as the final source edit, before final checks. It calls the night painter before the existing occupied smoke/window passes and filters their shared occupancy set; deferred room-cache painting reads that same set.

## D. UI

Every full day in the timeline has a shaded 21:30–06:00 band and an accessible 24-hour/night description. Clock labels continue through midnight. Quiet nights show “The village sleeps” with “Still awake” names underneath. Nearby sleepers show a disabled “Asleep” button and never enter the selectable whisper-listener list. Added UI tests exercise quiet-night copy, awake ordering and the actual sleeping whisper-sheet state.

## Initial implementation verification

Final root checks after applying the two-line renderer wiring all pass on Node 25.8.2:

- `npm run typecheck`: pass across all workspaces.
- `npm test`: 62 test files, 753 tests pass.
- `npm run build`: pass.
- `node .github/workflows/check-bundle.mjs`: pass; 7 game assets total 342,834 bytes gzipped against the 400,000-byte limit.
- `git diff --check`: pass.

No render failures were ignored. No dependency changes. The production build emits its existing advisory about a minified chunk over 500 kB; the required compressed-asset budget passes.

Browser verification was initially blocked (resolved in the continuation below): Vite cannot bind `127.0.0.1:5192` (`listen EPERM`), and Playwright's installed Chrome aborts on launch with `SIGABRT` under this sandbox. Desktop, 360 px layout, keyboard/focus behaviour, night screenshots, the 4 ms close-zoom frame budget and browser replay hashing remain to verify outside this sandbox. Node 25.8.2 is available locally; Node 22 still needs the existing CI matrix check against the same pin. Do not infer those checks passed from the unit tests.

Git staging was initially blocked (resolved in the continuation below): `git add` cannot create `.git/index.lock` (`Operation not permitted`). No commits or pushes were made. Intended section messages are `22: run full days and protect sleep`, `22: author the village night`, `22: add night sky and lantern light`, and `22: show nights in the timeline and whisper sheet`. Commit with Madhav Sunil's prescribed attribution and explicit file paths when repository writes are available. Existing build-info files and other runs' work were preserved, including task 19A's network files and concurrent whisper-sheet additions.


## Continuation verification and rulings

The previous implementation was retained and inspected before committing. The root checks were rerun after review fixes. The review is in `22-review.md`.

Final continuation checks: root typecheck passed; **755 workspace tests in 62 files** passed (46.87 seconds on Node 25); production build and the asset gate passed at **342,834 gzip bytes**. This count includes the pre-existing untracked SEO test, which remains outside task 22. `git diff --check` also passed.

Two integration issues were fixed: awake occupancy filtering now also runs at dawn, and developer-agent whispers reject sleeping listeners before registering a claim. The agent observation also reports sleeping residents as unavailable. A real-run regression verifies that a refused whisper does not change exported state or action replay. The development renderer clock now accepts the full day. These fixes leave the inspected simulation replay hash unchanged.

Recovered browser access using an approved local Vite server and Chrome outside the restricted sandbox. Verified desktop 1280 × 800 and phone 360 × 800: night arrival/banner state, visible awake list, rendered world, no horizontal overflow, working whisper sheet, Escape close and focus restoration to Whisper, and no page errors. Screenshots: `22-desktop-night.png`, `22-phone-night.png`. External requests were blocked during these local checks; no interpretation calls or spending occurred.

Raw event replay matches **Node 22, Node 25 and Chrome**, each with 7,306 events and SHA-256 `6137d96970f7a28e05e2fb37b57b9495274d1c256208d084818a336332994184`.

Measured the warmed renderer at 40 CSS pixels/tile, 1280 × 800, device pixel ratio 1, centred near the inn at 23:00. Across 176 animation-frame samples, JavaScript draw submission p50 was 0.4 ms, p95 0.5 ms, max 1.5 ms. A further 60 frames forced a canvas pixel read after each render; flushed p95 was 3.8 ms. This meets the 4 ms target on this development Mac, not a guarantee for all phones or GPUs.

The queue had a stale task-19 status: browser interpretation was already committed as `863c47e`, so it was preserved rather than rebuilt. Unrelated `19b-report.md`, `seo.test.ts` and generated build-info files remain outside this task's commits.

Scope ruling: the requested next step is completion of task 22. Task 21 remains next; its old 07:00–22:00 clock language must be reconciled with the now-authoritative full day. Public redeployment is scheduled after task 21 by `CONTINUE.md`; this verification does not redeploy the current intermediate build.


### CI follow-up

The first pushed run exposed the new night integration test's default five-second timeout on the shared Node 25 runner. It executes two real simulations through night and dawn; all other 742 committed tests passed. Its timeout now matches the existing replay/agent integration allowance of 20 seconds. No assertions, simulation steps, replay pins or performance limits were relaxed. The local suite includes 12 pre-existing untracked SEO tests, explaining the 755 local versus 743 committed-test count.
