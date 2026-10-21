import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { draftOptions, main } from './draft-addon.mjs';

const directories = [];
afterEach(() => { vi.restoreAllMocks(); directories.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true })); });
function setup() {
  const root = mkdtempSync(join(tmpdir(), 'rumor-addon-test-')); directories.push(root);
  const request = join(root, 'brief.txt'); writeFileSync(request, 'Let villagers investigate an overheard rumor.');
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  const run = vi.fn((binary, args) => {
    if (binary === 'git' && args[0] === 'worktree') mkdirSync(args[3], { recursive: true });
    return { status: 0, stdout: 'abc123\n' };
  });
  const args = ['--kind', 'behavior', '--name', 'investigate', '--request', request];
  return { root, args, run };
}
describe('developer add-on drafting', () => {
  it('previews without creating a job or launching any process', () => {
    const { root, args, run } = setup(); main(args, root, run);
    expect(run).not.toHaveBeenCalled();
    expect(existsSync(join(root, '.agent-runs'))).toBe(false);
  });
  it('isolates one agent invocation, passes the brief over stdin and independently checks the draft', () => {
    const { root, args, run } = setup(); main([...args, '--run'], root, run);
    const jobs = run.mock.calls.filter(([binary, argv]) => binary === 'codex' && argv[0] === 'exec');
    expect(jobs).toHaveLength(1);
    const [, argv, options] = jobs[0];
    expect(argv).toContain('workspace-write'); expect(argv.at(-1)).toBe('-');
    expect(options.input).toContain('Let villagers investigate');
    expect(options.cwd).toBe(join(root, '.agent-runs/addons/investigate/worktree'));
    expect(options.timeout).toBe(30 * 60_000);
    expect(run.mock.calls.slice(-4).map(([binary, argv]) => [binary, ...argv])).toEqual([
      ['npm', 'run', 'typecheck'], ['npm', 'test', '--', '--maxWorkers=2'],
      ['npm', 'run', 'build'], ['node', '.github/workflows/check-bundle.mjs'],
    ]);
    expect(readFileSync(join(root, '.agent-runs/addons/investigate/checks-passed.txt'), 'utf8')).toContain('review');
    expect(() => main([...args, '--run'], root, run)).toThrow();
    expect(run.mock.calls.filter(([binary, argv]) => binary === 'codex' && argv[0] === 'exec')).toHaveLength(1);
  });
  it('stops on a failed check and never marks a failed draft ready', () => {
    const { root, args, run } = setup();
    run.mockImplementation((binary, argv) => ({ status: binary === 'npm' && argv[0] === 'test' ? 1 : 0, stdout: 'abc123\n' }));
    expect(() => main([...args, '--run'], root, run)).toThrow();
    expect(existsSync(join(root, '.agent-runs/addons/investigate/checks-passed.txt'))).toBe(false);
    expect(run.mock.calls.some(([, argv]) => argv.includes('build'))).toBe(false);
  });
  it.each(['../escape', '/tmp/outside', 'a;bad', ''])('rejects invalid job name %s', name => {
    expect(() => draftOptions(['--kind', 'behavior', '--name', name, '--request', 'brief.txt'])).toThrow();
  });
});
