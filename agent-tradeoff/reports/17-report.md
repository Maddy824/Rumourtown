# 17: Search and share readiness

STATUS: BLOCKED

The requested SEO remainder is implemented on `build/village`. Completion is blocked by root verification failures outside the permitted files and unavailable browser verification.

## Changes

- `apps/rumortown/index.html`: requested title, 147-character description, canonical URL, moss theme colour, SVG and PNG icons, Apple icon, manifest, complete Open Graph metadata for the existing 1200 × 630 `og.jpg`, and Twitter large-image metadata.
- Root `WebApplication` and `WebSite` JSON-LD name Madhav Sunil as a Person with the requested GitHub `sameAs`. Both describe autonomous villagers and AI agents playing through the agent protocol, and include the requested keywords. The application declares its free USD offer and browser requirements.
- A visible HTML arrival section inside `#app` contains the crawlable h1 and intro before JavaScript runs. The normal app mount replaces it. Its noscript paragraph links to `/about`; the initial text also remains visible with reduced motion. No additional runtime script or image was introduced.
- `apps/rumortown/src/ui/opening.ts`: added a normal, keyboard-focusable `/about` anchor on the opening cards. More already has its `/about` anchor in the About panel, so `tools.ts` required no change. The first opening-card heading already uses h1.
- The existing font preload was preserved and tested.
- `apps/rumortown/about.html`: changed only the meta description, shortening it to 148 characters. Preserved the controller's FAQPage, page content and existing uncommitted edits.
- `apps/rumortown/src/seo.test.ts`: 12 tests extract the static HTML elements from both source and production pages, check metadata, JSON-LD, author, agent wording, headings, noscript and resource links, and assert crawler files and the JS/CSS gzip budget. A fresh Vite build in a temporary directory makes the tests independent of stale or missing `dist` output and the CI test-before-build order.

The controller's public assets and two-page Vite configuration were left unchanged. No dependencies, simulation code, replay pins, or other source files were edited by this task. Existing unrelated work and generated build-info files were preserved. The queue README was not edited because the user's file scope is narrower.

## Verification

- Scoped command: `npx --no-install vitest run apps/rumortown/src/seo.test.ts apps/rumortown/src/ui/opening.test.ts apps/rumortown/src/ui/presentation-dom.test.ts` — 20 tests passed in 3 files.
- Latest root `npm run typecheck` — fails at `src/ui/whisper.test.ts:48`: the mock lacks the newly required `WhisperFlow.warm()` method. Earlier transient unused-variable errors in concurrently edited renderer files disappeared on the last retry.
- Latest root `npm test` — 694 passed, 2 failed, 696 total in 55 files. Both failures are in `apps/rumortown/src/ui/whisper.test.ts`: the in-flight-result test expects “Asking the village…” while the UI shows “Checking you're human…”, and the old six-second deadline test times out. Earlier failures in concurrently edited network tests were resolved between runs.
- Latest root `npm run build` — blocked by the same missing `warm()` mock method at its TypeScript step.
- Direct production Vite build — passed. The last measured fresh output in `/private/tmp/rumourtown-17-final` had **198,616 bytes of JS and CSS gzipped**. The repository bundle checker applied to that fresh output measured **334,238 bytes for all game assets**, below 400,000. These measurements include concurrent renderer/network work present at build time.
- `node .github/workflows/check-bundle.mjs` — passed against the existing root `dist` at 332,082 bytes. This existing output is not evidence that the blocked root build passed; the fresh temporary-build measurement above verifies the current assets separately.
- `git diff --check` — passed.
- Browser verification attempted with the existing cached Playwright and installed Chrome: Chrome exited with SIGABRT under the sandbox. Starting a local Vite server also failed with `listen EPERM`. Desktop, 360 px, keyboard, no-JavaScript and measured arrival timing checks therefore remain unverified in a real browser.

No Lighthouse dependency or existing Lighthouse CI step is present. No dependency or CI changes were made. Once Lighthouse is available locally, run against a preview of the successful production build:

```sh
npx --no-install lighthouse http://127.0.0.1:5180/ --form-factor=mobile --only-categories=performance,accessibility,best-practices,seo --output=html --output-path=/private/tmp/rumourtown-17-lighthouse.html
```

## Remaining work and commits

1. The controller must reconcile the whisper tests with its current flow, then rerun root typecheck, tests, production build and the bundle checker. Those files are outside this task's explicit edit scope.
2. Verify desktop and 360 px layouts, Tab/Enter access to both about links, reduced motion, JavaScript disabled and first-paint timing in an environment that permits Chrome and a preview server.
3. Commit the app changes and this report separately with plain `17:` messages after verification passes. The sandbox marks `.git` read-only, so this task left all changes uncommitted and unstaged. Git's configured attribution already matches `Madhav Sunil <94164709+Maddy824@users.noreply.github.com>`. Stage only this task's description hunk in `about.html`; its other changes predate this task. No assistant trailers were added.

Test summary: scoped 20/20 pass; root 694/696 pass; root typecheck/build blocked by the whisper mock; fresh all-assets gzip 334,238/400,000 bytes.
