# RumorTown as an exploratory social model

Model `v3-neighbourhoods-1`, cast `v3`, 21 October 2026. This document follows the Overview, Design concepts and Details (ODD) structure. It describes executable assumptions, not a validated theory of human behaviour.

## Purpose and boundaries

Use the village to explore how location, repeated contact, social relationships and information provenance interact. Useful questions include where a claim travels, whether a correction reaches the same people, and how outcomes change when an assumption is removed. Classroom demonstrations and hypothesis generation are appropriate uses. Predicting real individuals, reporting model outcomes as participant data, or claiming human causal effects is unsupported.

There are 36 fictional adult agents, 42 places and a 64 by 44 tile world. Each person has an authored role, routine, relationships, six trait values, private events, aspirations, worries, habits and four social motive weights. Those values are fictional character design, not psychometric assessments. The player travels through the same world and can whisper a structured claim to a nearby person.

## Research reviewed and translation into rules

| Evidence | Finding relevant to this model | Implementation and limits |
|---|---|---|
| [Dores Cruz et al., 2021, everyday gossip](https://pmc.ncbi.nlm.nih.gov/articles/PMC8487731/) | Experience sampling connects gossip to sender–receiver–target relationships and reputational evaluations. | Directed trust, affinity, closeness and listener relevance influence telling. A fictional village is not a representative sample of those participants; no coefficients were fitted to their data. |
| [Testori, Beersma and Hemelrijk, 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC8938477/) | Their agent-based model finds that gossip's effects depend on motives and interaction conditions. | Distinguish protective, bonding, status and verification tendencies. This is an inference for character design, not a reproduction of their cooperation model. RumorTown has no economic cooperation payoff task. |
| [Kawakatsu, Kessinger and Plotkin, 2024](https://doi.org/10.1073/pnas.2400689121) | A formal model connects gossip, reputation agreement and cooperation under specified norms. | Keep private beliefs rather than a single public reputation. Agreement and truth are different outcomes. Their analytical thresholds do not transfer to our utility rules. |
| [Hassan and Barber, 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8116821/) | Two experiments find diminishing gains in perceived truth with repeated exposure. | The existing ledger adds a capped familiarity bonus. The exact power, scale and cap are tuned; an experimental rating change is not a log-odds coefficient. |
| [Acerbi, 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC9250454/) | Preregistered experiments find a negative-content advantage in retelling and sharing, with other biases varying by transmission task. | Negative content gets a sharing bonus. This does not make it automatically more credible. Neutral-sharing comparisons remove that bonus. |
| [Yousif, Aboody and Keil, 2019](https://doi.org/10.1177/0956797619856844) | Experiments show failures to distinguish apparent agreement from independent corroboration in their tasks. | Track remembered origins and reduce redundant evidence. The reduction and source-memory loss rate are authored. Independence detection depends on task and cues; universal inability is not assumed. |
| [Grimm et al., 2020, ODD](https://www.jasss.org/23/2/7.html) | A reporting protocol supports clear descriptions, replication and fitness-for-purpose evaluation of agent-based models. | Publish inputs, update order, assumptions and sensitivity checks. Following a reporting protocol does not establish empirical validity. |

The [library evidence table](../packages/rumormind/README.md#evidence) documents earlier work on credibility, corrections and trust repair. The new sources extend that foundation. Evidence for a qualitative direction does not validate every numeric value in the program.

## State, time and process

One tick is one game minute. A model day contains 900 active minutes from 07:00; the overnight interval is omitted. A run ends after three days. Movement speeds are one tile per minute for villagers and 1.4 for the player. Rendering interpolates between ticks and cannot change NPC outcomes.

Each tick runs in this order:

1. Advance schedules and choose utility-based goals for the agents due to decide (one decision every five ticks).
2. Move villagers along four-neighbour A* routes, with bounded visual separation; move the player.
3. Re-route approaches when the target has moved.
4. Observe nearby private acts, subject to visibility and location rules.
5. Progress conversations, tell claims, update beliefs and record speech locations.
6. Update needs and moods, and expire speech bubbles.
7. At dusk, judge the day, reset needs, reflect, forget remembered origins, and clear daily accusation bookkeeping.
8. Apply scheduled replay whispers at the tick where a live whisper would have occurred.

Randomness comes from one seeded stream in fixed agent order. Player movement is excluded from NPC separation, so walking a different route cannot silently change the social experiment. Replay whispers preserve their tick, listener and claim. A shared seed does not keep random draws aligned once two different conditions produce different actions.

## Spatial and character rules

Four neighbourhoods organise the travel atlas: Old village, Eastbank, Woodland and South commons. These are geographic labels, not additional psychological variables. The twelve new residents retain the same four overlapping social communities as the original cast. Their authored close ties connect them to older residents, and their daily errands and evening visits connect the districts. Twenty-four new claims pair harmful allegations with specific, observable alternatives.

Water, walls, trees and the well are impassable. Two three-tile bridges are the only river crossings. Route costs are 1 on paths, floors, doors and the bridge; 4 on grass; 3 on fields. These are route preferences, not time multipliers. Longer paved routes can win over short grass shortcuts. Grass stays accessible to reach field and orchard work spots. Routes include doorways rather than crossing building walls. Private events were checked again for sufficient travel time after the routing change.

Character motives modify the utility of an already eligible telling:

- Protection: add up to 0.12 for a warning or defence.
- Bonding: add up to 0.08 when the listener's closeness is at least 0.6.
- Status: add up to 0.10 for harmful gossip about the teller's authored rival.
- Verification: subtract up to `0.12 × (1 − confidence)` for a claim the speaker has not witnessed.

The values multiply that person's 0–1 motive weights. Telling utility retains its existing 0.85 cap. These are bounded design assumptions, not measured effect sizes. They do not change a claim's factual status or replace evidence updates. Existing schedules, needs, traits, remembered sources and relationships continue to shape behaviour. The tag exposes character context alongside beliefs, mood and reasons; it does not claim to read a real person's mind.

Dialogue is templated, with each claim-backed news line required to express the same claim as the corresponding belief update. There is no live language-model reasoning in the simulation. The current writing form accepts up to 100 characters, plus an explicitly chosen subject, category and severity. The simulation uses those chosen fields; it does not infer sentence meaning. Original prose is preserved in the claim, links and exports. Written claims do not inherit evidence or contradiction links from authored private events merely because their category matches. Their social spread can be explored, but their content is not fact-checked. The optional interpretation Worker is separate and is not called by this form.

## Observations and reproducible comparisons

Open **Explore** to see live positions, speaking markers, recent lines with locations and destinations. Choose a place to walk there, or hold an arrow key/WASD. The camera follows the player. **Notebook** holds the ordinary run while inspecting or comparing it.

**Follow a rumor** records actual transmission links from dawn, including repeated tellings, and displays one at a time. Previous/Next pause the simulation; Watch live resumes at 1×. The reached count is distinct recipients of those transmissions, not current believers or first-hand witnesses. The displayed thread joins current positions, not historical speech locations. Rewinding rebuilds the trail.

**Download run JSON** saves the model and cast versions, seed, tick, parameters, map, full authored cast, claim registry, interventions, current snapshot, inspections and chronological events. `replayInputs.initialClaims` excludes runtime taxonomy and player-written claims and their added reverse links; introduce those again at their recorded whisper ticks when reconstructing a run. The top-level registry reflects the observation time. Line events carry speaker coordinates and an optional place id; missing place ids mean a lane or other unnamed ground. **Download events CSV** provides one event per row. Non-speech events have no sampled historical coordinate. These exports contain synthetic data, not participant records. Player walking history is not retained.

**Compare three days** runs ordinary rules and one altered condition, starting from dawn, over the same seed(s) and recorded whispers. It can remove whispers, remove familiarity, set negative sharing odds to 1, or set affinity bias to 0. Choose the current seed or five consecutive unsigned 32-bit seeds. Download comparisons to retain settings, per-seed summaries, day endings and observations every 90 ticks. A no-whisper comparison is identical when the original inputs have no whispers; this is a useful control check. These comparisons leave the current village unchanged and can be cancelled.

Metrics are operational definitions:

| Metric | Definition |
|---|---|
| Harmful beliefs | Number of person–claim pairs with negative valence and confidence strictly above 0.5. Negative does not mean false. |
| Harmful believers | Distinct people with at least one such belief. |
| Claim tellings | Number of line events carrying a claim id, including news, denials and corrections. It is not a count of unique transmissions. |
| Mean trust in stranger | Arithmetic mean of all agents' trust toward the player. |
| Mean mood | Arithmetic mean of current model mood values. |

Report the version, condition, inputs and all seeds when using results. Five seeds are a small exploratory sample, not a powered statistical study. Preserve the source revision with the downloaded data. Older cast-v1/v2 links explicitly start a fresh cast-v3 run without their whispers. Population, routes, routines and dialogue changed, so an old seed alone cannot recreate the old social history. Use the source revision that produced an old export to reproduce it.

## Verification and remaining validation work

Engineering checks cover deterministic replays, export reconstruction, no-input paired controls, terrain-aware path optimality against an independent Dijkstra implementation, blocked terrain and doorway connectivity. Browser checks cover travel across the bridge, held-key movement, downloads, five-seed comparisons, mobile layout and focus restoration. These establish implementation properties.

Before research claims about people: choose an external dataset and target measures; define a fitting procedure separate from evaluation; reserve held-out observations; compare with simpler baselines; run broader parameter and seed sensitivity analyses; quantify uncertainty; and replicate qualitative results across plausible network and schedule alternatives. Human-subject studies would require a separate study design. No calibration or predictive validation is claimed in this release.
