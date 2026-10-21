# 06: Library publish preparation

`packages/rumormind` currently points `main` and `types` at TypeScript source, which npm consumers cannot use. Make it publishable without changing its API:
1. Add a build: `tsc -p tsconfig.build.json` emitting ES modules and `.d.ts` files to `dist/` (create `tsconfig.build.json` extending the package tsconfig with `noEmit: false`, `declaration: true`, `outDir: dist`, `rootDir: src`, and `include: ["src"]` only).
2. In `package.json`: `"version": "0.1.0"`, `"main": "./dist/index.js"`, `"types": "./dist/index.d.ts"`, `"exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" } }`, `"files": ["dist", "README.md", "LICENSE"]`, `"sideEffects": false`, `"scripts": { "build": "tsc -p tsconfig.build.json", "prepublishOnly": "npm run build && npm test" }` (test runs vitest on this package only), `"keywords"` (simulation, npc, gossip, beliefs, game-ai, deterministic), `"repository"`, `"license": "MIT"`, and a `LICENSE` file (MIT, owner name "Madhav Sunil", year 2026).
3. Make sure the game still resolves the package during development (Vite resolves the workspace symlink to source; if the `exports` map breaks that, add a `"development"` condition pointing at `./src/index.ts` and set Vite's `resolve.conditions` to include it in `apps/rumortown/vite.config.ts`).
4. Verify with `npm run build -w packages/rumormind`, `npm pack --dry-run -w packages/rumormind` (list the files), `npm run typecheck`, `npm test` and `npm run build` at the root.
5. Check the usage example in `packages/rumormind/README.md` runs against `dist/` with `node`.
Commit `packages/rumormind` and any Vite config change with a message starting `06:`. Report the packed file list and size.
