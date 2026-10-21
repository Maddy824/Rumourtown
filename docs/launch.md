# Launch copy

Updated 22 October 2026 for the 36-person village and open stories. Publish after owner playtests and live AI checks. The library link points to source until an npm release is confirmed. The [research index](research/README.md) distinguishes implemented tools from pending model comparisons.

## Show HN titles

1. Show HN: A village of 36 people who remember where a rumor came from
2. Show HN: Rumourtown, a deterministic village with beliefs and remembered sources
3. Show HN: Rumormind, a TypeScript belief engine with provenance and replay

## Show HN body

I built [Rumourtown](https://rumourtown.dev) to make social simulation visible. Thirty-six fictional adults follow schedules, trade stories and remember who told them what. Whisper that Tom stole bread, watch the story travel, then ask each villager why they believe it. Two tellers can still lead back to one source. Corrections leave a trace, friendships affect gossip, and exposure damages trust in the stranger.

The simulation runs locally with seeded randomness and fixed-order updates. A dependency-free TypeScript library tracks beliefs, sources and relationships. You can write an open story, review its wording and meaning, then send it into the village. Optional AI helps interpret stories and voice conversation, behind a $0.019 daily and $7 lifetime application ledger plus separate provider key caps. Stories remain playable with neutral meaning when inference is unavailable. A rule-based reply guard and an SLM study explore faithfulness to character beliefs; comparative model results and human validation remain pending.

Try Mira first, follow a rumor, then inspect its remembered sources. [Source and run instructions](https://github.com/Maddy824/Rumourtown). [Belief library](https://github.com/Maddy824/Rumourtown/tree/build/village/packages/rumormind).

## Fifteen-second muted clip

| Time | Shot | On-screen caption |
|---|---|---|
| 0–3 s | Awake villagers walking and talking; frame Mira's bakery and the stranger. | 36 people. One story. |
| 3–6 s | Choose the ready-made bread rumor, select Mira, then show the reaction. | Tell Mira that Tom stole bread. |
| 6–9 s | Follow the rumor and show its route through the village. | Two tellers can share one source. |
| 9–12 s | Inspect a belief and its source chain, then a correction or witnessed alternative. | Ask why they believe it. |
| 12–15 s | Show the resulting relationship or belief change, then the share control. | The village remembers. |

Use cuts between recorded moments; do not imply the whole day lasts fifteen seconds. Keep captions inside the central 80% for phone crops, with no audio-dependent information. Show the actual outcome of the recorded run.

## X / Bluesky posts

1. I built a village of 36 people who gossip. Tell Mira that Tom stole bread, trace the story through the town, then ask each person why they believe it. Rumourtown runs in your browser. https://rumourtown.dev
2. Two tellers can still be one source. Rumourtown tracks remembered origins, corrections and trust in a deterministic social simulation. The belief engine is a dependency-free TypeScript library. https://github.com/Maddy824/Rumourtown
3. Can a small model speak faithfully from a character's false beliefs? Rumourtown has a seeded village, a rule-based verifier and a study harness for that question. The comparative model study is still ahead. https://github.com/Maddy824/Rumourtown

## README GIF plan

- Capture at 960×600, 30 fps; export 15 seconds at 15 fps, targeting under 5 MB. Keep text legible.
- Use seed 731 and the current cast and engine. Record an awake daytime visit to Mira and a confirmed bread rumor. Save the actual share link from that run, which records its starting time and interventions.
- Old `cast: v1` replay payloads from the 24-person build do not describe the current `v4` cast. Do not reuse the old encoded launch link.
- Keep corrections in chronological order. Save the finished clip as `docs/images/rumortown.gif` and add descriptive alt text when it exists. Until then, use the existing village screenshot.

## GitHub description

A browser village of 36 people who gossip, with deterministic replay, beliefs with provenance, cost-capped AI and a study of dialogue faithful to character beliefs.
