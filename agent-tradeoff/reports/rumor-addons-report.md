# Reusable rumor add-ons and lightweight inference

Date: 2026-10-21. Base: `37b1784c8faeb15903a1a4ed9d13f4c5445ecf35`. Branch: `build/village`.

## Request and ruling

The owner asked for reusable rumor ideas and an agent that can write new game behaviors, then requested lightweight models combining OpenRouter with free built-in AI. Implemented two distinct layers: published reusable story packs for all visitors, and an owner-operated coding-agent drafting workflow. Runtime NPCs remain local. New conversations are not automatically published or executed as code. Automatic cross-player learning from arbitrary chat is not implemented; approved packs become available on the next release.

## Changes

- Three JSON packs contain 24 new stories. The loader discovers packs at build time, validates known cast/category/length/IDs/version, and rejects unknown fields. The library shows one full story at a time. Selecting a story gives a zero-credit notice; sending registers the self-contained written claim and lets the existing villagers spread it.
- Opening the library does not register new claims or alter the simulation RNG/decision list. Independent review caught a pre-existing written-story witness bug: category-only matching could confirm an unrelated pack story. `tickWitnessing` now excludes written claims from authored evidence and from facts that qualify typed claims; three regression tests cover confirmations, contradictions and that indirect path. A used story retains its published prose in offline replay. It is hearsay and does not acquire eyewitness evidence for another event. Original player input and conversation history are not harvested into packs.
- `npm run addon:draft` previews a brief without inference. With `--run`, it creates a detached worktree from committed HEAD, installs pinned dependencies, invokes the installed Codex CLI once, and then independently runs the release checks. No automatic merge/push/deploy; failed drafts are retained. Developer Codex usage is separate from the game's budget. Tests use a mock process runner, and the actual CLI was exercised in preview mode only; no additional coding-agent inference was purchased for verification.
- Both Wrangler environments now explicitly select Workers AI `@cf/meta/llama-3.2-3b-instruct` and OpenRouter `liquid/lfm-2.5-2.6b:free,google/gemini-2.5-flash-lite`. Source defaults match. No secrets, dependencies, reservations, caps, rate limits or notification wiring changed.

## Model evidence and limits

Checked [Cloudflare's 3B model reference](https://developers.cloudflare.com/workers-ai/models/llama-3.2-3b-instruct/), [free allocation](https://developers.cloudflare.com/workers-ai/platform/pricing/) and the [OpenRouter public model catalog](https://openrouter.ai/api/v1/models). The catalog listed the Liquid 2.6B free model with `structured_outputs` and `response_format`; paid Gemini prices remained $0.10/M input and $0.40/M output. Older Gemma 3 4B / Qwen 3 4B / Llama 3.2 3B free OpenRouter candidates were absent, so none was configured. Cloudflare's broad JSON-mode supported-model list does not list 3B, but its specific model input schema includes `response_format`; actual schema adherence remains subject to live verification and strict validation/fallback.

The coding workflow follows [official non-interactive Codex documentation](https://developers.openai.com/codex/noninteractive/) and installed `codex exec --help`. It is a trusted developer tool, not a secure executor for arbitrary public requests. Its timeout bounds the process, not developer account spend.

No real model request was made during this change. The previous production browser check was blocked by Turnstile 600010. Mocked provider tests verify selection, validation, bounded output, fallback and ledger correctness; they do not establish live output quality, availability or latency. Free quotas remain finite, and Cloudflare paid-plan overages are outside the OpenRouter ledger.

## Verification

- Focused pack/UI/provider/workflow checks: 68 passed initially.
- Desktop 1280×800, phone 360×800 and 360×640 production-build Chrome checks passed. Keyboard opens the library, changes a collection, selects a full sentence, focuses Whisper and sends. No overflow; send button remains in the viewport. The replay contains the exact sentence; no `/play` or `/interpret` request occurred. Evidence: `rumor-addons-browser.mjs`, `rumor-addons-browser-results.json`, and three PNGs.
- One parallel full-suite attempt exceeded an existing 1.5-second wall-time assertion while another obsolete test process was running. Stopped that process; the isolated 56-test regression file passed in 1.02 seconds. No threshold changed. The subsequent full serial suite passed all 824 tests. After the witness fix, all 827 tests in 70 files passed serially, with root typechecking, production build and bundle check. This includes 12 pre-existing untracked SEO tests; committed coverage is 815 tests in 69 files. The normal raw full-day replay pin remains `6137d96970f7a28e05e2fb37b57b9495274d1c256208d084818a336332994184`. Written-story runs now correctly omit unrelated firsthand evidence; ordinary runs are unchanged.
- Final root bundle check on the production-configured build: 353,767 bytes gzip, below 400,000.

## Release

Final checks passed. Independent review is recorded in `rumor-addons-review.md`: no remaining Critical/Important findings. The minor waiting-state observation is deferred. Commit/deployment results are recorded below after publication.

Unrelated pre-existing build-info changes, `reports/19b-report.md` and `apps/rumortown/src/seo.test.ts` remain unstaged.
