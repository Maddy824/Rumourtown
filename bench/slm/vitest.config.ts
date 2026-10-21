import { defineConfig } from 'vitest/config';

// Keep simulation export work away from the game's wall-time regression tests.
export default defineConfig({ test: {
  include: ['bench/slm/**/*.harness.test.ts'],
  fileParallelism: false,
  maxWorkers: 1,
} });
