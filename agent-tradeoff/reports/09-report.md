# 09 report

STATUS: DONE

Implemented the owner's expanded interactive-world direction and the pending news/new-run improvements. The cast is now version `v2`; the observation model is `v2-spatial-motives-1`. Older links retain their seed and omit old whispers so changed mechanics do not masquerade as the same replay.

## Behaviour

All 24 villagers have an authored aspiration, worry, habit and four bounded social motives. Contextual utility terms distinguish protection, friendship, rivalry and hesitation over uncertain hearsay. These coefficients are design assumptions. Tags show a person's inner life and a walk-over action alongside their existing beliefs, relationships, moods and reasons.

Terrain-aware A* prefers paths and bridge/floor/door tiles over grass and fields. Buildings retain their entrances, the river remains impassable, and the bridge is the only crossing. Four departure times were moved earlier to retain enough travel time for private events. The river is painted as a recessed channel with bank shading, reeds and moving surface highlights; reduced motion freezes the highlights. A persistent gold footprint and “You” label identify the player.

Explore supplies a live atlas, people markers, speaking highlights, recent conversation locations, destination controls and a visible 24-person directory. The underlying village keeps moving. Held WASD/arrows keep the player walking; water clicks explain the bridge crossing. Notebook holds the current game while observations or experiments are inspected. The final evening offers a new village with a new seed, empty whispers and no stale development tick.

The notebook exports JSON inputs/state/events and CSV events. Every real-engine spoken line records a coordinate and, when inside a named place, a place id. Runtime typed claims are separated from dawn inputs when exporting, including removal of reverse contradiction links that registration added. Reconstruction restores them at their original whisper ticks.

Four comparisons remove whispers, repetition, negative sharing advantage, or affinity bias. Each compares ordinary/changed rules for three days, on one or five consecutive seeds, without changing the observed run. Downloads retain settings, per-seed summaries, day endings and time series sampled every 90 ticks. Cancellation yields between short batches.

## Evidence and limits

Seven linked sources cover everyday gossip, conditional motive/cooperation models, reputation consensus, repetition, negative-content sharing, source dependence and the ODD reporting protocol. `docs/research-model.md` distinguishes experimental findings, formal model results and authored translations, and describes update order, parameters, metrics and limitations. Negative claims are not labelled false. Numeric character values are not psychometric scores. No human predictive or empirical validation is claimed.

## Verification

- Root typecheck passed.
- Root test suite: **533 tests across 33 files passed**.
- Production build passed; **307,577 gzip bytes**, below 400,000-byte gate. No dependencies added.
- Weighted A* costs match an independent Dijkstra implementation; a dedicated regression demonstrates a longer paved route winning over a lawn shortcut. Doorway, bridge and destination connectivity tests pass.
- All authored secret windows retain the worst-case path length plus five spare minutes.
- A five-seed, three-day spatial audit checked all 24 NPCs and the player at every tick: no blocked positions; 1,806 sampled positions on the middle bridge column; 25,431 spoken lines all with locations. Player repeatedly travelled between orchard and bakery.
- Export reconstruction reproduces exact events for both an authored rumor and a runtime typed claim. Exporting does not mutate the observed run.
- No-whisper control with no whispers produces identical per-seed summaries and all 31 time points. Cancellation verified.
- Chrome desktop: 24 atlas markers, travel to orchard over bridge, held-key movement, downloads, five-seed experiment (10 result rows), unchanged live tick during notebook, Escape/focus restoration, final evening/new village.
- Chrome at 360 px: no document overflow; guide fits viewport; people directory opens character tags; modal focus remains inside; screenshots saved.
- No browser page errors in either run.
- Fresh desktop benchmark: shipped 24-person three-day simulation 576.7 ms total, median .1453 ms, p95 .6107 ms; 60-person stress case 13,250.3 ms. Full values in `bench/results.md` and README. These are desktop CPU timings.

## Replay audit

Seed 731, whisper to Mira at tick 60, 900 ticks: **4,307 events, 844,314 raw JSON bytes**. Node 22, Node 25 and Chrome produced byte-identical raw JSON:

`2b87d54c36d5823230d99b58eb1f296c40b024de93e5681e41a87e061a81e020`

Compared the previous raw log before updating the pin. Location fields account for the first structural difference. Claim-backed news now voices the claim recorded by the engine; terrain choices, departures and motives subsequently change encounters and event counts. This run's first-day verdict is quiet rather than the previous exposed verdict. Those are intended model changes, not a runtime mismatch. The broad 20-seed spread/drama checks remain green.

## Artifacts and follow-up

- `docs/images/village-v2.png`, `docs/images/atlas.png`.
- `09-phone-atlas.png`, `09-phone-character.png`, `09-phone-notebook.png` beside this report.
- New model documentation: `docs/research-model.md`.
- Attribution rule: root `AGENTS.md`, owner identity retained; no assistant co-author trailers.

Public hosting, optional AI credentials and npm publication remain separate owner-checklist items. This update was tested locally; no public Cloudflare deployment or AI spending was performed. A full research release still needs external data, calibration, independent evaluation and a larger uncertainty/sensitivity study.
