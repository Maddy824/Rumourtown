# Spike findings (2026-10-21)

Played in Chromium via Playwright, seed 731, whisper "Tom stole the bread" to Mira at tick 5, witness off and on.

## Verdict: go on mechanics, not yet on drama

**Works**
- Share links reproduce a run exactly; the story log reads as a story without explanation.
- The inspector shows provenance and *why* evidence counted: "Remembered as a separate source" vs "Same remembered origin; familiarity only". This is the library's core idea, visible.
- The witness toggle changes the path: Ben defends with "I saw it myself. I trust Tom."
- End-of-day outcome line is readable and warm ("Mira apologized to Tom. Next time, he'll leave a note.").
- Visual style is calm and coherent; no console errors except a missing favicon.

**Does not work yet**
1. **The conflict resolves in six game-minutes.** Mira confronts Tom at 09:18, Tom explains at once, Mira apologizes at 09:24. The lie never reaches Ben before the truth does. Witness on/off produces the same ending.
2. **Nothing is at stake after 09:24.** The rest of the day is everyone repeating "tom took the bread to Ada".
3. **Dialogue templates ignore valence and addressee.** A favourable claim is framed as "Something smells off" / "Explain that"; Tom gossips about himself in the third person; names interpolate lowercase; Tom says "I'll pay Mira" to Mira.
4. Belief rules were hand-tuned by Codex and differ from the `rumormind` library; the real build should use the library.

## What the real build must do differently
- **The truth must travel slower than the lie.** Tom avoids conflict: he explains only when confronted privately, clams up when accused in public, and never volunteers. Mira's apology needs belief below a threshold *and* time; a correction leaves residual suspicion (continued influence).
- **Spread before confrontation.** Mira should meet Ben (gossip) before she meets Tom; routes and schedules must create that order. Confrontation should be a costly, public act that recruits allies (side-taking), not the first thing a believer does.
- **Stop talking about settled claims.** A claim stops being gossip-worthy once the listener already knows (stifling) or once it is resolved; favourable claims are told with reassuring lines, harmful ones with warning lines.
- **Line selection keyed by (act, valence, speaker, addressee, confidence)**, with cooldowns, hedged variants for weak beliefs, and callbacks ("you shouted at me yesterday").
- **Ending variety.** At least: village split, exposed liar, quiet reconciliation, unresolved grudge.
