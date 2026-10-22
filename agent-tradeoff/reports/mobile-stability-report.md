# Mobile stability follow-up

The owner reported that the game quickly becomes unusable on a phone. The model of iPhone and exact failure mode are still unknown; the owner reports the problem in Safari, Chrome and Edge on that phone. No physical-device crash was reproduced; browser measurements identified substantial avoidable canvas pressure.

## Findings and changes

- At 390×844 CSS pixels and DPR 3, the original renderer retained approximately 467.17 MiB of RGBA canvas buffers after collection. It warmed the desktop 40-pixel zoom, the phone's actual 30-pixel zoom, and overview images, including every facing, walk frame and mood for 36 residents.
- Compact viewports now use at most 1.25 backing pixels per CSS pixel, and desktop uses at most 2. Ground layers on compact viewports target four million pixels instead of twelve million. CSS geometry, world coordinates, hit targets, text in the DOM and the simulation remain unchanged. The tradeoff is less fine texture detail on high-density displays.
- Portrait phones warm their actual 30-pixel close view instead of also keeping the unused desktop view. The same measurement now retains 57.93 MiB, about 88% lower. These are canvas backing-size estimates, not total process memory or a universal maximum across every zoom state.
- Identical resize calls now return immediately. Thirty simulated visualViewport resize events previously created 1,231 extra canvases; now they create none. Actual size changes still rebuild the necessary views.
- Layer ownership includes partially painted crop, roof, tree and board canvases. Cancellation and eviction zero their backing dimensions immediately. Old sprite buckets are released the same way. Pending room work stops when its layer has been evicted.
- Hidden tabs skip simulation/render work, and visibility changes reset the wall-clock interval. Returning after several minutes does not create a simulation catch-up burst; existing pause controls still apply.

## Scope and validation

No changes to beliefs, movement, world rules, research harness code, model providers, inference limits, API configuration or runtime dependencies. Background GPU research was left running. The raw replay pin remains unchanged.

Evidence: `mobile-stability-memory.json`. Initial baseline/final runs used the development server, Chrome mobile emulation, DPR 3, 25 seconds to prepare, explicit collection, and identical unchanged-viewport events. Typecheck, production build and 361,565 / 400,000-byte gzip bundle gate passed. Production-preview stress checks passed at 390×844 and 360×640 / DPR 3 with 4× CPU throttling, plus 1280×800 / DPR 2 desktop. Three typing/resize cycles, phone rotation, map controls, keyboard entry and walking completed; simulation time continued; no page errors or horizontal overflow. Final phone backing estimates returned to 57–58 MiB. See `mobile-stability-results.json`, browser script and screenshots. Independent review approved after a minor cold-frame player lookup correction; see `mobile-stability-review.md`.

Local full suite completed with 1,026 passing tests and six timing-only failures (78 files, 864.66 seconds). Four existing replay/research tests hit their explicit timeouts (15, 20 or 180 seconds), and two unchanged simulation speed tests exceeded 1.5 seconds. The authored replay hash passed. No functional assertion failed. The host's research workload remained active. Do not weaken timeouts or stop that workload; use the clean GitHub Node 22/25 jobs as the full-suite release gate before production deployment. This is a documented exception to requiring every local timing test to pass before pushing a validation commit; all production deployment gates remain required. Baseline CI `39752801096` passed on the unchanged base `e3056b8`. Final focused verification passed: 48 tests across three files, root typecheck, production build and bundle gate. Clean CI [39768802984](https://github.com/Maddy824/Rumourtown/actions/runs/39768802984) passed all checks on Node 22 and Node 25 for `d2b433f`, including the full suite, research smoke tests, build and asset budget. No test thresholds were changed.

The browser tests emulate a phone screen, touch input and CPU throttling; they do not reproduce a particular phone's GPU, Safari memory policy, battery temperature or total available RAM. A physical-phone retest is still necessary to confirm the owner's exact symptom is resolved.


WebKit 26.6 production-preview checks also passed at both phone sizes and desktop, with the same typing, rotation, map and movement exercises. No CPU throttle or forced GC was applied in WebKit. Retained phone backing estimates returned to 57–58 MiB. See `mobile-stability-webkit-results.json` and screenshots. WebKit was installed only in the local test-tool cache; no application dependency was added.

## Release

- Code: `d2b433faa15dcbdfb55463dc3e911ff10bb16afe`, attributed to the repository owner.
- Site version: `c0b57bf0-bb06-491d-b72c-0d4332b67a64`.
- Live main asset: `/assets/main-1YaKQuPi.js`.
- API and inference settings were not deployed or changed.
- Live WebKit phone check passed at 390×844 / DPR 3: typing, viewport changes, rotation, map interaction, keyboard walking and advancing simulation; no page errors or horizontal overflow. Backing estimate remained 57.93 MiB, unchanged-size resize allocations stayed zero. See `mobile-stability-live-results.json` and screenshot. External requests were blocked; no AI credits were used.
