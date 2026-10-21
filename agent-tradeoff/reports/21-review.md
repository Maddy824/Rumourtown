# Task 21 review

Independent read-only review against `21-watch-a-rumor-grow.md`, `CONTINUE.md` and `AGENTS.md`; base `f11a349`.

## Findings and disposition

- **Important, fixed:** Exchanges that first carried another claim were never reconsidered when the followed rumor appeared. Detection now returns changed exchanges; playback deduplicates them, and Next beat excludes already-relevant exchanges. The recorded Wren/Sol sequence stops at tick 128. Independent replay inspection now offers all 31 of 31 relevant exchanges.
- **Important, fixed:** Pair-only grouping lost lines when a third person joined. Participant overlap now retains greetings, changing audiences, each speaker and farewell. The recorded Mira/Rosa/Wren conversation retains all lines at ticks 103–108 and closes at 108.
- **Important, fixed:** Witnesses at the same tick shared an event ID. IDs now include observer, subject and secret identity. Simultaneous witnesses retain separate history and playback entries.
- **Important, fixed:** Equal timeline divisions drifted when local arrival produced a partial final day. Day boundaries and night shading now use absolute 1,440-tick positions and widths; the ribbon clips the final partial day.
- **Minor, deferred:** A rail refresh may restore keyboard focus from “Read the exchange” to “Show me” in `ui/story.ts`. Preserve the control type in a later accessibility pass, per the runbook's instruction to defer minor findings.

The independent reviewer rechecked all four fixes and reran 26 focused tests across four files. Final disposition: **no remaining Critical or Important findings** in the reviewed task-21 changes. Requirements A–E are met by the inspected implementation and tests; browser and deployment evidence is recorded separately in `21-report.md`.

No simulation behavior, replay pin, dependencies or API spending boundaries were changed. The share-state union and optional renderer dim level are presentation/interface changes.
