# 19b: Workers AI remote tier and Worker speed changes

Implemented section B (7–9) and the Worker parts of section C (10–12). Browser interpretation, Turnstile warming, confirmation-card behavior and the local-interpreter eval belong to other runs. No edits were made by this run to `apps/rumortown`; root checks generated its build-info normally. Existing build-info and unrelated working changes were preserved. Branch: `build/village`. No dependencies or simulation/replay pins changed.

## Behavior

- Added `AI` bindings in the top-level Wrangler config and `[env.production.ai]`. Local AI remains off; production remains explicitly enabled.
- Workers AI runs before OpenRouter, using `@cf/meta/llama-3.1-8b-instruct-fast` by default and `env.WORKERS_AI_MODEL` as the override, including `@cf/meta/llama-3.3-70b-instruct-fp8-fast`.
- Both providers share the cast/taxonomy prompt and schema. Cast entries are `id: name, role` lines, kinds are one per line, and the prompt no longer repeats the JSON shape. The schema appears once in each request: Workers AI takes the bare schema; OpenRouter retains its strict named wrapper. Temperature is 0 and maximum output is 120 tokens, including in worst-case reservations.
- Workers AI accepts object or JSON-string `response` payloads, applies the existing validator, signs successful claims and caches only those signed claims. A valid unsupported result returns without OpenRouter. Missing binding preserves the existing OpenRouter route.
- Any Workers AI exception, quota/error response, invalid JSON/claim or six-second deadline falls through once to the unchanged free-first OpenRouter model chain. The deadline races the binding promise and signals cancellation; late completion cannot sign, cache or settle a second result.

## Money and counting

The single global ledger still gates dispatch. Workers AI uses a $0 reservation and $0 settlement while consuming the same visitor/hour and global/minute admission. Before OpenRouter fallback, the new transactional `/fund` operation increases the existing hold to the complete conservative OpenRouter quote. It checks daily/lifetime allowances, unresolved holds and billing faults without charging request limits a second time. Repeated funding at the same amount is idempotent; lowering a hold is refused. Funding against an older reservation uses its original UTC day.

The existing daily $0.019, lifetime $7, visitor 5/hour, global 20/minute, prepaid/key stops, provider price ceilings and fail-closed paths remain. Unknown paid usage consumes its quote. Lost funding acknowledgement prevents paid dispatch and retains the hold. Workers AI can answer at $0 with zero paid allowance; exhausted paid budgets still block fallback.

With an execution context, settlement and release promises run in `waitUntil`, followed by usage bookkeeping and digest scheduling. Returning a response does not wait for settlement or delivery. A failed/unknown settlement keeps the durable monetary hold; an overcharge still records the persistent billing fault. Direct test calls without an execution context retain synchronous settlement so its errors remain observable.

The digest now includes Workers AI attempts/failures and OpenRouter dispatches, alongside one uncached request count per player request, spend, remaining allowances and bounded refusal reasons. Provider counters contain no prose or identities. Workers AI days also receive a zero-spend end-of-day digest so its counters cover the complete day. Optional alerts, delivery deadlines/retries and separate alert faults remain.

Updated `docs/credit-controls.md` and only the budget section of the root README. These distinguish the planned browser tier from the Worker changes shipped here.

## Speed measurements and deployment limits

Node v25.8.2, local in-memory SQLite, stubbed Turnstile/Workers AI/OpenRouter, 30 uncached requests per path. Measured with `performance.now()` from calling the Worker handler through reading its response JSON, with settlement/digests deferred. The verbose API test prints the samples' p50 and p95. These measure Worker overhead, not network inference or tap-to-card latency.

| Path | p50 | p95 |
|---|---:|---:|
| Workers AI success, stubs | 2.88 ms | 6.92 ms |
| Immediate Workers AI error then OpenRouter success, stubs | 4.66 ms | 18.95 ms |

Live provider and browser timing was not exercised: this run did not use account credentials, deploy, or send inference requests. The local-interpreter under-5-ms target is outside this run. Live Workers AI p50 <1.5 s / p95 <3 s and OpenRouter fallback <4 s remain unverified. The required six-second Workers AI deadline means a timeout followed by OpenRouter will exceed the four-second target; the existing OpenRouter six-second deadline is unchanged.

The requested default model ID currently redirects to “Model not available” in [Cloudflare's catalog](https://developers.cloudflare.com/workers-ai/models/llama-3.1-8b-instruct-fast/). It was kept exactly as requested; deployment should verify availability or configure the 70B alternative. [Workers AI JSON Mode](https://developers.cloudflare.com/workers-ai/features/json-mode/) documents the bare-schema input and structured `response`. [Cloudflare pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) documents the Free allocation of 10,000 Neurons per UTC day and quota errors. A Paid plan can incur Cloudflare overages outside this OpenRouter ledger; keep the owner's account on Free. No live account settings were changed or audited.

## Verification

- `cd apps/api && npx tsc --noEmit`: pass.
- `npx vitest run apps/api`: pass, 201 tests across 8 files.
- Coverage includes valid structured/string outputs, configured model, unchanged paid fallback, quota exceptions/responses, hard timeout with ignored cancellation and late result, refusals, caches/signatures, admission and budget gates, concurrent/idempotent funding and rollback, lost funding acknowledgement, stalled/failed background settlement, and digest provider counts.
- Initial `npm run typecheck`: pass; initial `npm test`: pass, 668 tests across 52 files. Two API boundary tests were added afterward; final root rechecks are recorded below.
- `npm run build`: initially pass. `node .github/workflows/check-bundle.mjs`: pass, 7 files / 332,082 bytes gzipped against 400,000 bytes. Concurrent browser changes may change those assets afterward.
- Production and top-level Wrangler deployment dry runs: pass, both list `env.AI`; Worker upload 44.42 KiB / 12.00 KiB gzip. An initial Wrangler log write outside the sandbox was denied; rerunning with `WRANGLER_LOG_PATH` under `/tmp` completed cleanly. No deployment occurred.
- `git diff --check`: pass.

## Final root verification and commits

Final root checks encountered concurrent edits outside the allowed scope. `npm run typecheck` still reports the missing `warm` member in `apps/rumortown/src/ui/whisper.test.ts:48`. An earlier recheck also saw possibly-undefined `flow` errors in `apps/rumortown/src/ui/whisper.ts:119,133`; those disappeared in the latest recheck as concurrent work continued. The completed root test rerun reports 12 failed / 672 passed tests across 54 files, plus one unhandled Turnstile rejection. All failures are in the browser's whisper and Turnstile/network tests. These files were left untouched by this run.

No commits have been made: task rules require the final root checks to pass before committing, and this sandbox declares `.git` read-only. The API, documentation, README budget changes and this report remain in the tree. No unrelated paths or generated build-info files were staged.

Follow-up: finish the concurrent browser warming changes, rerun root verification/build/bundle checks, commit the explicit API paths, docs, README and report per directory with `19:` messages and Madhav Sunil's specified attribution. Complete browser section A in its separate run; then measure real tap-to-card latency and check the owner's Free-plan quota/model configuration.

STATUS: BLOCKED — Worker scope is implemented and API checks pass; final root verification is blocked by concurrent browser changes outside this task.
