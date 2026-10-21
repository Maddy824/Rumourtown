// Offline deployment rehearsal. The fake CLI never contacts Cloudflare or ntfy.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function rehearsal(existing, input, origin, missing = false) {
  const root = mkdtempSync(join(tmpdir(), 'rumourtown-go-live-'));
  try {
    for (const dir of ['scripts', 'apps/api', 'bin']) mkdirSync(join(root, dir), { recursive: true });
    copyFileSync(new URL('./go-live.sh', import.meta.url), join(root, 'scripts/go-live.sh'));
    copyFileSync(new URL('../apps/api/wrangler.toml', import.meta.url), join(root, 'apps/api/wrangler.toml'));
    const calls = join(root, 'calls.jsonl');
    writeFileSync(calls, '');
    writeFileSync(join(root, 'bin/npx'), `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(4);
if (args[0] === 'whoami') console.log('Authenticated test account');
else if (args[0] === 'secret' && args[1] === 'list') {
  if (process.env.TEST_MISSING === 'denied') { console.error('Authentication failed'); process.exit(1); }
  if (process.env.TEST_MISSING === 'true') { console.error('Worker "rumortown-api" (env: production) not found.'); process.exit(1); }
  console.log(process.env.TEST_EXISTING);
}
else if (args[0] === 'secret' && args[1] === 'put') {
  const value = fs.readFileSync(0, 'utf8');
  if (!value) process.exit(1);
  if (args[2] === 'SIGNING_KEY_JWK') { const j = JSON.parse(value); if (j.kty !== 'EC' || !j.d || !j.x || !j.y) process.exit(1); }
  fs.appendFileSync(process.env.TEST_CALLS, JSON.stringify({ args, hasValue: true }) + '\\n');
} else if (args[0] === 'deploy') fs.appendFileSync(process.env.TEST_CALLS, JSON.stringify({ args }) + '\\n');
else process.exit(2);
`, { mode: 0o700 });
    const result = spawnSync('bash', [join(root, 'scripts/go-live.sh'), ...(origin ? [origin] : [])], {
      input, encoding: 'utf8', env: { ...process.env, SIGNING_KEY_JWK: '', PATH: `${root}/bin:${process.env.PATH}`,
        TEST_CALLS: calls, TEST_MISSING: String(missing), TEST_EXISTING: JSON.stringify(existing.map(name => ({ name }))) },
    });
    assert.equal(result.status, missing === 'denied' ? 1 : 0, result.stderr);
    assert(!result.stdout.includes('synthetic-private-value'));
    assert(!result.stdout.includes('private-topic-123456789012345678901234567890'));
    return { calls: readFileSync(calls, 'utf8').trim().split('\n').filter(Boolean).map(s => JSON.parse(s)),
      config: readFileSync(join(root, 'apps/api/wrangler.toml'), 'utf8'), output: result.stdout };
  } finally { rmSync(root, { recursive: true, force: true }); }
}

test('first setup creates a signing key and three required secrets, with an optional fourth', () => {
  for (const topic of ['', 'private-topic-123456789012345678901234567890']) {
    const run = rehearsal([], `synthetic-private-value\nsynthetic-private-value\n${topic}\n`);
    const secrets = run.calls.filter(c => c.args[0] === 'secret').map(c => c.args[2]);
    assert.deepEqual(secrets, ['SIGNING_KEY_JWK', 'TURNSTILE_SECRET', 'OPENROUTER_API_KEY', ...(topic ? ['USAGE_ALERT_URL'] : [])]);
    assert(run.calls.every(c => c.args.includes('production')));
    assert(run.output.includes("gh variable set VITE_API_BASE_URL --body 'https://api.rumourtown.dev'"));
  }
});
test('reruns preserve secrets and persist an origin only in production', () => {
  const run = rehearsal(['SIGNING_KEY_JWK', 'TURNSTILE_SECRET', 'OPENROUTER_API_KEY', 'USAGE_ALERT_URL'], 'n\nn\nn\nn\n', 'https://preview.example');
  assert.equal(run.calls.length, 1);
  assert.equal(run.calls[0].args[0], 'deploy');
  assert(run.calls[0].args.includes('ALLOWED_ORIGIN:https://preview.example'));
  assert(run.config.includes('[env.production.vars]\nALLOWED_ORIGIN = "https://preview.example"'));
  assert(run.config.includes('[vars]\nALLOWED_ORIGIN = "https://rumortown.example"'));
  assert(run.config.includes('AI_ENABLED = "false"'));
});

test('first setup handles Wrangler reporting a Worker that has not been created yet', () => {
  const run = rehearsal([], 'synthetic-private-value\nsynthetic-private-value\n\n', undefined, true);
  assert.equal(run.calls.filter(c => c.args[0] === 'secret').length, 3);
  assert.equal(run.calls.at(-1).args[0], 'deploy');
});

test('a failed secret inspection stops before any secret mutation or deployment', () => {
  const run = rehearsal([], '', undefined, 'denied');
  assert.deepEqual(run.calls, []);
});
