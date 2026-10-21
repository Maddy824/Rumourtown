// Sum each deployed file's gzip size, including images, fonts and source maps.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const root = 'apps/rumortown/dist';
const budget = 400_000; // 400 KB (decimal), conservatively below 400 KiB.
let bytes = 0;
let files = 0;
function visit(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) visit(path);
    else if (entry.isFile()) {
      bytes += gzipSync(readFileSync(path), { level: 9 }).byteLength;
      files += 1;
    } else throw new Error(`Unexpected asset type: ${path}`);
  }
}
visit(root);
console.log(`Game assets: ${files} files, ${bytes} bytes gzipped; budget ${budget} bytes (400 KB).`);
if (files === 0 || bytes > budget) process.exitCode = 1;
