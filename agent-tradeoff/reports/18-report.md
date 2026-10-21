# 18: Typed whispers reach the village

STATUS: BLOCKED

The requested network and sheet changes are implemented. Two existing assertions in `apps/rumortown/src/ui/whisper.test.ts` still require the behavior this task replaces. That test file is outside the explicitly allowed file scope; a clarification to allow its update is pending. No production workaround preserves the obsolete deadline.

## Changes

- `src/net/turnstile.ts`: lazy `warm()` loads the script, renders one widget, and acquires one unused token. Acquisition is bounded to 12 seconds first and six seconds afterward. Consumption immediately starts the next acquisition using `reset(widgetId)` and `execute(widgetId)`. Concurrent callers wait for separate tokens. Tokens refresh after 240 seconds or the SDK expiry callback. Failed script loads can retry; timed-out/destroyed acquisitions clear their state, and aborted flow waiters cannot consume a late token.
- `src/net/whisperFlow.ts`: separate token and interpretation budgets, warm support, and public-key prefetch. Interpretation receives six full seconds after the human check. Human-check failures, request timeouts, and other transient failures have distinct lines; resting copy is reserved for budgets and limits.
- `src/net/interpret.ts` and `verify.ts`: the interpretation deadline covers only POST and response parsing. Public-key requests share one in-flight operation per normalized API URL, have their own bounded wait, and cache successful validated keys for the page lifetime. Failed requests remain retryable. Signature verification still gates every successful claim.
- `src/ui/whisper.ts`: the writing field sits directly below the listener, before “Or choose a village story”. Suggestions collapse with written text and expand when empty. Desktop opens with writing focused; phones focus a listener without opening the keyboard. Walk-to rows appear when nobody is within reach. The sheet warms on open, reports checking then asking, and offers a retry that warms the client and starts interpretation again. Closing/reopening ignores stale results and clears busy state.
- `src/ui/app.ts`: one-line `whisper.warm()` hook when the sheet opens.
- Regression tests stay within `src/net/`, including the new `whisper-sheet.test.ts`, which exercises the real sheet with the existing DOM fixture.

No Worker, simulation, replay pin, runtime dependency, index.html, opening.ts, tools.ts, renderer, or stylesheet was edited by this run. Other active runs changed and committed unrelated files; their work and generated build-info files were preserved. The branch remains `build/village`. README's task table was left unchanged to respect the file scope.

## Verification

- Requested filtered app typecheck: clean, no matching diagnostics. `grep` exits 1 when there are no matches; root typechecking independently exits 0.
- Network and new sheet regressions: **86 passed**. They cover an eight-second human check plus a one-second signed response, a seven-second interpretation timing out at six seconds, slow initial script loading, separate public-key timing, cached/in-flight key sharing, consecutive distinct tokens, SDK errors, retry after token timeouts, concurrent consumers, expiry, aborted waiters, two actual token-client whispers reaching fetch, sheet warming, writing order, focus selection, progress lines, and retry buttons.
- Requested combined network/UI test command: **161 passed, 2 failed** (18 files). Both failures are in the untouched `src/ui/whisper.test.ts`:
  - Line 115 expects “Asking the village…” immediately while its stubbed flow is unresolved. The sheet now honestly starts with “Checking you're human…”.
  - Lines 143–153 assert the replaced shared 5.8-second deadline and expect a timeout result. The first human check now has a separate 12-second budget and reports a human-check failure. The obsolete test waits after advancing only 5.8 seconds, so Vitest times it out.
- `npm run typecheck`: passed across all workspaces.
- `npm run build`: passed. Vite retains its existing config-loader and large-chunk notices.
- `node .github/workflows/check-bundle.mjs`: passed; latest build **335,914 bytes gzipped**, below 400,000 bytes. This includes concurrent renderer changes present at build time.
- Root `npm test`: **703 passed, 2 failed** (57 files); only the two obsolete assertions described above failed.
- Scoped `git diff --check`: passed.

Real desktop/360 px layout and keyboard traversal could not be verified in Chrome. A local Vite bind was rejected with `listen EPERM`, and Playwright's installed Chrome process exited with `SIGABRT` under the sandbox (cleanup also reported `kill EPERM`). DOM tests cover desktop/phone focus targets and native button/disclosure events, but do not establish browser geometry or keyboard trapping. Live Turnstile/Worker verification remains to be performed with the configured site key.

## Commits and remaining work

An explicit-file `git add` for the network directory failed: `Unable to create .../.git/index.lock: Operation not permitted`. No files were staged or committed by this run. Root tests are also not clean, so the task's pre-commit gate is unsatisfied. Once those gates are resolved, commit the network, UI, and report directories separately using plain `18:` messages and `Madhav Sunil <94164709+Maddy824@users.noreply.github.com>`, without co-author trailers.

1. Approve updating `src/ui/whisper.test.ts` to the new checking/status and separate-budget contract, then rerun the requested combined tests and root checks.
2. Verify the configured live flow and desktop/360 px keyboard behavior in a browser outside this sandbox.
3. Commit the scoped changes from a workspace with writable `.git`.
