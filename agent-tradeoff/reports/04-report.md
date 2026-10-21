# 04: Final fixes

Base: `2f50570`. All ten Important findings from the independent read-only review were addressed. Root typecheck, 509 tests across 28 files, production build and the actual CI bundle gate pass. Bundle: **295,834 bytes gzip**, down from 547,983, below 400,000.

| Finding | Change and coverage |
|---|---|
| Player path changes replay | `sim/engine.ts`: NPCs separate from NPCs only; the player can still avoid NPCs. `replay.test.ts` compares 900 ticks of standing still versus chasing Mira, with identical event logs and distinct player positions. |
| Opening rumor rarely travels | `agents/tellings.ts`: telling base utility 0.30 → 0.35; known claims cannot be presented as fresh news. Regression over seeds 1–20, tick-130 Tom/Mira whisper, three days: 18 spread by first evening, all 20 by run end; 9 have confrontation/defence. This narrow sample does not establish a universal 20% extinction rate. Tests require broad spread, some drama and bounded repeat count rather than pinning those measured counts. |
| Invented evidence for typed claims | `registered-claim.ts` matches kind, subject, object and any specified target to an authored fact. `engine.ts` and `agents/witness.ts` use it; unrelated coin/target allegations remain unproven. Registration and actual secret-witness regressions cover both paths. |
| Exposed before died | `agents/endings.ts` checks exposure/split/repair before no-spread; one-hearer first-hand contradiction test. |
| Mutable queued accusation | `agents/context.ts`, `conversation.ts` capture the accusation in each queued side decision and bind speech effects to it; test overwrites the conversation accusation before the delayed response and checks backing/mood attribution. |
| Same-tile bedtime | `agents/schedule.ts` uses the requested activity when the installed path requires no movement; exact current-spot regression. |
| Grammar | `talk/grammar.ts` recognises authored third-person verbs and keeps object antecedents distinct from possessive-owner context. Exact real-claim assertions cover Greta/I/work and Hal/charged/me/you plus the preserved wheel owner. |
| Self-whisper | `agents/stranger.ts` rejects before mutation; the sheet gives the authored “Say that to my face?” refusal. Live and replay rejection regressions. |
| Privacy notice | `ui/whisper.ts` places the required notice beside enabled input and clears typed state/input on close. |
| Asset budget | CSS uses WOFF2 only; removed the duplicate unused 408,496-byte TTF from public assets. Rebuilt and ran CI's recursive gzip checker. |

Additional small fix: topic selection consistently accepts midnight-based minutes; engine converts its day-relative minute at the call. The 06:30 regression remains in the morning.

## Replay hash

The walking isolation, corrected clock/grammar and calibrated telling change the old event log. Inspected the new actual 900-tick smoke output: 24 villagers, one whisper, 1,387 speech lines, 197 belief events, six defences and a grudge ending. Independent smoke and repeated-test serialization agree:

`2ce0d00d4593488c7aee1af1a2a4ce824f571ffc9a468eaad356bf8734d84159`

Seed 731, Mira, `tom-stole-bread`, tick 60, 900 steps. The test pins this reviewed replacement rather than silently accepting any hash.

## Parked minor findings

Retell distortion, content decay, correction timing/origin multipliers, separate trust dimensions, broader appraisal/side-taking/reflection and per-claim dare verdicts remain model scope debt; each needs a deliberate model/contract change rather than a release-fix patch. A larger seed/claim/route sample and external playtests remain useful calibration work. Renderer command-budget tests are not named-phone performance evidence. Cooldown fallback and app-shell refactoring remain follow-up maintenance. Live AI evals and external account caps require owner credentials/configuration.

## Rereview follow-up

The first rereview found that skipping every known claim was too broad. Revised the rule: a new direct teller can corroborate a known rumor (voiced as confiding), while the same direct teller needs newer first-hand evidence to repeat it. Known positive news stays suppressed, but an alternative can still defend against an active harmful belief. The approach-to-utterance path rechecks the same rules when the speaker arrives. Regression tests distinguish new teller, repeated teller, stronger same-teller correction, and an actual approach conversation. Telling base utility is now 0.40 after restoring corroboration. Initial 0.35/18-of-20 measurements above describe the earlier intermediate fix.

Queued replies now retain live turn bookkeeping while their effects remain attached to the original accusation. Pending typed submissions disable input choices and the text field, preserving Close and restoring fields on failure. The independent review's remaining concerns and follow-up disposition are in `04-rereview.md`.

The reviewed final seed-731 smoke log has 1,700 lines, 545 belief changes, 79 defences across all claims, and an **exposed** ending. New hash after restoring evidence paths and turn bookkeeping: `d5b44d1cc69d48f865963192513b83b0244dad204b3183d20ec7b69dad8619f9`. The earlier hash above is historical. The sample test includes defences using the linked innocent alternative, since those are meaningful responses to the allegation too.
