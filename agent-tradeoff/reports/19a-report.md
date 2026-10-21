# 19 A and C13: Local whisper interpretation

STATUS: BLOCKED

The requested browser implementation is complete. Automated checks and the allowed concurrent-work exceptions are recorded below. Actual desktop/360 px geometry and keyboard traversal remain blocked because Chrome cannot launch in this sandbox. Commits are unavailable because `.git` is read-only; the owner explicitly allowed leaving the changes uncommitted in that case.

## Scope and behavior

This task edited only browser code in `apps/rumortown/src/net/`, the minimal status-line change in `apps/rumortown/src/ui/whisper.ts`, this report, and the requested README updates were edited. Section B and C10–12 were not changed. No dependencies, simulation code, replay pins, build configuration, or unrelated working changes were edited by this task. Generated build-info files were preserved.

- `local-interpreter.ts` is pure, synchronous and deterministic. It resolves case-insensitive names and possessives, unique one-edit/transposed misspellings, optional nicknames, dossier roles and reviewed spouse links. The browser dossiers do not define spouses, so the small lexicon supplies only Sol/Greta; an explicit `spouse` field is also supported for callers. Unknown spouses and ambiguous roles abstain. Names resolve in mention order; appropriate kinds take the next distinct villager as target.
- `local-lexicons.ts` covers all twelve kinds, favourable kinds first, reviewed objects, strong/weak matches, and intensity words. Confidence is 0.9 for an unambiguous strong match, 0.7 for a single weak match, and 0.5 for conflicting harmful kinds. Negated claims abstain, including denial of a broken promise. Avoiding someone or skipping dinner does not become shirking work. Command-like, ambiguous and multi-sentence text uses the remote tier.
- `blocklist.ts` copies both Worker word lists exactly. `blocklist.test.ts` reads the actual `apps/api/src/moderation.ts` source with Node filesystem I/O and compares each list, including order. A second source-reading test checks the Worker object allowlist. The Worker files were not changed. Additional local guards reject protected-trait and sexual terms before any interpretation request.
- `whisperFlow.ts` runs local interpretation before obtaining a human-check token. Claims at confidence ≥ 0.75 transition directly to confirmation; local refusals transition directly to the existing refusal line. Uncertain/weak results follow the existing signed Worker path. A local result has an explicit `source: 'local'` and no invented signature or issuance metadata. Concurrent/reentrant start protection remains intact.
- Task 18's `warm()`, key prefetch, token re-arm code and separate 12-second first/6-second subsequent token deadlines plus full 6-second interpretation deadline remain intact. Local answers do not consume the first token-wait allowance. Opening the sheet still warms Turnstile and prefetches the key independently of interpretation; local classification itself makes no network request.
- `whisper.ts` shows “Understood locally” in the existing small live status text and preserves “Change it” and confirmation before registration. The same status element reserves two line heights, stays present while empty, and uses a flexible width independent of label length. “Asking the village…” and “Understood locally” replace text in that box. Confirmation appears as soon as the flow promise resolves, with no added timer or animation delay.

## Offline eval

Command: `npx vitest run apps/rumortown/src/net/local-interpreter.test.ts --reporter=verbose --silent=false`.

The test reads all 200 items from `apps/api/evals/lies.json`, prints the table and in-scope fallbacks, and enforces ≥ 75% kind-and-subject accuracy on answers and zero out-of-scope claims. “Needs Worker” uses the production decision: unsure or claim confidence below 0.75; local refusals need no interpretation request.

| Metric | Real count | Result |
|---|---:|---:|
| In-scope kind + about accuracy on all returned claims | 140/140 | 100% |
| In-scope kind + about accuracy at the local acceptance threshold | 140/140 | 100% |
| In-scope coverage accepted locally | 140/156 | 89.74% |
| Out-of-scope abstention, meaning no claim at any confidence | 44/44 | 100% |
| False claims on out-of-scope inputs | 0/44 | 0% |
| Needs Worker | 35/200 | 17.5% |
| Local refusal | 25/200 | 12.5% |
| Local confirmation | 140/200 | 70% |

The 16 in-scope fallbacks comprise all twelve command-injection examples and four conservative negation abstentions: an insult when someone was “not there,” two boasts that “no one” can compare, and a donation to someone who “could not afford” it. The fixture measures kind/about, not full claim correctness or live traffic savings. Target/object/intensity/valence behavior has separate unit tests.

The 200-item Node eval pass measured p50 **0.045 ms**, p95 **0.066 ms**, maximum **0.574 ms**, under the local 5 ms target. This is a process measurement after preceding unit tests, not a browser cold-start benchmark. Lexicons plus both copied blocklists total **1,604 bytes gzip**, summing the two source files, below 12 KB. The complete fresh production game assets total **342,834 bytes gzip**, below 400,000 bytes.

## Verification

- `npx vitest run apps/rumortown/src/net apps/rumortown/src/ui/whisper.test.ts`: **133 passed**, five files. This retains Task 18's warm/re-arm, scoped deadlines, retry and close-in-flight tests, and covers local acceptance/refusal, weak fallback, change controls, source-list parity and the offline eval.
- Root `npm run typecheck`: **passed** on the final rerun. Earlier failures in `sim/agents/night.test.ts` disappeared as that other run completed its edits; those files were left untouched.
- Root `npm run build`: **passed** on the final rerun. Vite emits its existing config-loader and large uncompressed chunk notices.
- Root `node .github/workflows/check-bundle.mjs`: **passed**, 342,834/400,000 bytes gzip, seven game assets, following the successful root build.
- Root `npm test`: **752 passed**, 62 files, on the final rerun. Earlier runs encountered concurrent failures in `sim/agents/night.test.ts` (typechecking) and `render/daylight.test.ts` (NaN daylight input), within the owner's allowed exceptions; none were edited here. Earlier root tests also failed in the concurrently changed `agent/environment.test.ts`, `research/model.test.ts` and `replay.test.ts` during the day-length migration; those were recorded as failures rather than ignored under the narrower directory list. All cleared in the final root run. This task did not change the replay pin.
- Scoped `git diff --check`: **passed**.

The existing sheet DOM tests cover desktop/phone focus targets. The additional integration test confirms local card visibility, focus on “Whisper it,” “Change it” prefilling manual fields, no `/interpret` request, and the persistent status element/style. These tests do not establish real layout geometry. A Playwright headless Chrome launch was attempted and failed with `Target page, context or browser has been closed` under the sandbox. Desktop and 360 px visual/keyboard verification remains a follow-up; no browser screenshot or measured layout-shift result is claimed.

## Commits and follow-up

Explicit-file staging of the network changes failed with `Unable to create .../.git/index.lock: Operation not permitted`. Nothing was staged or committed. The branch remains `build/village`. While this task ran, another task also added sleeping-villager behavior to `whisper.ts`; those concurrent hunks were preserved and are not part of this task's status-line changes. The last existing commits use Madhav Sunil's required attribution; no assistant byline or co-author trailer was added.

1. Verify actual desktop/360 px status geometry and keyboard traversal in a browser outside this sandbox.
2. From a workspace with writable `.git` and green checks, commit the network, UI, task-report directory and root README separately with plain `19:` messages, using `Madhav Sunil <94164709+Maddy824@users.noreply.github.com>`.
