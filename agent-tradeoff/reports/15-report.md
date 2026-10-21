# 15: AI whispers inside the website

Sections A–E are implemented on `build/village`. Simulation code, dependencies and the pinned replay hash are unchanged. No OpenRouter requests were made, no credit was spent, and the key in `apps/api/.dev.vars` was never printed or included in a staged path.

## A. Sheet and privacy

With both `VITE_API_BASE_URL` and `VITE_TURNSTILE_SITE_KEY`, typed whispers run the existing Turnstile/interpret/signature-verification flow. The sheet says “Asking the village…” and the whole flow has a 5.8-second deadline, including the challenge. A verified taxonomy claim becomes a confirmation with the listener, canonical sentence, “Whisper it” and “Change it”. Registration happens only on confirmation through `registerClaim` and the existing taxonomy adapter. “Change it” prefills subject, kind and weight. Unsupported and resting results show the flow’s authored line and reveal manual choices. Closing discards stale results and destroys the challenge client; reopening creates a fresh container.

Without the public settings, manual categorisation stays available. The sheet no longer calls the prose-carrying `createWrittenClaim` path: both manual and interpreted whispers register only canonical taxonomy claims. Typed prose is cleared on close and never enters the new claim, story, bubbles, share payload or research export. The API continues to cache a hash plus signed taxonomy fields only. The preview uses the requested privacy sentence. Historical simulation support for old written claims remains unchanged, as required by the simulation constraint.

Tests exercise the actual form with a small test DOM: confirmation before registration, prefilled changes, unsupported/resting fallback, manual privacy through a built share payload and research export, stale-result rejection, challenge reopening, and the total deadline. Existing network tests exercise real WebCrypto verification with stubbed fetch.

## B. Worker and digests

Removed the per-request ntfy receipt gate. Request accounting schedules optional aggregate digests through the global ledger and `waitUntil`; notification delivery cannot delay the response or relax a money boundary. The first completed uncached request schedules a first-request digest; a Durable Object alarm sends the end-of-UTC-day digest when that day had spend. Free-only days skip the zero-spend end digest. Counts, spend, remaining allowances (including outstanding holds), and the top five admitted refusal reasons are included. Early admission rejects retain their no-ledger path. Messages contain no player prose or identities.

Delivery has a hard four-second bound. Failed delivery creates an `alert_faults` row and one persisted retry at the next UTC midnight. Job claims prevent overlapping flushes from sending the same due attempt; jobs survive object restarts. Notification faults stay separate from billing faults. An uncertain ntfy receipt can produce a duplicate on the single retry, as documented. With no URL, there are no notification calls or digest alarms.

The daily allowance, lifetime stop, reservation/settlement logic and free-first pricing are unchanged. `AI_ENABLED = "true"` exists only in `[env.production.vars]`; the default remains false. Production has `ALLOWED_ORIGIN = "https://rumourtown.dev"`. CORS accepts that exact origin and `https://www.rumourtown.dev`, reflects the requesting origin, and checks the matching Turnstile hostname. Similar-looking and insecure origins are rejected.

The eval runner’s adapter, CLI, 200-case scoring and report tests pass using stubbed fetch. A real local Worker startup with `.dev.vars` and explicit `AI_ENABLED:false` was attempted, but sandbox socket binding failed with `EPERM`; no interpret call was sent. Live local eval remains unverified here. The runner command, once a separately authorized local evaluation Worker is running, is:

```sh
npx tsx apps/api/evals/run.ts --url http://localhost:8787 --token XXXX.DUMMY.TOKEN.XXXX --origin http://localhost:5173 --cast-version v3
```

This command runs the full corpus and can spend development credit; it was **not run** in this session. `docs/deploy.md` provides the local Worker command, explicitly enabling local AI only for a separately authorized evaluation. No full live corpus was authorized for task 15.

## C. Deployment readiness

Added executable `scripts/go-live.sh`, defaulting to `https://rumourtown.dev`. It checks authentication and existing production secret names, creates a P-256 signing key when needed, asks before replacing existing secrets, silently reads the Turnstile/OpenRouter credentials and optional ntfy topic/URL, and installs secrets with the production config selected. It never echoes or stores their values. It reuses existing remote secrets on reruns. The selected origin is persisted only in production; the script deploys the API and prints its URL and the two public GitHub variable commands.

The offline shell rehearsal uses a fake CLI and verifies first setup with three/four secrets, valid generated key material, secret redaction, production flags, idempotent reuse, origin persistence, an initially absent Worker, and authentication failure before mutation. No account changes, secret uploads or deployments were executed. Updated deployment and credit-control instructions, public developer copy, architecture and capacity diagrams to match the new path.

## D. Domains and names

Wrangler declares `rumourtown.dev` and `www.rumourtown.dev` on the assets-only game Worker, and `api.rumourtown.dev` on the production API Worker. Production bindings and rate limits are explicit. The CI API deploy now selects `--env production`. The game build continues to read both public settings from repository variables; setup prints `VITE_API_BASE_URL=https://api.rumourtown.dev` and the site-key command. Hashed asset headers are unchanged.

Visitor-facing title/description, opening card, share card/downloads, README and launch copy use “Rumourtown”. Package names, protocol names, code identifiers and historical design records retain their existing spelling.

## E. Postbox layout

The newer postbox label inherited an older `translate(-50%, -50%)`, which displaced its left edge outside its button. The label now resets that transform and top inset. The bottom controls enforce at least 16 px left/right/bottom padding, including safe areas. `docs/deploy.md` contains the exact bounding-box assertions for both the postbox and label at **360×640** and **1440×900**, plus keyboard confirmation, manual fallback, modal escape and focus-return checks.

Actual browser verification could not run: Vite could not bind `127.0.0.1:5194` (`listen EPERM`) and Chrome exited with `SIGABRT` under the sandbox. No live geometry, screenshot or keyboard results are claimed. The documented browser checks remain an owner follow-up.

## Verification

- Root `npm run typecheck`: passed.
- Root `npm test`: **609 passed across 45 files**.
- Root `npm run build`: passed.
- `node .github/workflows/check-bundle.mjs`: passed, **326,426 bytes gzipped** across 8 assets, below 400,000 bytes.
- `node --test scripts/go-live.test.mjs`: **4 passed**; `bash -n scripts/go-live.sh`: passed.
- Production API `wrangler deploy --config apps/api/wrangler.toml --env production --dry-run`: passed with the requested origin, AI flag, Durable Object and both rate-limit bindings. This did not deploy or spend credit.
- `git diff --check`: passed. No simulation/library source or replay-pin edits. Generated build-info files are left unstaged.

## Completion and follow-up

Commits are blocked by the session's read-only `.git`. After the final passing checks, staging only the explicitly named API files failed with:

```text
fatal: Unable to create '/Users/maddy/B2B/rumortown/.git/index.lock': Operation not permitted
```

No file was staged and no commit was created. Approval escalation is unavailable in this session. The existing commit attribution was checked and is `Madhav Sunil <94164709+Maddy824@users.noreply.github.com>`. Owner account steps remain: Cloudflare login/zone and Turnstile widget for both hosts, capped provider key, script execution, repository variables and deployment, browser checks above, and a separately authorized live eval. No launch or model-quality claim is made from stubbed tests.

Planned plain commits, each staging only the explicit files changed for that directory, with author and committer `Madhav Sunil <94164709+Maddy824@users.noreply.github.com>`:

- `15: send daily usage digests` for the named API source, tests and Wrangler configuration.
- `15: bound the whisper flow deadline` for `apps/rumortown/src/net/whisperFlow.ts`.
- `15: confirm private whispers` for the changed UI files and new DOM test fixture.
- `15: keep the postbox inside the viewport` for `apps/rumortown/src/styles/app.css`.
- `15: name the public game Rumourtown` for the game HTML and Wrangler configuration.
- `15: add the production setup script` for the two new script files.
- `15: deploy the production API environment` for `.github/workflows/deploy.yml`.
- `15: document AI whispers and deployment` for the changed `docs/` files.
- `15: update the game introduction` for root `README.md`.
- `15: record AI whisper verification` for `agent-tradeoff/README.md` and this report.

Unrelated task briefs appearing during the session and generated build-info files are preserved and excluded from these commits.

STATUS: BLOCKED

Tests: root typecheck, 609 tests, build, 326,426/400,000-byte bundle, 4 setup tests and production API dry-run passed; commits and live browser/local Worker checks blocked by sandbox permissions.
