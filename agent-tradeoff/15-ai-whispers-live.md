# 15: AI whispers inside the website

The owner wants the OpenRouter interpreter used by everyone on the public site. Today the whisper sheet's writing field works locally only (the player picks subject, kind and weight by hand) and never calls `apps/rumortown/src/net/`. This task wires the interpreter into the sheet, keeps the local path as the fallback, restores the safety rule about typed text, and makes the Worker's alert gate non-blocking. Read `docs/superpowers/specs/2026-10-21-rumortown-design.md` sections 10 and 13, `apps/rumortown/src/net/` (interpretWhisper, verify, turnstile, whisperFlow), `apps/rumortown/src/ui/whisper.ts`, `apps/api/src/index.ts`, `apps/api/wrangler.toml`, `docs/credit-controls.md` and `docs/deploy.md`.

## A. The sheet (apps/rumortown/src/ui, src/net)
1. When `import.meta.env.VITE_API_BASE_URL` and `VITE_TURNSTILE_SITE_KEY` are set, "Whisper" with typed text runs `createWhisperFlow`: Turnstile, interpret, verify. While it runs, the sheet shows "Asking the village…" (under 6 s). On a verified claim, show the confirmation card "Mira will hear: Tom stole bread from the bakery" with "Whisper it" and "Change it" (which opens the manual selects pre-filled from the claim). On `unsupported`, show the in-character line from the flow and keep the manual selects available. On any resting reason, show the flow's resting line and fall back to the manual selects, so the player is never stuck.
2. Without those two settings, behaviour stays exactly as now (local manual categorisation), but see rule 3.
3. **Typed text never leaves the author's session.** It is not written into share links, the story log, bubbles, the research export, or the API cache; only the interpreted or chosen claim sentence is. Remove the current behaviour that keeps the words in the story and link; update the preview copy accordingly ("Your words are only read to understand the rumor; the village repeats the rumor, not your words."). Add a test that a share link built after a typed whisper contains no typed text.
4. Registered claims from the interpreter use the existing `registerClaim` path and taxonomy adapter.

## B. The Worker (apps/api)
5. Replace the per-request ntfy receipt gate with a daily digest: after the first uncached model request of a UTC day, and again at the end of the day if there was spend, send one ntfy message with the day's count, spend, remaining daily and lifetime allowance, and the top refusal reasons. The digest never blocks a request; a failed digest is logged in the ledger as a fault and retried once the next day. Keep `USAGE_ALERT_URL` optional: when unset, no digest. Update tests and `docs/credit-controls.md`.
6. Keep every money boundary as is: `DAILY_ALLOWANCE_USD`, `LIFETIME_ALLOWANCE_USD`, free-first routing with a $0 reservation for `:free` models, the lifetime stop. Set `AI_ENABLED` to `"true"` in `wrangler.toml` only in the `[env.production]` section; the default stays `"false"` so local runs are safe.
7. Confirm the eval runner (`apps/api/evals/run.ts`) still works against a local Worker with `.dev.vars` and document the one-line command in the report.

## C. Deploy readiness (docs, scripts)
8. Write `scripts/go-live.sh`: an idempotent, commented script the owner runs once after `wrangler login`, that: checks `wrangler whoami`; generates the signing key pair if `SIGNING_KEY_JWK` is not set (prompting before overwriting); prompts for the Turnstile secret, the OpenRouter key and the ntfy topic (optional); sets the three or four secrets with `wrangler secret put --config apps/api/wrangler.toml`; sets `ALLOWED_ORIGIN` from an argument; deploys the API; prints the API URL and the two `gh variable set` commands for the game build. It never echoes secrets. Update `docs/deploy.md` to point at it.

## Rules and verification
- Simulation untouched; replay pin unchanged. No new dependencies. Gzip budget under 400 KB.
- All tests pass; add tests for the confirmation card states (verified, unsupported, resting), the no-typed-text rule, and the digest scheduling (first request of day, end of day, unset URL).
- Copy rules: sentence case, plain words, no all-caps, no middle dots, no arrows in buttons.
- Commit per directory with messages starting `15:`. Report to `agent-tradeoff/reports/15-report.md`; finish with STATUS: DONE or STATUS: BLOCKED.

## D. Domains and names (apps/api/wrangler.toml, apps/rumortown/wrangler.toml, copy)
9. The owner bought `rumourtown.dev` on Cloudflare (note the spelling, with a "u", matching the GitHub repository "Rumourtown"). Configure custom domains with wrangler: the game Worker (assets-only) on `rumourtown.dev` and `www.rumourtown.dev`, the API Worker on `api.rumourtown.dev` (`routes = [{ pattern = "api.rumourtown.dev", custom_domain = true }]` and the equivalent for the game). Set `ALLOWED_ORIGIN = "https://rumourtown.dev"` in the API's production env and make the Worker also accept `https://www.rumourtown.dev`. The static `_headers` keep immutable caching for hashed assets.
10. Align the product name with the domain: "Rumourtown" (one word, capital R, British spelling) everywhere a visitor sees it: the HTML title and description, the opening card, the share card, the README's first line, `docs/launch.md`; package names and code identifiers stay as they are. The game build reads `VITE_API_BASE_URL=https://api.rumourtown.dev` and the Turnstile site key from the repository variables; `scripts/go-live.sh` defaults its origin argument to `https://rumourtown.dev`.

## E. One layout fix from the owner's review of task 14
11. On desktop (1440×900) the Whisper postbox is clipped at the left edge of the viewport: part of its label is off-screen. Position it fully inside the viewport with a 16 px margin at every size, and add a test or a documented check that its bounding box lies within the viewport at 360×640 and 1440×900.
