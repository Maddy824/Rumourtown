# Task 21: Watch a rumor grow

STATUS: IN PROGRESS — implementation, independent review and final verification complete; deployment underway.

## Changes

- Read-only exchange tracking groups introductions, greetings, tellings, responses, accusations, defences, apologies, farewells and relevant witness exposures. Groups close at farewell or twelve game minutes from the first observed line. Full scripts remain expandable in the story rail.
- A 600 ms camera glide and 50% scene dim spotlight the speakers. A red thread connects the pair; a paper dialogue panel above Now shows one full 16 px line at a time. Lines stay at least 3.5 seconds unless Next is used; the final line remains two extra seconds. Pause freezes reading. Skip retires the current presentation. Expanding phone history hides the live panel so it cannot cover the history.
- Slow runs at one tick/second; 1× at two, 2× at four, 8× at sixteen. Open exchanges slow to one tick per 1.2 seconds (0.6 seconds at 8×), then ease back over two seconds. The panel can finish its reading queue after the exchange closes.
- A paused Next beat button or period key advances in bounded browser chunks and stops on the exact next relevant tick with the script open. The first whisper enables Follow automatically. Walking and turning Follow off release the presentation.
- Share and ending cards include beat count and longest chain. Counts exclude village chatter before the player introduced its claim. Longest chain means the deepest chronological first-arrival route from the stranger; loops and repeated tellings cannot inflate it.
- Fresh visits fast-forward deterministically from tick zero to the visitor's local clock. v2 share links retain that start; v1 links remain readable at start zero. Interventions retain absolute ticks. The visit ends exactly 4,320 ticks after arrival, with dawn cards at the unchanged boundaries.
- Bubble and tag anchors project world-space sprite-head coordinates; labels already project their positions. The camera uses the renderer's 40 px close zoom. No renderer accessor was needed.

## Rulings

Task 22's 06:00-origin, full 1,440-minute day supersedes task 21's older 07:00–22:00 description. At two ticks per second an uninterrupted full day is twelve minutes; the task's older 7.5-minute estimate described the shorter day. Midnight arrivals stay at midnight.

A conversation becomes identifiable as a rumor exchange when its first relevant event arrives. Buffered greetings are included in its script and twelve-minute bound; no future engine state is inspected. Group conversations retain all participants' lines while keeping a primary camera pair.

`main.ts` passes the engine's existing optional `days` setting to allow the final partial calendar day. The simulation algorithms, event cadence and replay pin are unchanged. A final visit card at a non-dawn endpoint identifies its judgment as the last dawn's summary.

The only changes outside UI/main/styles are the v1/v2 `ShareState` type and an optional renderer spotlight dim value plus its one-line use. No new dependencies, API changes, secrets changes, paid interpretation requests or spending-limit changes.

## Review

See `21-review.md`. All four Important findings were fixed and independently rechecked. The Minor rail-focus restoration finding is deferred under `CONTINUE.md` section 7.

## Verification

Browser checks passed in Chrome at 1280 × 800, 360 × 800 and 360 × 640: first-whisper auto-follow, Next advances dialogue, pause freezes reading, period stops at tick 78 and remains paused, full scripts expand in the rail, and no horizontal overflow or page errors. Both speakers remain above the dialogue panel; the panel clears the Whisper postbox. A live preset whisper through the phone sheet succeeds. External requests were blocked, so no interpretation calls occurred. Screenshots and replayable browser scripts are included beside this report.

Fresh 19:00 and 00:00 arrivals start at ticks 780 and 1080 with the corresponding clock/arrival-night state. An accelerated presentation clock verified dawn cards at 1440, 2880 and 4320, then the visit card at exactly 4380 for a 07:00 arrival; further frames do not advance the finished visit. v2 shares preserve start 900 in the evening case. The raw Chrome replay remains `6137d96970f7a28e05e2fb37b57b9495274d1c256208d084818a336332994184`.

Final root checks passed: typecheck, **777 tests in 65 files**, production build, compressed asset gate (**346,236 bytes**, below 400,000), and `git diff --check`. The committed suite excludes the 12 unrelated untracked SEO tests: 765 tests in 64 files. Existing Vite advisories about native config loading and the minified chunk size remain; the required gzip gate passes.

Unrelated `reports/19b-report.md`, `src/seo.test.ts`, and generated build-info changes are preserved outside task 21's commits. The local suite includes 12 tests from that pre-existing untracked SEO file.
