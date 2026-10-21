# 14: A town you can read — legibility, wayfinding, flow

Owner feedback on the current build: "it's hard to look at and find the flow". A new visitor sees a uniform grid of identical red-roofed boxes with no signs, districts that exist only in data, speech bubbles floating far from their speakers, controls in four corners, and no hint of what to do first. This task fixes that without changing the felt-and-paper identity, the simulation, the replay pin, or any behaviour rule. Visual and UI only. Read `docs/superpowers/specs/2026-10-21-rumortown-design.md` section 11 for the visual tokens and section 4 for the intended flow, then the renderer (`apps/rumortown/src/render/`), the UI (`apps/rumortown/src/ui/`, `src/styles/app.css`, `src/main.ts`), the map (`apps/rumortown/src/content/map/`, including the district data from task 11) and the cast (`apps/rumortown/src/content/cast/`).

## A. Wayfinding (renderer + map data)
1. **Districts look different.** Give each district (the four from task 11) its own ground treatment and trim, using the existing tokens: Old village: cobbled paths (oat with a stitched cobble pattern) and the standard moss; Eastbank: sandy oat ground near the river, one or two paper boats at the jetty tiles, reeds along the bank; Woodland: deeper moss (darken `#6B8E4E` by about 12%) and denser tree clusters; Farmland: lighter moss with field rows and short stitched fences along field edges. Add a `district` field to the map data if it is not already per tile, and keep tile rendering cached per zoom as now.
2. **District banner.** When the player crosses into a district, a paper banner at the top centre shows the district name for 2.5 seconds (once per entry, suppressed during the first 10 seconds and under reduced motion shown without animation).
3. **Signposts.** A paper signpost sprite at each junction between districts with one arm per neighbouring destination (district name or the nearest public building), drawn at the close zoom only; at most eight signposts, placed from map data.
4. **Buildings you can tell apart.** Public buildings get a hanging paper sign with their name (Bakery, Inn, Mill, Chapel, School, Smithy, Shop) under the roof edge, and a distinct silhouette detail: bakery an awning and a chimney with a stitched smoke curl; inn a wider front with a lantern; chapel a bell; smithy a chimney with smoke; school a small bell tower; shop crates by the door; mill keeps its wheel. Homes get a small nameplate by the door ("Mira's"). Signs render at the close zoom only; at the far zoom draw a tiny icon instead.

## B. Who is talking (renderer + UI)
5. Every speech bubble gets a stitched tail pointing at the speaker's head and is anchored within 1.5 tiles of them; when the speaker is off-screen the bubble is not shown.
6. A soft paper spotlight (a pale ellipse at 25% opacity) under every villager in an active conversation; the three conversations nearest the player show at full strength, others at 50%.
7. Name labels: a small paper label with the first name under every villager within four tiles of the player, and always under the six core villagers (Mira, Tom, Ben, Ada, Rosa, Jonah). Labels never overlap a bubble; hide the label while the bubble is up.
8. Bubble text 15 px at the close zoom, at most two lines, longer lines truncated with an ellipsis and expanded on tap or hover.

## C. One control hierarchy (UI + styles)
9. **Primary action.** One Whisper button, bottom centre on phones and bottom left on desktop, the largest control on screen (postbox styling stays). Pressing it opens the sheet listing people within six tiles with their face, name, role and distance, nearest first, each with "Walk to" (auto-walks, then reopens the sheet when in range) and, when within two tiles, the ready-made claims. Nobody near: the sheet says "Nobody is close. Walk to the square or tap a name." and lists the six core villagers with "Walk to".
10. **Time strip.** Clock, speed (pause, 1×, 2×, 8×) and the three-day timeline live in one paper strip along the bottom edge on desktop and in the Time drawer on phones. Story beats appear as pins on the timeline: whisper (berry), confrontation (ink), defence (denim), apology (mustard), exposure (berry with a ring); tapping a pin scrubs to it. At most 24 pins; merge pins closer than 10 minutes.
11. **Top right.** Explore, Story, More as paper pins. "Follow a rumor" appears only after the first whisper, as a pin with a short red thread drawn on it; it is hidden before that.
12. **Top left.** Only the clock and the day. The dare moves into the opening card's footer and into Story.
13. **Running story line.** A one-line paper strip at top centre (below the banner slot) that shows the latest story beat in words with two small faces: "Mira told Ben that Tom stole the bread", "Ben defended Tom", "Mira apologised to Tom". It updates at most once every 4 seconds, fades after 8 seconds, and is empty until the first rumor event. Tapping it opens Story at that event.

## D. The first ten seconds (UI)
14. **Opening card**, shown once per browser (localStorage, guarded with try/catch), paper styled, centred: three lines with small glyphs: "Walk to someone." "Whisper a rumor." "Follow the red thread." Buttons: "Show me" and "Let me look around". "Show me" closes the card, auto-walks the player to Mira's bakery door, and opens the whisper sheet when in range. The simulation keeps running under the card.
15. **The player stands out.** A gold stitched ring under the stranger at all times, pulsing gently (not under reduced motion), and "You" stays.

## E. Explore map (UI)
16. The Explore (far zoom) view colours districts with their ground treatment, labels each district in a paper tag, marks public buildings with their icons and names, shows the player as a gold dot and the six core villagers as named dots, and lets a tap on a building or district auto-walk there and close the map.

## Rules and verification
- No simulation changes; the replay pin must not change. No new dependencies. Keep the gzip budget (under 400 KB). Keep determinism in any map-data change (no randomness).
- Keep every existing test passing; add tests for: beat-pin merging, nearby-people ordering, the opening card's one-time logic, label visibility rules, and the district-banner trigger.
- Phone first: verify the layout at 360×640 by reasoning about the CSS; nothing may overlap the Whisper button, and no horizontal scroll.
- Copy rules: sentence case, plain words, no all-caps, no middle dots, no arrows in button text.
- Commit per directory with messages starting `14:`. Write `agent-tradeoff/reports/14-report.md` with what changed, the files, the tests, the bundle size, and anything you could not verify without a browser; finish with STATUS: DONE or STATUS: BLOCKED.
