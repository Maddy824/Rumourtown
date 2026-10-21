# Credit controls and phone alerts

The current browser game, written whispers, autonomous tour and developer agent examples run locally. They consume **$0 of AI credits**. The optional OpenRouter interpretation Worker is separate and is disabled by default (`AI_ENABLED = "false"`). It is not connected to the current writing form. Connecting a developer's own paid LLM loop requires a separate budget integration; the local adapter does not meter third-party model calls.

## A $10 prepaid budget

| Allowance | Default | Purpose |
|---|---|---|
| Live interpretation | $7 lifetime | Server cap, plus a matching provider key cap without resets |
| Daily pacing | $0.019 per UTC day | At most $6.935 across 365 UTC daily allowances, before the lifetime stop |
| Development | $2 total on a separate key | Manual evaluation only; never share the live key |
| Headroom | $1 | Unallocated balance; fees or other account charges are separate |

The daily limit is pacing, not a promise to answer every request. Heavy traffic exhausts that day's allowance; local gameplay continues. Unused daily allowance does not roll forward. The lifetime cap has no calendar-year reset, and includes historical spend and unresolved reservations. Do not delete ledger storage or create extra deployments/keys using the same budget. Keep auto top-up off and the external key's limit at $7 with no reset. These settings must also be configured at the provider; application code cannot enforce account-wide spending by other keys or projects.

The Worker reserves a conservative maximum in a single transactional SQLite ledger before dispatch. Cache hits avoid another inference. Unknown dispatched cost consumes the reservation. A settlement above the reserved amount freezes further calls until reviewed. The request also rejects routes above the configured token prices and per-request surcharges. Provider price and key-limit behaviour are documented by [OpenRouter routing](https://openrouter.ai/docs/guides/routing/provider-selection#max-price) and [key management](https://openrouter.ai/docs/api/api-reference/api-keys/create-keys). The currently supported paid model is [Gemini 2.5 Flash Lite](https://openrouter.ai/google/gemini-2.5-flash-lite/pricing), with a free model tried first. Model availability can change; failure leaves local features usable.

## Phone notifications

Notifications use [ntfy's phone apps](https://docs.ntfy.sh/subscribe/phone/). They announce each **uncached external model request**, including requests whose free-first routing might use paid fallback. The message includes a request ID and reserved maximum, not a final bill. It excludes player prose, IP addresses, credentials and visitor identities. Local simulation actions get an on-screen notice and produce no phone traffic.

Before model dispatch, the Worker requires a successful message receipt from ntfy. Missing configuration, a refused notification or a notification timeout releases the unused reservation and stops the model request. Cache hits and locally rejected inputs produce no notification because they do not use a model. Service acceptance cannot guarantee that a phone is online or allowed to show the notification; confirm device delivery during setup. An alert can also precede a failed model request, so its reservation is not a claim that money was charged.

1. Run `npm run alerts:setup`. This creates a long random topic URL in ignored `.env.alerts` with owner-only file permissions. It reuses an existing valid topic on subsequent runs.
2. Install ntfy on the phone, enable notifications and subscribe to the printed URL. The topic address grants access: keep it private. [ntfy topics](https://docs.ntfy.sh/publish/#picking-a-topic) are created through publishing/subscribing; no AI credentials go into the phone app.
3. Once subscribed, run `npm run alerts:setup -- --test` and confirm the message arrives. This test makes one ntfy request and no AI request.
4. Store the URL as a **Worker secret**:

   ```sh
   npx --no-install wrangler secret put USAGE_ALERT_URL --config apps/api/wrangler.toml
   ```

   Paste the URL from the local file into the prompt. Keep it out of source, public frontend variables and build logs.
5. Complete the optional Worker deployment and capped provider-key setup in [deploy.md](deploy.md). Only after the phone test and provider limits are verified, change `AI_ENABLED` to `"true"` and redeploy. Keep the default daily and lifetime limits. Notification failures will stop inference.

Phone setup can be postponed indefinitely. The local town and agent remain available, and paid AI stays off. No hosted service, provider purchase, key limits or phone subscription is created by building this repository.
