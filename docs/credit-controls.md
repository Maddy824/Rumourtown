# Credit controls and phone alerts

The browser simulation, manual whispers, autonomous tour and developer agent examples run locally and consume **$0 of AI credits**. When both public build settings are present, typed whispers call the separate Worker interpreter and require confirmation before entering the village. Unavailable interpretation falls back to manual choices. Only taxonomy claims are kept in stories, links and research exports. The default/local Worker is disabled (`AI_ENABLED = "false"`); production alone enables it. Connecting a developer's own paid LLM loop requires a separate budget integration; the local adapter does not meter third-party model calls.


## Conversation and actions

The primary **Talk or act** sheet sends freeform text to `POST /play`, without the local rumor matcher. It sends at most 280 characters, the selected nearby villager's authored voice/mood/activity, place names, and the last three exchanges. The model returns a short reply plus one validated proposal: move, approach, pause, resume, look, or no action. The user must choose the action button before it executes. Unsupported mechanics (including combat/death) are explained rather than fabricated. The local walking shortcuts make no model calls.

`/play` shares Turnstile, edge admission, visitor/global limits, the same global budget object, provider fallback and aggregate phone digests with `/interpret`. The existing $0.019 daily and $7 lifetime paid limits are unchanged. Conversation uses temperature 0.7 and the same 120-token output ceiling. No conversation text, context or generated replies are cached or sent to the ledger. The browser keeps three exchanges in memory while the sheet is open; switching people or reopening clears that history. AI failures are shown explicitly without replacing the user's words with a guessed rumor. The service still has no promise of unlimited AI under heavy traffic.

## Three interpretation tiers

1. Browser rules: the local interpreter answers clear taxonomy claims for $0 without a network call in the separate rumor sheet. Talk or act bypasses that matcher. Manual choices already cost $0.
2. Workers AI: the first remote attempt uses the `AI` binding and defaults to `@cf/meta/llama-3.1-8b-instruct-fast`. It reserves and settles $0 in the ledger, but counts against the same visitor/global request limits and appears in digests. Set `WORKERS_AI_MODEL` to `@cf/meta/llama-3.3-70b-instruct-fp8-fast` to use the larger alternative. Both local and production Wrangler configurations declare the binding. Local AI remains disabled.
3. OpenRouter: on a missing binding, any Workers AI error, quota response, six-second timeout or invalid output, the existing free-first OpenRouter model chain runs, followed by the priced Gemini fallback. A valid Workers AI refusal ends interpretation without a paid retry. Both providers use the same compact cast/taxonomy prompt and JSON Schema, temperature 0 and at most 120 output tokens; validation and signed claims remain unchanged.

Workers AI costs $0 in this application's ledger under the owner's Cloudflare Free plan. Cloudflare currently provides 10,000 Neurons per UTC day; exhaustion on Free returns an error and the Worker falls back without retrying that tier. Keep the account on Free: a Workers Paid plan can charge overages that this OpenRouter ledger does not meter. See [Cloudflare pricing and quota behavior](https://developers.cloudflare.com/workers-ai/platform/pricing/). The requested 8B model ID currently redirects to [model unavailable](https://developers.cloudflare.com/workers-ai/models/llama-3.1-8b-instruct-fast/); configure the 70B alternative if that remains true at deployment. The binding sends the schema directly as documented in [Workers AI JSON Mode](https://developers.cloudflare.com/workers-ai/features/json-mode/).

## A $10 prepaid budget

| Allowance | Default | Purpose |
|---|---|---|
| Live interpretation | $7 lifetime | Server cap, plus a matching provider key cap without resets |
| Daily pacing | $0.019 per UTC day | At most $6.935 across 365 UTC daily allowances, before the lifetime stop |
| Development | $2 total on a separate key | Manual evaluation only; never share the live key |
| Headroom | $1 | Unallocated balance; fees or other account charges are separate |

The daily limit is pacing, not a promise to answer every request. Heavy traffic exhausts that day's allowance; local gameplay continues. Unused daily allowance does not roll forward. The lifetime cap has no calendar-year reset, and includes historical spend and unresolved reservations. Do not delete ledger storage or create extra deployments/keys using the same budget. Keep auto top-up off and the external key's limit at $7 with no reset. These settings must also be configured at the provider; application code cannot enforce account-wide spending by other keys or projects.

The Worker admits uncached requests through a single transactional SQLite ledger before either remote tier. Workers AI gets a zero-dollar hold. Before OpenRouter fallback, that same hold is funded atomically with the conservative maximum, without charging request limits twice. A missing AI binding uses the existing paid reservation path. Funding checks daily and lifetime caps, all outstanding holds and billing faults before paid dispatch. Cache hits avoid another inference. Unknown OpenRouter dispatched cost consumes the reservation. Settlement and release run in `waitUntil`, so the response does not wait for them; failed settlement retains the durable hold and its full budget charge. Digests run after that settlement attempt in the background. A settlement above the reserved amount freezes further calls until reviewed. The request also rejects routes above the configured token prices and per-request surcharges. Provider price and key-limit behaviour are documented by [OpenRouter routing](https://openrouter.ai/docs/guides/routing/provider-selection#max-price) and [key management](https://openrouter.ai/docs/api/api-reference/api-keys/create-keys). The currently supported paid model is [Gemini 2.5 Flash Lite](https://openrouter.ai/google/gemini-2.5-flash-lite/pricing), with a free model tried first. Model availability can change; failure leaves local features usable.

## Daily phone digests

`USAGE_ALERT_URL` is an optional Worker secret containing a private ntfy.sh topic URL. When it is unset there are no notification requests or digest alarms. Notifications never gate model dispatch: an unavailable phone service cannot prevent interpretation or relax a money boundary.

The global ledger records uncached model dispatch counts and bounded refusal reason counters, without player prose or visitor identity. After the first uncached request of each UTC day settles, it schedules one digest in the background. A Durable Object alarm sends the end-of-day digest at the next UTC midnight **if that day had spend or Workers AI attempts**; it also runs when there is no further traffic. Workers AI days receive both digests even at $0, so the final digest includes all attempts and failures. Days with only free OpenRouter calls retain the first-request digest without a zero-spend end digest. Cache hits do not increment the model count.

Each digest includes the UTC day, uncached request count (one even when both providers were tried), Workers AI attempt and failure counts, OpenRouter dispatch count, settled spend, remaining daily and lifetime allowances (subtracting unresolved reservations), and up to five refusal reasons in count order. Refusals counted here are from requests that passed Turnstile and reached the ledger/model path; early admission rejects remain outside the ledger. No typed words, IP addresses, credentials or visitor IDs go to ntfy. Unknown model cost still consumes its reserved bound.

Delivery has a four-second deadline. Failed delivery is persisted in the separate `alert_faults` table, and that digest is retried **once at the next UTC midnight**. Delivery failures never enter `billing_faults`, never release money and never freeze inference. Jobs persist across object restarts; overlapping delivery work claims each job before network I/O. A transport failure can leave receipt status uncertain, so a retry can duplicate a message already accepted by ntfy. Phone notification permissions and connectivity are separate from service acceptance.

To opt in:

1. Run `npm run alerts:setup` to create a private random topic in ignored `.env.alerts`, with owner-only permissions. Existing valid topics are reused.
2. Subscribe in the ntfy phone app and run `npm run alerts:setup -- --test` to check device delivery. That test uses no AI credits.
3. Supply the private topic URL to `./scripts/go-live.sh`, or run `npx --no-install wrangler secret put USAGE_ALERT_URL --config apps/api/wrangler.toml --env production` and paste it at the prompt. Keep it out of public variables and build logs.

The default/local Worker keeps `AI_ENABLED = "false"`. Only `[env.production.vars]` enables it. The production allowance and lifetime cap remain unchanged; the setup script does not purchase credit or alter provider key limits. See [deployment](deploy.md).
