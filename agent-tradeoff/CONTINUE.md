# Continue without the controller

Read this first when the Claude session is gone (limit hit, closed, or silent). It tells you where things stand, what to do next, how to verify and deploy, and what never to do. The owner starts you with:

```sh
codex exec -s workspace-write -C /Users/maddy/B2B/rumortown -c model_reasoning_effort=high \
  "Read agent-tradeoff/CONTINUE.md and do the next step it describes. Report to agent-tradeoff/reports/ as it says."
```

## 1. Where things stand

- Branch `build/village`, pushed to `https://github.com/Maddy824/Rumourtown`. Commits use `Madhav Sunil <94164709+Maddy824@users.noreply.github.com>` and never carry assistant co-author lines (see `AGENTS.md`).
- Live: the game at `https://rumourtown.dev` (assets-only Cloudflare Worker `rumortown`) and the API at `https://api.rumourtown.dev` (Worker `rumortown-api`, environment `production`, with secrets `TURNSTILE_SECRET`, `OPENROUTER_API_KEY`, `SIGNING_KEY_JWK`, `AI_ENABLED=true`, Workers AI binding `AI`). Deploys run from this Mac with wrangler, logged in by OAuth; CI deploys need a valid `CLOUDFLARE_API_TOKEN` secret the owner has not provided yet.
- Interpretation tiers for typed whispers: browser rule interpreter (task 19A, in progress) → Workers AI (`@cf/meta/llama-3.1-8b-instruct-fast`, $0) → OpenRouter free models → `google/gemini-2.5-flash-lite`, all behind the ledger ($0.019 per UTC day, $7 lifetime) and the key's own $10 cap.
- Secrets live outside the repo: `~/.config/rumourtown/cloudflare.env`, `~/.config/rumourtown/turnstile.env`, `~/.config/rumourtown/signing.json`, and the git-ignored `apps/api/.dev.vars`. Never print, copy or commit them.
- Design authority: `docs/superpowers/specs/2026-10-21-rumortown-design.md`. Research: `/Users/maddy/B2B/reports/` (outside the repo). Rulings and history: `.superpowers/sdd/2026-10-21-village-build/progress.md`.

## 2. The queue, in order

| # | Task file | State at handoff | What to do |
|---|---|---|---|
| 22 | `22-night.md` | running or just finished | If `reports/22-report.md` exists with STATUS: DONE or BLOCKED and the tree holds its changes, verify (section 4) and commit per directory with `22:` messages; the replay pin changes: inspect the new replay and record old and new hashes. If the report is missing, run the task from its file. |
| 19A | `19-local-first-interpretation.md` section A | running or just finished | Same procedure; commit with `19:`; put the offline eval numbers in `README.md`. |
| 21 | `21-watch-a-rumor-grow.md` (sections A–E) | queued, after 22 | Run it only after 22 is committed (it depends on the 24-hour day). |
| — | Redeploy and live check | after 21 | Section 5, then section 6. |
| 23 | Final whole-branch review | after the redeploy | Run `03-final-review.md`'s command against the whole branch again, then `04-final-fixes.md`. |
| — | Owner steps | any time | `owner-checklist.md` (CI token, key cap, domain email, launch). |

A task is "committed" when `git log --oneline -30` shows its number prefix and `git status --short` shows nothing of it left. A task is "BLOCKED on commit" when its report says so and its files are still in the working tree: verify and commit them yourself; that is the common case, because the sandbox often cannot write `.git`.

## 3. Rules that bind every step

- Stage explicit paths; never `git add -A`. Keep generated `tsconfig.tsbuildinfo` files out of commits.
- No new dependencies. No simulation change without re-inspecting and re-pinning the replay hash in `apps/rumortown/src/replay.test.ts`; say what changed in the replay and why.
- Determinism in `apps/rumortown/src/sim/**` and `packages/rumormind/**`: no `Math.random`, `Date`, `performance.now`; seeded draws and stable iteration only.
- Copy: sentence case, plain words, no all-caps labels, no middle dots, no arrows in buttons, no exclamation marks.
- Phone first: 360 px wide must work with no horizontal scroll; nothing may overlap the Whisper postbox.
- Typed text never reaches links, logs, bubbles, the API cache or the share card; only the interpreted claim does.
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
