import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const DATA = fileURLToPath(new URL('./data/', import.meta.url));
export function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
export function choice<T>(values: readonly T[], key: string): T {
  if (!values.length) throw new Error('Cannot choose from an empty list');
  return values[Number.parseInt(hash(key).slice(0, 8), 16) % values.length]!;
}
export async function* readJsonl<T>(path: string): AsyncGenerator<T> {
  const input = createReadStream(path, { encoding: 'utf8' });
  const lines = createInterface({ input, crlfDelay: Infinity });
  try {
    for await (const line of lines) if (line.trim()) yield JSON.parse(line) as T;
  } finally { lines.close(); input.destroy(); }
}
export async function writeJsonl(path: string, rows: Iterable<unknown>): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  // Dataset sizes are bounded by seeds/ticks; the runner itself streams inputs.
  await writeFile(path, Array.from(rows, row => JSON.stringify(row)).join('\n') + '\n');
}
export function isMain(url: string): boolean {
  return !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(url);
}
