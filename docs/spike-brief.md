# RumorTown spike: three villagers, one rumor

This is a throwaway go/no-go prototype. It answers one question: **can three rule-driven characters produce one disagreement that a stranger understands, and enjoys, within about 60 seconds, without reading a log?** Code quality can be prototype-grade, but keep the simulation core pure so it can be salvaged later.

## Hard constraints

- No network calls, no AI or LLM, no backend. Everything runs in the browser.
- No new dependencies. `vite`, `typescript` and `vitest` are already installed. No UI framework: plain TypeScript, DOM, and Canvas 2D or SVG.
- Deterministic. The same seed and the same interventions must produce an identical event log. Use a seeded PRNG (for example mulberry32). Never use `Math.random` or `Date.now` inside the simulation.
- `src/sim/` is pure TypeScript. It must not touch the DOM or import from `src/ui/`.
- The simulation advances in fixed ticks. The UI plays ticks back at an adjustable speed.
- Layout works at phone width (360px): the inspector stacks below the village.

## Scenario

A small village, one day from 08:00 to 20:00, 120 ticks (one tick = 6 minutes).

**Places:** Bakery, Square, Tom's house, Ada's cottage. Ada is sick and is a place, not a simulated character.

**Characters**

| Name | Role | Personality | Starting relationships |
|---|---|---|---|
| Mira | The baker | Proud, quick to anger, values honesty, gossips when upset | Likes Tom a little, neutral on Ben |
| Tom | Kind and quiet | Avoids conflict, explains himself when accused | Close to Ben, likes Mira |
| Ben | Tom's best friend | Sceptical of strangers, loyal | Trusts Tom highly, neutral on Mira |

**Ground truth** (simulated events, perceived only by characters in the same place at that tick):
- Early in the day, while Mira is away from the bakery, Tom takes a loaf from the back shelf. He means to pay later.
- Tom carries the loaf to Ada's cottage and gives it to her.
- When Mira returns, she notices a loaf is missing. She knows it is missing, not who took it.

**The player is "a stranger"** who can whisper a claim to any character at any tick. Claims available in the spike:
- "Tom stole the bread"
- "Tom took the bread to Ada"

"Stole" and "took it to Ada" contradict each other. Define contradiction pairs explicitly in data.

**Witness switch:** a scenario option, "Ben saw Tom deliver the bread". When it's on, Ben's morning schedule puts him at Ada's cottage when Tom arrives, so he perceives the delivery.

## Simulation model (minimum)

- **Claim:** structured data, for example `{ id, kind: 'stole' | 'gaveTo', about: 'tom', object: 'bread', target?: 'ada' }`.
- **Belief:** one per character per claim. It holds a confidence from 0 to 1 and a provenance list: `{ source: CharacterId | 'stranger' | 'saw' | 'noticed', tick, delta }`.
- **Relationships:** `trust[a][b]` from 0 to 1, and `affinity[a][b]` from -1 to 1. Each character also has a trust value for the stranger (Mira 0.6, Tom 0.4, Ben 0.2).
- **Belief update (research-backed):** keep beliefs as log-odds and add evidence to them. Every constant goes in `src/sim/tuning.ts`.
  - **Hearsay:** `L += w_source * strength`. `w_source` comes from the listener's trust in the speaker. Tune it so that one telling from a neutral, trusted source moves belief from 0.5 to about 0.65 (people move roughly 39% of the way toward advice they receive).
  - **Repetition:** hearing the same claim again adds a capped familiarity bonus, `min(0.4, 0.15 * ln(1 + exposures))`. This is separate from corroboration.
  - **False independence:** a second source counts as independent corroboration only if, in the listener's remembered provenance, it did not trace back to the same origin. Use what the character remembers, never the engine's omniscient record.
  - **First-hand evidence:** seeing an event yourself weighs 2 to 4 times as much as hearsay.
  - **Motivated reasoning:** multiply evidence against someone you like by 0.7 to 1.0, and congenial evidence by 1.0 to 1.3.
  - **Corrections:** a credible correction with an alternative explanation ("he took it to Ada") removes 50 to 90% of the unsupported contribution, and leaves some residual. A correction can never raise belief in the original claim.
- **Actions:** each tick, each character picks an action by utility scoring. Record the winning terms as a plain-English `why`.
  - `routine`: follow your schedule.
  - `gossip`: tell a co-located character a claim you believe above 0.5.
  - `confront`: go to the accused and accuse them, when you believe a harmful claim above about 0.6 and are the victim or close to the victim.
  - `defend`: speak up for someone you like when you hear them accused, especially if you believe a contradicting claim.
  - `explain` / `deny`: the accused gives their side.
  - `reconcile`: apologize or make up when confidence in the harmful claim falls back below a threshold.
- **Conversations** pass claims between co-located characters. Each spoken line is an event that links back to the belief that caused it.
- **Emotion, kept minimal:** believing a harmful claim about X lowers your affinity for X. Being defended raises it.
- **End-of-day outcome:** a one-line summary, for example "Mira and Tom fell out", "Mira apologized to Tom" or "The village split".

## Dialogue

Template lines go in `src/sim/lines.ts`. Key them by speech act (`gossip`, `confront`, `deny`, `explain`, `defend`, `doubt`, `agree`, `reconcile`) and by speaker. Give each 3 to 5 variants with `{placeholders}`, chosen by the seeded PRNG. Each character should sound distinct: Mira sharp, Tom gentle, Ben blunt.

## UI

- **Village view:** the four places as labelled areas. Characters are coloured circles with names that move smoothly between places. Speech bubbles show the current line. When a claim passes from speaker to listener, draw a short-lived line between them (the "rumor trail").
- **Inspector:** click a character to see:
  - each belief as a row: the claim in plain English, a confidence bar, and a provenance chain ("Stranger told Mira at 09:12, then Mira told Ben at 10:30")
  - relationship bars toward the others
  - "Why I did that": their last three decisions with the top reasons in plain English
- **Controls:**
  - Play, pause and speed.
  - A timeline scrubber. Seeking re-runs the simulation from tick 0 with the same interventions.
  - A whisper control: pick a character and a claim, then add it at the current tick.
  - The witness toggle.
- **Share:** the URL hash encodes `{ v: 1, seed, witness, interventions: [{ t, to, claim }] }`. Loading that URL reproduces the run. Include a "Copy link" button.
- **Story log:** collapsed by default. The goal is that nobody needs it.
- **First load:** the day starts playing immediately. Show a one-click suggestion, "Whisper to Mira: Tom stole the bread", so the drama starts within 10 seconds.

## Tests (minimal, vitest)

1. **Determinism:** two runs with the same seed and interventions produce deep-equal event logs.
2. **Story sanity:**
   - Witness off, plus an early whisper "Tom stole the bread" to Mira: Mira confronts Tom at some point.
   - Witness on, same whisper: Ben defends Tom, and Mira's final confidence in "stole" is lower than with the witness off.
3. **URL round trip:** encoding then decoding a state returns the same state.

## Done when

- `npm run typecheck`, `npm test` and `npm run build` all pass.
- In `npm run dev`:
  - the village plays
  - a whisper visibly changes the story
  - clicking a character shows their beliefs, provenance and reasons
  - a copied link reproduces the same day
- `README.md` says this is a spike and explains how to run it.

When you finish, reply with: what you built, the file list, how the rules produce the default story (in a few sentences), and what is fragile or fudged.
