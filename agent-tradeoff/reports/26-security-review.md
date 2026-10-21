# 26: Read-only diff review

Reviewed the task's uncommitted source/test diff against `26-security-audit.md` and `CONTINUE.md` section 3. Unrelated concurrent changes were excluded. No files were edited as part of the review itself, and no secrets were read during it.

The prescribed `codex exec -s read-only ...` command was attempted. It exited before review with `failed to initialize in-process app-server client: Operation not permitted (os error 1)`. This document records the subsequent local read-only review; it is not an independent Codex review. The full test gate had not passed, so the requested post-passing-checks review sequence remains incomplete.

## Findings

- **Important — verification gate not met:** `apps/rumortown/src/replay.test.ts:193`, `apps/rumortown/src/research/model.test.ts:40`, `apps/rumortown/src/sim/agents/regressions.test.ts:522`. The latest complete root suite passed 993/997 tests, with only existing timeout/performance checks failing under severe host load. The preceding complete run passed 994/997, failing three replay timeouts. **Action:** rerun the full suite on an idle host with unchanged thresholds before committing or deploying. Do not represent this as a passed root suite.
- **Minor — account billing remains externally conditional:** `apps/api/src/index.ts:119`. Workers AI still uses the documented zero-dollar Free-plan reservation. There is no source-level proof of the actual account plan. **Action:** controller verifies Free-plan quota failure; any Paid-plan migration needs priced cumulative reservations first. This is explicitly recorded in the report, not silently treated as verified.
- **Minor — browser/header delivery cannot be verified offline:** `apps/rumortown/public/_headers:10`. Static and fresh-build tests verify the intended CSP, not Cloudflare enforcement, HTTP redirection or actual Turnstile operation. **Action:** execute the report's exact live requests and browser checks before release.

No additional Critical or Important source-code finding was identified in the reviewed diff. There is no basis here for weakening an existing money boundary or changing test timeouts to obtain a green check.

## Requirement walk

| Requirement | Result | Evidence or limit |
| --- | --- | --- |
| Paid dispatch reservation, fallback funding, caps and settlement | Met in source/tests; account assumption cannot be verified | One global object, transactional counters/holds, fixed provider options; existing concurrency/error tests and new UA-rotation regressions. No dispatch/funding/settlement rule was loosened. |
| Per-IP/visitor limits and kind spoofing | Met in source/tests | Visitor key no longer includes caller-controlled User-Agent; route selects kind. All routes reject client money-control fields. Deploy-key migration is disclosed. |
| `/play` field type/count/length validation | Met | Record check precedes optional-field access. Existing bounds retained; new malformed-context and field-matrix tests exercise them. |
| Context injection and response validation | Met for enforceable boundaries; semantic model obedience cannot be verified | System/user roles remain separate. Action/target allowlists remain enforced server/client, output moderation is added, and UI execution still requires a user action. No model tool execution exists. |
| Share links, names, story rail, replies and share-card XSS | Met in source/tests | No runtime HTML parser sinks found; text nodes/textContent/canvas text are used. Added DOM and malicious-share regressions preserve that boundary. |
| Typed/shared text moderation | Met for the documented lexical policy | Punctuation boundaries and default-ignorables are normalized; API story input, shared questions and model conversation output are checked. Semantic/multilingual moderation is not claimed. |
| CORS/security headers/transport | Met in source/build; live behavior cannot be verified | Exact-origin policy retained, security headers cover API status paths and site assets. No wildcard script/connect allowlist introduced. Inline styles remain deliberately allowed for current UI styles. |
| Signing algorithms, secret key handling and replay | Met for intended authentication semantics | P-256/SHA-256 fixed algorithms and canonical envelopes unchanged. Only public coordinates are exposed. Offline authored replay links remain untrusted unsigned state, not paid-operation credentials. |
| Working-tree and full-history secret scan | Met | Report lists all hits by file/commit only, explains ignored local files and explicit fixtures, and records scan coverage. No credential values reproduced. |
| Body size, slow/deep JSON, link size and simulation loop bounds | Met in source/tests | 16 KiB/five-second input bounds, 16,000-character/400-intervention links, finite run/start tick and one-time pending-intervention consumption. |
| Regression for every fix | Met | API, client output, canonical replay, DOM and built-header cases are in existing test files. No new dependency or separate test framework. |
| Severity/location/exploit/fix/test report and exact live probes | Met | `26-security-report.md` includes all eight fixes, clean coverage, limitations, remaining account/browser work and concrete requests. |
| Four root checks | Not met | Typecheck, production build and bundle gate pass. Root suite still has timing failures. |
| Post-passing-checks independent command review | Not met | Tests have not all passed and the prescribed CLI cannot initialize in this sandbox. This local review is recorded transparently. |
| Preserve forbidden/concurrent files, branch and attribution | Met | No edits to the three excluded paths, unrelated work or replay pin. No staging, commit, push, environment change, dependency addition or assistant attribution. |
| Deterministic simulation and identical replay pin | Met locally | No simulation algorithm/randomness edits. The existing raw replay pin assertion passed unchanged in complete root runs. Node 22/browser checks were not run in this offline task. |

Verdict: source fixes and their regression coverage are ready for controller review. Commit/deployment remains blocked on the full test gate and outstanding live/account checks; the independent review command also needs a working app-server environment.
