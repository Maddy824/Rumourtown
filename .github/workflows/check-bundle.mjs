// Sum each deployed file's gzip size, including images, fonts and source maps.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const root = 'apps/rumortown/dist';
// Share images, icons and crawler files are never fetched by the game page, so they stay out of the budget.
const SOCIAL_ASSET = /(^|[\\/])(og\.(png|jpg|jpeg|webp)|icon(-\d+)?\.(png|svg)|apple-touch-icon\.png|favicon(-\d+)?\.(png|ico)|manifest\.webmanifest|robots\.txt|sitemap\.xml|llms\.txt|about\.html)$/u;
const budget = 400_000; // 400 KB (decimal), conservatively below 400 KiB.
let bytes = 0;
let files = 0;
function visit(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isFile() && SOCIAL_ASSET.test(entry.name)) continue;
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
