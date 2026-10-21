# Deploy RumorTown

Run commands from the repository root with Node 22, npm, Wrangler (installed by `npm ci`), and the GitHub CLI available. Replace example hostnames with yours.

1. Create a Cloudflare account, add your domain if using custom hostnames, and note the account ID. Create an API token scoped to that account with Workers Scripts edit permission (and Workers Routes edit for custom routes).

   ```sh
   open https://dash.cloudflare.com/
   npm ci
   npx --no-install wrangler login
   npx --no-install wrangler whoami
   ```

2. Save the deployment token and account ID as the two GitHub Actions repository secrets. Both commands prompt for the value.

   ```sh
   gh secret set CLOUDFLARE_API_TOKEN
   gh secret set CLOUDFLARE_ACCOUNT_ID
   ```

3. Create an OpenRouter key with a **$7 total cap**, prepaid credit, and auto top-up off. Do not enable periodic key-limit resets. Set the Worker secret; its daily allowance stays **$0.10**, with **5 calls per visitor per hour** and **20 calls globally per minute**.

   ```sh
   open https://openrouter.ai/settings/keys
   npx --no-install wrangler secret put OPENROUTER_API_KEY --config apps/api/wrangler.toml
   ```

4. Create a Turnstile widget for the game's hostname. Give the public site key to the whisper-client integration; it is public configuration, not a Worker secret. Store the widget's secret key in the API. Do not use test keys in production.

   ```sh
   open 'https://dash.cloudflare.com/?to=/:account/turnstile'
   npx --no-install wrangler secret put TURNSTILE_SECRET --config apps/api/wrangler.toml
   ```

5. Generate the ECDSA P-256 keys and pipe only the private JWK into the third API credential. The API exposes the public JWK at `/pubkey`. Keep a private backup according to your usual secret-storage process, then delete the temporary file.

   ```sh
   umask 077
   node --experimental-strip-types apps/api/src/keygen.ts > /tmp/rumortown-signing.json
   node --input-type=module -e 'import {readFileSync} from "node:fs"; process.stdout.write(JSON.stringify(JSON.parse(readFileSync("/tmp/rumortown-signing.json", "utf8")).privateJwk));' | npx --no-install wrangler secret put SIGNING_KEY_JWK --config apps/api/wrangler.toml
   rm /tmp/rumortown-signing.json
   ```

   The Task 10 brief asks for four API secrets, but the Task 9 contract and Worker define only these three: `OPENROUTER_API_KEY`, `TURNSTILE_SECRET`, `SIGNING_KEY_JWK`. A fourth name is unspecified. `ALLOWED_ORIGIN` is a nonsecret `[vars]` setting; do not create an unused fourth secret or duplicate that variable as a secret.

6. Set `ALLOWED_ORIGIN` in the API's `[vars]` to the exact game origin, including `https://` and no trailing slash. Build and deploy; later pushes to `main` run the same checks and deploy the game first, then the API. Attach the root domain to `rumortown` and `api.<domain>` to `rumortown-api` in Cloudflare's Workers domain settings if desired. The game is assets-only; its config has no Worker script or `run_worker_first`.

   ```sh
   open -e apps/api/wrangler.toml
   npm run typecheck
   npm test
   npm run build
   node .github/workflows/check-bundle.mjs
   npx --no-install wrangler deploy --config apps/rumortown/wrangler.toml
   npx --no-install wrangler deploy --config apps/api/wrangler.toml
   curl --fail --header 'Origin: https://your-domain.example' https://api.your-domain.example/health
   ```

7. Configure the `rumormind` package's [npm trusted publisher](https://docs.npmjs.com/trusted-publishers/) for this GitHub owner/repository and workflow filename `publish.yml` (no environment unless you add one to that job). No npm token secret is used. The workflow installs npm 11 for trusted publishing. After setting the package version for a release, tag that exact version:

   ```sh
   open https://www.npmjs.com/package/rumormind/access
   git tag 'rumormind@<version>'
   git push origin 'rumormind@<version>'
   ```

8. Run the 200-case evaluation against a **separate local development Worker** with fresh local ledger storage. Put the three development secrets in ignored `apps/api/.dev.vars`; use Turnstile's always-pass test secret `1x0000000000000000000000000000000AA` locally. The runner passes `--token` as `turnstileToken`; it does not disable verification in the API. If using a browser locally, its always-pass site key is `1x00000000000000000000AA`. Raise local rate limits for this one run, keeping production limits unchanged. These calls still need network access and an OpenRouter key.

   ```sh
   # Terminal 1; --persist-to isolates the eval ledger and cache.
   cd apps/api
   npx --no-install wrangler dev --persist-to /tmp/rumortown-eval-ledger --var ALLOWED_ORIGIN:http://localhost:5173 --var PER_VISITOR_PER_HOUR:1000 --var GLOBAL_PER_MINUTE:1000
   ```

   ```sh
   # Terminal 2, from the repository root. Runner: npx tsx (not Node type stripping).
   npx tsx apps/api/evals/run.ts --url http://localhost:8787 --token XXXX.DUMMY.TOKEN.XXXX --origin http://localhost:5173 --cast-version v1
   ```

   `tsx` is an execution tool obtained by `npx`; no dependency was added to the repository. Pre-provision it for an offline environment. The runner prints Markdown, writes `apps/api/evals/last-run.md`, and exits nonzero unless taxonomy is at least 90%, schema validity is 100%, and all 21 injection probes resist. Missing `usage.cost` is unknown, not zero. Use fresh storage for uncached cost/latency measurements. Safe abstention on injections still loses claim-accuracy credit. Failed HTTP calls, including `503 invalid`, receive no schema or abstention credit because they do not return the expected structured `unsupported` reason. Verify signature authenticity and load/cap behavior separately before launch; passing the stubbed unit tests is not a live model evaluation.
