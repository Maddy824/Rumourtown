// Bounded Node surface used by the fixture and its existing imports. The repo has
// no @types/node; keep this local rather than adding a dependency or ambient anys.
declare const process: { argv: string[]; env: Record<string, string | undefined> };
declare module 'node:fs/promises' {
  export function readFile(path: string | URL, encoding: 'utf8'): Promise<string>;
}
declare module 'node:os' { export function homedir(): string; }
declare module 'node:path' { export function join(...parts: string[]): string; }
declare module 'node:perf_hooks' { export const performance: { now(): number }; }
