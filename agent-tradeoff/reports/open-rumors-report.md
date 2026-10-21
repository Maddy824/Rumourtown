# Open-ended public stories

The owner rejected both a twelve-category matcher and a larger hardcoded list, and asked for broader knowledge. Typed whispers now preserve the exact event sentence rather than converting it to a category. Model knowledge supplies bounded social annotations and a story-specific question; simulation knowledge remains each villager's beliefs, source memory and relationships.

## Delivered scope

- New `/rumor` semantic route accepts open events: actor, affected person, reputational valence, severity and a short question. It uses the existing shared ledger, admission, human check, free-first providers and paid caps. No new models, secrets, dependencies, server prose cache or per-tick inference.
- New browser flow: typed stories bypass the legacy matcher and use semantic AI when available. Failures, timeouts and budget exhaustion leave the exact story playable with neutral meaning. The player can continue without waiting and remove assignments.
- Exact wording, interpretations, proposed question and sharing disclosure appear before confirmation. The owner-authorized privacy amendment is recorded in the design plan and CONTINUE. Confirmed stories appear in dialogue, exported research and replay links; unsent text does not. No raw story enters server logs/caches.
- Canonical `story_` claims retain exact text/meaning for offline replay. Unknown actors use the village topic with neutral reputational valence; the affected person is separate. Generic world events have no invented cast actor. Open stories never match authored eyewitness evidence or mutate world facts.
- Story dialogue uses a generated initial question when available, then local bounded quotations informed by speech act, belief and character honesty. A bounded, explicitly documented attention bonus lets new stories compete with the village's preloaded rumors. It changes telling utility only, not belief or evidence.
- Developer agents get a zero-credit `whisperStory` tool. Research exports record the new model version `v4-open-stories-1`, parameters and annotation data. Older incompatible agent research versions are rejected; ordinary share-link compatibility remains.

## Knowledge and research limits

This is open-ended event representation, not an exhaustive world database or a guarantee of correct semantic parsing. The 100-character story limit protects readable bubbles and bounded replay links. General knowledge comes from the existing lightweight models; no live web retrieval or fact checking was added. Neutral fallback preserves wording but does not understand its meaning. Models can misassign roles or propose an unsuitable question, so both are previewed and removable. No new combat, death, inventory or arbitrary behavior-code execution is implied by a rumor.

The design notes connect source monitoring and social diffusion research to the implementation, with explicit limits: `docs/superpowers/plans/2026-10-21-open-rumors.md`. Game coefficients are not validated human-population estimates.

## Validation

Final full check: root typecheck, 867 tests / 74 files, production build and bundle gate passed (349,647 / 400,000 gzip bytes). Local count includes 12 pre-existing untracked SEO tests. The unchanged authored replay SHA-256 remains `6137d96970f7a28e05e2fb37b57b9495274d1c256208d084818a336332994184`; changes are restricted to newly introduced open claims. Open-story twin simulations match exactly, propagate hearsay and do not blame/kill Tom or invent eyewitness evidence. API tests cover unknown perpetrators, discoveries, impossible events, victim blame, malformed model answers, shared quotas and cap exhaustion. UI tests cover consent, editing, late responses, neutral correction, local mode and library selection.

Production-preview Chrome checks passed for unknown-killer and moon stories at 1280×800, 360×800 and 360×640, with mocked inference: exact wording, unknown actor, explicit disclosure before registration, keyboard confirmation, correct replay payload, no overflow/page errors. See `open-rumors-browser.mjs`, JSON evidence and screenshots. Independent review approved after fixing reversed passive roles in the legacy local shortcut (removed from this flow) and exposing reputation/importance at confirmation. 42 independent scoped tests passed; see `open-rumors-review.md`. Deployed in code commit `506ea5d344873cb8c95b2aa42be4d32b0f2e2b2d`; live browser verification passed. Live model quality has not been measured by these mocked provider tests.

## Release

- Code: `506ea5d344873cb8c95b2aa42be4d32b0f2e2b2d`.
- API: `ff4c92d3-9fcb-4844-9f86-52cb63c780c9`.
- Site: `b09694c0-beef-4a79-9c30-78bac170a2e7`.
- Live asset: `/assets/main-DbOSUlxP.js`.
- Live API health returned `{"ok":true}`. No production secrets, provider configuration or spending limits changed.
- Live desktop/360×800/360×640 checks passed for both stories: exact wording, disclosed sharing, no premature registration, visible interpretation, keyboard confirmation, neutral replay payload, no overflow or page errors. External requests were deliberately blocked to exercise free fallback; these checks did not spend inference credits or measure live model quality. See `open-rumors-live-browser-results.json` and six live screenshots.
- GitHub CI [39653917608](https://github.com/Maddy824/Rumourtown/actions/runs/39653917608) passed on Node 22 and Node 25 for release head `e29a282`. Local total includes 12 pre-existing untracked SEO tests; the committed suite contains 855 tests across 73 files.
