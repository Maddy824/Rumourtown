# Task 12: easier controls, developer agents and credit controls

STATUS: DONE for implementation. Phone subscription and optional paid-service activation are deferred by the owner.

## What changed

- The main controls are Explore, Follow a rumor, More, Whisper and Pause/Resume. Whisper shows a nearby count, phones retain the Time drawer, and secondary tools move into More. The dare starts collapsed. A short keyboard/touch guide explains the actions. Walking resumes paused time and returns from the rumor overview.
- More contains a developer guide with runnable commands, links to the library, the agent protocol and credit setup. A local tour planner visits the square, old bridge, Eastbank market and community gardens. It shows a persistent $0-credit notice, has a Take over button, and stops on manual walking, writing or rewind. The tour is bounded to four destinations or 600 game minutes.
- `agent/environment.ts` exposes observe, move, approach, wait and whisper tools with schemas. Each advancing call is bounded to 120 minutes, a run to 2,700 ticks and 2,000 actions. Observations show nearby public state; evaluator research exports expose hidden state separately. Invalid calls do not mutate the simulation. Replay includes player actions and checks model/cast versions.
- `npm run agent:demo`, `agent:serve` and `agent:replay` provide a working example, JSON-lines controller bridge and exact replay. No new dependency or model call is involved. These are a local scripted policy and an adapter, not a hosted LLM agent or an MCP server.
- Optional interpretation is disabled by default. Its default daily allowance is $0.019, with a hard $7 lifetime live cap including historical spend and outstanding reservations. The $2 development key and $1 headroom remain external account settings. Provider price caps exclude more expensive routes and per-request surcharges. A cost above reservation freezes further dispatches.
- Before uncached inference, the Worker requires a successful ntfy message receipt. Missing, failed, redirected or timed-out alerts release the unused reservation and prevent inference. Notifications contain a request ID and reserved maximum, not player text or identity. Receipt means service acceptance, not confirmed phone delivery. Cache hits do not notify or invoke a model.
- `npm run alerts:setup` prepares a private topic in ignored `.env.alerts`; `--test` sends a single push test without AI usage. The owner selected phone push, then chose to set it up later. No test push, paid inference, deployment or purchase was performed. Paid AI remains off; the current writing form remains local.
- Updated optional interpreter cast data to all 36 people and refreshed deployment, architecture and owner notes.

## Verification

- Root typechecking, full tests, production build and asset gate pass: 566 tests in 36 files; 316,315 bytes gzipped against the 400 KB limit.
- New tests cover exact agent replay, no hidden-state leakage, non-mutating failures, action/tick limits, detached observations, 365-day budget pacing, lifetime holds across days, overcharge freeze, disabled inference, and notification-before-dispatch/failure/timeout behaviour.
- At default pacing, 365 fully used daily allowances total exactly $6.935 in integer ledger units. The $7 lifetime stop does not reset at New Year. These are application checks; provider account limits still require deployment configuration.
- The CLI demo completed at tick 532. Replay research JSON is byte-identical in Node 22 and Node 25. Chrome's normalized JSON hash matches both: `12abe27b165a018b11248f2461326d2a256c5cbcea271f2100fa39252afd34d0`.
- The original simulation pin is unchanged: `bfe954cc3d9d87c9fd6b6b11e786cdf7ddb22dc784b87615352365144f1d126e`. No NPC update rules changed.
- The browser tour completed all four destinations and stopped at the community gardens, with no sampled player position on water.
- JSON-lines smoke verified schema discovery, movement, time advancement, malformed JSON recovery and replay export.
- Chrome at 1440 × 900 and 360 × 740 verified visible primary controls, pause/resume, automatic walking resume, modal keyboard trapping/return, notebook/share access, developer panel, agent notices and manual takeover. The local agent made no external network requests. No browser errors remained. A browser-only module-namespace serialization issue in research export was caught and fixed by serializing the export to plain JSON.
- Screenshots: [phone controls](12-phone-controls.png), [phone agent](12-phone-agent.png), [developer guide](12-developers.png).
- `.env.alerts` is ignored and contains no AI credentials. Generated build-info files remain unstaged.
- Initial GitHub CI passed every check on Node 22. Node 25 completed all assertions but exceeded Vitest's five-second default on a pre-existing two-run typed-replay case (6.4 seconds). Bounded replay and agent integration suites now allow 20 seconds per case; the longer seed-sample test retains its own limit. Event assertions, replay pins and separate performance thresholds are unchanged.

## Remaining setup

The owner will install ntfy, subscribe to the locally saved private topic, and confirm a test notification later. The optional Worker still needs production secrets, capped provider keys and deployment before phone alerts accompany real inference. Building the repository does not activate any paid service. A developer who connects an independent paid LLM controller must bring its calls under a budget; this adapter does not meter external harnesses.

For a future session, use [the agent guide](../../docs/agents.md) and [credit/phone setup](../../docs/credit-controls.md). Keep commits attributed to the owner and preserve the existing generated files.
