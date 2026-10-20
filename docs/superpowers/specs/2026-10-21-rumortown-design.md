# RumorTown design

Status: draft for the owner's approval. Written for the builder (Codex and Claude, with the owner reviewing). Where a decision was the owner's, it says so; where it was the writer's call, it is marked **(my call)** so the owner can overrule it.

## 1. Intent

A free browser game and an open-source library. A player walks into a felt-and-paper village of about two dozen villagers who live their day, chat, and gossip. The player whispers a lie to one villager and watches it travel: who believes it, who repeats it, who takes sides, who confronts whom, and whether the lie is exposed. The villagers are driven by a deterministic simulation built on behavioural-science findings; a language model is used for exactly one thing, turning a typed lie into a structured claim, and the game works without it.

**Why.** The owner wants (1) a site ordinary people see, play and share, understood in ten seconds; (2) characters that act like humans, grounded in real psychology; (3) something other developers pull into their own projects; (4) technical depth that reads as "this person knows what they're doing" on a CV; (5) minimal cost: $0 to run, one $10 prepaid AI budget that can never be exceeded, set up once and left alone.

## 2. Goals, non-goals, anti-goals

**Goals**
- Ten seconds to the first wow: on load, villagers are already walking and talking; one tap places a lie; the first visible consequence happens within a minute of game time.
- Legible cause and effect. At any moment the player can ask "why did she do that?" and get an answer in plain words: who told her, what she believes, how she feels and why.
- Every behaviour traceable to a rule, and every rule traceable to a finding or marked as tuned.
- A library, `rumormind`, that any JS/TS game can use for beliefs-with-provenance, trust, gossip decisions, side-taking and repair, with zero dependencies.
- Reproducible runs: a share link replays the same story on any device.
- $0 hosting; the AI endpoint cannot spend more than its prepaid cap under any load.

**Non-goals (not in v1)**
- Multiplayer or any shared state between visitors.
- Live AI-written dialogue. Dialogue is authored once and selected by rules.
- Mobile app, accounts, saves beyond the URL, localisation.
- A general-purpose game engine or a visual editor.

**Anti-goals (would make it a failure even if it works)**
- A manipulation trainer. The game must show the cost of lying (the player's own credibility burns) and offer repair, exposure and a debrief.
- A bot-chat box. If it feels like talking to a chatbot, it has failed.
- "Meters wearing sprites." If villagers read as bars that move, it has failed.
- A surprise bill, or a site that goes down when it goes viral.
- Player-written text ever appearing on screen or in a shared link.

## 3. Constraints

- **Cost.** Static hosting on Cloudflare (free, no card). One prepaid $10 on OpenRouter, auto top-up off, keys capped ($7 live, $2 dev). A custom domain at about $10 a year is the only recurring cost.
- **Upkeep.** Push to deploy. No tokens that expire (npm trusted publishing from GitHub Actions). No dependency with a release treadmill in the library (zero runtime dependencies). The game keeps working if the AI endpoint is dead.
- **Determinism.** Fixed-step simulation, seeded PRNG, ordered updates, no `Math.random` or wall-clock inside the sim. Same seed and interventions produce byte-identical event logs.
- **Performance.** 24 villagers at 60 fps on a 2022 mid-range Android phone in Chrome, and in Safari on iPhone. Simulation CPU budget: under 2 ms per game-minute step on that phone.
- **Browsers.** Canvas 2D and DOM only. No WebGPU, no SharedArrayBuffer, so it works inside the in-app browsers of X and Instagram, where shared links are opened.
- **Safety.** Fictional villagers only, adults only, 13+. Typed text is never shown, stored or shared.

## 4. The experience

### First ten seconds
The page is the village. Villagers are already mid-day: the baker is at her counter, two people are chatting by the well, someone is walking a path with a basket. One speech bubble is visible with a plain line ("Rosa says the fair's moved to Sunday"). The clock reads 09:10. A single prompt sits at the bottom: **"Whisper something to someone."** Tapping it suggests a ready-made lie about a nearby villager; typing is also allowed.

### The loop
1. **Whisper.** The player walks (tap to move; arrow keys or WASD on desktop) up to a villager and whispers. Range is two tiles; a villager who sees the whisper knows the stranger started something.
2. **Watch.** Speech bubbles show the rumor passing. A toggle, **"Who told whom"**, draws red thread between villagers over the map. Pause, play, 2× and 8× speed; a timeline scrubber replays from the start.
3. **Ask.** Tap any villager to open their tag: what they believe and how sure, who told them (a chain of faces), how they feel about others and why, and their last three decisions in plain words.
4. **Intervene again.** Whisper a second claim, a denial, or the truth; stand near a conversation to overhear; approach the accused to see how they are doing.
5. **End of day.** A one-screen summary: what spread, who fell out, who made up, whether the lie was exposed, and what the stranger's word is worth now. A run is three days long; the summary updates each evening.
6. **Share.** "Pin it to the board" makes a share card built from glyphs and names, never from typed text, plus a link that replays the run exactly.

### What makes it enjoyable (from the spike's failure)
The spike resolved its conflict in six game-minutes. The real build enforces three things:
- **The lie travels faster than the truth.** Believers gossip to allies before they confront. The accused avoids conflict, explains only when asked privately, and clams up when accused in public.
- **Confrontation is a public act with a cost.** It recruits allies (side-taking), and it can go wrong for the accuser.
- **Repair is incomplete.** A correction lowers belief but leaves residue; being falsely accused leaves hurt; trust comes back slower than it left.

### Endings (per day, per run)
- **Quiet reconciliation**: the truth came out privately; small residue remains.
- **Exposed**: a witness or the accused's account contradicted the lie publicly; the villagers now distrust the stranger.
- **The village split**: two camps formed and dug in.
- **A grudge**: the lie was believed and never challenged.
- **It died**: nobody passed it on (about one in five rumors never travel).

### The player's credibility
Each villager tracks trust in the stranger. Provenance makes exposure possible: when a claim that traces to the stranger is contradicted by first-hand evidence, every villager who remembers that chain lowers their trust in the stranger twice as fast as trust ever rises, and caps it for good. By day three a careless player finds that nobody listens any more. This is the game's moral weight and its educational beat.

## 5. The world

- **Map.** A hand-built village of about 24×16 tiles: market square with a well, bakery, mill, inn, chapel, schoolhouse, six homes, two fields, a riverside path, a bridge. Places have doors; indoor scenes are rendered as cut-away rooms.
- **Walking.** Grid A* on a walkability mask; villagers follow paths and avoid each other with simple separation. The player's avatar, the stranger, is visible and walks too **(my call: visible, because being seen whispering is how lies get traced)**.
- **Range and witnessing.** Talking range is adjacent tiles; whisper range is two tiles. Anyone within four tiles and line-of-sight can witness an act or a whisper, with clarity falling with distance. Eavesdropping: the player within three tiles hears a conversation's lines.
- **Time.** One sim tick is one game-minute. A day runs 07:00 to 22:00 (900 ticks). At 1× speed a game-minute is 0.4 s real, so a day is six minutes real-time; 2× and 8× available. Movement is interpolated per frame. Decisions run every five game-minutes per villager; conversations advance one line per game-minute.
- **Level of detail.** Villagers more than ten tiles from the player and off-screen still simulate fully (gossip must spread off-screen), but skip animation.
- **Ground truth.** Each villager performs two or three witnessable private acts per day drawn from their secrets and errands (delivering bread, hiding a gift, borrowing a tool, meeting someone by the bridge). These are the facts lies collide with. A lie that collides with a witnessed act can be exposed; a lie about something no one saw can only be met with denial and reputation, and the summary says so ("No one could prove it either way").

## 6. The cast

- **Size and tiers.** 24 villagers, adults only. Five core (deep dossiers, 40+ authored lines per act), ten regulars (medium dossiers), nine background (routines, a few lines). Four overlapping communities: market, farm and mill, inn, chapel and school. Every villager belongs to two.
- **Introduction.** The first day opens on one dispute involving six villagers: Mira (baker), Tom (quiet neighbour), Ben (Tom's friend), Ada (sick, at home), Rosa (innkeeper, hub gossip), Jonah (miller, Mira's rival). Others are met by walking and by the rumor reaching them. Never more than 8–12 villagers salient on any day.
- **Making them memorable.** Role first, then one exaggerated trait with a twist ("Rosa knows everything and is wrong about half of it"), a distinct silhouette (hat, hair, apron, tool, build), a name that cues the role, and a rationed catchphrase (at most once a day).
- **Dossier template** (data, authored offline once, AI-assisted and reviewed): id, name, role, communities, home, workplace, schedule template, HEXACO-lite traits (honesty, emotionality, extraversion, agreeableness, conscientiousness, openness; 0–1), two or three close ties, one rival, one or two secrets (private acts), what they know about others at the start, speech style notes, and line sets per speech act.
- **Relationship web.** Dunbar-shaped: each villager has about 3 close ties, 8 friendly ties, and knows everyone. Negative gossip flows to close ties about distant targets; that triangle is the main source of recognisable moments.

## 7. Character architecture

Every villager is one object with these parts. The sim is pure TypeScript with no DOM access; the renderer reads state and never writes it.

1. **Needs and schedule.** Hunger, rest, sociability, duty. A schedule is generated at dawn from the role template (open the bakery, deliver, lunch at the inn, errands, home). Places advertise what needs they satisfy (Sims pattern).
2. **Action selection.** Utility scoring over candidate actions (continue routine, satisfy need, approach someone, gossip, confront, defend, explain, avoid, reconcile, go home) with response curves. Interrupts for obvious events (someone shouted at you; you saw a theft). The winning score's top terms are stored as a plain-English `why`.
3. **Beliefs with provenance** via `rumormind.BeliefLedger`: log-odds belief per claim, with a remembered trail of who told me and where they said they got it. Source memory fades (half-life about two game days); content fades slower.
4. **Relationships** via `rumormind.Relationships`: trust (0–1) and affinity (−1–1), directed. Trust loses 2× faster than it gains; an exposed liar gets a permanent ceiling. Integrity and competence trust kept separate for the accused.
5. **Mood with causes.** RimWorld pattern: mood is the sum of named, timed modifiers ("accused in public, −20, 1 day", "defended by Ben, +8, 6 hours"). Emotions (anger, fear, shame, gratitude) come from a small appraisal: goal impact, blame, certainty, control. Dialogue can always say why.
6. **Memory.** Episodic events with importance (1–10) and recency decay (0.995 per game-hour, from Generative Agents). Retrieval = recency + importance + relevance. A daily "reflection" at dusk turns the day's events into one or two standing opinions ("Mira judges too fast").
7. **Personality.** HEXACO-lite modifiers of at most ±20% on tendencies: honesty lowers lying and gossip; extraversion raises gossip and approaching; agreeableness raises forgiveness and conflict avoidance; emotionality raises anxiety-driven sharing. Situations dominate; traits bias.
8. **Conversation.** Versu-style social practices: greet, small talk, swap news, confide, warn, accuse, deny, explain, defend, doubt, agree, apologise, forgive, refuse. Groups of up to four. About 14% of lines are gossip, three-quarters of it neutral; the rest is daily life (weather, the fair, bread, the river).

## 8. Simulation rules and defaults

"Measured" means anchored on a published finding; "tuned" means a designer starting point. All live in `tuning.ts`.

| Rule | Default | Status | Source |
|---|---|---|---|
| One telling from a trusted source moves belief 0.5 → ~0.65 | hearsayWeight 1.0 × trust | measured (advice-taking shift 0.39; 0.48 trusted, 0.32 untrusted; 0.55 when uncertain) | Bailey et al. 2023, 346 effects |
| Repetition raises belief, capped | 0.45·(n−1)^0.25 log-odds, capped at 1.0; nothing on the first hearing | measured (illusory truth g≈.37; power-law dose–response) | Ye et al. 2026; Hassan & Barber 2021 |
| A second teller counts only if the listener does not remember the same origin | nonIndependentFactor 0.5 | measured direction (people barely discount repeated-origin sources) | Weaver 2007; Yousif 2019 |
| Tellers pass on "where I heard it" | attributionPassRate 0.5 | tuned (chains shorten in retelling) | transmission-chain work |
| Source memory fades | half-life 2 game days; content 10 days | tuned (source fades faster than content) | source-monitoring literature |
| First-hand beats hearsay | firsthandWeight 2.5 (2–4×) | measured direction | Weizsäcker 2010 |
| Liking the accused dampens harmful claims | prior offset of ±0.6 log-odds per unit of affinity, set on first hearing | tuned, extrapolated | Pfänder & Altay 2025 (d=.78, political) |
| A correction with an alternative explanation | removes 60% of positive log-odds; bare denial 40%; floor 20% of peak; never raises | measured direction (continued influence; alternatives r=.25 vs .14) | Walter & Murphy 2018; Ecker 2022 |
| Corrections work best from the original source and early | ×1.5 if from origin; ×0.7 if the rumor was repeated ≥3× first | measured direction | Walter & Tukachinsky 2020 |
| Belief drives telling | tellScore: confidence + negativity + closeness terms − stifling | measured (belief strongest driver; anxiety amplifies) | DiFonzo & Bordia; Pezzo & Beckstead 2006 |
| Negative content spreads more | odds ×1.5 (range 1.2–1.9) | measured (preregistered) | Acerbi 2022 |
| Tell allies about distant targets | +0.3·closeness(listener) − 0.3·closeness(listener,target) | measured pattern (closeness 71 vs 47 /100) | Dores Cruz et al. 2021 |
| Stop when the listener knows | −0.6 | model (Maki–Thompson stifling; ~20% never hear) | rumor models |
| Interesting-if-true | +0.2 | measured direction | Altay et al. 2021 |
| Knowing vs acting | hearing takes one contact; public side-taking needs belief > 0.75 and two independent sources (2nd ×1.7, 3rd ×1.3) | measured (complex contagion) | Centola 2010 |
| Distortion per retelling | drop 10–25% of peripheral details, 5–15% of qualifiers, invent 0–5%; social and negative details survive | measured direction (heavy loss in first two hops, then ~20%/hop) | Moussaïd 2015; Bebbington 2017 |
| Side-taking | score = loyalty difference + perceived wrongness + expected reciprocity − conflict cost; neutral below 0.4 | theory + experiments | DeScioli & Kurzban |
| Forgiveness | driven by apology (+), empathy (+), perceived intent (−), anger (−); high relationship value and low exploitation risk | measured correlates (.42, .51, −.49, −.41) | Fehr et al. 2010 meta-analysis |
| Repairing an integrity accusation | denial + exonerating evidence beats apology | measured | Kim et al. 2004 |
| Trust asymmetry | losses ×2 gains; an exposed liar's trust is capped at 0.75 of full, permanently | measured direction | Schweitzer 2006 |
| Gossipers lose standing | habitual negative gossipers: −trust from listeners over time | measured | Farley 2011; 2024 field work |
| Gossip share of talk | 14% of lines; 75% neutral; negative 2× positive | measured | Robbins & Karan 2020 |
| Personality modifiers | ≤ ±20% | measured (trait–behaviour r ≤ .26) | HEXACO meta-analyses |
| Memory retrieval | recency 0.995/hour, importance 1–10, relevance; reflect when Σimportance > 150 | measured in a believability study | Park et al. 2023 |

**Not built on, because they failed replication or are contested:** the backfire effect (corrections never raise belief); ego depletion; behavioural priming; "negative claims are believed more" (only shared more); the disgust bias in sharing; the sleeper effect; bounded-confidence rejection (distance does not reduce influence).

## 9. Dialogue

- **Authored once, offline.** A line bank per villager per speech act, generated with AI assistance on the owner's laptop (FreeLLMAPI or any model) and hand-reviewed. Lines use placeholders filled from structured state: `{target}`, `{source}`, `{claim}`, `{place}`, `{time-ago}`.
- **Selection key:** (act, claim valence, speaker, addressee relation, confidence band, mood band). The most specific matching line wins; ties broken by the seeded PRNG.
- **Guards:** cooldown of one day per line; hedged variants when confidence < 0.6 ("I heard, maybe, that…"); forced reactions to obvious events; callbacks to earlier events ("you shouted at me yesterday"); lines about others' beliefs ("Ben thinks you're lying").
- **Name handling:** capitalised, pronouns from the dossier, "you" when addressing the subject. (The spike got all three wrong.)
- **Never:** a villager gossiping about themselves in the third person; a favourable claim in a warning template; a settled or already-known claim brought up as news.

## 10. The AI layer

One purpose: turn a typed lie into a structured claim. The simulation decides everything else, so a cleverly worded lie cannot rig the outcome.

- **Endpoint.** `POST https://api.<domain>/interpret` with `{ text (≤140 chars), turnstileToken, castVersion }`. Response: `{ claim: { kind, about, target?, object?, severity 1–3, valence }, confidence, unsupported?: reason, sig }`, signed with ECDSA P-256 by the Worker (WebCrypto, supported in every browser including in-app ones); the browser verifies with the public key before applying it.
- **Claim taxonomy** (fixed, about fictional villagers only): theft, cheating, secret romance, lying, broken promise, insult behind the back, hoarding, shirking, boasting, and three favourable kinds: secret kindness, paid a debt, nursed someone. Each kind has severity, valence, authored line sets, and the innocent alternatives the world can produce as truth.
- **Model.** OpenRouter, free models first with `require_parameters` and JSON-schema strict output, then `google/gemini-2.5-flash-lite` (about $0.001 per call). Temperature 0, max 200 output tokens, 6-second timeout, no retries.
- **Budget ledger** in a SQLite Durable Object: reserve the worst-case cost before the call, settle after; daily allowance $0.10 (about 70 days of $7); global 20 calls/min; per-visitor 5/hour (hashed IP and UA bucket, no cookies); cache by normalised text so the same lie never pays twice. Fail closed if the ledger is unreachable.
- **Hard stops outside our code:** prepaid credit, auto top-up off, key cap $7.
- **Fallback.** Any rejection, timeout or invalid output shows: "The town's gossip is resting. Try a ready-made rumor." Shared links carry the signed claim, never the text, and replay without any call. Game start never waits for the API.
- **Guardrails.** Text is data, never instructions. Allowlisted ids only; `unsupported` for real people, protected traits, sexual or hateful content, or anything outside the taxonomy. Output lines are not generated live (templates only), so there is no generated text to moderate. Unsigned or tampered claims are rejected and fall back to the menu.
- **Evals (CV artifact).** A set of 200 typed lies with expected claims: schema validity, taxonomy accuracy, abstention on out-of-scope text, injection resistance, cost per whisper, p95 latency. Reported in the README.

## 11. Visual design

**Subject and job.** A storybook village where gossip travels, for ordinary people on phones, arriving from a link. The hero is the living village itself, not a headline.

**Direction: a felt diorama.** The village is a craft table: felt fields and paths, paper-cut houses with stitched outlines, round felt villagers with distinct hats, hair and aprons. Speech bubbles are paper tags. The rumor trail is red embroidery thread between pins. Panels are paper tags and index cards pinned to the board, not cards in a grid. One memorable element: the thread drawing itself across the village as a rumor passes. Everything else stays quiet.

**Tokens**
- Colour: field moss `#6B8E4E`, path oat `#E8DCC3`, roof berry `#A3323B`, river denim `#3F5E8A`, mustard `#D9A531`, ink (dark olive-brown) `#2E2A22`, paper `#F6F0E4` for tags only. No near-black, no terracotta accent, no cream page background.
- Type: **Bricolage Grotesque** for everything, using its optical sizes: 96opsz for the few display moments, 12–14opsz for tags and UI. Sentence case throughout. No all-caps eyebrows, no middle-dot meta strings, no arrows on buttons, no monospace data labels.
- Layout: the village fills the viewport; a slim top strip holds the clock as a small paper sun-dial and the day counter; bottom-left a postbox button "Whisper"; tapping a villager pins their tag beside them (on phones it slides up as a sheet); "Who told whom" and "Story so far" are pins on the top-right board. Left-aligned text inside tags; line length under 70 characters.
- Motion: one orchestrated moment, the thread drawing; otherwise only motion that answers an action (a tag unpinning, a bubble appearing). Reduced motion respected.
- Rendering: Canvas 2D for the world at device pixel ratio with a paper-grain overlay; speech and tags are DOM elements positioned from world coordinates, so text is selectable, accessible and crisp.

**Review against the generic defaults.** The spike used the commonest AI look (cream, serif display, terracotta, caps eyebrows, arrow buttons, uniform cards). The felt diorama was chosen because the subject is handmade, small and warm with a sting, and because it survives as a muted 15-second clip. Quality floor: phone-first, keyboard focus visible, contrast AA, no horizontal scroll.

## 12. Share and spread

- **Share card** (image generated in-browser on a canvas): the village silhouette, the lie as its claim kind glyph, the thread path as a mini-map, three faces with their final verdicts, and the stranger's credibility. No typed text.
- **Link**: `v`, `seed`, cast version, interventions with ticks, and signed claims. Compressed; decoded size capped.
- **Launch clip**: a 15-second muted screen recording of a lie spreading, thread and all.
- **For developers**: `rumormind` on npm with the game as its demo page; README with a GIF and the two benchmarks (sim throughput, interpreter evals).

## 13. Ethics and safety

- 13+. Fictional adults only; the taxonomy and dossiers contain no protected-trait content; real names are blocked.
- The debrief: at the end of a run, a one-screen explanation of what the player exploited (repetition, false independence, allies) and a two-item true/false check, because feedback after play is what improves discernment.
- No morality meter; individual villagers react. No timers during reflection screens. Unwitnessed acts are not held against the player.
- Privacy notice at the whisper box: "Your typed words go to an AI service to be understood, then are discarded."

## 14. Architecture and repository

- **Monorepo (my call):** `packages/rumormind` (library, zero deps, published), `apps/rumortown` (Vite + TypeScript game), `apps/api` (Cloudflare Worker + Durable Object). npm workspaces. The current two repos are merged at the start of milestone 1.
- **Library surface:** BeliefLedger, Relationships, tellScore, plus ClaimRegistry (contradictions and alternatives), retell (distortion), sideTaking, repair, Mood, and a deterministic `createRng`. No scheduling, rendering or DOM.
- **Game modules:** `sim/` (world, agents, schedule, conversation, ground truth, interventions, replay), `render/` (canvas, sprites, tags, thread), `ui/` (controls, inspector, share), `content/` (dossiers, line banks, map).
- **Hosting:** game as an assets-only Cloudflare deployment on the root domain; API Worker on `api.<domain>`; never `run_worker_first` on the game. Turnstile on the whisper box.
- **CI:** typecheck, tests, replay-hash check (fixed seed must produce a known hash), bundle-size budget 400 KB gzipped for the game, Lighthouse mobile ≥ 90. npm trusted publishing on tag.
- **Benchmarks:** `bench/` reports game-minutes simulated per second for 24 and 60 villagers on CI and on a named phone.

## 15. Milestones and gates

0. **Done.** Spike (three villagers) and `rumormind` core (9 tests).
1. **Library complete.** ClaimRegistry, retell, sideTaking, repair, Mood; property tests for "corrections never raise belief" and determinism. Gate: all rules in section 8 implemented and tested.
2. **World and walking.** Map, A*, schedules, needs, 24 villagers walking and meeting, felt renderer, phone controls, LOD. Gate: 60 fps with 24 villagers on the named phone; a stranger can say what three villagers are doing.
3. **Talk.** Social practices, line selection, authored line banks for the six opening villagers, small talk. Gate: a five-minute watch with no repeated line, and a stranger can retell the opening dispute.
4. **Drama.** Confrontation, side-taking, repair, endings, player credibility, three-day runs, inspector tags, thread map, timeline, share card and link, debrief. Gate: three testers play without instructions and each describes a different ending.
5. **AI whisper.** Worker, ledger, Turnstile, signing, evals, fallbacks; dev key only until evals pass. Gate: 200-lie eval ≥ 90% taxonomy accuracy, 100% schema validity, 0 injection successes; load test shows the cap holds.
6. **Launch.** Domain, Cloudflare, npm publish, README with GIF, Show HN with a number in the title, 15-second clip for X and Bluesky.

## 16. Left to the builder

Exact map layout and tile art; sprite composition rules; the schedule templates; the response curves; the authored line banks beyond the six core villagers (with the owner's review); the share-card composition; the eval set's lies; which free models to prefer (changes over time).

## 17. Open questions for the owner

Listed in the message that accompanies this document.

## 18. Builder-check decisions (my calls)

Questions a builder raised on reading this document, settled here so the document stands alone. The owner can overrule any of them.

- **Camera and tiles.** Tiles are 32 CSS px. The play camera follows the stranger and shows roughly 11×7 tiles on a phone; a second camera level shows the whole village (used by "Who told whom" and the timeline). No pinch-zoom; a single toggle switches levels.
- **Indoors.** Rooms are cut-away areas on the same grid; no scene switching.
- **Days.** Ticks continue across days (day 2 begins at tick 900). The night skip is one transition: needs restore, the dusk reflection runs, rumor forgetting applies.
- **Objective.** v1 is a sandbox with the end-of-day summary, plus one optional dare per run shown at the start ("Turn the village on Jonah without anyone blaming you"). The dare gives the share card a comparable outcome (done / caught / gave up, and on which day).
- **Whispering about the listener.** A lie about the person you are whispering to returns `unsupported`; the villager answers with an authored line ("Say that to my face?").
- **Witnesses of a whisper** are computed from the listener's tile at that tick, so share links need only (tick, listener, claim) and stay deterministic without storing the player's path.
- **Signing** uses ECDSA P-256 rather than Ed25519, for universal WebCrypto support.
- **Per-visitor limit** is a hashed IP-and-user-agent bucket. Shared networks may hit it; the ready-made menu is always available, so nothing breaks.
- **Content pipeline.** Line banks are generated in batches from a per-villager style sheet, reviewed by sampling, and linted: placeholders resolve, length ≤ 140 characters, no banned words, no duplicates, pronouns from the dossier.
- **Age.** "13+" is stated on the about panel and in the debrief; no gate screen, which would kill the first ten seconds.
- **Talking to the stranger.** Villagers do not converse with the player in v1; the player whispers, listens and reads tags.
- **Accessibility.** Tags and bubbles are DOM. Bubbles are mirrored to a throttled polite live region; the story log is the full transcript.
- **Fonts** are self-hosted (variable Bricolage Grotesque, about 100 KB), so the page makes no third-party request.
- **Repository merge** uses `git subtree add` so the library keeps its history.
- **Seeds** come from `crypto.getRandomValues` on first load, outside the simulation, then live in the URL.
