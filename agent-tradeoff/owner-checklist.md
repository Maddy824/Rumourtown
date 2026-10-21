# Things only the owner can do

In order. Each item is blocked until the previous one is done.

1. **Play-test locally.** `npm run dev` at the repo root, open the printed address on a laptop and on your phone (same Wi-Fi, use the Network address). Whisper "Tom stole bread" to Mira, run a day at 8×, open tags, toggle "Who told whom", scrub, copy the link, reload it. Write what felt wrong in `agent-tradeoff/reports/playtest.md` so Codex can tune it (give it the file as a task).
2. **Decide the two open design questions**: the village's setting and names (storybook-neutral as now, or a specific place), and the name "RumorTown". Both are data changes; tell Codex which files to change (`apps/rumortown/src/content/cast/`, `index.html` title, README).
3. **Cloudflare account** (free, no card): create it, then `npx wrangler login`. Generate the signing key: `node --experimental-strip-types apps/api/src/keygen.ts`. Set the API secrets as `docs/deploy.md` lists (`wrangler secret put` for TURNSTILE_SECRET, OPENROUTER_API_KEY, SIGNING_KEY_JWK). Create a Turnstile widget and note its site key.
4. **OpenRouter**: buy $10 of credit, keep auto top-up off, create two keys with credit limits: `rumortown-live` ($7) and `rumortown-dev` ($2). The live key goes into the Worker secret; the dev key into `apps/api/.dev.vars` as `OPENROUTER_API_KEY=...` (git-ignored) for local evals.
5. **Local eval run**: `npm run dev -w apps/api` in one terminal (Wrangler dev with `.dev.vars`), then the command in `apps/api/evals/run.ts`'s header. Keep the printed table; it goes in the README.
6. **GitHub**: push the repo, set repository secrets CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID, and variables VITE_API_BASE_URL and VITE_TURNSTILE_SITE_KEY; merge `build/village` into `master` when the final review says ready; the deploy workflow publishes the game and the Worker.
7. **Domain** (about $10 a year, auto-renew): point it at Cloudflare; set the root to the game and `api.` to the Worker; set the Worker's ALLOWED_ORIGIN var to the game's origin.
8. **npm**: create the `rumormind` package's trusted publisher link on npmjs.com (GitHub Actions, the publish workflow), then tag `rumormind@0.1.0` to publish.
9. **Launch**: record the GIF and the 15-second clip per `docs/launch.md`; post.
