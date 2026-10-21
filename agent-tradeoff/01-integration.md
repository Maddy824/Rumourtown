## Task 8: Integration (after Tasks 1–7)

Directory: `apps/rumortown/src/main.ts` plus minimal fixes anywhere in `apps/rumortown/src` needed to make the modules agree.

1. Wire the real modules: `villageMap`, `createWorld`, `cast`, `claims`, `createTalk`, `createSimulation`, `createRenderer`, and the UI. The fake remains available behind `?fake=1`.
2. Resolve contract mismatches with the smallest change; record each in the report.
3. Add `apps/rumortown/src/replay.test.ts`: a fixed seed with one whisper at tick 60 run for 900 ticks produces a stable event-log hash; print the hash so it can be pinned.
4. Play-test with Playwright: load, walk to Mira, whisper "Tom stole bread", run a day at 8×, open tags, toggle threads, scrub, copy a link, reload it. Report what a stranger would see in the first ten seconds and the first minute, with screenshots.


## Integration notes from the controller (binding)

- Attach the world module's `createMover` to the world object passed to `createSimulation` (the engine duck-types `opts.world.createMover`), or add an optional `createMover?` to `WorldApi` in the contract and use it; either is acceptable, say which.
- Delete `apps/rumortown/src/ui/fake-replay.ts` and replay through the real engine's `interventions` option; a whisper at tick T applies at the end of the step that reaches T.
- Keep `?fake=1` working with `createFakeSimulation`.
- Switch the map's stand-in place kinds to the real ones now in the contract: `smithy`, `orchard`, `riverside`.
- Wire the whisper client (`apps/rumortown/src/net/`) behind the whisper sheet's text field only if `import.meta.env.VITE_API_BASE_URL` and `VITE_TURNSTILE_SITE_KEY` are set; otherwise the field stays disabled with its "coming later" label. A verified claim is registered with the simulation before whispering: add `registerClaim(claim: GameClaim): void` to the `Simulation` contract and the engine (a new claim about a cast member, with its `contradicts` left empty unless the taxonomy maps it to an existing innocent alternative by kind and subject).
- Wire the debrief data (`apps/rumortown/src/content/debrief/`): show `buildDebrief` on the day-3 summary card with two check items; show one dare at run start and evaluate it at each day end.
- The replay-hash test pins the hash it prints; include the hash in the report.
- Play-test (item 4) is done by the controller in a browser after the wiring lands; do the rest.

## Context for a fresh start

Everything the integration needs already exists and is tested:
- `apps/rumortown/src/content/map/index.ts` exports `villageMap`; `apps/rumortown/src/sim/world/index.ts` exports `createWorld(map)` and `createMover(start)`.
- `apps/rumortown/src/content/cast/index.ts` exports `cast`, `claims`, `castVersion`.
- `apps/rumortown/src/sim/talk/index.ts` exports `createTalk(cast)`.
- `apps/rumortown/src/sim/engine.ts` exports `createSimulation(opts)` (check `apps/rumortown/src/sim/agents/` for its helpers).
- `apps/rumortown/src/render/index.ts` exports `createRenderer(canvas, map)`.
- `apps/rumortown/src/ui/` and `apps/rumortown/src/main.ts` mount the app against `createFakeSimulation` today through a `deps` object: `mountApp(root, { createSim, createRenderer, map })`.
- `apps/rumortown/src/net/` is the whisper client; `apps/rumortown/src/content/debrief/` holds debrief paragraphs, check items and dares.

Done when: `npm run dev` shows the real village with the 24 named villagers following schedules and talking in their own voices; a whisper of a ready-made claim leads to visible gossip and, within a day at 8×, a confrontation or defence; a copied link reproduces the run; `apps/rumortown/src/replay.test.ts` passes with its printed hash pinned; typecheck, tests and build pass; the report lists every contract mismatch you resolved and what a stranger sees in the first ten seconds and first minute.
