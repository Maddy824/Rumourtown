# Task 22 review

Read-only review of the task-22 working changes against `22-night.md`, `CONTINUE.md` and `AGENTS.md`, followed by fixes and verification by the controller.

## Findings and disposition

- **Important, fixed:** `render/night.ts` returned before filtering awake occupancy at dawn. Homes could regain window light while residents still slept. Filtering now precedes the night-strength return; a dawn regression covers it.
- **Important, fixed:** `agent/environment.ts` advertised sleeping residents as whisperable and could register a claim before a sleeping listener rejected it. Failed calls were omitted from replay, leaving unrecorded state. Both observation and pre-registration validation now check sleep. A real-world regression verifies failed whispers preserve the research export and exact action replay.
- **Minor, fixed:** `render/dev.ts` clamped the diagnostic clock to 07:00–22:00. It now wraps finite minutes across the full day and ignores non-finite input.
- **Minor, deferred:** `sim/talk/context.ts:78` and topic selection in `sim/talk/index.ts:194` classify 00:00–05:59 as morning, so overnight conversations can use morning greetings/topics. A future night-dialogue content pass should add overnight selection or retain evening dialogue until dawn, with content tests and replay inspection. Sleep, availability and night activities are unaffected; task 22 does not require a new dialogue taxonomy.

No unresolved Critical or Important findings in the reviewed code.

## Requirement coverage

| Area | Result |
| --- | --- |
| A1: 1,440-tick days, dawn ending/reflection/forgetting | Met; three-day runs use 4,320 ticks. |
| A2: Indoor sleep, trait-based waking, unavailable sleepers | Met with explicitly authored night-duty exceptions. |
| A3: Inn rotation, patrol, twice-weekly errands, baker | Met; reviewer independently inspected seven days at seed 731. |
| A4: Shifted secrets, two night secrets, night witnesses | Met. |
| B5: Converted schedules and walking windows | Met; automated walking checks pass. |
| C6: Extended light keys and midnight continuity | Met. |
| C7: Stars, moon, lanterns, windows, watchman, river and rims | Implemented; browser evidence and timing recorded in `22-report.md`. |
| C8: Arrival and district banner follow clock | Met; night state verified in desktop/phone browser. |
| D9: Full-day timeline, night band, quiet copy, awake list | Met. |
| D10: Awake listeners and disabled sleeping targets | Met in UI and corrected developer-agent integration. |

Simulation ordering and seeded randomness are preserved. No dependency or API money-boundary changes. The old/new replay hashes and inspected differences are recorded in the task report; the new raw hash matches Node 22, Node 25 and Chrome.
