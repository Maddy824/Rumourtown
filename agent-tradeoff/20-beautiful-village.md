# 20: Beautiful to look through — art direction pass for the renderer

Owner request: "make the graphics better; it should look beautiful to look through." The felt-and-paper identity and tokens stay. What changes is light, depth, scale and detail. Work in `apps/rumortown/src/render/` (and `apps/rumortown/src/content/map/` for decoration data only). No simulation changes, no replay-pin change, no new dependencies; the 4 ms frame budget at the close zoom with 36 villagers still holds, so cache everything that does not move per frame. Do the sections in order; each is independently shippable.

## A. Light and time of day (the single biggest change)
1. A sky-light tint that follows the clock: 07:00 cool and pale, 09:00 to 16:00 neutral, 17:00 to 19:00 golden (warm multiply at low opacity), 20:00 to 22:00 dusk: a deep denim overlay at about 35% with a soft vignette, and warm window glow in occupied buildings and lit lanterns at the inn and square. Implement as one or two full-canvas fills with blend modes over the cached layers, computed from `minuteOfDay`; never re-rasterise layers for the tint. Reduced motion: still tints, just no transitions.
2. Soft directional light from the top-left: paper drop shadows under every standing piece (buildings, trees, signposts, figures: an offset ellipse at 18% ink) and a one-pixel darker seam where walls meet the ground. Shadows lengthen slightly toward evening (offset grows 1.5x after 17:00).

## B. Figures you can read
3. Raise the close zoom tile size from 32 to 40 CSS px and draw villagers about 1.4 tiles tall, anchored at the feet; keep the far zoom as is. Re-tune bubble, label and tag anchors for the new size.
4. Richer felt figures: stitched outline, two-tone body (top and bottom), visible hands and the prop, hair silhouette with a highlight, hats with brims, a soft blush, eyes and a mood mouth, three-frame walk with a gentle bob; core villagers keep the 1.1x scale. The stranger: ink hood with a faint gold inner glow at the hem.
5. Idle life: standing villagers occasionally shift weight or turn their head (every 4 to 9 seconds, seeded from the tick so replays match); nothing under reduced motion.

## C. Buildings that feel lived in
6. Interiors as felt cut-outs per building kind: bakery (oven with a warm glow, counter, shelves with loaves), inn (tables, barrels, a hearth), chapel (pews, altar), school (desks, a board), smithy (anvil, forge glow), shop (crates, shelves), mill (millstone, sacks), homes (bed, table and two chairs, a rug, a hearth). Draw as a few rounded shapes with stitched edges; keep each interior under 12 shapes.
7. Roofs vary by district and kind: berry, slate, thatch and olive, each with a felt nap pattern; chimneys with a stitched smoke curl when the building is occupied; flower boxes on homes; lanterns at the inn and the square; a laundry line in the farm district; low stitched fences along fields and gardens.

## D. Ground and nature
8. Two-tone grass with scattered flower tufts and small stones; paths with pebble marks and worn edges; a shallow puddle or two near the well; the river with a lighter inner band and occasional paper ripples; reeds and two paper boats at the jetty stay.
9. Wind: trees and crops sway slowly (a few pixels, 6 to 10 s period, seeded), only on the dynamic layer, not under reduced motion.

## E. The board itself
10. At the far zoom the whole village sits on a paper board: a 24 px torn-paper margin and a soft vignette so it reads as a diorama on a table; at the close zoom only the vignette (very subtle, 6%).
11. Threads: a faint shadow under the red thread and pin heads with a highlight; newest thread slightly thicker.

## F. Palette and chrome
12. Refine the palette within the tokens: grass in two mosses (`#6B8E4E` and a 6% darker sibling), oat paths slightly warmer at dusk, roofs from berry `#A3323B`, slate `#3F5E8A`, thatch `#D9A531` and olive (a mix of moss and oat). Paper UI elements get a faint paper texture and a one-pixel torn edge on tags; pins get a highlight dot.

## Verification
- Keep all tests green; add tests for the tint function (values at 07:00, 12:00, 18:00, 21:30), the shadow offset by hour, and that idle animations are seeded (same tick, same pose).
- Measure and report frame time at the close zoom with 36 villagers before and after; stay under 4 ms on the dev machine.
- You cannot see the result; describe each visual change precisely in the report so the controller can verify in a browser, and keep each section in its own commit so any one can be reverted. Commit messages start with `20:`; no co-author lines. Report to `agent-tradeoff/reports/20-report.md`; finish with STATUS: DONE or STATUS: BLOCKED.
