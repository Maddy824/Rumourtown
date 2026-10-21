# SLM limits harness

Run from the repository root on Node 22 or newer. No added dependencies or changes to the game are required.

```sh
npm run bench:slm:scenarios
npm run bench:slm:probes
node --experimental-strip-types bench/slm/run.ts --models qwen3:0.6b,llama3.2:1b --strategies grounded,cite --axes pressure,facts --limit 200
npm run bench:slm:smoke
```

The first command bundles the real engine, map, cast, claims and authored talk with the existing Vite development dependency, as `bench/sim.ts` does, and explicitly aliases `rumormind` to its current source so a fresh checkout needs no library dist build. It runs seeds 1–200, whispers at ticks 30, 90 and 150, and samples ticks 0, 180 and 420. Witness events come from the real schedules and visibility rules. One villager per snapshot rotates across all 36 cast members. `facts` and their source chains come directly from `inspect`. World truth uses claim kinds confirmed by the subject's authored secrets, rather than rumor confidence; it describes the authored account, including acts scheduled later in the day. Unconfirmed claims are false under this closed-world convention.

The export has 450 training snapshots, 150 held-out seed snapshots (151–200), and 600 mechanism snapshots. Both sides of the Mira debt and Rosa nursing disputes are excluded from general contexts, unknown-world lists and distractors. Only the mechanism snapshots expose these stories, including for held-out seeds. Mechanism and seed results are reported separately. Four real snapshots are retained in `fixtures/scenarios.jsonl` for review. The full deterministic JSONL exports and run results are generated locally and ignored by git.

`probes.ts` supplies 48 seeded templates and all 12 program axes. Template wording stays fixed within each sweep. Confidence, provenance, correction and quoted-instruction interventions are explicit probe overrides; they never mutate the exported simulation state. Gold labels are speech acts, not a claim that the rule-based oracle is perfect. Conversation levels count complete user/assistant pairs including the final question. Larger fact and distractor levels are capped by the available real records and report `actualSize`. This initial export has at most nine beliefs per snapshot: a requested 50-fact level is **not** evidence about 50-fact performance. Extending the story inventory and collecting denser belief states remains follow-up work.

The method names are:

| Name | Method |
|---|---|
| `persona` | Persona and conversation only |
| `grounded` | Persona and current beliefs |
| `cite` | Prompted JSON `{uses, reply}`, validated citations |
| `plan` | Schema-constrained fact/speech-act selection, then realisation from those facts |
| `best-of` | First verifier-passing grounded sample at temperature 0.7; `--best-of 2`, `4` (default), or `8` |
| `cascade` | Grounded local reply, then reference model on failed verification |
| `grammar` | Cite then speak with provider JSON schema enforcement |

Model names route to Ollama by default (`ollama:` is optional). `cf:@cf/meta/llama-3.2-3b-instruct` and other `cf:` names use Workers AI REST. The default cascade reference is `cf:@cf/meta/llama-3.3-70b-instruct-fp8-fast`; override it with `--cascade-model`. Choosing Workers AI or the default cascade can consume that account's allowance; this standalone benchmark does not use the game's inference ledger. It reads only the OAuth token from `~/Library/Preferences/.wrangler/config/default.toml` for account `a37c517b6f93de94eee5d64f3dcd49ae`. Tokens, request headers and remote error bodies are never written to results. No credential is included in fixtures.

Quantisation probes require explicit tags for each base model and precision. Missing mappings produce skipped rows rather than running the same tag under three precision labels. Confirm that the tags contain the same underlying weights and the intended precision before comparing results.

```sh
node --experimental-strip-types bench/slm/run.ts --models qwen3:0.6b --strategies grounded --axes quantisation --quantisations qwen3:0.6b:q4=qwen3-06b-q4,qwen3:0.6b:q8=qwen3-06b-q8,qwen3:0.6b:fp16=qwen3-06b-fp16
```

`--concurrency` defaults to 2. `--limit` bounds the selected probe set, which is then crossed with models and methods. Axes and available splits are selected round-robin so small runs cover the requested axes and include held-out seeds. `--split train`, `test-seed`, or `test-mechanism` restricts evaluation; default `all` keeps split-specific report rows. `--scenarios` and `--probes` select other JSONL inputs. `--out` chooses a new result directory; otherwise results go to `bench/slm/results/<timestamp>/`.

Resume with the original flags and `--resume bench/slm/results/<timestamp>` in place of `--out`. Dataset hashes, source hashes (including the verifier behind any re-export), models, axes, methods and sampling settings must match. Successful and skipped rows are retained, errors retried, a torn final record discarded, and a live writer's lock respected. `outputs.jsonl` keeps every candidate, plan, selected reply, verdict, model tag, token count and provider timing. Repeated error records in the append-only file are superseded by the last record for that key in `summary.md`.

Summary tables report epistemic/world faithfulness, abstention accuracy, calibration, provenance accuracy, a speech-act surface proxy, injection success, end-to-end strategy latency p50/p95, throughput, token totals, escalation rate and known costs per 100 messages, grouped by model, method, split and axis. A first sampled level below 95% epistemic faithfulness is marked as a descriptive break point. Ollama throughput uses reported decode time; Workers AI throughput uses total REST latency. Strategy latency includes plans, rejected samples and verification. Missing usage, remote prices, process memory and a validated persona judge remain `n/a` or unmeasured. The verifier gate checks epistemic fidelity, calibration and provenance; a faithfully voiced false belief can pass while failing world fidelity.

The CI smoke test substitutes the `./verifier.ts` import **inside the test only**. Thirty probes cover all axes, two mock model labels and all seven methods (420 records), with a fetch guard and a no-duplicate resume check. Other harness tests cover fixture transports, malformed completions, citation/planning gates, rejected samples, conditional escalation, split leakage, deterministic generation, torn writes and CLI validation. `mock:` tags are plumbing checks; their output says nothing about the named real models. Fixtures are sanitised protocol examples, not captured performance measurements. Live Ollama and Workers AI quality, throughput and cost still require a machine with those services available.

Root typechecking currently covers the three workspaces, not this Node benchmark, following the existing benchmark layout. A standalone strict check needs the optional `@types/node` development package, which is absent in this offline checkout. No dependency was added to work around that limitation.
