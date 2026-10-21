# How the research feeds Rumourtown

Research outputs feed the game and its evaluation tools. “Implemented” describes repository code; deployment versions and live behavior need separate verification.

| Research output | Use in the game | Status |
|---|---|---|
| Epistemic verifier (`apps/rumortown/src/agentic/verifier.ts`) | Runtime guard for model conversation replies: sentences labelled unsupported or contradictory are dropped; an ignorance reply is used when none remain (`agentic/guard.ts`). The heuristic can miss errors; see [known limits](verifier-notes.md). | Implemented |
| Orchestrator (`agentic/orchestrator.ts`) | Moves, visits, provenance and news answered from simulation state with no model call. | Implemented |
| Smallest faithful model per route | Choose the model per route by measured faithfulness and latency, not by size; if a fine-tuned 1.7B model holds up, run it in the browser (WebLLM) for $0, offline, with no hourly limits. | Pending the baseline run |
| Break points per stress axis | Production limits: facts sent per reply, conversation length before summarising, resistance to player pressure. | Pending |
| Attack set from the red team | Regression tests against the live endpoints, including instructions hidden inside rumors. | Pending |
| State-verified cascade | Small model first, large model only when the guard rejects the reply; lower latency and cost. | Pending |
| Calibration results | Villagers hedge in proportion to their confidence ("I heard, maybe…"). | Pending |
| Released benchmark and dataset | Other developers can test their own characters; the `rumormind` library gains `verifyReply()`. | Pending |
