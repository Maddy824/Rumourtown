# 14: A town you can read

Implemented the front-end brief in order A, B, C, D, E on `build/village`. The felt-and-paper identity and existing colour tokens remain. No simulation, cast, behaviour rule, dependency, map walkability or replay-pin change was made.

A. Wayfinding: added presentation-only district metadata for every visual tile and six junction signposts. Old village paths have stitched cobbles; Eastbank has sandy ground, the existing reeds and two folded boats; Woodland has deeper moss and additional crowns around existing trees; Farmland has lighter moss, field rows and short stitched fences. Grounds and signs remain in the per-zoom caches. Added named hanging public-building signs, small far-view icons, bakery awning and smoke, smithy smoke, inn lantern, shop crates and door-side home nameplates; existing bell towers and mill wheel remain. District entry banners last 2.5 seconds, suppress the first ten seconds, and respect reduced motion.

The fourth task-11 district is stored as `commons`, named South commons in the simulation map. Its UI name is Farmland, as requested by this brief. The original district ID, places and tile data remain intact. Tile district fields live in a separate presentation table so the replay map does not change.

B. Speakers: bubbles have stitched SVG tails to the speaker's head, hide off-screen and retire when placement would put their tail more than 1.5 tiles away. Close-view text is 15 px and clamped to two lines; hover, tap, Enter or Space expands it. Active conversations have paper ellipses at 25% opacity, with conversations after the nearest three at half strength. Nearby villagers and all six core villagers get paper first-name labels; a visible bubble suppresses its speaker's label, and labels avoid other visible bubbles.

C. Controls: restored the large postbox Whisper action, centred on phones and at the left on desktop. Its sheet lists people within six tiles by distance, with face, name, role, distance and Walk to. Within two tiles it offers ready-made claims and retains local writing. With nobody within six tiles it uses the exact empty copy from the brief and offers all six core villagers. Walking reopens the sheet in whisper range. Clock, speeds and the three-day timeline share a paper strip on desktop and the Time drawer on phones. Timeline beat pins use the requested colours, merge neighbours less than ten minutes apart, retain at most 24 groups and scrub on activation. Explore, Story and More are top-right pins; Follow a rumor is hidden until an actual whisper and has a small red thread. The top left contains only the clock and day. The dare is in Story and the opening footer. The running story has two faces, a four-second update limit, an eight-second fade and a link to its event in Story. Exposure summaries use existing relationship events; denials are worded as denials.

D. Arrival: a centred paper opening card is claimed once using guarded localStorage. Both required buttons and all three instructions are present. The simulation keeps running. Show me walks to the bakery door, then approaches Mira if she has moved and opens the sheet in range. The player has a persistent gold stitched ring, gentle pulse outside reduced motion and the You label. When storage is unavailable, the card still works but cannot persist its dismissal across visits.

E. Explore: the atlas uses district ground patterns and paper district tags, public-building icons and names, a mustard player dot and six always-named core dots. Building footprints, building tags and district tags send the player to their door and close Explore. Existing neighbourhood filters allow a closer view; destination buttons provide keyboard travel.

Files changed:

- `apps/rumortown/src/content/map/`: new `wayfinding.ts` and `wayfinding.test.ts`.
- `apps/rumortown/src/render/`: `buildings.ts`, `index.ts`, `roofs.ts`, `tiles.ts`; new `wayfinding.ts`, `conversations.ts` and `conversations.test.ts`. Updated the canvas doubles in `index.test.ts` and `layer.test.ts` to implement the standard `measureText` API used by the signs.
- `apps/rumortown/src/ui/`: `app.ts`, `bubbles.ts`, `field-guide.ts`, `story.ts`, `timebar.ts`, `whisper.ts`; new `district-banner.ts`, `name-labels.ts`, `opening.ts`, `story-beats.ts` and their tests, plus `whisper.test.ts`.
- `apps/rumortown/src/styles/app.css`: paper labels, tails, banner, running story, opening card and the desktop/phone control hierarchy.
- `agent-tradeoff/README.md` and this report.

Verification:

- Root `npm run typecheck`: passed across all workspaces.
- Root `npm test`: 44 test files, 595 tests passed. Includes beat-pin merging and cap, nearby-person ordering and range, one-time opening logic and denied storage, label visibility, district-banner entry suppression and re-entry, map metadata immutability, conversation grouping and the existing renderer cache/performance checks.
- The unchanged raw replay SHA-256 assertion passed: `bfe954cc3d9d87c9fd6b6b11e786cdf7ddb22dc784b87615352365144f1d126e`. This run used Node 25.8.2; Node 22 and browser replay checks were not repeated.
- Root `npm run build`: passed.
- `.github/workflows/check-bundle.mjs`: 322,893 bytes gzipped across 8 deployed files, below the 400,000-byte budget.
- `git diff --check`: passed.

At 360×640, CSS reserves a 136 px wide Whisper action at horizontal centre, a separate 66 px Time tab on the right and a 124 px bottom clearance for sheets, tags and Explore. Top pins wrap in the space beside the compact clock; the thread pin can occupy a second row. Banner and story slots sit below that group. Existing overflow containment remains; flexible children use bounded widths. Sheets scroll internally. Desktop retains the left postbox and bottom time strip. Code review covered native buttons/radios/range controls, visible focus, modal Tab trapping, Escape and focus restoration; bubble expansion also supports Enter and Space.

Browser follow-up: visually inspect desktop and 360×640, actual text wrapping and atlas label crowding, hover/touch expansion, Show me and moving-villager arrival, timeline scrubbing and keyboard travel. Browser verification was attempted, but Vite could not bind `127.0.0.1:5194` (`listen EPERM`) and Chrome launch exited with `SIGABRT` under the sandbox. No screenshots or live keyboard results are claimed.

Commit blocker: `git add --dry-run apps/rumortown/src/content/map/wayfinding.ts apps/rumortown/src/content/map/wayfinding.test.ts` failed with `Unable to create '/Users/maddy/B2B/rumortown/.git/index.lock': Operation not permitted`. The session grants read-only access to `.git`, and approval escalation is unavailable. No staging or commits were possible. The intended directory commits, after the passing verification, are:

- `14: add district presentation data` for the two named files in `src/content/map/`.
- `14: make the felt village legible` for the explicitly listed renderer files.
- `14: guide whispers and the village story` for the explicitly listed UI files.
- `14: give the controls a paper hierarchy` for `src/styles/app.css`.
- `14: record legible village verification` for `agent-tradeoff/README.md` and this report.

Use `Madhav Sunil <94164709+Maddy824@users.noreply.github.com>` for these commits and stage only those paths. Existing generated build-info changes remain unstaged; the unrelated untracked task-15 brief is preserved.

STATUS: BLOCKED
