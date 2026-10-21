# Task 11: expand the world and its people

STATUS: DONE

The village now has 36 fictional adults, 42 places and 2,816 tiles (64 by 44). That adds twelve residents, sixteen destinations and about 83% more map area. Four neighbourhoods organise Explore: Old village, Eastbank, Woodland and South commons. Six shared homes, pottery, boat workshop, seed exchange, reading room, posthouse, teahouse, woodland loop, community gardens, market and a second bridge connect to the existing paths. Water remains impassable. The new market has a well and planted islands.

Suri, Oren, Leela, Tavi, Edda, Arun, Bram, Nia, Vesa, Cora, Dara and Silas each have a distinct appearance, authored voice, private act, routine, relationships, ambitions, worries and social motives. Their errands and evening visits bring them into the old village. Twenty-four new authored claims pair allegations with observable alternatives. These are fictional design choices, not measured human personalities.

Explore can zoom to a neighbourhood, filter its destinations and show people who live or work there. Names are optional on the atlas to preserve readability. Player-written stories and the quiet rumor-trail view from task 10 remain available.

Validation:

- Typechecking and production build passed. The final bundle is 314,095 gzip bytes against the 400,000-byte budget.
- All 548 tests in 35 files passed on the final implementation (46.90 seconds locally). New checks cover all twelve residents speaking/moving and alternative routes when either bridge closes. Existing connectivity, interior spots, path-only door access, secret travel time, claim contradictions and full replay checks still apply. The unchanged twenty-seed, 54,000-tick spread check gets a 180-second timeout for the larger cast on CI machines.
- Five seeds across three days: zero blocked positions for villagers/player; all twelve newcomers spoke; 14,720 speech events connected original and new residents. Bridge occupancy was observed 2,575 times at the old bridge and 1,577 at the commons bridge. These are sampled occupancies, not counts of completed crossings. Reproduce with `node agent-tradeoff/reports/11-spatial-audit.mjs`.
- Chrome: physically walked to Woodland loop, Eastbank market and Community gardens; opened Suri’s full profile; verified district filtering, keyboard containment and 360-pixel layout. No browser errors. Desktop profile text widths were checked for overflow.
- New raw replay, seed 731, whisper to Mira at tick 60, 900 ticks: 6,950 events, 1,341,899 bytes; identical SHA-256 on Node 22, Node 25 and Chrome: `bfe954cc3d9d87c9fd6b6b11e786cdf7ddb22dc784b87615352365144f1d126e`.

The replay change was inspected before pinning. The expanded roster changes initial placement, seeded draws, schedules, encounters and lines; the run includes all twelve new speakers and 770 cross-group speech events. The final wording adjustment changed only 65 greeting text values, with the event sequence and all other fields identical. The expansion is explicitly cast `v3`, model `v3-neighbourhoods-1`. Older v1/v2 links announce that their whispers are omitted when opening this world; older exports need their original source revision for replication.

The previous 24-person benchmark remains labelled as historical in README. No predictive validation of human behaviour is claimed. Public hosting and npm publication remain separate launch steps. Generated build-info files remain unstaged. Screenshots: `docs/images/village-v3.png` and `agent-tradeoff/reports/11-phone-atlas.png`.
