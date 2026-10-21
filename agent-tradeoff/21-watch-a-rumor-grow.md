# 21: Watch a rumor grow — slow beats you can read

Owner feedback: "it's very fast right now; I need a slower look at how one rumour grows, and to see and read it when someone goes and says it." Build on the story rail and focus mode from task 16. UI and loop only (`apps/rumortown/src/ui/`, `src/main.ts`, `src/styles/app.css`); the simulation, its line cadence and the replay pin stay unchanged, so all slowing happens in the game loop's tick rate, never in the engine.

## A. Beats in slow motion
1. A **beat** is an exchange that carries the followed rumor (or, before the player follows one, any claim the stranger introduced): a telling, an accusation, a denial or explanation, a defence, an apology, a witness exposure. Detect a beat from the engine events the rail already uses; the beat spans from the first line of that exchange to its farewell or 12 game-minutes, whichever comes first.
2. When a beat starts and the player is not paused: the camera glides to the pair (600 ms ease), both get the spotlight, everything else dims to 50%, and the loop drops to **one tick per 1.2 s** for the beat's duration, then eases back to the selected speed over 2 s. At 8x, beats still slow to one tick per 0.6 s so they stay readable. A small paper note at the bottom says "Watching Mira tell Ben" with a "Skip" tag.
3. Lines spoken during a beat appear in a **dialogue panel**: a paper strip above the Now bar on desktop and above the sheet handle on phones, showing the exchange as a short script: face, name, the full line (16 px, never truncated), one line at a time, each staying at least 3.5 s or until the player taps "Next". The panel stays 2 s after the last line, then folds away. On phones it never covers the two speakers.
4. The red thread draws between the two during the beat, and the rail gets the beat card at the same moment.

## B. Pace
5. Default speed stays the slowest comfortable: 1x = 2 ticks per second (a day in about 7.5 minutes); 2x and 8x remain; add a "Slow" option at 1 tick per second for players who want to read everything.
6. **Step**: when paused, a "Next beat" control runs the simulation at full speed until the next beat begins, then stops there with the camera on the pair and the panel open. Keyboard: period key.
7. After the player's first whisper, Follow mode turns on by itself and the first beat (the listener reacting, then telling someone) plays in slow motion with the panel open, so the opening promise "follow the red thread" is kept without the player learning any control.

## C. Reading what was said
8. Each beat card in the rail expands to show the exchange's full script (every line, with names), so a player can read any past telling.
9. The share card and the day-end card include the number of beats and the longest chain.

## Rules and verification
- No engine changes; the replay pin is unchanged. Tests: beat detection from a recorded event list; the slow-motion tick schedule (ticks per real second during and after a beat); "Next beat" stops at the right tick; the panel's minimum line time; first-whisper auto-follow. Typecheck, tests and build pass; gzip under 400 KB. Plain copy. Commits start with `21:`; no co-author lines. Report to `agent-tradeoff/reports/21-report.md`; finish with STATUS: DONE or STATUS: BLOCKED.

## D. The village keeps your clock (owner request)
10. On a fresh visit the village starts at the visitor's local time of day (the browser's time zone, `new Date()`), not at 07:00: the start tick is the visitor's minutes since 07:00, clamped to the day. Before 07:00 the village starts at 07:00; after 22:00 it starts at 20:00 (dusk, lanterns lit). The simulation stays deterministic: it always runs from tick 0 and fast-forwards to the start tick at load (900 ticks take well under 100 ms), behind the arrival sequence, so the villagers have already lived their morning when the visitor arrives at noon.
11. The share link records the start tick (`start` in `ShareState`, bump to v2 with v1 still readable, start 0), so a friend sees the same days from the same moment; interventions keep absolute ticks.
12. The clock, the daylight tint (`render/daylight.ts`), the arrival sky and the district banner all follow the village clock, so a visitor at 19:00 arrives into golden light and one at 21:00 into dusk with windows glowing. Day boundaries are unchanged (day ends at 22:00, next day starts at 07:00); the run still lasts three village days from the start.
13. A small line in the clock's tooltip and in How it works: "The village keeps your clock."

## E. Adopt the renderer's new close tile (from task 20)
14. The renderer now draws the close zoom at 40 CSS px per tile while `TILE` in the contract stays 32 and the UI still assumes 32 for bubble, label and tag anchors. Use the renderer's `project`/`unproject` for every anchor (never the constant), and add a test that a bubble anchored to a villager at the close zoom lands within 4 px of the projected head position. If a renderer accessor for the current tile size is needed, add it as an additive optional field on the Renderer interface and say so.
