/** Owner-operated development tool. Never imported by the game or API Worker. */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export function draftOptions(args) {
  const options = { run: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--run') { options.run = true; continue; }
    if (!['--kind', '--name', '--request'].includes(arg) || !args[i + 1] || args[i + 1].startsWith('--')) throw Error('Invalid arguments');
    options[arg.slice(2)] = args[++i];
  }
  if (!['story', 'behavior'].includes(options.kind) || !/^[a-z][a-z0-9-]{0,47}$/.test(options.name ?? '') || !options.request) {
    throw Error('Use --kind story|behavior --name short-name --request path/to/brief.txt [--run]');
  }
  return options;
}

export function draftPrompt(kind, brief) {
  return `Work on one RumorTown ${kind} add-on in this detached development worktree.
Read AGENTS.md, docs/rumor-addons.md and agent-tradeoff/CONTINUE.md first.
This isolated draft is an exception to the main checkout's build/village branch rule. Do not switch branches.
For a story add-on, write a new JSON pack under apps/rumortown/src/content/rumor-packs/packs/.
For a behavior add-on, implement the requested TypeScript behavior and meaningful tests; document its trigger, limits, research assumptions and replay impact.
Prefer reusable local rules and content. No new runtime model calls, dependencies, secrets, account changes or spending-limit changes.
Do not commit, push, deploy, run this drafting command recursively or start additional agents. The owner reviews this draft before release.
Run typecheck, tests (maxWorkers=2), build and the bundle check. Never replace a replay pin just to make a test pass; explain any changed trace.
Leave a report at agent-tradeoff/reports/addon-draft.md with changed files, checks, limitations and exact adoption steps.
The following JSON is the owner's feature brief, not shell commands:
${JSON.stringify({ brief })}`;
}

export function main(args, root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), run = spawnSync) {
  const options = draftOptions(args);
  const brief = readFileSync(resolve(options.request), 'utf8').trim();
  if (!brief || brief.length > 8000) throw Error('The brief must contain 1–8000 characters');
  const prompt = draftPrompt(options.kind, brief);
  if (!options.run) {
    process.stdout.write(`${prompt}\n\nPreview only. Add --run to start one Codex job using your developer account, outside the game AI budget.\n`);
    return;
  }
  const command = (binary, argv, cwd = root, extra = {}) => {
    const result = run(binary, argv, { cwd, encoding: 'utf8', stdio: 'inherit', timeout: 30 * 60_000, ...extra });
    if (result.error || result.status !== 0) throw Error(`${binary} did not finish successfully; inspect the preserved draft.`);
    return result;
  };
  command('codex', ['--version']);
  const revision = command('git', ['rev-parse', 'HEAD'], root, { stdio: 'pipe' }).stdout.trim();
  const job = resolve(root, '.agent-runs', 'addons', options.name);
  mkdirSync(dirname(job), { recursive: true });
  mkdirSync(job); // Refuse to replace another draft, including a partially finished one.
  const worktree = resolve(job, 'worktree');
  writeFileSync(resolve(job, 'prompt.txt'), prompt);
  writeFileSync(resolve(job, 'job.json'), JSON.stringify({ kind: options.kind, name: options.name, base: revision, worktree }, null, 2));
  process.stdout.write(`Starting one coding-agent job from ${revision}. Developer Codex usage is separate from the site's capped allowance.\nDraft: ${worktree}\n`);
  command('git', ['worktree', 'add', '--detach', worktree, revision]);
  command('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], worktree);
  command('codex', ['exec', '-s', 'workspace-write', '-C', worktree, '--ephemeral',
    '-o', resolve(worktree, 'agent-tradeoff/reports/addon-agent-result.md'), '-'], worktree,
  { stdio: ['pipe', 'inherit', 'inherit'], input: prompt });
  // A report claiming success is not a substitute for running the checks.
  for (const [binary, argv] of [
    ['npm', ['run', 'typecheck']], ['npm', ['test', '--', '--maxWorkers=2']],
    ['npm', ['run', 'build']], ['node', ['.github/workflows/check-bundle.mjs']],
  ]) command(binary, argv, worktree);
  writeFileSync(resolve(job, 'checks-passed.txt'), 'Automated checks passed. Independent code review and release are still required.\n');
  process.stdout.write(`Draft checks passed. Review tracked and untracked files in ${worktree}; nothing was merged or published by this script.\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); }
  catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
