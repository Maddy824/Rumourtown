# Deploy Rumourtown

The game lives at [rumourtown.dev](https://rumourtown.dev), with `www.rumourtown.dev` as a second game hostname and `api.rumourtown.dev` for interpretation. Wrangler declares the custom domains; the zone must belong to your Cloudflare account. The game Worker serves assets only. Hashed assets retain the immutable cache policy in `apps/rumortown/public/_headers`.

Use Node 22, npm, Wrangler (from `npm ci`) and the GitHub CLI. The local town always works without an API. With both public build settings present, typed whispers use Turnstile, interpretation and signature verification, then ask the player to confirm. A refusal or unavailable API leaves manual choices available. Only taxonomy claims enter stories and replay links.

## First production setup

1. Add the domain to Cloudflare and create an invisible Turnstile widget for **both** `rumourtown.dev` and `www.rumourtown.dev`. Keep its public site key for the game build. Store the secret only in the API.
2. Prepay OpenRouter credit, turn off auto top-up, and cap the live key at **$7 with no periodic reset**. The Worker also enforces **$0.019 per UTC day**, **$7 lifetime**, **5 calls per visitor per hour** and **20 calls globally per minute**. The free model is tried first; the paid fallback stays within its priced reservation. See [credit controls](credit-controls.md).
3. Log in and run the setup script from the repository:

   ```sh
   npm ci
   npx --no-install wrangler login
   ./scripts/go-live.sh
   # Optional custom game origin:
   # ./scripts/go-live.sh https://rumourtown.dev
   ```

   The script checks `wrangler whoami`, inspects existing production secrets, generates a signing pair when needed, and prompts silently for the Turnstile secret, OpenRouter key and optional private ntfy topic/URL. It installs three required secrets and, when supplied, `USAGE_ALERT_URL`, using `--config apps/api/wrangler.toml --env production`. It reuses existing secrets on reruns unless you explicitly choose replacement. An existing signing key requires confirmation before rotation; alternatively supply `SIGNING_KEY_JWK` through your secret manager. Secrets are never echoed or saved in the repository. The API derives and exposes the public verification key at `/pubkey`.

   The script persists the origin **only in `[env.production.vars]`**, deploys the production API, and prints its URL and the two game build commands. Defaults are `ALLOWED_ORIGIN = "https://rumourtown.dev"` and `AI_ENABLED = "true"` in production. The default environment keeps AI **false**. The production origin also admits `https://www.rumourtown.dev`, with the exact requesting origin returned in CORS headers. Other origins are rejected.
4. Set the printed public repository variables:

   ```sh
   gh variable set VITE_API_BASE_URL --body 'https://api.rumourtown.dev'
   gh variable set VITE_TURNSTILE_SITE_KEY --body '<your-public-turnstile-site-key>'
   ```

   `.github/workflows/deploy.yml` reads both variables at build time. A change needs a new build. The Turnstile **secret** and OpenRouter key never belong in frontend variables.
5. Set the GitHub deployment secrets (both commands prompt), then build and deploy the game:

   ```sh
   gh secret set CLOUDFLARE_API_TOKEN
   gh secret set CLOUDFLARE_ACCOUNT_ID
   npm run typecheck
   npm test
   VITE_API_BASE_URL="$(gh variable get VITE_API_BASE_URL --json value --jq .value)" VITE_TURNSTILE_SITE_KEY="$(gh variable get VITE_TURNSTILE_SITE_KEY --json value --jq .value)" npm run build
   node .github/workflows/check-bundle.mjs
   npx --no-install wrangler deploy --config apps/rumortown/wrangler.toml
   curl --fail --header 'Origin: https://rumourtown.dev' https://api.rumourtown.dev/health
   curl --fail --header 'Origin: https://www.rumourtown.dev' https://api.rumourtown.dev/health
   ```

   Scope the token to Workers Scripts edit and Workers Routes edit in the account. Pushes to `main` deploy game assets. To deploy the API in that workflow too, set `gh variable set DEPLOY_OPTIONAL_API --body true`; its command selects `--env production`. Keep the declared Durable Object and both rate-limit bindings. Reuse the same ledger to preserve the lifetime allowance. See [traffic and capacity](scale.md) before a large launch.

## Local evaluation

`apps/api/.dev.vars` is ignored. Use a separate development OpenRouter key, a development signing JWK and Turnstile's always-pass test secret `1x0000000000000000000000000000000AA`. `.dev.vars` supplies secrets to a local Worker; it does not enable AI. The following commands explicitly enable local AI and make **200 model requests**, so run them only when that development spend is authorized. Never run the corpus against production. Optional ntfy can be left unset.

```sh
# Terminal 1, from the root; fresh storage isolates the evaluation ledger/cache.
npx --no-install wrangler dev --config apps/api/wrangler.toml --persist-to /tmp/rumourtown-eval-ledger --var AI_ENABLED:true --var ALLOWED_ORIGIN:http://localhost:5173 --var PER_VISITOR_PER_HOUR:1000 --var GLOBAL_PER_MINUTE:1000
# Terminal 2, from the root (tsx must already be available when offline).
npx tsx apps/api/evals/run.ts --url http://localhost:8787 --token XXXX.DUMMY.TOKEN.XXXX --origin http://localhost:5173 --cast-version v3
```

The runner posts `turnstileToken`, `Origin` and `castVersion` and leaves Turnstile verification enabled. It writes `apps/api/evals/last-run.md`. Gates are at least 90% taxonomy accuracy, 100% schema validity and all 21 injection probes resisted. Missing usage cost remains unknown. Stubbed tests check the adapter and scoring; they do not establish live model quality. No full live corpus was authorized for task 15.

## Browser checks before launch

At **360×640** and **1440×900**, dismiss the opening card and run this in browser developer tools. Both the postbox and its label must fit inside a 16 px viewport margin:

```js
for (const selector of ['.quick-whisper', '.postbox-label']) {
  const r = document.querySelector(selector).getBoundingClientRect();
  console.assert(r.left >= 16 && r.top >= 16 && r.right <= innerWidth - 16 && r.bottom <= innerHeight - 16, selector, r);
}
```

Use Tab to reach Whisper, Enter to open it, and keyboard controls to write, choose a listener, confirm with “Whisper it”, or use “Change it” to edit the prefilled manual choices. Check Escape closes the modal and restores focus. Repeat with the API offline and with public settings omitted. A slow or unavailable challenge must leave “Asking the village…” within 5.8 seconds. Verify no horizontal overflow, reachable controls and readable wrapping at 360 px.

## Library publishing

Configure `rumormind`'s npm trusted publisher for the repository and `publish.yml`, then tag the exact package version with `rumormind@<version>`. That workflow uses npm 11 and no npm token. Package and code identifiers keep their existing spelling.
