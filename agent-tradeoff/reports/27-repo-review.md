# 27: Repository review

Reviewed 22 October 2026 on `build/village`, starting at `cb03e8d680b6d761c314a034ddf528856fb1db60`. The scoped repository review is complete. Full application validation remains unresolved because six timing checks failed during parallel work. This report covers repository presentation, documentation, metadata, workflows and read-only hygiene/history checks. The parallel security audit owns application security; the controller owns game source and the SLM harness.

## Findings and changes

| Brief requirement | Finding and action |
|---|---|
| Two-minute README | Added a prominent live URL, one-sentence description, engineering overview and short Mermaid diagram. Preserved the existing village screenshot, evidence table and qualified historical benchmarks. Linked research, setup, test/build commands and MIT license. |
| Determinism, provenance, AI budget, verifier and SLM study | All five appear near the top. Documented verifier limits and separated implemented harness/fixture checks from pending real-model comparisons and human validation. |
| Local run and tests | Uses `npm ci`, explicit supported Node versions, the root checks and SLM smoke command. No account or inference service is needed for ordinary local play or these checks. Added `docs/workspaces.md` with scoped commands for all four components. |
| Workspace READMEs | `packages/rumormind/README.md` and `bench/slm/README.md` exist. `apps/rumortown/README.md` and `apps/api/README.md` are missing. Their directories are outside the edit allowlist; see owner follow-up below. The central workspace guide supplies the missing orientation without touching those directories. |
| Root hygiene | The tracked root contains only `.gitignore`, `AGENTS.md`, `LICENSE`, `README.md`, the package manifest/lockfile, TypeScript config and Vitest config. No stray tracked root files. Added ignore rules for build-info files, coverage, logs and generated API evaluation output. |
| Generated tracked files | Three `tsconfig.tsbuildinfo` files are tracked and were already dirty. Preserved them. No tracked `dist/`, `node_modules/` or generated result directories were found. SLM full datasets/results already have scoped ignore rules; retained checked-in fixtures and measured `bench/results.md`. |
| Stale documentation | Updated the 900-tick day to 1,440 ticks, share format v2, player-path replay behavior, open-story privacy/fallback, per-route models, separate chat allowance and background settlement order. Replaced obsolete 24-person/taxonomy launch copy and its outdated replay link. Marked spike docs historical. Fixed the architecture's broken README budget anchor. |
| Research orientation | Added `docs/research/README.md`. Corrected the paper plan's obsolete `bench/agents` path. Qualified “perfectly labelled” synthetic data and “Live” status claims; implementation alone does not establish deployed behavior. |
| Metadata and license | Name, description, owner, repository and MIT metadata were already present and correct; root and library LICENSE files identify Madhav Sunil. Added homepage, issue URL and Node engine range matching installed tool requirements (`^22.12.0 || >=24.0.0`). Dependencies, lockfiles and scripts are unchanged. |
| CI sanity | CI checks Node 22/25, typecheck, tests, SLM smoke, build and bundle size with read-only repository permissions. Added the missing SLM smoke gate to deployment. Deployment still triggers only on `main`; no branch, deployment or account settings changed. Publish remains tag/version-gated with npm trusted publishing. |

## History and attribution

Read-only `git log --all` found 122 commits across the available refs. Every author and committer identity was `Madhav Sunil <94164709+Maddy824@users.noreply.github.com>`. Two message-body attribution violations need an owner decision; no history or refs were changed:

| Commit | Finding | Reachability at review |
|---|---|---|
| `deac69805029484c36c02eb07699f8ef2c8ce25d` | Assistant “Built by” byline in the message body | Reachable from `build/village`, `main`, `origin/build/village` and the local backup ref |
| `be4cf1481a1872ace3bf81e352e6c02588c35f8e` | Assistant `Co-Authored-By` trailer | Only `refs/original/refs/heads/build/village`; not reachable from the current branch or remote-tracking branch |

Additional task credits mention assistant names in subject suffixes, although they do not create Git author identities or co-author trailers. If the owner's message policy also excludes these, review these hashes before any coordinated rewrite: `3ed34bdfd6f4fd38c20eb0714e7a79248fd942d6`, `e334e4de3b47ba8ad17755e1229eed29e92023dd`, `f5292b4482bc275a352afd4a90cfe10b276a90f6`, `43af51148e970bf7b7214fef98d5b8437918b6ba`, `599e2cd8f1a673ebfa04180483f1381e2efc359e`, `79c93fd042c6652d181aadc989382146a4586c02`, `e485f409b99dbfe9bab3221d608304a1a147e6c5`, `18faa4a69fe8bf390318e84e6c0b6f753d75afc8`.

Operational subjects mentioning a tool/runbook are not contributor credits. The design spec's description of AI-assisted line-bank preparation is a process disclosure, not an assistant byline; retained it.

## History size, paths and secret hygiene

Used `git rev-list --objects --all` and `git cat-file --batch-check` to inspect 1,173 historical blobs (36,065,320 uncompressed bytes in total). No blob exceeds 5 MiB. The largest are legitimate screenshots:

| Path | Largest reviewed blob, bytes |
|---|---:|
| `agent-tradeoff/reports/01-desktop.png` | 1,903,982 |
| `docs/images/village-v2.png` | 1,894,156 |
| `agent-tradeoff/reports/07-desktop.png` | 1,869,066 |
| `docs/images/village-v3.png` | 1,614,173 |

There is no size-driven reason for a destructive history cleanup. Old screenshots are review evidence and were preserved.

A location-only scan of reachable historical text blobs for common provider tokens, private-key headers and private EC JWKs returned no candidates. A scan of tracked working files found no private-detail TODO candidates. This is a bounded hygiene check, not a guarantee that no secret exists; the separate security review remains authoritative for application findings. No credential values, ignored environment files or external secret stores were printed or copied.

Removed the machine-specific report path in the editable build plan. Personal machine paths remain in operational handoff/report files, including `agent-tradeoff/CONTINUE.md`, `03-final-review.md`, `README.md`, reports `01`, `14`, `15`, `16`, `20`, `25` and browser-check scripts `21-browser.mjs`, `21-clock-end.mjs`, `21-live.mjs`, `22-browser.mjs`. The SLM guide also names a local Wrangler config location and a Cloudflare account identifier (not a secret). These are portability/presentation follow-ups in other runs' files; they were not edited. Do not remove useful historical evidence without reviewing each reference.

## Validation

Working source changed concurrently; these results describe this shared checkout, not an isolated docs-only revision.

- Local Markdown paths and heading anchors: 92 tracked/new documentation files checked, including this report; no broken links after fixing the budget anchor.
- `git diff --check` on the review's docs/metadata paths passed. Built HTML includes a title, canonical link and description. Ignore checks cover build-info, dist, coverage/logs and full SLM dataset/result paths.
- Package JSON parsed; runtime/development dependencies match the existing lock metadata. No dependency or lockfile edit.
- Root `npm run typecheck` passed on retry. The initial run failed in concurrently edited `apps/rumortown/src/ui/share-link.test.ts:23` (extra `instructions` property on a typed share state); the subsequent production build also passed its typecheck. No application fix was made by this task.
- `npm run build` passed, transforming 182 modules. Existing warnings concern Vite's future native config loader and a chunk above 500 kB before gzip; changing application bundling is outside scope.
- `node .github/workflows/check-bundle.mjs` passed: 353,350 bytes gzipped, below the 400,000-byte budget.
- Root `npm test` did not pass: the default-concurrency run hit multiple timing failures and stopped making progress, so that task-owned process was interrupted (exit 130). The complete retry, `npm test -- --maxWorkers=2`, finished with **991 passed / 6 failed**, across **74 passed / 4 failed files** (405.55 seconds). Four failures were timeouts: two in `apps/rumortown/src/replay.test.ts:148` and `:193`, one in `apps/rumortown/src/research/model.test.ts:40`, and one in `apps/rumortown/src/sim/talk/talk.test.ts:620`. The other two were the 1.5-second speed assertions at `apps/rumortown/src/sim/agents/regressions.test.ts:522` (2,502 and 2,842 ms observed). The failures are consistent with resource contention during parallel work, but their cause was not isolated. No test assertion or timeout was changed. Run the complete suite after concurrent application edits settle; this task cannot certify a green application suite.
- `npm run bench:slm:smoke` passed on the isolated retry: **19 tests / 5 files passed**, in 23.11 seconds. The initial run finished with 18 passed and 1 export timeout while root tests were also active.
- Live GET checks for `/`, `/about`, `/sitemap.xml` and API `/health` could not resolve the hostnames from the sandbox. The web tool also could not access the three site URLs. This does not establish a site outage; live availability and the full set of external Markdown links could not be verified. No inference request was sent. The configured live URL is corroborated by the runbook and checked-in production domain configuration.
- Cloudflare's [pricing documentation](https://developers.cloudflare.com/workers-ai/platform/pricing/) was accessible and still documents the Free daily allocation, errors at the quota and paid-plan overages. Account plan/key caps were not inspected.
- This task makes no product UI changes. Desktop, 360 px and keyboard browser checks were not rerun for documentation changes.

## Independent review

A read-only independent review of the task-owned docs/metadata diff and this report found no Critical or Important issues. Fixed all three Minor observations: historical benchmark day length, the legacy 3B model label, and the scale diagram's distinction between cached legacy interpretation and uncached story/conversation routes. Validation outcomes and limitations are recorded above; no application edits were made in response to the review.

## Owner and controller follow-up

1. After the parallel work finishes, add `apps/rumortown/README.md` and `apps/api/README.md`. Link their scoped setup and architecture sections in `docs/workspaces.md`; the API guide must distinguish local disabled AI, secrets and production caps. `packages/rumormind/README.md` is accurate and substantial; the SLM guide is detailed but should eventually remove machine/account-specific setup.
2. Stop tracking the three build-info files while retaining local copies: explicitly remove only `apps/api/tsconfig.tsbuildinfo`, `apps/rumortown/tsconfig.tsbuildinfo` and `packages/rumormind/tsconfig.tsbuildinfo` from the index in a separate cleanup. This run cannot change the index and must preserve the existing dirty files. The new ignore rule alone cannot untrack them.
3. Decide whether to rewrite published commit messages for attribution. Coordinate with every active checkout first. The backup-only trailer is not proof of a published violation. Never force-push or delete `refs/original` as incidental cleanup.
4. In GitHub settings, use `https://rumourtown.dev` as the homepage and the description from `docs/launch.md`. Suggested topics: `typescript`, `social-simulation`, `deterministic`, `game-ai`, `npc`, `beliefs`, `provenance`, `small-language-models`. Pin the repository on the owner's profile. For the social preview, the existing `apps/rumortown/public/og.jpg` is 213,305 bytes; review its framing before uploading. No GitHub settings were changed.
5. Confirm the intended GitHub default branch and branch protection/required checks. Work continues on `build/village`; automatic deployment is intentionally `main` only. Supply the pending Cloudflare CI secrets/variables and npm trusted-publisher settings when ready, as described in the owner checklist. These account settings and provider spending controls cannot be inferred from repository files.
6. Rerun the complete root tests after concurrent work settles; investigate the reported timeouts and speed assertions without weakening them. Recheck live desktop, 360 px and keyboard flows after the concurrent code lands. Confirm the site/API health, guarded conversation and model quality from an authorized browser. Do not treat the pending comparative SLM study or historical benchmarks as current production measurements.

## Rulings

- The explicit edit allowlist takes precedence over the request to give every workspace a README. Added a central setup guide under `docs/`; missing app READMEs are a concrete follow-up for the owning runs. No authored edits under `apps/`, `bench/` or `packages/` were made by this task; required compiler checks can refresh existing build-info files.
- `.gitignore` changes implement the brief's explicit ignore-gap hygiene check. They do not remove or overwrite generated files, existing work or tracked artifacts.
- Kept correct evidence tables, library docs, existing screenshots and qualified historical benchmarks. Updated current guides and launch copy; historical plans/observations remain labelled history rather than being silently rewritten as present-day requirements.
- No commit, staging, push, deployment, history rewrite, model request, dependency installation or external message was performed.

## Files to commit

Commit only these task-owned paths after reviewing other runs' changes. Do not include the three dirty build-info files, application changes, bench changes or task briefs from other runs.

```text
.github/workflows/deploy.yml
.gitignore
README.md
package.json
docs/architecture.md
docs/credit-controls.md
docs/deploy.md
docs/how-it-works.md
docs/launch.md
docs/research/README.md
docs/research/paper-plan.md
docs/research/product-impact.md
docs/research/slm-limits-program.md
docs/scale.md
docs/spike-brief.md
docs/spike-findings.md
docs/superpowers/plans/2026-10-21-village-build.md
docs/workspaces.md
agent-tradeoff/reports/27-repo-review.md
```

Suggested commit message: `27: clarify repository overview, research status and setup`

Use the owner's configured identity and inspect author/committer attribution before any later push. Do not add an assistant byline or co-author trailer.
