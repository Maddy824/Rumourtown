# Task 13: prepare for larger audiences

Owner requested an architecture that could grow to millions of users or requests, and clarified that monthly, daily or concurrent users could all be relevant. This change prepares the existing independent-village product for growth. Production capacity has not been measured. It does not add multiplayer, accounts, server saves or unlimited AI.

## Implementation

- Preserve the assets-only CDN deployment and local simulation. Add immutable caching for Vite's content-addressed assets, with HTML retaining revalidation. Static deployment no longer provisions the optional API unless `DEPLOY_OPTIONAL_API=true`.
- Move the disabled-AI check before body parsing, Turnstile, cache, storage and external requests. Missing/failed edge admission bindings reject requests.
- Add native per-location limits: 20 anonymous requests/IP/minute, 60 total/minute. Return 429 and exposed Retry-After on throttling. These approximate counters are not the money boundary.
- Bound JSON input to 16 KiB and five seconds, including absent or misleading lengths. Reject unsupported encodings/content types and malformed UTF-8/JSON.
- Cache signed claims at the edge for one hour, keyed by normalized-text hash, requested cast and public signing key. Verify Turnstile and cached signatures; keep browser responses no-store. Edge failures fall back to the durable cache. Warm hits skip central ledger reads, model calls and notifications.
- Prune old visitor/minute buckets hourly and completed reservation IDs after 30 days. Bound the durable FIFO claim cache to 2,048 rows. Keep daily monetary balances, unresolved holds and billing faults permanently. No budget reset or refund occurs during cleanup.
- Add a bounded HTTP load-check script and capacity guide covering traffic assumptions, local verification, remote staging tests and remaining launch work.

No simulation behavior, replay pin or runtime dependencies changed. Commits retain the owner's attribution. Generated build-info files remain unstaged. Wrangler's local generated directories are now ignored.

## Verification

- Root typecheck passed.
- Full test suite: **583 tests across 37 files**, including 17 new traffic/accounting tests. Local suite duration 46.60 seconds.
- Production build and asset gate passed: **316,555 gzip bytes**, under 400,000. The only asset addition is `_headers`; simulation and renderer bundles are unchanged.
- Wrangler API dry-run accepted the binding configuration; the local runtime instantiated both native rate-limit bindings.
- Native binding smoke: 30 sequential invalid requests to an explicitly enabled local Worker yielded 20 validation failures followed by 10 HTTP 429 visitor-limit responses with Retry-After 60. Invalid `{}` bodies cannot dispatch inference. No model or notification requests were made.
- Built game in desktop Chrome (1280 px) and phone Chrome (360 px): canvas rendered, developer panel and local agent worked, zero page errors, zero external requests.
- Actual static responses: HTML `public, max-age=0, must-revalidate`; hashed JS `public, max-age=31536000, immutable`; both included ETags and the expected content types.
- Burst tests in the unit suite: 1,000 disabled requests produce zero body reads or upstream work; 500 warm cache hits produce zero ledger reads/reservations; 1,000 concurrent $0.001 reservation attempts under $0.019 allowance admit exactly 19.

HTTP checks against local workerd on the development machine, 1,000 requests per run, concurrency 32:

| Target | Expected result | Unexpected failures | Throughput (requests/sec) | p95 latency |
| --- | --- | ---: | ---: | ---: |
| HTML | 1,000 HTTP 200 | 0 | 1,812.2 | 25.88 ms |
| Main JS, fully drained bodies | 1,000 HTTP 200 | 0 | 157.3 | 213.76 ms |
| Disabled interpretation | 1,000 HTTP 503, reason model | 0 | 1,855.3 | 23.83 ms |

These are localhost smoke measurements, not CDN throughput, concurrent players or production service guarantees. The JavaScript check consumed 453.5 MB of uncompressed response bodies on the same machine. No distributed load test was run.

## Remaining operational work

Connect the hosting account and deploy staging before validating production capacity. Measure cold/warm delivery and distributed arrival rates, agree service targets, inspect account quotas/billing and confirm extreme bursts with the provider. See [the capacity guide](../../docs/scale.md).

The tiny optional interpretation allowance deliberately rejects excess traffic; it cannot fund millions of model calls. Worker request/hosting costs are separate from AI credits. The one exact budget coordinator remains appropriate for twenty admitted model calls/minute; it must not become a database for gameplay or be sharded into independently spendable budgets.

Paid AI remains disabled. Phone subscription remains deferred by the owner. Nothing was deployed publicly, no provider calls were made, and no credits were purchased or spent.

STATUS: DONE — implementation and local verification complete; production scale unvalidated.
