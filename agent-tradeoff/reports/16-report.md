# 16: See what’s happening

Implemented sections A–F on `build/village`. Release verification remains blocked by the bundle budget and unavailable browser access. Nothing was deployed or pushed. No simulation, cast, map, replay pin, runtime dependency or lockfile was changed.

## A. Story rail

- A persistent Now bar replaces the transient strip: two felt faces, a complete wrapping sentence at 15 px and a chevron. Long beats get a shorter complete sentence here; the full beat stays in the rail. There is no ellipsis, line clamp or retirement timer.
- Story opens a 320 px paper rail on desktop and a half-height phone sheet. The same Now bar becomes the phone handle. Drag it upward to expand, downward to lower; the Expand button also provides keyboard access. Landscape phones use the right drawer.
- Cards use the timeline’s existing engine-event summaries, newest first, with time, faces, one sentence and Show me. Small talk is excluded. Show me pans toward both current positions, frames distant participants, gives both paper rings and dims the other map figures and labels to 40% for four seconds.
- The scrollable transmission strip appears after the first whisper. Its rumor selector supports multiple rumors. Tappable faces locate people; separate branches are separated instead of implying a transmission that never occurred.
- Day-end cards and the final debrief are children of the rail, with no map-covering scrim. The rail scrolls to the ending. New beats preserve a reader’s scroll position and focused card control.

## B. Follow and quiet map

- Follow a rumor is a toggle in the Now bar. Whispering selects the rumor and turns it on. Turning it off restores normal speech and name-label rules.
- Following filters speech to the selected rumor and associated social acts. Labels show the chain and six core people, subject to the stricter phone proximity rule. The red thread draws the selected rumor’s recorded path.
- New transmissions queue camera targets in order with two seconds for each. Player walking suspends following; Following paused. Tap to resume restores it explicitly.
- The movement hint permanently retires on the first app tap or walking input, or after twenty seconds. Its position clears the postbox. The dare lives inside the rail.

## C. Phone layout

- Uses 100dvh, safe-area spacing, a canvas with touch-action: none, three top pins, Now directly beneath them, a 64 px bottom-centre postbox and Time to its right. Landscape puts the postbox at bottom right beside the drawer.
- Shows one full-strength speech bubble; phone home nameplates are hidden. Public nameplates are drawn separately from cached map art and appear only within six tiles. Names are limited to three tiles plus the rumor chain; the district banner scales to 60%.
- Phone people choices use 56 px rows with faces; cards fill the rail width. Controls and timeline targets have 44 px minimum touch dimensions. Opening cards use compact copy and portrait/landscape styling.
- Actual desktop, 360 px, 390–430 px, landscape and keyboard browser verification is still required. The automated DOM tests exercise events, not geometry or raster appearance.

## D. How it works

- More contains a five-section How it works page with the opening glyphs, research-table link, exact replay/privacy explanation and bounded AI interpretation explanation. Every section is under eighty words.
- The same five sections are in `docs/how-it-works.md`, linked from the root README. The opening guide also links to the full in-app page.

## E. Arrival and guide

- A 2.8-second denim-to-oat paper-grain sky, four layered felt clouds, falling stranger and puff form the arrival. The stranger uses the renderer’s SpriteCache composition at the in-game scale. Its landing tracks the actual camera projection as the map rises.
- Skip is present immediately; tapping skips. Reduced motion uses a 350 ms sky cross-fade with the in-game figure standing.
- Font readiness is never awaited. The lazy renderer import has a 1.5-second fallback deadline; ground and zoom textures prepare in idle slices. Actual map tiles remain visible while felt layers prepare, with Stitching the village… until ready.
- The sky carries Rumourtown, the requested agentic subtitle and Made by Madhav, who likes to hear gossip, with the GitHub link.
- Landing opens three short swipeable guide cards with Next, Back, Skip, final Walk in and Show me. Show me walks directly to Mira and opens the whisper sheet on reaching her.
- The guide repeats on visits until a day ends. Only the finished-day flag is written to localStorage, with guarded reads and writes. More offers the full guide and Replay the arrival. Other UI has no new load animation.

## F. Agentic game

- The arrival subtitle, first guide card, rail empty state and More’s About page explain that villagers act as autonomous agents with goals, routines, memory, beliefs and decisions.
- The concurrently added static About page also now states this explicitly, links `agent/environment.ts`, names `npm run agent:demo` and points to More’s developer guide. Its body overrides the game stylesheet’s scroll lock so the page can be read.
- More’s developer guide links the actual protocol source and working example. The existing felt-and-paper tokens remain unchanged.

## Verification

- Root `npm run typecheck`: passed.
- Root `npm test`: **636 passed across 51 files**, including concurrent stage 18 checks.
- Root `npm run build`: passed.
- Additional event-level presentation checks: **5 passed**, covering actual Show me callbacks and faces, Now-bar movement into/out of the phone sheet, arrival deadline/skip/reduced motion, and the guide walkthrough callback.
- New unit coverage includes card ordering, midpoint and wide-pair targeting, wrapping-only Now styles, short Now sentences, focus movement/two-second holds, phone label/sign rules, hint retirement, guide word counts and finished-day storage. Renderer tests also verify idle bootstrap readiness and redrawing both spotlight participants. Existing renderer-cache tests remain intact and pass.
- The integrated raw replay pin remains `bfe954cc3d9d87c9fd6b6b11e786cdf7ddb22dc784b87615352365144f1d126e`; no replay test or simulation file was edited. Other Node versions and real browsers were not exercised here.
- `git diff --check`: passed. Existing generated build-info files remain unstaged.

## Blockers and follow-up

1. **Bundle:** `node .github/workflows/check-bundle.mjs` fails at **592,783 / 400,000 bytes gzipped**, across 19 deployed files. Concurrent commit `4ae44b3` added the static About/search/share assets during this task. A clean temporary archive of HEAD through stage 18, without these stage 16 edits, builds to **587,041 bytes** and also fails the same checker. The share JPEG alone contributes 211,188 bytes gzipped; icons contribute roughly 45 KB. Preserve their visual quality while resolving the shared budget before release. The checker and assets were not weakened or removed to obtain a pass.
2. **Browser:** Vite cannot bind either localhost or 127.0.0.1 in this sandbox (`listen EPERM`); Chrome launched through the available Playwright installation exits with SIGABRT before opening a page. There is no available browser connector. Required follow-up is desktop and 360–430 px portrait/landscape review, touch dragging, keyboard focus and Escape, reduced motion, arrival-to-map alignment, distant Show me pairs and an entire day/debrief. No screenshot or visual pass is claimed.
3. **Commits:** staging the explicit path `apps/rumortown/src/ui/focus.ts` failed with `fatal: Unable to create '/Users/maddy/B2B/rumortown/.git/index.lock': Operation not permitted`. Nothing was staged or committed by this task. Approval escalation is unavailable. The existing owner attribution was checked as Madhav Sunil <94164709+Maddy824@users.noreply.github.com>.

Concurrent stage 17, stage 18 and controller daylight/interior module commits were preserved. Generated build-info files were already dirty on entry and are excluded from the intended commits. After the remaining gates pass, stage explicit files per directory with plain owner-attributed commits:

- `16: add the readable story rail` for the changed and new `apps/rumortown/src/ui/` files.
- `16: prepare the village during arrival` for the changed and new `apps/rumortown/src/render/` files.
- `16: fit the story to phones` for `apps/rumortown/src/styles/app.css`.
- `16: start the arrival before loading the renderer` for `apps/rumortown/src/main.ts`.
- `16: explain the autonomous village` for `apps/rumortown/about.html`.
- `16: document how the game works` for `docs/how-it-works.md`.
- `16: link the game guide` for root `README.md`.
- `16: record story rail verification` for `agent-tradeoff/README.md` and this report.

STATUS: BLOCKED

Tests: root typecheck, 636 tests and production build pass; bundle is 592,783/400,000 bytes, browser checks and commits are blocked.
