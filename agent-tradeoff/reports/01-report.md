# Task 8: Integration report

Status: DONE with concerns. The controller verified the integration and browser flow after the original integration worker completed. See the controller verification below; the original worker's historical commit restriction is superseded.

## What is wired

- `main.ts` defaults to `villageMap`, the 24 authored cast dossiers and claims, `createWorld`, the world module's `createMover`, a fresh `createTalk(cast)` per run, and `createSimulation({ seed, world, cast, claims, talk, interventions })`. The existing asynchronous felt renderer loader and renderer fallback remain wired through `mountApp` dependencies.
- The shell still reads and validates the seed, cast version, and interventions from the share link. Scrubbing rebuilds the real simulation with its `interventions` option. Replayed whispers use the engine's existing end-of-step timing, including tick-zero interventions during creation.
- `?fake=1` selects `createFakeMap` and `createFakeSimulation`. The stand-in now owns its small replay queue and evening events; `ui/fake-replay.ts` is deleted. `?renderer=stub` remains available independently.
- The map now uses the `smithy`, `orchard`, and `riverside` place kinds.
- The typed field is enabled only when both `VITE_API_BASE_URL` and `VITE_TURNSTILE_SITE_KEY` are set. Without both, it stays disabled with “Type your own (coming later)”. Ready-made claims remain available.
- A typed submission lazily starts Turnstile, runs the existing whisper flow and signature verifier, converts only a verified taxonomy claim to a `GameClaim`, registers it, then whispers. Existing flow failure/unsupported messages appear in the sheet. Closing, reopening, or destroying the sheet invalidates pending results and destroys the challenge widget. A failed or unsupported interpretation cannot register or whisper a claim.
- A separate RNG derived from the run seed selects one dare and two different check items without consuming simulation randomness. The dare is visible at run start in a collapsible note. Each evening card shows its evaluated status. Day 3 additionally shows `buildDebrief` paragraphs, two true/false check items with authored explanations, and the authored age notice. The card scrolls within the existing responsive card container.
- The shell pauses when the real engine finishes. The startup tick is bounded by the configured timeline, and the fixed-step loop stops attempting to advance a finished simulation.

## Contract mismatches and resolutions

| Mismatch | Resolution |
| --- | --- |
| The shell's dependency factory previously built only the fake simulation. The engine needs cast, claims, world, talk, and an options object. | Adapted that factory in `main.ts`, retaining the UI's existing `(seed, interventions)` dependency interface. Talk state is fresh on every rebuild. |
| The world exports `createMover` separately, while the engine previously duck-typed a method absent from `WorldApi`. | Added the explicitly authorized optional `WorldApi.createMover(start)` and attached the exported mover in `main.ts`. The engine uses this typed method and retains its fallback for isolated fixtures. |
| Map content still used stand-in place kinds even though the contract now has the real variants. | Replaced just the three kinds and removed the outdated comment. |
| Fake replay synthesized events outside the simulation. Real replay must follow engine timing. | Removed the wrapper and passed interventions directly to `createSimulation`. Only the explicitly requested fake mode retains stand-in replay behavior, inside `fake.ts`. |
| `Simulation` had no claim-registration operation. | Added the authorized `registerClaim(claim: GameClaim): void` to the contract, real engine, and fake implementation. No other contract definitions were changed. |
| The engine maintains both a claim map and an ordered claim list used by decisions, dialogue, and witnessing. Updating only the map would make typed claims inert. | Registration updates both structures in insertion order, rejects subjects outside the cast, and leaves existing IDs unchanged. |
| A signed API claim lacks a simulation ID, display text, and contradiction links; API interpretation confidence is not a simulation belief. | Added a pure taxonomy adapter in `sim/registered-claim.ts`. It generates canonical text and an ID from kind, subject, target, reviewed object, and severity. Valence is retained for verified input and inferred from kind when decoding a link. API confidence and user prose are not copied into simulation state. The engine's existing stranger-hearing rule still determines belief. |
| A new claim must not invent contradictory facts. | The adapter starts with no contradictions. The engine links it only to existing positive innocent alternatives whose original harmful claim has the same kind and subject. Reverse links are copied into the run-local registry/list, preserving imported cast content. |
| Version-1 share links store only `claimId`, not newly registered claim payloads. | Typed IDs carry bounded taxonomy fields and fit the existing ID validator. The engine validates and reconstructs them at the scheduled whisper tick, then registers and applies them. The shell's link filter recognizes these IDs without registering them early. This preserves `ShareState` unchanged and avoids network calls during replay. |
| Debrief content accepts an aggregate summary, while the simulation exposes events, inspections, and interventions. | Added a UI adapter for endings, repetition, remembered independent sources, telling allies, and exposure. Future interventions are excluded. The authored `buildDebrief` generates the paragraphs. |
| Dares specify target, deadline, exposure, and believer requirements, but the contract exposes only the winning day ending. | The UI checks the winning ending and its described claim/subject, the deadline, exposure events through that evening, and the last logged belief per villager with confidence above 0.6. It preserves an earlier success by evaluating historical evenings too. It does not award a target's dare merely because an unrelated claim won that evening. |
| The fake implementation continued indefinitely, while the real engine stops at day 3. | Added a no-progress guard and pause on closing the final evening card, avoiding repeated no-op stepping. |

## Verification

Run from the repository root:

- `npm run typecheck`: passed for all three workspaces.
- `npm test`: passed, 28 files and 502 tests.
- `npm run build`: passed; production assets emitted successfully.
- `git diff --check`: passed.
- `node agent-tradeoff/reports/01-smoke.mjs`: passed. This small Node script uses Vite's module loader without opening a browser or listening for HTTP/WebSocket connections, runs the actual map/cast/talk/world/engine stack for 900 ticks, and prints the output below.

New regressions cover tick-60 replay timing, share encoding/decoding, two identical real replays, typed claim registration and reconstruction, immutable imported claim data, a live walk to Mira followed by whisper/replay event equality, fake replay, the third evening, deterministic dare/check selection, target/deadline constraints, historical success, exposure, believer counts, and debrief aggregation.

The first typecheck encountered a transient renderer-test mismatch (`paintGround` versus `paintGroundSteps`) while another writer was updating the renderer. That writer's subsequent changes resolved it. No renderer file was edited or staged by this task. The final root checks include the renderer as it exists in the shared working tree.

## Pinned replay hash

Seed **731**, one intervention **`{ tick: 60, listener: 'mira', claimId: 'tom-stole-bread' }`**, exactly **900** steps. Serialization is `JSON.stringify(sim.events(0))`, UTF-8, SHA-256.

```text
37969fab5d382e233387147d50a03731979d309b36bb98086651fe89b2cc1b6b
```

`apps/rumortown/src/replay.test.ts` prints and asserts this value. The independent Node smoke script prints the same hash.

## One-day Node output

```text
Villagers: 24
Event kinds: {"line":1357,"belief":90,"whisper":1,"witness":28,"action":571,"day-end":1}
Speech acts: {"greet":245,"smalltalk":828,"farewell":242,"reactToWhisper":1,"news":33,"defend":1,"doubt":2,"agree":5}
Day-end summary: {"kind":"day-end","tick":900,"dayIndex":0,"summary":"Mira heard the stranger's story about Tom and kept it to herself; it went no further.","ending":"died"}
Replay SHA-256: 37969fab5d382e233387147d50a03731979d309b36bb98086651fe89b2cc1b6b
```

This is 2,048 events. The fixed-seed rumor dies without being passed on. The log contains one defence, but the smoke run does not establish a confrontation or that the harmful rumor itself spreads; its speech-act counts are reported without treating them as proof of that outcome. No simulation tuning was changed to force a dramatic result.

## First ten seconds and first minute

These are expectations from the wiring and clock, not browser observations or screenshots:

- A fresh run opens at tick 130, day 1 at 09:10. The stranger is in the village square, with authored villagers already following schedules. The clock, board controls, whisper postbox/prompt, timeline, and the selected dare are present. At 1×, ten uninterrupted seconds advance about 25 game minutes, to 09:35. The renderer prepares its sprite/layer caches asynchronously; exact visible composition needs the controller's browser check.
- At 1×, one uninterrupted minute advances about 150 game minutes, to 11:40. Walking to a villager and opening Whisper holds time while choosing. A nearby listener can receive a ready-made claim and react in their authored voice; typing requires the two deployment settings and a working API/Turnstile setup. At 8×, an uninterrupted run from tick 130 reaches the first evening in about 38.5 seconds. The evening card holds time until continued. Outcome depends on the seed and interventions, including stories that go no further.

## Fragile points and remaining checks

1. Browser play-testing and screenshots remain with the controller. Phone/desktop layout, focus, tags, thread toggling, scrubbing, clipboard sharing/reload, and live external Turnstile/API behavior have not been observed in a browser here. Existing client tests cover signature and failure paths; no live credentials or API deployment were required for the local checks.
2. Dare target attribution uses the existing authored day-summary wording because `SimEvent` has no per-claim verdict or winning claim ID. Changing that wording must update the adapter/tests. A qualifying outcome for a non-winning claim is conservatively not credited.
3. Debrief exploit detection is inferred from public simulation data. In particular, multiple remembered sources are an indication of apparent independence, rather than a complete audit of every teller's original evidence.
4. Typed IDs deliberately encode taxonomy, not signed envelopes or raw text. A hand-edited link can specify a valid fictional taxonomy claim just as it can specify a ready-made whisper; replay performs structural validation, not online signature verification. The live typed submission path still verifies before registration. Keep the reviewed-object vocabulary and taxonomy decoder aligned with the API if either changes.
5. Share links contain the seed and whispers, not the player's walking path or current camera/tick. The added live-walk regression reproduces the event log for seed 731, and repeated engine replays are identical. Arbitrary player paths are not exhaustively proven to leave events unchanged; player positions participate in the engine's light movement separation. A reload starts at the normal opening tick and replays later whispers on schedule.
6. The hash intentionally changes if authored dialogue, deterministic simulation behavior, or event serialization changes. Review the resulting log before repinning it.
7. Concurrent renderer work and the pre-existing/generated `tsconfig.tsbuildinfo` changes were left untouched and were excluded from the attempted integration staging.

## Commit blocker

The session permits source writes in the workspace but denies writes to `.git`, and its approval policy is `never`. After all required checks passed, the first directory-specific staging command was:

```sh
git add apps/rumortown/src/sim/types.ts apps/rumortown/src/sim/engine.ts apps/rumortown/src/sim/fake.ts apps/rumortown/src/sim/registered-claim.ts
```

It failed with exit 128:

```text
fatal: Unable to create '/Users/maddy/B2B/rumortown/.git/index.lock': Operation not permitted
```

No integration commits were created and nothing was staged by this task. The branch remains `build/village`. The verified implementation, report, and reproducible Node script remain in the working tree. Finishing the required commits needs a session allowed to write `.git`; no permission bypass was attempted.

The intended directory-specific commits all start with `08:`: simulation registration/replay; map place kinds; dare/check styles; UI whisper/debrief wiring and fake-replay deletion; main wiring and replay tests; report/smoke script; and the handoff queue status. Stage only the named integration files, excluding concurrent renderer work and build-info artifacts.

## Controller verification, 21 October 2026

Fresh root typecheck, 502 tests across 28 files, production build and diff whitespace checks pass. The separate CI asset-size gate fails at 547,983 gzip bytes versus 400,000; carried to final fixes, rather than treating the build alone as launch readiness.

Chrome desktop (1440×900) and phone (360×640) checks used the real renderer, map and engine. The first rendered scene contains walking villagers, authored speech, the 09:10 clock, dare, postbox and board controls. Initial sprite preparation briefly precedes the painted frame; the village is painted by the 2.5-second capture. Walking the stranger to Mira and submitting the ready-made “Tom stole bread” records a real intervention at tick 148. Story and threads open; phone layout has no horizontal document overflow; no page exceptions or console errors were recorded. Screenshots: `01-desktop.png`, `01-story.png`, `01-phone.png` alongside this report. The independent Node run verifies a complete evening and replay hash; physical-phone performance, clipboard permissions and live Turnstile/model calls remain owner checks.

This controller can request Git access under the current policy. The earlier worker's `.git` restriction is historical, not a code blocker. Integration is committed separately from the renderer's pending third fix round.
