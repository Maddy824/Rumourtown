import { defineConfig } from 'vite';
export default defineConfig({
  server: { port: 5180, strictPort: true },
  resolve: { conditions: ['development', 'module', 'browser'] },
  build: { target: 'es2022' },
});
