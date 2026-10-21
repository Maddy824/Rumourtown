# Architecture

Rumourtown separates a dependency-free behaviour library, a browser simulation and an optional AI Worker. The shared game contract is [apps/rumortown/src/sim/types.ts](../apps/rumortown/src/sim/types.ts). Modules exchange typed commands, snapshots, inspection views and ordered events through that contract.

## Module map

```text
+--------------------------+    +---------------------------+
| content/                 |    | packages/rumormind        |
| cast, map, claims, lines |    | belief, trust, gossip,    |
|                          |    | mood, retelling, repair   |
+-------------+------------+    +-------------+-------------+
              |                              |
              v                              v
       +---------------------------------------------+
       | apps/rumortown/src/sim/types.ts              |
       | Simulation, WorldApi, TalkApi, Renderer,    |
       | WorldSnapshot, Inspection, SimEvent,        |
       | Intervention, ShareState                    |
       +----------+---------------------+------------+
                  |                     |
                  v                     v
+-----------------------------+  +--------------------------+
| sim/engine.ts and agents/   |  | render/ and ui/           |
| world/, talk/               |  | canvas, bubbles, tags,   |
| schedules, needs, decisions |  | controls, story, sharing |
+-----------------------------+  +--------------------------+

+-----------------------------+  +--------------------------+
| apps/api                    |  | Optional browser client  |
| interpret, validate, sign,  |  | structured claim input   |
| prices, BudgetLedger       |  | for the simulation       |
+-----------------------------+  +--------------------------+
```

Paths such as `content/` and `sim/` above are under `apps/rumortown/src/`.
The library owns no schedule, renderer, browser state or network access. The game
owns the world and agent lifecycle. `WorldApi` supplies pathfinding, places and
visibility; `TalkApi` selects authored lines. The renderer reads snapshots, while
the interface issues `movePlayer` and `whisper` commands and reads `inspect`,
`events` and `interventions`.

`main.ts` mounts the real engine, world, talk and renderer by default; `?fake=1` selects the UI fixture. Confirmed open stories become local claims; optional `/rumor` annotations can describe their social meaning. The Worker is disabled in local defaults and enabled in its production environment.

The headless `agent/environment.ts` adapter provides bounded tools over the same engine. Ordinary agent observations expose nearby public state; research exports expose hidden state separately. The browser also has a local tour planner with a visible usage notice and manual takeover. See [the agent interface](agents.md).

## One simulation tick

A tick is one game-minute. A day contains 1,440 ticks, from 06:00 to the
following dawn, including sleep and night activity. The tick counter continues
across days. The browser starts at the visitor's local time, or the shared
starting offset in a replay; the local clock is read outside the simulation.
The default browser run spans three days from that offset.
The interface controls playback speed and interpolates drawing between snapshots.
Those frame updates do not advance beliefs independently of `step()`.

```text
+---------------------------+
| step(): increment tick    |
+-------------+-------------+
              |
              v
+---------------------------+
| Update schedules          |
| Score due agent decisions |
+-------------+-------------+
              |
              v
+---------------------------+
| Move villagers and player |
| Re-path moving targets    |
+-------------+-------------+
              |
              v
+---------------------------+
| Witness acts              |
| Advance conversations     |
| Update beliefs and ties   |
+-------------+-------------+
              |
              v
+---------------------------+
| Update needs              |
| Expire mood and bubbles   |
| End-day work when due     |
+-------------+-------------+
              |
              v
+---------------------------+
| Apply interventions at T  |
| after the step to T       |
+-------------+-------------+
              |
              v
+---------------------------+
| snapshot(), inspect(),    |
| events() read by the UI   |
+---------------------------+
```

Agents are processed in cast order. Decisions are staggered every five ticks by
agent index; conversations advance each tick. End-day work emits a summary,
restores needs, reflects on memories, forgets source attribution and clears daily
accusations. The engine runs it at `tick % 1440 === 0`, at dawn.
The library's source-memory default is 240 caller ticks; the engine overrides that
value to `2` and calls `forget` once per day to approximate a two-day half-life.

## Replay

The replay input is a seed plus ordered interventions, together with the same
cast, claims, map, dialogue data and engine version. Each intervention is
`{ tick, listener, claimId }`. The seeded random generator and ordered updates
make repeated runs with identical inputs reproducible; playback speed is outside
the simulation.

An intervention recorded at tick T is applied after the step to T, matching a
live whisper made at the current `sim.tick`. Tick-zero interventions are applied
during construction. Sorting preserves the supplied order for equal ticks. To
scrub, construct a fresh simulation from the seed and interventions, then step it
to the desired tick. Do not inject tick T before its step: that would let its
consequences affect decisions a minute early.

Live whispers require the player to be within two tiles. Replayed whispers bypass
the range check and place the stranger at the listener; witnesses are computed
from the listener's position. Player walking paths are absent from replay data.
Player position is excluded from villager movement separation, so walking does
not perturb NPC paths or decisions. Replay tests pin the same raw event hash
across supported Node versions and browser checks. This guarantee requires the
same engine, content and ordered inputs; generated conversation text is not
part of the replay.

## Share links

The implemented link is `<page>#<base64url>`. The fragment contains UTF-8 JSON
encoded as unpadded base64url, with this shape:

```json
{
  "v": 2,
  "start": 190,
  "seed": 42,
  "cast": "v4",
  "interventions": [
    { "tick": 12, "listener": "mira", "claimId": "tom-stole-bread" }
  ]
}
```

The claim id above illustrates the shape; it must exist in the loaded claim map.
`ui/share-link.ts` accepts legacy version 1 and current version 2. Version 2
also records `start`, an integer offset of 0–1,439 ticks from 06:00. Both versions
validate a 32-bit unsigned seed, a cast string of at most 32 characters and at
most 400 interventions. Ticks must be integers from
0 through 1,000,000 and ids must match the bounded identifier pattern. Decoding
rejects fragments longer than 16,000 characters, invalid encoding and malformed
JSON. The interface also checks the cast version and known listener and claim ids.

This format is encoded, not compressed. Authored claims use stable ids. Current
open stories use bounded `story_` base64url payloads containing their confirmed
wording and semantic annotations; legacy `written_` payloads are still accepted.
The engine validates and registers custom claims at their intervention tick.
Player paths and generated conversation replies are absent. The encoder keeps
the largest suffix of recent whispers that fits the 16,000-character limit, so
a long link can omit older interventions. Share links are not complete archives.

Worker signatures do not travel in this format; the browser validates the
embedded claim payload. Opening a replay needs no interpretation call. Confirmed
story wording is visible to anyone with the link, as explained in
[open stories](open-rumors.md).

## Conversation routing and verification

The browser's `agentic/orchestrator.ts` handles supported moves, visits, source
questions and news from simulation state without inference. Open conversation
passes a bounded set of character facts to `/play`; a proposed action requires
player confirmation. Model output cannot directly update beliefs or world truth.

`agentic/verifier.ts` compares reply sentences with belief records, confidence
bands and source chains. `agentic/guard.ts` keeps sentences labelled supported
or chatter, drops unsupported or contradictory sentences, and supplies an
ignorance reply if none remain. These labels are heuristic. Implication,
paraphrases and world-knowledge mappings can defeat the matcher; it is not a
proof that a reply is true or calibrated. Research uses the same verifier through
`bench/slm/verifier.ts`, with separate world-truth labels. See
[development findings](research/verifier-notes.md) and [study status](research/README.md).

## The Worker's request path

All routes require an allowed browser origin. `GET /health` reports service
health and `GET /pubkey` exposes the ECDSA P-256 public key. The inference routes
share Turnstile, bounded input, edge admission and the single `global-budget`
SQLite Durable Object:

| Route | Purpose | Cache and signing |
|---|---|---|
| `POST /rumor` | Semantic annotations for confirmed open stories | No shared prose cache; unsigned annotations reviewed by the player |
| `POST /play` | Grounded conversation and a validated action proposal | No prose, context or reply cache |
| `POST /interpret` | Legacy fixed-taxonomy claim interpretation | Validated and signed claims; hash-keyed edge and durable caches |

```text
Origin, route, enabled-state and edge admission checks
  -> bounded body and route-specific validation
  -> Turnstile verification
  -> legacy /interpret only: authenticated cache lookup
  -> reserve request allowance and cost in the global ledger
  -> Workers AI with a $0 hold
  -> on failure: fund the same hold before OpenRouter fallback
  -> validate provider output and return the route's response
  -> settle/release in waitUntil; then record aggregate usage/digests
```

The ledger checks the UTC day's spend plus reservations and lifetime spend plus
reservations in a synchronous transaction. Defaults are $0.019 per day, $7
lifetime and 20 requests per minute globally. Hashed visitor buckets allow
5 story requests and a separate 30 conversation requests per hour. Workers AI
attempts count even at $0. Legacy cache hits precede reservation and avoid model
calls. A fallback funds the original reservation without charging admission twice.

Workers AI defaults to Llama 3.3 70B for `/rumor` and `/play`, and Llama 3.2 3B
for legacy `/interpret`. OpenRouter tries `liquid/lfm-2.5-2.6b:free`, then
`google/gemini-2.5-flash-lite`. Route schemas and validators bound model outputs;
the output ceiling is 120 tokens, with temperatures 0.3, 0.7 and 0 respectively.
Each provider tier has a six-second deadline. Availability can change.

The allowlisted price table and provider price caps reject unsupported prices.
Before paid dispatch, a conservative prompt-token bound and maximum output cost
must fit the hold. Invalid or refused output may already have cost money, so it
is settled too. A pre-dispatch failure releases the hold; uncertain dispatched
cost consumes the reserved amount. Failed settlement leaves the durable hold in
place. Settlement above the bound freezes new calls. Ledger faults fail closed.
Settlement and release run in `waitUntil` in production, outside the response
path; usage digests follow the settlement attempt and cannot relax money limits.

Only legacy accepted taxonomy claims are signed and cached. Refusals are neither.
Cache hits require payload validation and signature verification; cast changes
can re-sign a claim without another inference. Open-story and conversation prose
are not stored in shared caches, the ledger or API logs. Confirmed story text
still enters the browser's dialogue, exports and replay links.

See [traffic admission and capacity limits](scale.md) for bounds and retention.
The ledger is one cost layer. Prepaid credit with auto top-up off, non-resetting
provider key caps and a Cloudflare Free account must be configured separately;
paid Workers AI overages are outside this ledger. See [credit controls](credit-controls.md)
and [the root budget explanation](../README.md#stay-within-a-10-ai-budget).
API failures leave local simulation and neutral-meaning stories playable.
