import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({
  server: { port: 5180, strictPort: true },
  resolve: { conditions: ['development', 'module', 'browser'] },
  build: { rollupOptions: { input: { main: resolve(__dirname, 'index.html'), about: resolve(__dirname, 'about.html') } }, target: 'es2022' },
});
