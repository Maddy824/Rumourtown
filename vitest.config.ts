import { defineConfig } from 'vitest/config';
export default defineConfig({ test: {
  include: ['packages/**/*.test.ts', 'apps/**/*.test.ts', 'scripts/draft-addon.test.mjs'],
  exclude: ['**/node_modules/**', 'spike/**'],
  css: { include: [/app\.css/] },
} });
