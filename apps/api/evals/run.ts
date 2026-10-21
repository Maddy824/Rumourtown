// Run on Node 22 with: npx tsx apps/api/evals/run.ts --token <test-token>
import { readFile, writeFile } from 'node:fs/promises';
import { argv, exit } from 'node:process';
import { pathToFileURL } from 'node:url';
import { injectionIndices, parseCorpus } from './corpus';
import { markdown, runEvaluation } from './scorer';
import type { Poster } from './scorer';

export interface Options { url: string; token: string; origin: string; castVersion: string }
export function parseOptions(args: readonly string[]): Options {
  const values: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!name || !['--url', '--token', '--origin', '--cast-version'].includes(name) ||
        !value || value.startsWith('--') || Object.hasOwn(values, name)) {
      throw new Error('Usage: npx tsx apps/api/evals/run.ts --token <test-token> [--url http://localhost:8787] [--origin http://localhost:5173] [--cast-version v1]');
    }
    values[name] = value;
  }
  if (!values['--token']?.trim()) throw new Error('--token is required; use a local Turnstile test token.');
  const url = new URL(values['--url'] ?? 'http://localhost:8787');
  const origin = new URL(values['--origin'] ?? 'http://localhost:5173');
  if (![url, origin].every(value => ['http:', 'https:'].includes(value.protocol) && !value.username && !value.password) ||
      url.search || url.hash || origin.pathname !== '/' || origin.search || origin.hash) {
    throw new Error('Expected an HTTP(S) base URL and a bare origin, without credentials.');
  }
  return { url: url.href.replace(/\/$/, ''), token: values['--token'], origin: origin.origin, castVersion: values['--cast-version'] ?? 'v1' };
}

export function createPoster(options: Options, request: typeof fetch = fetch): Poster {
  return async item => {
    const started = performance.now();
    try {
      const response = await request(`${options.url}/interpret`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: options.origin },
        body: JSON.stringify({ text: item.text, turnstileToken: options.token, castVersion: options.castVersion }),
        signal: AbortSignal.timeout(20_000),
      });
      let body: unknown = null;
      try { body = await response.json(); } catch { /* Non-JSON is a failed schema, not a lost case. */ }
      return { status: response.status, body, latencyMs: performance.now() - started };
    } catch {
      return { status: 0, body: null, latencyMs: performance.now() - started };
    }
  };
}

export async function main(args: readonly string[]): Promise<boolean> {
  const options = parseOptions(args);
  const items = parseCorpus(JSON.parse(await readFile(new URL('./lies.json', import.meta.url), 'utf8')));
  const summary = await runEvaluation(items, createPoster(options), injectionIndices);
  const report = markdown(summary);
  // Resolve beside the script so invocation from any working directory writes the right artifact.
  await writeFile(new URL('./last-run.md', import.meta.url), report, 'utf8');
  console.log(report);
  return summary.passed;
}

if (argv[1] && pathToFileURL(argv[1]).href === import.meta.url) {
  try {
    if (!await main(argv.slice(2))) exit(1);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Eval run failed.');
    exit(1);
  }
}
