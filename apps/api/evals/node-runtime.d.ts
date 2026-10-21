// Narrow declarations for Node built-ins used only by the offline eval CLI/tests.
// The Worker tsconfig intentionally has no @types/node; no runtime dependency is needed.
interface ImportMeta { readonly url: string }

declare module 'node:fs/promises' {
  export function readFile(path: URL, encoding: 'utf8'): Promise<string>;
  export function writeFile(path: URL, data: string, encoding: 'utf8'): Promise<void>;
}
declare module 'node:url' {
  export function pathToFileURL(path: string): URL;
}
declare module 'node:process' {
  export const argv: string[];
  export function exit(code: number): never;
}
