// Create a private local topic configuration. Never prints or reads any AI credentials.
import { randomBytes } from 'node:crypto';
import { readFile, writeFile, chmod } from 'node:fs/promises';
const file = new URL('../.env.alerts', import.meta.url);
let url;
try {
  const existing = await readFile(file, 'utf8');
  url = existing.match(/^USAGE_ALERT_URL=(https:\/\/ntfy\.sh\/[A-Za-z0-9_-]{32,128})\s*$/)?.[1];
  if (!url) throw new Error('Existing .env.alerts is invalid; fix it without overwriting other settings.');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  url = `https://ntfy.sh/rumortown-${randomBytes(24).toString('hex')}`;
  await writeFile(file, `USAGE_ALERT_URL=${url}\n`, { mode: 0o600, flag: 'wx' });
}
await chmod(file, 0o600);
console.log(`In the ntfy phone app, subscribe to:\n${url}\nKeep this topic private. Its address grants access to notifications.\nSaved in ignored .env.alerts. Paid AI remains disabled.`);
if (process.argv.includes('--test')) {
  const response = await fetch(url, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000),
    headers: { Title: 'RumorTown notification test', 'Content-Type': 'text/plain' },
    body: 'RumorTown phone alerts are connected to this topic. This test used $0 AI credits. Confirm it arrived on your phone before enabling paid AI.' });
  if (!response.ok) throw new Error(`Push service returned ${response.status}. Paid AI remains disabled.`);
  const receipt = await response.json();
  if (receipt.event !== 'message' || typeof receipt.id !== 'string') throw new Error('Push service did not return a message receipt.');
  console.log('Push service accepted the test. Check your phone; server acceptance does not confirm device delivery.');
}
