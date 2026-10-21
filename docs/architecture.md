# Architecture

RumorTown separates a dependency-free behaviour library, a browser simulation and an optional interpretation Worker. The shared game contract is [apps/rumortown/src/sim/types.ts](../apps/rumortown/src/sim/types.ts). Modules exchange typed commands, snapshots, inspection views and ordered events through that contract.

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

`main.ts` mounts the real engine, world, talk and renderer by default; `?fake=1` selects the UI fixture. The browser currently writes claims locally. The optional Worker remains separate and is disabled by default.

The headless `agent/environment.ts` adapter provides bounded tools over the same engine. Ordinary agent observations expose nearby public state; research exports expose hidden state separately. The browser also has a local tour planner with a visible usage notice and manual takeover. See [the agent interface](agents.md).

## One simulation tick

A tick is one game-minute. A day contains 900 ticks, representing 07:00 through
22:00; the tick counter continues across days. The default run spans three days.
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
accusations. The engine currently runs it at `tick % 900 === 0`.
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
Because player position also participates in movement separation, the seed and
intervention model alone should not be treated as proof that every live walking
session reproduces a byte-identical event log. That guarantee needs integration
validation with the real engine.

## Share links

The implemented link is `<page>#<base64url>`. The fragment contains UTF-8 JSON
encoded as unpadded base64url, with this shape:

```json
{
  "v": 1,
  "seed": 42,
  "cast": "v1",
  "interventions": [
    { "tick": 12, "listener": "mira", "claimId": "theft-tom" }
  ]
}
```

The claim id above illustrates the shape; it must exist in the loaded claim map.
`ui/share-link.ts` validates version 1, a 32-bit unsigned seed, a cast string of
at most 32 characters and at most 400 interventions. Ticks must be integers from
0 through 1,000,000 and ids must match the bounded identifier pattern. Decoding
rejects fragments longer than 16,000 characters, invalid encoding and malformed
JSON. The interface also checks the cast version and known listener and claim ids.

This format is encoded, not compressed. Player-written claims use a bounded `written_` base64url payload containing original text, subject, category and severity. The claim id therefore carries text for those claims, while authored and legacy interpreted claims remain taxonomy ids. Player-written claims are validated and registered at their intervention tick. For legacy interpreted claims it contains claim ids rather than typed
text, player paths or generated dialogue. The design calls for signed custom
claims and compression, but the current `ShareState` contract has no field for
signed claims. Worker signatures therefore do not yet travel in this link format.
Opening an existing claim-id replay requires no interpretation call.

## The Worker's request path

The Worker accepts `POST /interpret` with `{ text, turnstileToken, castVersion }`.
It also exposes `GET /health` and `GET /pubkey`. All routes require the configured
browser origin. The returned signed payload contains `claim`, `castVersion`,
`issuedAt` and `sig`; signing uses ECDSA P-256. The browser helper in `net/interpret.ts` verifies signatures before returning
a successful custom claim. Unsupported input returns an unsigned refusal with
`unsupported`, `castVersion` and `issuedAt`; it is never applied as a claim.

```text
+----------------------------------+
| Origin and route checks          |
| Body, length and blocked text    |
+----------------+-----------------+
                 |
                 v
+----------------------------------+
| Verify Turnstile                 |
| Hash normalised text             |
+----------------+-----------------+
                 |
                 v
+----------------------------------+
| Ledger cacheGet                  |
| Hit: validate, verify signature, |
| re-sign for new cast if needed   |
+----------------+-----------------+
                 | cache miss
                 v
+----------------------------------+
| Require AI_ENABLED=true         |
| Price allowlisted models         |
| Hash visitor bucket              |
| Ledger reserve worst-case cost   |
+----------------+-----------------+
                 |
                 v
+----------------------------------+
| Check secrets, require ntfy     |
| message receipt, dispatch model |
| Six-second timeout, no retries   |
+----------------+-----------------+
                 |
                 v
+----------------------------------+
| Ledger settle usage first        |
| Then parse and validate claim    |
| Sign, cachePut, return           |
+----------------------------------+
```

One Durable Object named `global-budget` serves the whole deployment. Within a
synchronous transaction, reservation checks the visitor's hourly count, the
global minute count, the UTC day's spent plus reserved balance, and lifetime spend plus reservations, then records
the hold and increments counts. Defaults are 5 requests per visitor per hour,
20 globally per minute, $0.019 per day and $7 lifetime. A provider settlement above the reserved bound freezes further calls. Cache hits precede reservation and do
not consume those model-call counts. The cache stores a hash and signed structured
payload; the ledger does not store the typed words.

Before dispatch, the Worker requires a phone-notification receipt; failed or missing alert configuration releases the unused reservation. The phone may still be offline, so receipt is service acceptance rather than confirmed device delivery. See [credit controls and notification setup](credit-controls.md).

The price table rejects unpriced models, and provider price caps reject more expensive routes. The reservation covers the most expensive
configured model, a conservative prompt-token bound and up to 200 output tokens.
Returned usage is settled before output validation because an invalid or refused
answer may already have cost money. A failure before dispatch releases the hold;
a timeout or uncertain dispatched result settles the worst-case amount. Failed
ledger settlement leaves its durable reservation held. Settlement and release are
idempotent, and ledger errors stop the request.

Only after settlement does the Worker validate the taxonomy, sign an accepted
claim and cache it. Locally blocked text returns a refusal before Turnstile;
model-generated refusals return after settlement without signing or caching. Cache hits are validated and signature-checked; a cast-version change
re-signs the cached claim without another model call. Model requests use structured
output, temperature zero and a free-first model list with a priced fallback.

The ledger is one cost layer. Prepaid credit with auto top-up disabled, capped
provider keys and free hosting with no card must be configured separately, as
explained in [the root README](../README.md#the-10-guarantee). Rejections and outages
leave the authored rumor menu as the intended browser fallback.
