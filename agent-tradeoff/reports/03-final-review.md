# 03: Final review

Read-only reviewer examined `build/village` through `2f50570`, including integration and renderer round 3. `master` is absent; the original base branch is `main`. Critical findings: none. Verdict: changes needed.

## Important merge blockers

1. `sim/engine.ts:212`: NPC separation includes player position, although shares omit the player's route. Seed 731, no whispers, chasing Mira every three ticks diverges at event 417/tick 300. Remove player influence on NPC paths and compare walking histories in a replay regression.
2. `sim/agents/tellings.ts:74`, `conversation.ts:338`: telling utility loses to ordinary small talk. Independent seeds 1–20 with a tick-130 Tom/Mira whisper: 18/20 never pass it, across three days. Tune the competition and validate a seeded sample without forcing a showcase seed.
3. `sim/engine.ts:159`, `agents/witness.ts:31`: subject/kind-only matching invents evidence for unrelated typed claims. Tom stealing coins from Jonah must not be exonerated by delivering bread to Ada. Match authored facts by relevant object and target.
4. `sim/agents/endings.ts:52`: single-hearer death is checked before exposure. A corrected, exposed lie must get the exposed ending.
5. `sim/agents/conversation.ts:534,565`: delayed side-taking retains mutable conversation state. Capture and use the original accusation throughout the response.
6. `sim/agents/schedule.ts:87,141`: same-tile bedtime installs an already-complete path but leaves activity at rest. Apply the destination activity when no movement remains.
7. `sim/talk/grammar.ts:202,245`: Greta becomes “me works”/“you works”; Hal's “charged him” binds to Ivo and reverses the payer. Fix agreement and object antecedents, preserving “his wheel”.
8. `sim/agents/stranger.ts:34`: a whisper about its listener is falsely counted as successful even though hearing ignores it. Reject before mutation and show the authored refusal in the sheet.
9. `ui/whisper.ts:218`: enabled typed input lacks the required privacy sentence from design §13.
10. CI bundle gate: controller measured 547,983 gzip bytes vs 400,000. Remove unused deployed TTF, rebuild and run the actual bundle gate.

## Safety and determinism audit

The only OpenRouter dispatch follows a successful atomic reservation. SQLite checks spent plus reserved; unknown failures charge or retain the hold. No spend bypass found. Provider prepaid credit, top-up disabled, and key limits still require owner setup for the lifetime cap.

No raw user prose reaches authored dialogue, cached payloads, URL or share card. Cache keys are text hashes and values are validated signed taxonomy. Links reconstruct bounded taxonomy IDs rather than storing signatures; document this deliberate implementation choice. No production sim/library wall-clock or unseeded randomness found; matching tests are performance checks.

## Minor debt (not merge blockers)

- The library exports retelling but game transfers an unchanged claim; no content decay or origin/early/repeated correction multipliers.
- Side-taking uses the evidence gate and loyalty, not full wrongness/reciprocity/conflict inputs. Trust has one dimension, without separate integrity/competence or habitual-gossip standing penalties.
- Dusk reflection uses importance × recency, without relevance or the threshold-150 trigger; timed mood modifiers lack a separate appraisal layer.
- Dares infer the winning claim from summary wording and conservatively miss non-winning claims' successes.
- Dialogue permits cooldown exhaustion fallback; early-morning topic conversion is inconsistent.
- The large app shell can be split later. Cache miss coalescing and stronger API stubs can follow without weakening reservation safety.

Root checks at review time: 502 tests/typecheck/build passed; bundle gate failed. Browser smoke passed desktop and 360 px width. Named-phone timing, physical Safari, live model evals, owner playtests and deployment remain unverified gates.
