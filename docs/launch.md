# Launch copy

Prepared 21 October 2026. Publish after owner playtests, deployment and the live interpretation eval pass. The library link currently points to source; change it to the npm release after publication. Timing below is the recorded Apple M4 Max benchmark, not a phone claim.

## Show HN titles

1. Show HN: A village of 24 people who remember where a rumor came from
2. Show HN: Simulating three days of village gossip in 0.51 seconds
3. Show HN: Rumormind, a TypeScript belief engine tested in a 24-person village

## Show HN body

I built RumorTown to make social simulation visible. Twenty-four fictional adults follow schedules, trade stories and remember who told them what. Whisper that Tom stole bread, watch the story travel, then ask each villager why they believed it. Beliefs track provenance, so two tellers can still lead back to one source. Corrections leave residue, friendships affect gossip, and exposure damages trust in the stranger. The simulation is deterministic, with authored dialogue and research-informed rules whose tuned parameters are documented. An optional interpreter turns typed whispers into a fixed taxonomy, with a deployment designed around a prepaid $10 cap. Ready-made whispers work offline. Each shared link preserves the seed and recorded whispers. Try Mira first, enable the threads, then rewind. [Library](https://github.com/Maddy824/Rumourtown/tree/build/village/packages/rumormind).

## Fifteen-second muted clip

| Time | Shot | On-screen caption |
|---|---|---|
| 0–3 s | Village already walking and talking; frame Mira's bakery and the stranger. | 24 people. One story. |
| 3–6 s | Cut to the ready-made whisper, Mira selected, then the reaction. | Tell Mira that Tom stole bread. |
| 6–9 s | Toggle Who told whom; advance at 8× and show red threads. | A teller is not always a new source. |
| 9–12 s | Open a belief tag and its chain; cut to a defence or witnessed alternative. | Ask why they believe it. |
| 12–15 s | Cut to the exposed evening card, then the share control. | The village remembers who started it. |

Use cuts between recorded moments rather than implying the whole day lasts fifteen seconds. Keep captions inside the central 80% for phone crops; use no audio-dependent information.

## X / Bluesky posts

1. I built a village of 24 people who gossip. Tell Mira that Tom stole bread, trace the story through the town, then ask each person why they believed it. RumorTown runs in your browser. https://github.com/Maddy824/Rumourtown
2. Two tellers can still be one source. RumorTown tracks remembered origins, corrections and trust in a deterministic social simulation. The belief engine is a zero-dependency TypeScript library. https://github.com/Maddy824/Rumourtown
3. Three days of gossip, 24 villagers, about 0.51 seconds of simulation on my M4 Max. Rendering has its own budget. I published the code, measured results and a small belief engine here: https://github.com/Maddy824/Rumourtown

## README GIF plan

- Capture at 960×600, 30 fps; export 15 seconds at 15 fps, targeting under 5 MB. Preserve text legibility before colour count.
- Seed **731**, `tom-stole-bread` whispered to **Mira at tick 60**. The reproducible first-day outcome is **exposed** after the truth is defended; the stranger's credibility falls. Use the story/tag and thread views for the middle shots.
- Replay payload: `{"v":1,"seed":731,"cast":"v1","interventions":[{"tick":60,"listener":"mira","claimId":"tom-stole-bread"}]}`.
- Link: `GAME_ORIGIN/#eyJ2IjoxLCJzZWVkIjo3MzEsImNhc3QiOiJ2MSIsImludGVydmVudGlvbnMiOlt7InRpY2siOjYwLCJsaXN0ZW5lciI6Im1pcmEiLCJjbGFpbUlkIjoidG9tLXN0b2xlLWJyZWFkIn1dfQ`.
- Replace `GAME_ORIGIN` with the deployed game URL. For recording the whisper from the beginning on the local development build, insert `?t=1` before the hash, select 8× and record the tick-60 intervention. A normal link opens at the standard 09:10 view with that whisper already applied.
- Montage the five moments above; do not remove a correction or reverse chronology to manufacture an outcome. Save to `docs/images/rumortown.gif`, insert it near the README opening, and use a descriptive alt text. The existing screenshot can remain as a fallback.

## GitHub description

Whisper a lie to a village of 24 people and watch it spread. A deterministic social simulation with replay links and a zero-dependency TypeScript belief engine.
