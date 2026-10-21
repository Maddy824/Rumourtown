# Whisper interpretation grounding

The owner typed `someone killed tom` and received a confirmation about Rosa doing a kindness for Ada. The old schema accepted any valid cast IDs, even when unrelated to the input; the rumor taxonomy cannot represent killing. The actual production inference trace is unavailable because player text is not logged. The reported substitution is reproduced with a mocked, schema-valid model reply.

## Changes

- Death/killing input now receives an explicit unsupported-story explanation before inference, on the browser and API. No character is killed or blamed. Conversation through Talk or act is unchanged.
- Remote interpretations must name people grounded in the input (explicit names/nicknames or unique exact roles), with confidence at least 0.75. Both fresh and cached API results are checked; the client checks signed remote replies too.
- Refused interpretations cannot fall through to a default manual story. Editing or choosing an authored/library story recovers the form. Manual stories now receive a confirmation before registration; editing their fields invalidates that confirmation.
- Removed the misleading default reputation preview shown before the typed input was interpreted.

## Rulings and limits

This is a correctness fix, not unrestricted narrative understanding. The current 12-category reputation model still cannot represent deaths or an unknown perpetrator. It now states the limitation instead of substituting another story. The shared guard is a conservative consistency floor: it can reject unsupported wording or indirect references, and it does not prove semantic equivalence when a model returns a wrong action involving the same people. The death-word guard can also reject metaphors containing those exact words. The prompt explicitly requires abstaining instead of inventing actors/categories.

Raw player text remains excluded from simulation claims, links, exports, bubbles, and caches. No runtime dependencies, simulation mechanics, budgets, providers, secrets or Wrangler environments changed. The shared guard lives outside the public rumormind library API.

## Validation

- Root typecheck, 846 tests / 71 files, production build, and bundle gate passed (354,121 / 400,000 gzip bytes). This local count includes 12 pre-existing untracked SEO tests; committed scope is 834 tests / 70 files.
- The full-day replay pin remains `6137d96970f7a28e05e2fb37b57b9495274d1c256208d084818a336332994184`; no simulation code changed.
- Chrome production-preview checks passed at 1280×800, 360×800 and 360×640. The exact reported input shows the explanation, stays out of replay, and makes no inference request. Editing to a supported story restores confirmation and keyboard submission. No overflow or page errors; button remains visible. See `whisper-grounding-browser.mjs`, JSON evidence and screenshots.
- New tests cover unknown-killer input online/offline, refusal repeat-submit, old unrelated signed cache entries, billing settlement without caching an ungrounded output, low confidence, and signed client output containing invented people.
- Independent read-only review cleared the change with no Critical/Important findings and 198 additional focused test passes. See `whisper-grounding-review.md`.

## Release

- Code commit: `fa276db0e7ed5ad7143227de53cea4c42108250a`.
- API version: `93015a05-3359-43e2-8d64-4becec294988`.
- Site version: `f3887484-dc36-41dc-b45a-669d48cdc946`; main asset `/assets/main-B26oeCYE.js`.
- API health returned `{"ok":true}`. The same three-viewport browser checks passed against https://rumourtown.dev with no inference calls, page errors, overflow or rejected-input replay leakage; see `whisper-grounding-live-browser-results.json` and screenshots.
- No live model request was needed for this reproduction. Local preview stopped after verification. GitHub CI status can be checked on the final release commit.
