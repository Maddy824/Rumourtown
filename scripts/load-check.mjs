// Bounded HTTP check for an owned local/staging target; never calls a model.
import { parseArgs } from 'node:util';
import { performance } from 'node:perf_hooks';

const { values } = parseArgs({ options: {
  url: { type: 'string' }, mode: { type: 'string', default: 'assets' },
  origin: { type: 'string', default: 'https://rumortown.example' },
  requests: { type: 'string', default: '1000' }, concurrency: { type: 'string', default: '32' },
  'allow-remote': { type: 'boolean', default: false },
} });
function integer(value, max, name) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1 || n > max) throw new Error(`${name} must be 1–${max}`);
  return n;
}
const url = new URL(values.url ?? 'http://127.0.0.1:8787/');
if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Use an HTTP(S) URL without credentials');
if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && !values['allow-remote']) {
  throw new Error('Remote checks require --allow-remote. Use only an owned staging target with a confirmed request budget.');
}
if (!['assets', 'api-disabled'].includes(values.mode)) throw new Error('mode must be assets or api-disabled');
const count = integer(values.requests, 20_000, 'requests');
const concurrency = Math.min(count, integer(values.concurrency, 128, 'concurrency'));
const api = values.mode === 'api-disabled';
if (api && url.pathname !== '/interpret') throw new Error('api-disabled requires the /interpret URL');
const latencies = [];
const statuses = {};
let next = 0, bytes = 0, failures = 0;
const started = performance.now();
async function run() {
  while (next++ < count) {
    const start = performance.now();
    try {
      const response = await fetch(url, {
        method: api ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(10_000),
        ...(api ? { headers: { Origin: values.origin, 'Content-Type': 'application/json' }, body: '{}' } : {}),
      });
      statuses[response.status] = (statuses[response.status] ?? 0) + 1;
      const body = await response.arrayBuffer();
      bytes += body.byteLength;
      // {} is intentionally invalid input even if AI is accidentally enabled.
      // No Turnstile token or player text is ever sent by this script.
      if (api ? response.status !== 503 || JSON.parse(new TextDecoder().decode(body)).reason !== 'model' : response.status !== 200) failures++;
    } catch { failures++; }
    latencies.push(performance.now() - start);
  }
}
await Promise.all(Array.from({ length: concurrency }, run));
const elapsed = performance.now() - started;
latencies.sort((a, b) => a - b);
const percentile = p => Number(latencies[Math.ceil(latencies.length * p) - 1].toFixed(2));
console.log(JSON.stringify({
  target: url.origin + url.pathname, mode: values.mode, requests: count, concurrency, failures, statuses,
  elapsedMs: Math.round(elapsed), requestsPerSecond: Number((count * 1000 / elapsed).toFixed(1)),
  latencyMs: { p50: percentile(.5), p95: percentile(.95), p99: percentile(.99) },
  responseBytes: bytes, note: 'One load-generator run, not a verified production capacity or concurrent-user count.',
}, null, 2));
if (failures) process.exitCode = 1;
