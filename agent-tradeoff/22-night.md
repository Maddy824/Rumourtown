# 22: Night — a true 24-hour village

Owner request: "is there no night in this? we need those too, and better looking." Today the simulated day runs 07:00–22:00 (900 ticks) and the night is skipped. Make the village live a full day of 24 hours with a real night, in the simulation, the content and the light. Read `apps/rumortown/src/sim/types.ts` (DAY_START_MINUTE, MINUTES_PER_DAY), `src/sim/engine.ts` and `src/sim/agents/` (schedules, needs, day end, reflections), `src/content/cast/` (schedules in minutes since day start, secrets' windows), `src/render/daylight.ts` (keyframes; extend, do not rewrite), the UI timeline (`src/ui/timebar.ts`) and `src/replay.test.ts`. This changes the replay pin; inspect a changed replay before re-pinning, as the project rules require.

## A. Simulation (apps/rumortown/src/sim, src/sim/types.ts)
1. The day starts at 06:00 and lasts 1,440 ticks (`DAY_START_MINUTE = 6 * 60`, `MINUTES_PER_DAY = 24 * 60`). Day end, the ending summary, reflections and forgetting happen at 06:00. Three-day runs stay three days.
2. Night is 21:30 to 06:00. Needs: `rest` drives everyone home to sleep by 23:00 at the latest, waking between 05:30 and 07:00 by conscientiousness. Sleeping villagers are indoors, cannot be whispered to, and do not talk.
3. Night life (authored, deterministic): the inn stays open until 00:30 with four to six regulars from its community rotating by night; the bridge keeper walks a lantern loop between the bridges and the square from 22:00 to 02:00; the gravedigger and the beekeeper each have one late errand twice a week; the baker rises at 04:30 to light the oven. The innkeeper and these night walkers can hear whispers at night; night gossip at the inn uses the normal rules.
4. Secrets: existing windows shift by +60 minutes (the day now starts an hour earlier); add two night secrets (a meeting by the bridge at 23:00; the shepherd's late check on the flock) with witnesses possible only for night walkers.

## B. Content (apps/rumortown/src/content/cast)
5. Convert every schedule to the new day origin, add a `sleep` entry at home for everyone (start between 21:30 and 23:00, end at the wake time), and the night entries from item 3. Keep the existing walking-time test green with the new windows.

## C. Light and look (apps/rumortown/src/render)
6. Extend `daylight.ts` with keyframes 22:00 (dusk deepening), 23:30 (night: multiply `#1E2A4A` at 0.62, soft-light `#5B6FA6` at 0.14, vignette 0.3, windows 1), 03:00 (deepest: multiply 0.7), 05:00 (pre-dawn: cool `#8FA6D3`), 06:00 (dawn: soft-light `#F2B9A0` at 0.22, multiply 0.2), 07:00 (existing). The function must be continuous around midnight.
7. Night sky and lights on the dynamic layer: a scatter of small paper stars (seeded, twinkling slowly, none under reduced motion) and a thin paper moon that crosses the sky between 21:00 and 05:00; lanterns at the inn, the square and the bridges with a warm radial glow (additive-looking: 'lighter' blend at low alpha); windows glow only in occupied buildings until their residents sleep (homes dark after 23:00, the inn lit until 00:30, the bakery from 04:30); the night watchman carries a lantern that lights the path around him; the river carries a moon highlight. Figures at night are slightly darker with a warm rim where a lantern is near.
8. The arrival sky and the district banner follow the clock, so a night visitor falls through stars.

## D. UI (apps/rumortown/src/ui)
9. The timeline shows the full 24 hours per day with a shaded night band; the clock shows the time of day as now; the Now bar says "The village sleeps" during the night when nothing is happening and lists the night walkers under "Still awake".
10. Whispering at night: the sheet lists only awake villagers in range; a sleeping target in range shows "Asleep" and is not selectable.

## Rules
- Keep determinism: single rng, cast-order iteration, no wall clock. Update the replay test's pinned hash after inspecting the new replay (count events, confirm night sleep, confirm the inn's night gossip); state the old and new hashes in the report.
- Frame budget unchanged (4 ms at the close zoom); stars and lanterns are cheap sprites on the dynamic layer.
- All tests green; typecheck, tests, build and the bundle check pass. Commits start with `22:`; no co-author lines. Report to `agent-tradeoff/reports/22-report.md`; finish with STATUS: DONE or STATUS: BLOCKED.
