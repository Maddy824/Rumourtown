# 26: Security audit and red-team tests

Read `agent-tradeoff/CONTINUE.md` section 3 first; every rule there binds this task.

## Goal

Attack Rumourtown as an adversary would and leave behind tests that keep the fixes in place. The live site is `https://rumourtown.dev`, the API `https://api.rumourtown.dev` (`apps/api`). Your sandbox has no network: work from the source and the local test suite. The controller runs live probes separately.

## Scope, in priority order

1. **Money.** Can any request path reach a paid model (OpenRouter, Workers AI) without a ledger reservation, past the daily or lifetime cap, past Turnstile, or past the per-IP and per-visitor limits? Look for: retries that re-dispatch without reserving, settle failures that leave money unaccounted, concurrent requests racing the Durable Object, `kind` spoofing between the `rumor` and `play` allowances, oversized `max_tokens`, model ids chosen by the client, error paths that fail open.
2. **Injection into the model.** `/play` accepts client-supplied `facts`, `history`, `voice`, `nearby`, `places`. What can a crafted body make the model say or do (actions it should not take, a target outside the allowlist, a reply carrying markup)? Confirm the server validates every field's type, count and length, and that a model reply is validated before it reaches the client.
3. **Client.** XSS through share links (`#` base64url JSON with `interventions`, typed stories), villager names, model replies, the story rail, the share-card renderer. Every place untrusted text reaches the DOM must go through text nodes (`h()` in `apps/rumortown/src/ui/dom.ts`) and never `innerHTML`. Check the moderation of typed text that travels in links (`apps/api/src/moderation.ts` and the browser blocklist).
4. **Headers and transport.** CORS (only the site's origins), CSP, HSTS, `X-Content-Type-Options`, frame-ancestors, on both Workers. Signing of share links and verification of signatures (key handling, algorithm confusion, replay).
5. **Secrets.** Search the working tree and the full git history (`git log -p --all`) for keys, tokens, `.dev.vars` contents, account tokens. Report any hit by file and commit only; never print a secret value.
6. **Denial of wallet and service.** Large bodies, deep JSON, slow requests, very long share links, unbounded loops in the simulation driven by interventions.

## Deliverables

- Fix every real finding with the smallest change. Never loosen a money boundary.
- A regression test for every fix, in the existing test files of `apps/api/test/` or `apps/rumortown/src/**`.
- `agent-tradeoff/reports/26-security-report.md`: each finding with severity (critical/high/medium/low/info), file:line, how to exploit it, the fix, the test. List what you checked and found clean, so the owner can see the coverage. List what needs a live probe, with the exact request the controller should send.
- Run the checks in CONTINUE.md section 4. You cannot commit (read-only `.git`); list the files to commit and a plain commit message. No assistant attribution anywhere.

End your last message with `STATUS: DONE` or `STATUS: BLOCKED` and a one-line test summary.
