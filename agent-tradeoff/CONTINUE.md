# Continue without the controller

Read this first when the Claude session is gone (limit hit, closed, or silent). It tells you where things stand, what to do next, how to verify and deploy, and what never to do. The owner starts you with:

```sh
codex exec -s workspace-write -C /Users/maddy/B2B/rumortown -c model_reasoning_effort=high \
  "Read agent-tradeoff/CONTINUE.md and do the next step it describes. Report to agent-tradeoff/reports/ as it says."
```

## 1. Where things stand

- Branch `build/village`, pushed to `https://github.com/Maddy824/Rumourtown`. Commits use `Madhav Sunil <94164709+Maddy824@users.noreply.github.com>` and never carry assistant co-author lines (see `AGENTS.md`).
- Live: the game at `https://rumourtown.dev` (assets-only Cloudflare Worker `rumortown`) and the API at `https://api.rumourtown.dev` (Worker `rumortown-api`, environment `production`, with secrets `TURNSTILE_SECRET`, `OPENROUTER_API_KEY`, `SIGNING_KEY_JWK`, `AI_ENABLED=true`, Workers AI binding `AI`). Deploys run from this Mac with wrangler, logged in by OAuth; CI deploys need a valid `CLOUDFLARE_API_TOKEN` secret the owner has not provided yet.
- Interpretation tiers for typed whispers: browser rule interpreter (task 19A, committed) → Workers AI (`@cf/meta/llama-3.2-3b-instruct`, $0 on Free) → OpenRouter `liquid/lfm-2.5-2.6b:free` → `google/gemini-2.5-flash-lite`, all behind the ledger ($0.019 per UTC day, $7 lifetime) and the key's own $10 cap.
- Secrets live outside the repo: `~/.config/rumourtown/cloudflare.env`, `~/.config/rumourtown/turnstile.env`, `~/.config/rumourtown/signing.json`, and the git-ignored `apps/api/.dev.vars`. Never print, copy or commit them.
- Design authority: `docs/superpowers/specs/2026-10-21-rumortown-design.md`. Research: `/Users/maddy/B2B/reports/` (outside the repo). Rulings and history: `.superpowers/sdd/2026-10-21-village-build/progress.md`.

## 1b. Latest state (2026-10-22, controller)
- Live at 706fda2 plus deploys of 912b238: the conversation orchestrator (`apps/rumortown/src/agentic/orchestrator.ts`) answers moves, visits, provenance and news from simulation state with no model call; open conversation goes to `/play` with grounded `facts` and is voiced by `@cf/meta/llama-3.3-70b-instruct-fp8-fast`; `/rumor` also uses 70B; chat has its own allowance (`PLAY_PER_VISITOR_PER_HOUR=30`); the Talk sheet shows "<name> is thinking" immediately and warms Turnstile on open.
- Human QA report: `reports/qa-2026-10-22.md`. Done from task 23: items 1, 2, 3, 4 (model, deterministic moves, grounding, separate allowance). Still open: items 5 (night guidance), 6 (first-screen copy), 7 (timeline noise, stale status lines, blank signs), 8 (phone talk sheet), 9 (shared-text moderation), plus: library-rumor beats read "X told Y a village rumor" and should name the rumor.
- Research track: `docs/research/slm-limits-program.md`, `docs/research/paper-plan.md`, `docs/research/product-impact.md`; harness brief `25-slm-harness.md`; verifier and runtime guard in `apps/rumortown/src/agentic/` (verifier.ts, guard.ts).
- Pending deploy: `apps/rumortown/src/ui/play.ts` holds both the controller's guard wiring (guardReply before showing model replies) and task 23 item 8's phone typing changes; commit it with task 23, then deploy game and API.

## 2. The queue, in order

| # | Task file | State at handoff | What to do |
|---|---|---|---|
| 22 | `22-night.md` | completed and verified; see `reports/22-report.md` | Full-day replay matches Node 22/25 and Chrome; desktop/phone and frame budget verified. Check `22:` commits and skip once clean. |
| 19A | `19-local-first-interpretation.md` section A | committed in `863c47e` | Preserve the implemented local interpreter and recorded offline eval; do not rebuild it. |
| 21 | `21-watch-a-rumor-grow.md` (sections A–E) | complete and live, code `b147aaf` | See `reports/21-report.md`; full-day local arrival, readable exchanges and projected anchors passed Node 22/25 CI and live desktop/phone checks. |
| — | Redeploy and live check | complete 2026-10-21 | Cloudflare version `c540792e-8ba3-475d-af0c-b743a26b9a04`; game, About, sitemap and API health verified. |
| 23 | Final whole-branch review | next | Run `03-final-review.md`'s command against the whole branch again, then `04-final-fixes.md`. |
| — | Owner steps | any time | `owner-checklist.md` (CI token, key cap, domain email, launch). |

A task is "committed" when `git log --oneline -30` shows its number prefix and `git status --short` shows nothing of it left. A task is "BLOCKED on commit" when its report says so and its files are still in the working tree: verify and commit them yourself; that is the common case, because the sandbox often cannot write `.git`.

### Latest owner follow-up (2026-10-22)

Open-ended stories replace the actual UI's twelve-category interpretation and death refusal. Exact wording becomes a canonical `story_` claim after preview/disclosure, with semantic AI annotations or neutral free fallback; typed stories bypass the old local classifier. `/rumor` shares the unchanged inference ledger and caps. Rumors never create eyewitness evidence or world-state deaths. Developer agents gain `whisperStory`. Research model is `v4-open-stories-1`; authored replay hash is unchanged. See [implementation and release report](reports/open-rumors-report.md), [independent review](reports/open-rumors-review.md), and [developer guide](../docs/open-rumors.md). Published code `506ea5d`; API `ff4c92d3-9fcb-4844-9f86-52cb63c780c9`, site `b09694c0-beef-4a79-9c30-78bac170a2e7`. Root typecheck, 867 local tests, build, bundle gate, independent review and live desktop/phone free-fallback checks passed. Live semantic model accuracy remains unmeasured.

### Previous owner follow-ups (2026-10-21)

Whisper grounding follow-up is live in code commit `fa276db`: `someone killed tom` must never become an unrelated kindness. The browser and API now reject death rumors explicitly; remote claims require grounded people and sufficient confidence, including cache hits. Refusals cannot silently become default manual rumors, and manual choices require confirmation. Raw-input privacy and simulation mechanics remain unchanged. See [validation and release report](reports/whisper-grounding-report.md). This does not add death mechanics or unrestricted narrative interpretation.

Reusable rumor add-ons and lightweight hybrid inference are published in code commit `2cf7ee5`. The library adds 24 shared stories; `addon:draft` prepares story/behavior development jobs. Workers AI now uses Llama 3.2 3B, followed by OpenRouter Liquid 2.6B free and capped Gemini Flash Lite. Written rumors no longer gain unrelated eyewitness evidence. Final local checks: 827 tests, typecheck, build, 353,767-byte bundle; independent review cleared. Live desktop/360 px library checks and API health passed. Site version `19777188-3f2a-441f-b685-b48f5f56955c`; API `1eff3c06-a8ee-4a52-919d-2606d7f0cbc0`. See [report](reports/rumor-addons-report.md) and [add-on guide](../docs/rumor-addons.md). New live model quality and actual coding-agent execution were not exercised; free inference quotas and separate developer-account costs still apply.

Manual landing entry and the subsequent music/play polish are published. Code commit `fb5c351` adds quiet local ambience, an angelic arrival, one-card onboarding, **Talk or act** with budgeted `POST /play`, independent rumor-line/reading toggles, and claim-aware dialogue. See [the full report](reports/play-polish-report.md). Both Node 22/25 CI jobs passed. Site version `f9539a50-9b32-405e-aef4-7c3003fad431`; API version `3aabb750-0c4b-4cd2-8fdd-a2a8371dd8c7`. Limits and secrets are unchanged. Live UI/audio checks passed; automated Turnstile 600010 prevented a real conversation request, so live model quality still needs a human-browser check. Task 23 remains the next whole-branch review.

## 3. Rules that bind every step

- Stage explicit paths; never `git add -A`. Keep generated `tsconfig.tsbuildinfo` files out of commits.
- No new dependencies. No simulation change without re-inspecting and re-pinning the replay hash in `apps/rumortown/src/replay.test.ts`; say what changed in the replay and why.
- Determinism in `apps/rumortown/src/sim/**` and `packages/rumormind/**`: no `Math.random`, `Date`, `performance.now`; seeded draws and stable iteration only.
- Copy: sentence case, plain words, no all-caps labels, no middle dots, no arrows in buttons, no exclamation marks.
- Phone first: 360 px wide must work with no horizontal scroll; nothing may overlap the Whisper postbox.
- Owner-authorized open stories: confirmed wording may enter dialogue, research exports and replay links after an explicit preview/disclosure. Unsent text and raw prose must never enter server logs or shared API caches. The share-card image still uses glyphs and names. See `docs/superpowers/plans/2026-10-21-open-rumors.md`.
- Money boundaries in `apps/api` are not to be loosened: reservation before dispatch, settlement after, daily and lifetime caps, fail closed.
- The renderer's close zoom is 40 CSS px per tile; UI anchors must use `project`/`unproject`, never the `TILE` constant.

## 4. Verify (every task, before every commit)

```sh
npm run typecheck && npm test && npm run build && node .github/workflows/check-bundle.mjs
```

All four must pass. If a failure is inside files another run is editing at that moment, say so in the report and wait; if you are the only run, fix it. Scoped commands per task are in each task file.

## 5. Deploy

```sh
cd /Users/maddy/B2B/rumortown
npx --no-install wrangler whoami                       # must show the owner's account
(cd apps/rumortown && VITE_API_BASE_URL=https://api.rumourtown.dev VITE_TURNSTILE_SITE_KEY=0x4AAAAAAFfL_oLW4eeV2uAo npx vite build)
npx --no-install wrangler deploy --config apps/rumortown/wrangler.toml
npx --no-install wrangler deploy --config apps/api/wrangler.toml --env production   # only if apps/api changed
curl -s -o /dev/null -w 'game %{http_code}\n' https://rumourtown.dev/
curl -s -H 'Origin: https://rumourtown.dev' https://api.rumourtown.dev/health       # {"ok":true}
git push origin build/village
```

Never deploy with failing checks. Never change secrets or wrangler environments without a line in the report.

## 6. Live check (what the controller used to do in a browser)

You cannot open a browser from the sandbox. Do what you can: `curl` the three pages (`/`, `/about`, `/sitemap.xml`), check the head tags in the built `dist/index.html`, and send one interpret request only when the owner asks (it needs a Turnstile token from a real page). Write what you could not verify in the report; the owner can look at the site on a phone and paste notes into `reports/playtest.md` for you to act on.

## 7. Review your own work before finishing a task

After the checks pass, run a read-only review of your diff and act on its Critical and Important findings before the final commit:

```sh
codex exec -s read-only -C /Users/maddy/B2B/rumortown -c model_reasoning_effort=high \
  -o agent-tradeoff/reports/NN-review.md \
  "Review the diff of the last commits for task NN (git log and git diff <base>..HEAD) against agent-tradeoff/NN-<file>.md and the rules in agent-tradeoff/CONTINUE.md section 3. Walk every requirement; mark met, not met, or cannot verify. Tag findings Critical, Important or Minor with file and line and a one-line fix. Your final message is the review."
```

Minor findings go into the report as deferred items; never into endless loops.

## 8. When something is unclear

Decide, record the decision in the report under "Rulings" with what it costs if wrong, and continue. Stop only for: anything that could spend money beyond the caps, anything destructive (history rewrite, deleting deployments or secrets), or a change to the product's purpose. Those wait for the owner.
