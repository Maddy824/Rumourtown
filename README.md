# RumorTown

A throwaway **go/no-go spike**, not a general social simulator: three villagers,
one missing loaf, and a stranger who can change the story. The question is whether
a rule-driven disagreement is understandable and enjoyable in about a minute
without opening a log.

## Run

Dependencies are already installed. No additional packages or services are needed.

```sh
npm run dev
```

Open the local URL Vite prints. The day starts playing immediately. Click
**Whisper to Mira: Tom stole the bread**, then watch the bubbles. Click a villager
to inspect beliefs, remembered evidence, relationships, and their last three
decisions. The story log is collapsed by default.

- Pause, change speed, or scrub from 08:00 to 20:00. Scrubbing pauses and rebuilds
  the world from the seed and recorded interventions.
- Whisper either claim to any villager at the current tick. Replaying preserves
  every whisper, including whispers later than the current scrub position.
- Toggle **Ben saw Tom deliver the bread** to change Ben's morning schedule and
  replay to the current time; use ↺ to watch the changed day from the beginning.
- **Copy link** stores `{ v: 1, seed, witness, interventions: [{ t, to, claim }] }`
  as URI-encoded JSON in the URL hash. Opening it starts the same day at 08:00.
  If clipboard permission is unavailable, copy the updated address bar.
- Refreshing a shared URL retains its interventions. Open the base URL without
  a hash for a fresh day. There is no server-side storage.

Everything runs locally in the browser: plain TypeScript, DOM, CSS, and SVG.
There are no runtime network requests, external fonts, AI calls, or backend.
The inspector stacks below the village at narrow widths, including 360px.
Reduced-motion preferences disable movement transitions.

## Validate

```sh
npm run typecheck
npm test
npm run build
```

Tests cover deterministic replay (including prefixes), the confrontation and
witness stories, location-limited perception, neutral advice calibration,
source dependence and capped repetition, corrections with residual belief,
bounded state, and share-state round trips and validation.

All three commands passed during implementation. A visual browser smoke test
could not run in the execution sandbox: starting Vite's local listener returned
`EPERM`, and the installed headless Chrome could not launch. Phone layout and
playback therefore still need a human browser pass.

## How the story works

Without intervention the day is quiet. Tom takes bread while Mira is away,
delivers it to sick Ada, and means to pay later. Mira's observation of a missing
loaf does **not** identify a culprit or itself increase belief in theft.

An early stranger's whisper moves Mira above the confrontation threshold.
Once she notices the missing loaf, her confidence, anger, and personal stake
outscore her routine. She seeks Tom and accuses him. Tom explains the delivery.
Ben is loyal enough to defend his friend; if he was at Ada's cottage, his own
observation supplies an independent origin for the alternative explanation.
Without that observation, passing on Tom's account is still the same remembered
origin. Mira therefore ends with less suspicion when Ben witnessed the delivery.
When suspicion falls below the reconciliation threshold, an apology wins.

The engine advances fixed six-minute ticks, with 08:00 as tick 0 and 20:00 as
tick 120. Playback inserts reading time for each line without altering simulated
time. A seeded mulberry32 generator picks dialogue variants; a given seed and
ordered intervention list produce the same event log, independent of UI speed.

## Files

- `src/sim/types.ts`: claims, beliefs, provenance, characters, decisions, events.
- `src/sim/data.ts`: characters, places, structured claims, explicit contradiction pairs.
- `src/sim/tuning.ts`: behavioral weights, thresholds, relationships, schedule timing.
- `src/sim/beliefs.ts`: log-odds updates, motivated reasoning, remembered origins,
  first-hand evidence, capped familiarity, and residual corrections.
- `src/sim/lines.ts`: three variants per speaker for each of eight speech acts.
- `src/sim/engine.ts`: seeded randomness, schedules, local perception, utility
  scoring, conversations, replay, and end-of-day outcomes.
- `src/sim/share.ts`: versioned URL encoding and defensive decoding.
- `src/sim/sim.test.ts`: simulation and URL tests.
- `src/ui/app.ts`: village, animated villagers, speech queue, rumor trails,
  inspector, controls, sharing, and story log.
- `src/ui/styles.css`: responsive layout and village styling.
- `src/main.ts`: application entry point.
- `src/vite-env.d.ts`: Vite asset-import types.

## Fragile or fudged

- This is research-inspired arithmetic using the brief's numerical targets,
  **not a validated psychological model**. Neutral trust gives about 0.65
  confidence after one telling; direct observation has three times the base
  weight of neutral hearsay. Personality modifiers alter that weight.
- Taking bread and delivering it are scripted world events. Schedules and
  thresholds are tuned for this tiny scenario, not emergent general planning.
  Movement is one simulation step; the UI interpolates it.
- “Stole” and “gave to Ada” are declared narrative alternatives even though
  real theft and generosity can coexist. Initial confidence is 0.5 for each
  claim independently; these are not normalized probabilities of exclusive facts.
- A listener retains only three source-chain hops. Retellings from a remembered
  common origin contribute familiarity, not independent evidence. Forgetting
  earlier hops can eventually create false independence. A correction removes
  50–90% of the remaining unsupported contribution once per remembered origin;
  it cannot increase the original claim. Some suspicion remains.
- Dialogue and behavior are finite templates. Gossip is limited to one telling
  per speaker/listener/claim; reconciliation happens once. Actor ordering is
  fixed (Mira, Tom, Ben), and characters can respond within the same tick.
  Trust stays fixed; affinity changes with harmful belief and defense.
- Outcomes are simple threshold summaries. The seed changes wording, not the
  village layout or the scripted morning. Both witness settings may end in an
  apology; the tested difference is evidence provenance and final confidence.
- The URL contains the entire scenario, not a short server-generated ID.
  Decoding rejects more than 1,000 interventions; very long links may hit browser
  or clipboard limits. There is no save migration beyond version 1.
