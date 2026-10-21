#!/usr/bin/env bash
# Run from anywhere after wrangler login. Remote secrets are reused on reruns.
# No secret is written into the repository, echoed, or passed as a process argument.
set -euo pipefail
set +x
cd "$(dirname "$0")/.."
origin="${1:-https://rumourtown.dev}"
node --input-type=module -e 'const u = new URL(process.argv[1]); if (u.protocol !== "https:" || u.origin !== process.argv[1] || u.username || u.password) process.exit(1);' "$origin"
wrangler=(npx --no-install wrangler)
config=(--config apps/api/wrangler.toml --env production)
"${wrangler[@]}" whoami
# Failure to inspect existing secrets aborts rather than accidentally rotating keys.
if ! secret_names="$("${wrangler[@]}" secret list "${config[@]}" 2>&1)"; then
  # Wrangler reports an absent script on first setup; secret put can create its
  # draft. Authentication/network failures must not look like an empty key set.
  if [[ "$secret_names" == *'Worker "rumortown-api" (env: production) not found.'* ]]; then
    secret_names='[]'
  else
    printf 'Could not inspect production secrets. Check the selected Cloudflare account and connection.\n' >&2
    exit 1
  fi
fi
SECRET_NAMES="$secret_names" node --input-type=module -e 'try { const names = JSON.parse(process.env.SECRET_NAMES); if (!Array.isArray(names) || !names.every(s => s && typeof s.name === "string")) throw Error(); } catch { console.error("Could not read the production secret list."); process.exit(1); }'
has_secret() {
  SECRET_NAMES="$secret_names" node --input-type=module -e 'const names = JSON.parse(process.env.SECRET_NAMES); process.exit(names.some(s => s.name === process.argv[1]) ? 0 : 1);' "$1"
}
put_secret() { printf '%s' "$2" | "${wrangler[@]}" secret put "$1" "${config[@]}" >/dev/null; }
# Existing signing keys must survive redeploys so old claims remain verifiable.
if has_secret SIGNING_KEY_JWK; then
  read -r -p 'Signing key exists. Replace it? Existing signatures will change. [y/N] ' replace
else
  replace=y
fi
if [[ "$replace" =~ ^[Yy]$ ]]; then
  if [[ -n "${SIGNING_KEY_JWK:-}" ]]; then
    signing_key="$SIGNING_KEY_JWK"
  else
    signing_key="$(node --input-type=module -e 'const p = await crypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]); process.stdout.write(JSON.stringify(await crypto.subtle.exportKey("jwk",p.privateKey)));')"
  fi
  put_secret SIGNING_KEY_JWK "$signing_key"
  unset signing_key
fi
for name in TURNSTILE_SECRET OPENROUTER_API_KEY USAGE_ALERT_URL; do
  if has_secret "$name"; then
    read -r -p "$name exists. Replace it? [y/N] " replace
    [[ "$replace" =~ ^[Yy]$ ]] || continue
  fi
  if [[ "$name" == USAGE_ALERT_URL ]]; then
    read -r -s -p 'Private ntfy topic or https://ntfy.sh/topic (optional; enter to skip): ' secret_value
  else
    read -r -s -p "$name: " secret_value
  fi
  printf '\n'
  if [[ -z "$secret_value" ]]; then
    [[ "$name" == USAGE_ALERT_URL ]] && continue
    printf 'Required secret is empty.\n' >&2
    exit 1
  fi
  if [[ "$name" == USAGE_ALERT_URL ]]; then
    [[ "$secret_value" == https://ntfy.sh/* ]] || secret_value="https://ntfy.sh/$secret_value"
    # Validate without putting the private topic in argv or log output.
    printf '%s' "$secret_value" | node --input-type=module -e 'let s=""; for await(const c of process.stdin) s+=c; if(!/^https:\/\/ntfy\.sh\/[A-Za-z0-9_-]{32,128}$/.test(s)) { console.error("Use a private ntfy topic of 32–128 letters, digits, underscores or hyphens."); process.exit(1); }'
  fi
  put_secret "$name" "$secret_value"
  unset secret_value
 done
# Persist the chosen origin in production only, so future CI deploys keep it.
node --input-type=module - "$origin" <<'JS'
import { readFileSync, writeFileSync } from 'node:fs';
const file = 'apps/api/wrangler.toml';
const source = readFileSync(file, 'utf8');
const updated = source.replace(/(\[env\.production\.vars\]\s*\nALLOWED_ORIGIN = )"[^"]*"/, (_, prefix) => prefix + JSON.stringify(process.argv[2]));
if (updated === source && !source.includes(`ALLOWED_ORIGIN = ${JSON.stringify(process.argv[2])}`)) throw Error('Production origin setting missing');
writeFileSync(file, updated);
JS
"${wrangler[@]}" deploy "${config[@]}" --var "ALLOWED_ORIGIN:$origin"
printf '\nAPI URL: https://api.rumourtown.dev\n'
printf "gh variable set VITE_API_BASE_URL --body 'https://api.rumourtown.dev'\n"
printf "gh variable set VITE_TURNSTILE_SITE_KEY --body '<your-public-turnstile-site-key>'\n"
printf 'Commit the production origin setting if changed, then rebuild and deploy the game.\n'
