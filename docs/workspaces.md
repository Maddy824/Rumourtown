# Workspace setup

Run commands from the repository root after `npm ci`. Use Node 22.12+ in the 22.x line or Node 24+; CI checks Node 22 and 25. The game needs no account, API key or running model service.

## Belief library

[`packages/rumormind`](../packages/rumormind/README.md) is the dependency-free TypeScript library for confidence, provenance, relationships, gossip and repair. Callers supply ticks and seeded randomness.

```sh
npm run typecheck -w packages/rumormind
npm test -w packages/rumormind
npm run build -w packages/rumormind
```

The build emits the package's JavaScript and declarations into `packages/rumormind/dist`. The browser uses the source through the development export condition, so playing locally does not need this separate library build.

## Browser game

[`apps/rumortown`](../apps/rumortown) contains the deterministic simulation, authored content, Canvas renderer, controls and local conversation routing. Its optional model replies pass through the browser's epistemic guard.

```sh
npm run dev
npm run typecheck -w apps/rumortown
npm run build
npm run preview -w apps/rumortown
```

Vite prints the local URL. The production assets go to `apps/rumortown/dist`. Set both `VITE_API_BASE_URL` and `VITE_TURNSTILE_SITE_KEY` at build time only when connecting the optional API. These are public settings; provider keys and Turnstile secrets belong only in the Worker. Without the API, stories still spread with neutral meaning, and background gossip and supported local commands keep working.

## API Worker

[`apps/api`](../apps/api) is the optional Cloudflare Worker. It exposes `/rumor` for story annotations, `/play` for conversation and legacy `/interpret` for signed taxonomy claims. A single SQLite Durable Object owns admission counters, cost reservations and settlement. No browser simulation runs on the server.

```sh
npm run dev -w apps/api -- --var ALLOWED_ORIGIN:http://localhost:5173
npm run typecheck -w apps/api
```

Local AI is disabled by default. A local `/health` request needs the configured origin:

```sh
curl --header 'Origin: http://localhost:5173' http://localhost:8787/health
```

Put any local secrets in ignored `apps/api/.dev.vars`. Keep production credentials out of the checkout. See [deployment](deploy.md) for explicit setup and [credit controls](credit-controls.md) for the provider settings needed in addition to application caps. Root `npm test` includes the Worker tests with provider calls stubbed.

## SLM study

[`bench/slm`](../bench/slm/README.md) is a standalone Node harness, outside the npm workspaces. It exports seeded simulation snapshots, generates stress probes and compares dialogue methods against character beliefs and world truth.

```sh
npm run bench:slm:scenarios
npm run bench:slm:probes
npm run bench:slm:smoke
```

These commands require no live model calls. Generated full datasets and result directories are ignored; checked-in fixtures are small examples. Actual model runs need separately configured Ollama or Workers AI access. Remote benchmark calls use that account's allowance outside the game's spending ledger. Read the [harness guide](../bench/slm/README.md) before running them.

The root typecheck covers the three npm workspaces, not the benchmark. See [research status and limitations](research/README.md) for what has been measured.
