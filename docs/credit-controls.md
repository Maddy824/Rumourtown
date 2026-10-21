# Credit controls and phone alerts

The browser simulation, library stories, neutral-meaning written stories, autonomous tour and developer agent examples run locally and consume **$0 of AI credits**. When both public build settings are present, typed stories can call `/rumor` for semantic annotations before confirmation. Unavailable interpretation leaves the same wording playable with neutral meaning. Confirmed wording enters dialogue, links and research exports; unsent text does not. See [open stories](open-rumors.md). The default/local Worker is disabled (`AI_ENABLED = "false"`); production alone enables it. Connecting a developer's own paid LLM loop requires a separate budget integration; the local adapter does not meter third-party model calls.


## Shared content and development agents

The published rumor library is bundled static content. Its stories cost no inference credits to browse or spread. New visitors reuse the same version, while villagers react using their local beliefs and relationships. New packs and behavior code are authored once and released after checks. See [the add-on workflow](rumor-addons.md). Its optional coding-agent invocation uses the developer’s own Codex access, outside this Worker ledger; previewing the task starts no model. It is never invoked by a website visitor.

## Conversation and actions

The **Talk or act** sheet first routes supported moves, visits, provenance questions and news locally from simulation state. Open conversation uses `POST /play`, sending at most 280 characters, the selected nearby villager's authored voice/mood/activity, bounded grounding facts, place names and the last three exchanges. The model returns a short reply plus one validated proposal: move, approach, pause, resume, look, or no action. The user must choose the action button before it executes. Unsupported mechanics (including combat/death) are explained rather than fabricated. The local walking shortcuts make no model calls.

`/play` shares Turnstile, edge admission, the global minute limit, the same global budget object, provider fallback and aggregate phone digests with `/rumor` and legacy `/interpret`. Conversation has a separate visitor allowance of 30 calls/hour; stories have 5 calls/hour. The existing $0.019 daily and $7 lifetime paid limits are unchanged. Conversation uses temperature 0.7 and the same 120-token output ceiling. No conversation text, context or generated replies are cached or sent to the ledger. The browser keeps three exchanges in memory while the sheet is open; switching people or reopening clears that history. AI failures are shown explicitly without replacing the user's words with a guessed rumor. The service still has no promise of unlimited AI under heavy traffic.

## Local fallback and remote inference

Current typed stories bypass the legacy taxonomy matcher. Their exact wording stays playable with neutral meaning when inference is absent. Background gossip, library stories and the local conversation router need no inference. The old browser matcher and signed `/interpret` route remain for compatible clients.

Remote routes try the `AI` binding first. `WORKERS_AI_RUMOR_MODEL` and `WORKERS_AI_PLAY_MODEL` default to `@cf/meta/llama-3.3-70b-instruct-fp8-fast`; legacy `WORKERS_AI_MODEL` defaults to `@cf/meta/llama-3.2-3b-instruct`. Each attempt reserves and settles $0 in the ledger, counts against request allowances and appears in digests. Both Wrangler environments declare the binding; local AI remains disabled.

A missing binding, Workers AI error, quota response, six-second timeout or invalid output falls through to OpenRouter's `liquid/lfm-2.5-2.6b:free`, then the priced `google/gemini-2.5-flash-lite` fallback. The same reservation is funded before paid dispatch. A valid legacy refusal ends interpretation without a paid retry. All routes use JSON schemas and at most 120 output tokens: `/rumor` uses temperature 0.3, `/play` uses 0.7 and legacy `/interpret` uses 0.

Workers AI costs $0 in this application's ledger under the owner's Cloudflare Free plan. Cloudflare currently provides 10,000 Neurons per UTC day; exhaustion on Free returns an error and the Worker falls back without retrying that tier. Keep the account on Free: a Workers Paid plan can charge overages that this OpenRouter ledger does not meter. See [Cloudflare pricing and quota behavior](https://developers.cloudflare.com/workers-ai/platform/pricing/). The legacy `/interpret` default is listed in the [Llama 3.2 3B model reference](https://developers.cloudflare.com/workers-ai/models/llama-3.2-3b-instruct/). The binding sends the schema directly as documented in [Workers AI JSON Mode](https://developers.cloudflare.com/workers-ai/features/json-mode/).

## A $10 prepaid budget

| Allowance | Default | Purpose |
|---|---|---|
| Live interpretation | $7 lifetime | Server cap, plus a matching provider key cap without resets |
| Daily pacing | $0.019 per UTC day | At most $6.935 across 365 UTC daily allowances, before the lifetime stop |
| Development | $2 total on a separate key | Manual evaluation only; never share the live key |
| Headroom | $1 | Unallocated balance; fees or other account charges are separate |

The daily limit is pacing, not a promise to answer every request. Heavy traffic exhausts that day's allowance; local gameplay continues. Unused daily allowance does not roll forward. The lifetime cap has no calendar-year reset, and includes historical spend and unresolved reservations. Do not delete ledger storage or create extra deployments/keys using the same budget. Keep auto top-up off and the external key's limit at $7 with no reset. These settings must also be configured at the provider; application code cannot enforce account-wide spending by other keys or projects.

The Worker admits uncached requests through a single transactional SQLite ledger before either remote tier. Workers AI gets a zero-dollar hold. Before OpenRouter fallback, that same hold is funded atomically with the conservative maximum, without charging request limits twice. A missing AI binding uses the existing paid reservation path. Funding checks daily and lifetime caps, all outstanding holds and billing faults before paid dispatch. Only legacy `/interpret` cache hits avoid another inference; `/rumor` and `/play` prose is not cached. Unknown OpenRouter dispatched cost consumes the reservation. Settlement and release run in `waitUntil`, so the response does not wait for them; failed settlement retains the durable hold and its full budget charge. Digests run after that settlement attempt in the background. A settlement above the reserved amount freezes further calls until reviewed. The request also rejects routes above the configured token prices and per-request surcharges. Provider price and key-limit behaviour are documented by [OpenRouter routing](https://openrouter.ai/docs/guides/routing/provider-selection#max-price) and [key management](https://openrouter.ai/docs/api/api-reference/api-keys/create-keys). The currently supported paid model is [Gemini 2.5 Flash Lite](https://openrouter.ai/google/gemini-2.5-flash-lite/pricing), with a free model tried first. Model availability can change; failure leaves local features usable.

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
