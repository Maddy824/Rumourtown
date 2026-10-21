# 25: SLM harness implementation

Implemented brief items 1, 2, 3, 4, 6 and 7 under `bench/slm/`, plus npm scripts and a separate smoke step in the existing Node 22/25 CI matrix. No runtime or development dependencies were added. No `apps/` source file or `bench/slm/verifier.ts` was created or edited by this task. The controller's verifier remains a direct `./verifier.ts` import; only harness tests substitute that import.

## Deliverables

- `scenarios.ts`, `types.ts`, `io.ts`: the real simulation, map, cast, claims and talk, loaded with the existing Vite benchmark approach and an explicit library-source alias so fresh CI checkouts do not require a library dist build. Seeds 1–200, three whispers, natural scheduled witnessing, inspection snapshots at ticks 0/180/420, persona and world-truth fields. One rotating cast member per seed/tick, with distinct general and held-out mechanism records.
- `probes.ts`: 48 reproducibly selected templates across all 12 stress axes, with complete requested sweeps, gold speech acts, history and explicit state overrides. Wording is fixed within each sweep. Larger contexts expose their actual size rather than manufacturing extra beliefs.
- `providers.ts`: Ollama chat/schema support, Workers AI REST with the requested account and on-demand Wrangler OAuth configuration, schema-aware mock provider, injected transports, bounded requests, latency/token/throughput accounting and credential-safe failures. Sanitised protocol fixtures test request and response handling without network access.
- `strategies.ts`: persona, grounded, cite, two-step plan, verifier-guided best-of-2/4/8, conditional 70B cascade and grammar-constrained citation. All generations and rejected candidates survive in output; malformed structures and invalid/uncited fact IDs fail the gate. World unfaithfulness alone does not reject a faithfully voiced false belief. Truth flags and unknown world facts never enter model prompts.
- `run.ts`: the requested native Node CLI, configurable concurrency (default 2), model routing, axis/split selection, explicit quantisation-tag mapping, append-only JSONL and Markdown metrics/break points. Resume binds source and dataset hashes, retries errors, retains completed/skipped records, repairs only a torn final record and respects a writer lock. The code hash follows the controller's verifier re-export.
- `npm run bench:slm:smoke`: 30 probes, all 12 axes, two mock model labels and seven strategies, producing 420 records. It tests no-duplicate resume and guards against network calls. The separate Vitest configuration also runs provider, strategy, data and recovery checks, with one worker to avoid competing with game timing tests in CI.

Usage and detailed conventions are in `bench/slm/README.md`. Generate the complete data with `npm run bench:slm:scenarios` and `npm run bench:slm:probes`; run the brief's command directly afterward. Full data and results are local, git-ignored artifacts; four real simulation snapshots are retained in `bench/slm/fixtures/scenarios.jsonl`.

## Data generated in this sandbox

| Artifact | Records | SHA-256 |
|---|---:|---|
| `bench/slm/data/scenarios.jsonl` | 1,200 | `6694ed576389c3c527a19973f860568c2bf2306471fee62f4ee8b037125fadbb` |
| `bench/slm/data/probes.jsonl` | 57,600 | `48fee6cf062a15951434aa62d368ff2412a32781c7e2b79e9eb92cf951f8792d` |

There are 450 training, 150 held-out-seed and 600 held-out-mechanism records. All 48 template IDs occur in the full export. Snapshot witness counts reach 44. The largest exported ledger has nine facts.

## Validation

- `npm run bench:slm:smoke`: **19 tests passed** in five files; includes the 30-probe × two-model-label × seven-method smoke with the test-only oracle substitute. Provider tests use fixture responses and temporary fake OAuth configuration, never the real credentials.
- Native `node --experimental-strip-types bench/slm/run.ts` integration against mock providers and the controller's actual verifier import: **420 completed records, zero errors, zero skips**, all 12 axes and seven methods, with training, held-out-seed and mechanism splits sampled. Both `mock:qwen3:0.6b` and `mock:llama3.2:1b` contribute 210 records. Outputs and report are in `bench/slm/results/offline-stratified/`. Prior native 420-record runs also completed without errors, including a byte-preserving resume of `offline-final/`.
- Root `npm run typecheck`: passed.
- Root `npm run build`: passed.
- `node .github/workflows/check-bundle.mjs`: passed, 352,778 bytes gzipped against the 400,000-byte limit on the latest build of the shared working tree.
- Root `npm test -- --maxWorkers=1 --no-file-parallelism`: **939 tests passed in 78 files**. The first unrestricted run had 12 timing failures under heavy worker contention, including an initial benchmark export timeout. Benchmark tests were removed from the root suite and placed in their own one-worker configuration; the serialized root rerun passed all tests without changing any app test or timing threshold. The root Vitest configuration has no final diff.
- Additional standalone strict TypeScript invocation reported only missing Node type definitions (`@types/node`, absent in this checkout). Root typechecking follows the existing workspace scope and does not cover Node benchmarks. No package was added in the offline sandbox.
- Targeted diff whitespace check passed. Manual review checked every requested item, prompt truth separation, holdout leakage, schema failures, sample/cascade gates, resume integrity and error redaction. Important review fixes were applied: isolate simulation export checks, hold paraphrases fixed within sweeps, distinguish protocol acceptance from raw oracle faithfulness, hash the verifier implementation behind its bridge, stratify small selections across axes and held-out splits, and alias the library source for clean CI execution.

## Rulings and follow-up work

1. The sandbox has no network, so **no live Qwen3, Llama, Ollama or Workers AI inference was performed**. The two names in mock results are labels, not model measurements. The requested two-local-model smoke therefore remains an owner/controller follow-up on a machine with Ollama. Run the documented CLI with `qwen3:0.6b,llama3.2:1b` and compare grounded/cite before expanding the matrix.
2. Debt (both Mira/Pim claims) and nursing (both Rosa/Ada claims) are the two held-out mechanisms. They are excluded from all general knowledge, unknown-world lists and distractors, and exposed only in mechanism-test records. Seed 151–200 general records are never training records. Mechanism tests intentionally include both seen and held-out seeds; reports keep splits distinct.
3. World truth follows authored secret confirmations, including scheduled acts later in the day; unconfirmed rumors are false under this closed-world convention. Changing that convention requires regenerating the data, not editing simulation semantics.
4. This real story inventory cannot supply 20 or 50 simultaneous beliefs for the chosen snapshots. Requested sizes are recorded but capped, with actual sizes in results. Extend the authored research inventory or collect denser real states before drawing high-context break-point conclusions. Counterfactual confidence/provenance/correction/injection probes are explicit and never rewrite simulation snapshots.
5. Memory and a validated persona judge remain unmeasured. Speech-act matching is a documented surface proxy; injection success is exact-marker output or oracle epistemic failure on an injection probe. Remote prices and absent usage remain unknown, never fabricated zeros. The raw oracle's own accuracy is the controller's item 5, not validated by the stubbed smoke.
6. Precision comparisons require user-supplied exact model tags containing the same weights. Missing precision mappings are skipped. Choosing Workers AI or the default 70B cascade on a connected machine uses that account directly, outside the game's ledger; this task changes no app money boundary.
7. A separate strict benchmark typecheck could use the optional `@types/node` development dependency when available. Node 22 execution and actual CI execution were not available locally; the existing CI matrix now invokes the offline smoke on both supported versions.

## Commit handoff

Staging the first explicit file group failed: `fatal: Unable to create '/Users/maddy/B2B/rumortown/.git/index.lock': Operation not permitted`. This task made no commits, pushes or deployments. Existing uncommitted work and generated build-info files were preserved. No approval escalation was attempted.

During concurrent controller work, commit `0274084` recorded the npm/CI integration and an earlier version of this report with the owner's attribution. The harness implementation files remain untracked, and this report has later uncommitted updates. Preserve that controller commit; stage only remaining diffs when completing the groups below.

Suggested explicit groups and plain commit messages, using `Madhav Sunil <94164709+Maddy824@users.noreply.github.com>` and no assistant trailers:

1. `25: generate held-out village scenarios and probes` — `.gitignore`, `io.ts`, `types.ts`, `scenarios.ts`, `probes.ts`, scenario tests and `fixtures/scenarios.jsonl`.
2. `25: add fixture-tested local and Workers AI providers` — `providers.ts`, provider tests and `fixtures/providers.json`.
3. `25: implement seven inference strategies` — `strategies.ts`, strategy tests and `test-support.ts`.
4. `25: add resumable runner and offline CI smoke` — `run.ts`, runner/smoke tests, `vitest.config.ts` under the harness, README, root `package.json` and `.github/workflows/ci.yml`.
5. `25: record harness validation and remaining measurements` — this report.

Do not stage the controller's verifier files, any `apps/` changes, generated build-info, or the ignored full datasets/results with these groups.

STATUS: DONE

Tests: 19 harness tests and 939 root tests passed; native 420-record mock integration, root typecheck, production build and bundle gate passed. Live model runs remain untested offline; commits are blocked by sandbox permissions.
