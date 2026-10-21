# 25: SLM limits harness (phase 1)

Build the harness described in `docs/research/slm-limits-program.md`, in TypeScript under `bench/slm/`, run with `node --experimental-strip-types` (no new runtime dependencies; dev dependencies only if unavoidable, say so).

1. `scenarios.ts`: run the real simulation (`apps/rumortown/src/sim/engine.ts` with the real map, cast, claims and talk) for seeds 1–200 with a few scripted whispers and witness events; at chosen ticks, export villager belief states via `inspect` into `bench/slm/data/scenarios.jsonl`: id, seed, tick, villager, persona (voice, role), facts [{ id, text, confidence, band, chain, trueInWorld }], and world facts the villager does not know. Hold out seeds 151–200 and two story mechanisms for testing.
2. `probes.ts`: for each scenario and each stress axis in the program table, generate probes with gold behaviour labels and the sweep level; write `probes.jsonl`. At least 40 probe templates across the axes; paraphrase variety from seeded templates.
3. `providers.ts`: Ollama (`http://127.0.0.1:11434/api/chat`, with `format` for JSON schema), Workers AI via the REST API using the wrangler OAuth token from `~/Library/Preferences/.wrangler/config/default.toml` and account `a37c517b6f93de94eee5d64f3dcd49ae` (never print the token), and a mock provider for tests. Record latency, tokens and tokens per second.
4. `strategies.ts`: the seven inference-time methods in the program.
5. `verifier.ts`: the state oracle as described, with embeddings from Ollama (`all-minilm`); a hand-labelled development set of at least 60 replies in `bench/slm/data/dev-labels.jsonl` with unit tests on it.
6. `run.ts`: `node --experimental-strip-types bench/slm/run.ts --models qwen3:0.6b,llama3.2:1b --strategies grounded,cite --axes pressure,facts --limit 200` writes `bench/slm/results/<timestamp>/outputs.jsonl` and `summary.md` with the metrics and break-point tables; resumable; concurrency configurable (default 2 for local models).
7. `npm run bench:slm:smoke` runs a 30-probe smoke test against the mock provider in CI.
Commit per file group with plain messages starting `25:` (no co-author lines). Report to `agent-tradeoff/reports/25-report.md` with a smoke-run summary on two local models.
