# 20: Beautiful village renderer

Implemented A–F in order on `build/village`. Application edits are confined to `apps/rumortown/src/render/`; this report is the requested exception. No UI, HTML entry point, network, simulation, map walkability, dependencies, or replay pin was edited. `src/sim/types.ts` and `RenderOptions` were not edited by this task: no additive fields were needed. Other controller work began changing simulation files later in this session; those edits were left untouched. The controller's `daylight.ts`, `daylight.test.ts`, `interiors.ts`, and `interiors.test.ts` are unchanged.

Completion is blocked on browser measurements and the UI-owned bubble offsets described below. The permitted renderer changes and scoped checks are complete; the latest root checks also encounter concurrent simulation failures. No real browser images or GPU frame measurements were possible in this sandbox.

## A. Light and time of day

- The existing `daylight(snapshot.minuteOfDay)` now drives the world. Its result and occupancy are computed when a snapshot changes. `drawDaylight` runs once over the painted world, before building signs, the You label, spotlight overlays, and red threads. Ground, roof, and figure textures are never rebuilt for tint.
- At 07:00, the supplied painter applies its pale blue soft-light tint at 22%. Noon has no multiply darkening and only about 4.6% neutral warm soft-light. At 18:00, the golden multiply pass is 10% and warm soft-light is 28%. At 20:00 denim multiply is 35%; the unchanged controller curve deepens it to 46.25% at 21:30. Section E sets the close vignette to 6%; overview uses at least 12%, increasing with the supplied dusk curve. Reduced motion uses the same clock colours with immediate snapshot changes.
- Occupied buildings show two small golden window panes near the top interior wall, with an ink mullion and a low-opacity oval halo. Occupancy includes the stranger. The inn and both edges of each square have lantern light as the window-glow value rises. Square lantern frames remain visible at noon.
- Clock-dependent ink ellipses now sit beneath trees, building footprints, signposts, villagers, and the stranger. They offset toward the lower right. The controller's 18:00 offsets are 1.5 times noon's offsets. Its original per-hour shadow opacity is preserved. Baked tree-ground shadows and the figure's extra baked contact ellipse are no longer used. Walls have a one-CSS-pixel dark contact seam.

Browser check: compare the same paused scene at minutes 420, 720, 1080, and 1290. Check that signs and thread colours stay readable while the world changes colour. Move the stranger into an empty home and back out: its windows and hearth should light and extinguish, with a brief idle-cache update allowed for furniture.

## B. Figures you can read

- Close tiles render at 40 CSS pixels. The UI still requests the contract's unchanged `TILE = 32`; renderer camera math resolves that request to 40 for drawing, projection, inverse projection, and hit testing. Explicit other zoom values retain their meaning. Section E separately adds room around the overview board.
- Figures stay anchored at the feet. Their existing body art is stretched vertically by 1.26, producing roughly 1.4-tile silhouettes, with extra offscreen headroom for hats. Core villagers retain their existing 1.1 multiplier. Hit bounds extend to 1.48 tiles above the feet. Rendered thread anchors move from 0.52 to 0.72 tiles above the feet; the You label is placed above the new head bound.
- Existing two-tone felt clothes, garment stitches, hands, props, brimmed hats, blush, eye glints, and mood mouths are retained. Hair gains an explicit pale upper-left arc clipped to its silhouette. The stranger gains a faint gold curve just inside its cloak hem.
- All looks, moods, and facings are prepared with three walk poses. Opposite feet lift on the two stepping frames; arms swing in opposite directions; the body lifts by 0, 0.04, and 0.018 source tiles. Frames derive from simulation tick plus interpolation and a per-id phase.
- Idle villagers briefly lean left or right and turn toward that side once per seeded 10–22-tick cycle, nominally 4–8.8 seconds at normal speed. The same id and tick produce the same pose without a mutable random stream. Reduced motion removes idle movement, wind, walk cycling, and the stranger's footprint pulse.

**UI-scope limitation:** DOM speech bubbles and selected-person tag strings are positioned by `ui/bubbles.ts` and `ui/app.ts`, outside the permitted edit scope. Their existing offsets still read the original camera's zoom. The renderer's own signs, You label, thread anchors, projection, and picking were adjusted, but those DOM offsets were not. The controller should review speech above a tall/core villager at 360 px width and desktop. Bubble clearance needs the effective renderer zoom and the new head extent, with the existing control-exclusion placement retained. Name labels below feet use renderer projection and continue to follow those feet. The UI's animated approach to a 32 px camera request also needs a browser check: the renderer resolves the final 32 request to 40.

## C. Buildings that feel lived in

- Existing room floor colours and floor patterns remain. The old rug-only furnishing implementation is replaced by calls to the supplied `drawInterior`, clipped inside each room and scaled to fit compact rooms. The supplied painter retains its own shape-count bound.
- Bakery: oven and glow, counter, loaves and shelf. Inn: two tables, two barrels and hearth. Chapel: three pews, altar, cloth and candle glow. School: six desks and board. Smithy: forge, anvil and block. Shop: crates, shelves and counter. Mill: round millstone, central eye and sacks. Homes: bed and sheet, table, two chairs, rug and hearth.
- Each room retains a clean floor patch plus a reusable painting surface. Occupancy changes or a window-glow change across a 0.05 step queue a small furniture repaint in idle time. The world tint never invalidates the ground cache. Unoccupied rooms have no hearth/oven/forge glow. New zooms receive their initial occupancy lighting before publication.
- Chapel and smithy keep dark slate roofs; mill roofs are thatch; school and inn use berry variations. Other roofs use berry in Old village, exact mustard/thatch in Farmland (`commons`), slate in Eastbank, and a moss/oat olive mix in Woodland. All roofs gain a fine, low-opacity fibre nap over their shingle pattern.
- Stitched pale smoke appears only over occupied homes, bakery, inn, or smithy. It uses the corresponding left/right chimney position. It is a still curl, not an additional animation.
- Homes gain a low olive flower box centered on the facade eave, with three berry/pale and mustard blossoms. Existing inn lantern and field/garden stitched fences remain. A sagging stitched laundry line with four paper, denim, oat, and mustard cloths runs above the community garden, approximately x=3–7, y=39.55, clear of its entrance. Two thin support poles anchor it.

Browser check: use the stranger or select a person indoors to fade the roof facade and inspect each furniture kind. Watch a room while someone leaves it at dusk; the ground texture must remain steady when its glow changes.

## D. Ground and nature

- Seeded darker moss ovals vary the grass; French-knot flowers and three-stroke tufts now sit above district dyes. Small warm stone ellipses have a pale upper edge. They remain sparse and entirely cached.
- Existing pebbles, cobbles, running stitches, and fuzzy path edges remain. Quiet pale patches along exposed lane edges add a rubbed appearance. Near each well, up to two adjacent path/grass tiles get shallow blue-green puddles with pale partial-ellipse reflections.
- The river gains a pale connected inner band and occasional fixed paper-ripple arcs. Existing bank reeds and the two folded paper boats at the eastern jetties remain. The dynamic current now visits only viewport tiles at close zoom.
- Tree sprites sway through a small shear around their fixed ground anchor. Crop rows are prepared once into separate field sprites and sway as complete cached pieces over the soil. Seeded cycles last nominally 6–10 seconds at normal tick speed, with offsets bounded by 2.2 CSS pixels at close zoom and smaller offsets in overview. Reduced motion draws the exact unsheared sprites; paused tick time freezes wind. No plant fibres or stalks are rasterized per frame.

## E. The board itself

- Overview layers have a separate cached paper backing, with a nominal 24 CSS pixel margin, small irregular tears every roughly seven pixels, faint border fibres, an oat cut edge, and a soft table shadow. The stitched grass sheet sits above it.
- Overview framing now reserves 36 pixels per side: 24 for paper plus 12 for table. The fit-based overview therefore becomes slightly smaller to keep the backing visible. Close view does not draw the paper backing and uses the 6% vignette. Intermediate zooms stretch the nearest prepared backing while their exact cache is built.
- Existing thread shadows are reduced to 18% ink times thread alpha. The last/newest thread is 18% thicker. Pin heads retain the bright upper-left glint and gain a second tiny lower-right reflection.

## F. Palette and chrome

- The two grass mosses are `#6B8E4E` and `darken(MOSS, 0.06)`. District dyes are reduced from 82% to 28% and restricted to grass/tree ground; they no longer paint across other ground materials. This keeps moss visible, with quiet woodland, farmland, and Eastbank differences.
- Paths retain oat and take their evening warmth from the shared golden world tint. Roof colours remain within berry `#A3323B`, slate `#3F5E8A`, thatch `#D9A531`, olive, and their existing derived shades.
- Renderer-owned building tags, direction signs, and the You label now use cached paper sprites: faint grain at 10%, a one-pixel irregular torn edge, a fine dashed inset stitch, and a mustard pin with a pale highlight dot. Text and texture are rasterized at creation/DPR changes, never in a warm frame. Direction arms are spaced 23 CSS pixels apart to fit their taller paper.
- The renderer development page's real-map driver now uses the actual 36-person cast, replacing its former 24 fake looks. `window.__dev.minute(value)` freezes a chosen light for controller review without changing simulation modules.

## Verification and frame budget

| Check | Final result |
| --- | --- |
| Requested scoped TypeScript command | No `render/` or `content/map` diagnostics; grep exits 1 because there are no matches |
| Targeted renderer/map Vitest run | 12 files, 56 tests passed |
| Root `npm run typecheck` | Passed in the earlier completed run; handoff rerun blocked by new `sim/agents/night.test.ts` TS2339 errors |
| Root `npm test` | Earlier completed run: 57 files, 707 tests passed; handoff rerun: 705 passed, 4 failed across cast/agent/research/replay files |
| Root `npm run build` | Earlier run passed; handoff rerun blocked by the same night-test type errors |
| `node .github/workflows/check-bundle.mjs` | Passed on the last produced build: 337,077 gzip bytes, 7 assets, 400,000-byte budget; handoff build could not refresh assets |
| Scoped `git diff --check` | Passed |
| Controller modules | No changes by this task; supplied painters and tests preserved |

Tests cover the controller's four requested tint times, exact 1.5x evening shadow offsets, occupancy including the stranger, tick-seeded idle poses, reduced motion, three walk frames, bounded seeded wind, interior patch refresh without whole-ground rebuilds, and all 36 prepared appearances across three walk frames without creating canvases during drawing. The existing cooperative layer test now runs at 40 px and checks its synthetic 1 ms painting-step / 3 ms idle-slice bounds. These command-recorder tests do not measure GPU raster time.

| Close zoom, 36 villagers, real canvas | Before | After |
| --- | --- | --- |
| Mean / p95 / flushed frame milliseconds | Unavailable: browser launch blocked | Unavailable: browser launch blocked |
| Required under-4-ms result | Not measured | Not measured; cannot certify the budget |

Before editing, attempted `npx vite apps/rumortown --host 127.0.0.1 --port 5200`; the sandbox rejected the loopback listener with `listen EPERM`. Also attempted the already-installed Playwright against Chrome; Chrome exited with SIGABRT, and process cleanup reported EPERM. No browser screenshots, desktop/360 px checks, keyboard checks, or before/after GPU timings are claimed. No dependencies were installed and no permissions were escalated.

Controller measurement procedure: serve the app normally, open `/src/render/dev.html?map=real&zoom=close&paused=1&note=0&dpr=1&lineup=mixed&origin=17.5,14.2`, use a 1440×900 viewport, and wait for the cached wardrobe to finish. Confirm `__dev.snapshot().villagers.length === 36`. Record `__dev.bench(600)`, `__dev.benchFlushed(300)`, and rolling `__dev.stats`, then repeat with `dpr=2`, at 360×640, and at minutes 420/720/1080/1290 using `__dev.minute(...)`. Run with motion enabled as well as reduced motion. Reproduce the baseline using stage 0 below and the same 36-person cast in a temporary benchmark harness: the old real-map dev driver itself used only 24 figures, so its default result is not a comparable baseline. If flushed timing exceeds 4 ms, profile blend passes and viewport blits before accepting the change.

## Commits, scope, and handoff

Git staging was attempted with explicit section-A renderer files. It failed with `fatal: Unable to create '/Users/maddy/B2B/rumortown/.git/index.lock': Operation not permitted`. No commits or pushes were made by this task. Changes are left in the working tree as authorized by the fallback instruction. Concurrent controller changes outside this scope were preserved; initial root failures in UI/network tests resolved during that work, and the completed root checks pass. Further concurrent simulation work began after that run. The handoff rerun fails typechecking/build in `sim/agents/night.test.ts` at lines 35, 37 and 41 (`placeId`/`act` accessed on an unnarrowed `SimEvent`), and the root test rerun has 705 passing / 4 failing tests: cast schedule, three-day agent environment, paired research runs, and the replay pin. Those files and the concurrent replay-hash work were not edited by this task.

For independent review/reversion, six incremental patches are saved in `/private/tmp/rt20-patches/20-A.patch` through `20-F.patch`. Complete renderer snapshots are in `/private/tmp/rt20-stages/0` and `/private/tmp/rt20-stages/A` through `F`. The six patches were checked and applied in order to a temporary baseline; the resulting files exactly match the final renderer. These are local handoff artifacts outside the repository. Apply patches to a clean copy in A–F order; do not apply them over the already-edited working tree. Suggested separate commit messages:

1. `20: add clock light and standing shadows`
2. `20: enlarge felt figures and seed their idle poses`
3. `20: furnish rooms and add lived-in building details`
4. `20: add ground detail and cached plant wind`
5. `20: frame the village on torn paper`
6. `20: refine moss colours and paper signs`

When commits are possible, use `Madhav Sunil <94164709+Maddy824@users.noreply.github.com>`, stage only the relevant files, and preserve human attribution. Controller follow-up: verify desktop/phone visuals and DOM bubble offsets, measure matching 36-person before/after frames, then create the six commits. The rules table in `agent-tradeoff/README.md` was left unchanged to respect the requested file scope.

STATUS: BLOCKED
Tests: 56 targeted passed; earlier root run passed 707 tests/typecheck/build; latest root rerun has 705 passed/4 failed from concurrent simulation work and night-test type errors; bundle passed on last build; browser timings and commits blocked by sandbox.
