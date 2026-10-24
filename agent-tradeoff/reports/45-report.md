# 45: Speaker-floor preparation

Prepared on 24 October 2026. The launcher and CPU checks are implemented. **The complete four-model run is blocked by access to `google/gemma-3-270m-it`.** Its official Hugging Face download returned `GatedRepoError`; the local snapshot contains only the public README. No alternative model or mirror was substituted. The owner needs to authenticate this machine with an account that has accepted the model's terms, then rerun preparation below.

No training, model inference, MLX model import, GPU dry run, commit, push or deployment was performed. No runtime dependency or application source changed. Existing uncommitted files were preserved. This supplied worktree is on `research/speaker-floor`, not `build/village`; it was left on its existing branch, and no Git metadata was written. The controller can review/integrate the listed files onto `build/village`.

## Controller commands

After Gemma access is available, finish the **CPU/network-only** preparation:

```sh
cd /Users/maddy/B2B/rumortown-floor
bash bench/slm/finetune/speaker-floor.sh --prepare --download \
  --source /Users/maddy/B2B/rumortown/bench/slm/data/confirmation-37
bash bench/slm/finetune/speaker-floor.sh --check
```

Both commands must report `STATUS: DONE` before treating the full experiment as ready. They never load model weights into an ML runtime. They check downloaded files, tokenizer rendering, assistant loss-mask alignment and frozen input hashes.

When the GPU is free, the exact unattended command is:

```sh
cd /Users/maddy/B2B/rumortown-floor
nohup caffeinate -i bash bench/slm/finetune/speaker-floor.sh --launch --limit 240 \
  > bench/slm/data/speaker-floor-45/launch-console.log 2>&1 < /dev/null &
```

Run that same command again to resume. `--launch` sets `HF_HUB_OFFLINE=1` and `TRANSFORMERS_OFFLINE=1`, uses local snapshot paths, and performs no downloads. It also checks for known MLX/Ollama GPU worker processes and refuses a concurrent launch. The controller must still release any other GPU jobs first; this process check cannot detect every possible GPU application.

The default held-out limit is **240 for every model, baseline, split and cache condition**, following the speaker-floor screening design. Validation remains **1,980 probes**, matching the saved Qwen validation. To request 1,980 held-out probes too, use `--limit 1980` on the first launch; changing a frozen limit after starting is rejected.

Outputs are confined to `bench/slm/data/speaker-floor-45/` in this worktree. The main checkout's confirmation data/results are read only. Hugging Face downloads live in the permitted `~/.cache/huggingface/` cache. The output tree is Git-ignored.

## Models and matched recipe

| Model | Preparation | Frozen snapshot | Stored parameters |
|---|---|---|---:|
| SmolLM2-360M-Instruct | Downloaded, tokenizer checked | `a10cc1512eabd3dde888204e902eca88bddb4951` | 361,821,120 |
| Gemma 3 270M IT | Blocked by gated download | Not available | Not measured |
| LFM2-350M | Downloaded, tokenizer checked | `f37d3f5c8c5484bc01dad379a595cf4c68c4e70e` | 354,483,968 |
| Qwen3-0.6B BF16 | Existing base and trained epochs reused | Base `42096995f6402fde107068cf530136fe64b604f8` | 596,049,920 |

Parameter counts come from safetensors headers, without loading tensors. All three available snapshots store BF16 weights. File hashes, revisions, installed MLX source hashes and prepared-data hashes are in `prepared.json`.

Training retains the exact act-arm examples: **792 train / 97 valid**, batch 4, **198 updates per epoch / 396 total**, two epochs, seed 7, rank 8, q/k/v/output attention projections, scale 20, dropout .05, Adam learning rate 1e-4, maximum sequence length 4,608, prompt masking and gradient checkpointing. It uses the existing `train-selected.py` epoch callback and fuses both epoch checkpoints. A partial training run restarts deterministically; a completed run is hash-checked and reused.

Installed `mlx-lm 0.32.2` contains `models/lfm2.py` and matches LFM2's configuration. Its attention output is named **`self_attn.out_proj`**, rather than `o_proj`; the configuration uses that equivalent. Only six of its sixteen blocks have attention, so only those blocks receive q/k/v/output LoRAs. Equal rank and updates do not imply equal trainable capacity across architectures.

Each model uses its own tokenizer/chat template. Available-model train/valid maximum lengths are Smol **1,873 / 1,675**, LFM **1,758 / 1,599**, Qwen **1,808 / 1,617** tokens. Every message remains in rendered text and every assistant loss mask matches the rendered prompt prefix. Preparation fails rather than silently truncating examples. Gemma's system instruction is prepended verbatim, separated by two newlines, to the first user turn in both training and evaluation. That transformation has CPU tests; its actual tokenizer audit awaits the gated files.

Epoch selection uses checker-v2 act-macro Q, subject to the original development guards: macro F no more than .02 below base and leakage no more than .01 above base. Ties choose epoch 1. If neither epoch passes, the highest-Q fallback is explicitly marked `guardPassed: false`. Qwen is **never retrained**: its existing base and both epoch validation outputs are copied read-only into this experiment, rescored with v2, and used for the same selection rule. Its historical v1 selection is retained in the preparation manifest.

This saved-Qwen path was exercised on CPU: all three sets contain 1,980 rows and zero errors. V2 selects **epoch 2**, with the guard passing. Its act-macro Q is **53.83%**, pooled Q **67.27%**, pooled F **93.28%**, macro F **94.98%**, and leakage **10.05%**. These are development-set classifier measurements, not held-out floor results. CPU check artifacts are under `checks/qwen-{base,epoch-1,epoch-2}/`.

Every base and selected student then receives identical root-balanced `confirm`, `test-mechanism` and `wording` probes, best-of-1, temperature .7, maximum 192 tokens, and the existing harness seed convention (`scenario.seed`). The deterministic `template` strategy uses the same probes without a provider request. Tests compare the new probe allocator directly against the existing confirmation allocator.

## Measurement and outputs

The wrapper uses the stock seeded, non-batched MLX server path. Separate cold and ledger-cache runs retain their own outputs and quality scores. Cold clears the prompt cache for every probe. Ledger mode identifies the token prefix before the first user text, including persona and ledger, pre-fills exactly those tokens, and inserts that cache into the server's native LRU. It never caches the question, history, or a generated answer. This exact-prefix insertion also works with LFM's non-trimmable convolution state; it does not rely on trimming a previous completion. The evaluated answer is seeded after prefix preparation.

Prefix preparation uses forward calls without sampling. Reading installed `generate_step` revealed that even one-token generation evaluates an extra token ahead; using that as a prefix builder would contaminate the cache. CPU fake-server tests cover the corrected prefix boundary and reseeding behavior. Real GPU behavior remains untested by design.

Per-request telemetry records native MLX prefill/decode token counts, rates and elapsed components, cached tokens, peak memory, turn time, and prefix preparation cost. MLX's native prefill timing includes its first sample/lookahead convention; these are engine counters, not separate hardware-event measurements. Cached-turn p50/p95 exclude prefix preparation; HTTP latency and whole-evaluation cost include it. Prefix preparation totals are retained so a cache-hit claim cannot hide setup cost. The wrapper rejects missing telemetry or a reused-token count different from the requested prefix.

`ioreg` exposes `PowerTelemetryData.SystemLoad` on this Mac even on AC power. The runner samples that value in milliwatts and retains its publication counter. It falls back to voltage × signed battery discharge current when system load is unavailable. Adapter nameplate watts and AC charging current are never treated as device consumption. `pmset -g batt` is recorded as context; it supplies no watt reading here. No `sudo` or `powermetrics` is invoked.

System-load values can update slowly, approximately once a minute on some systems. The runner retains repeated publications and only integrates a coarse whole-system joule estimate when multiple publications exist, with no gaps or source changes. Otherwise energy stays null and wall time, tokens and available watt readings remain. These readings include other processes, are not isolated GPU/package power, are not wall-socket power and cannot resolve per-request joules. This interpretation follows the primary [puter power-reporting implementation](https://git.soconnor.dev/soconnor/puter/commit/4bfa239aa0e7286aec3b7eda14f3688f7ee53e09) and the cadence limitation documented by [powerflow](https://github.com/dylansantwani/powerflow). Native unquantized KV caches are used; no phone, speculative-decoding or quantized-KV results are claimed.

- `controller.log` and per-stage logs retain progress and failures.
- `runs/<model>/selection.json` records both candidates, guards and chosen checkpoint.
- `eval/<model-arm>/<split>/<cold|ledger>/outputs.jsonl` retains raw answers; `telemetry.jsonl` retains per-request counters.
- `evaluation-cost.jsonl` retains **all evaluation invocations**, including failed attempts, restarts, prefix preparation and model-server startup. Its `deviceJoulesEstimate` is explicitly coarse; `packageJoules` is always null.
- Every evaluation invokes `rescore.ts --verifier-version v2 --out <separate checker-v2 directory>`. Original outputs and historical scores are preserved.
- `scores.json` retains pooled Q/F, act-macro Q/F, per-act counts, errors and leakage numerator/denominator. Leakage uses the same opportunity definition as confirmation validation.
- `summary.md`, printed after each model, contains model, parameters, split, cache condition, Q, F, act-macro Q, leakage and separate prefill/decode tokens per second.

A file lock prevents two controllers writing the same experiment. Child processes have bounded timeouts and TERM/KILL cleanup. A generation error stops that model immediately, records it, and allows the next model to proceed. There are no automatic model retries. Rerunning explicitly retries unfinished work, repairs only torn final JSONL appends, and skips hash-verified completions. A returned answer whose telemetry was interrupted is preserved but superseded by a bounded retry. Changed code, datasets, configuration or completed artifacts fail visibly. A previously unavailable model may be prepared later and join an otherwise unchanged run. Missing Gemma is an explicit model failure and makes launch exit nonzero; it is never counted as a completed arm.

## GPU-time estimate

Reference evidence is the existing confirmation-37 Qwen validation logs, not new timing measurements:

| Saved Qwen validation | Requests | Sum of provider latency | Mean per request |
|---|---:|---:|---:|
| Base | 1,980 | 350.41 s | .177 s |
| Act epoch 1 | 1,980 | 457.98 s | .231 s |
| Act epoch 2 | 1,980 | 564.78 s | .285 s |

The three validation passes sum to **22.9 minutes**. Its training log reports about 33.1k tokens at 116 tok/s and another 33.1k at 109 tok/s: approximately **9.8 minutes**, plus 36.2 seconds of loss validation. Those rounded counters are an estimate, not a training wall-time record.

At held-out limit 240, each model has **2,880 generated answers** (two arms × three splits × two cache conditions), plus 1,440 explicit prefix preparations. Each newly trained model also has 5,940 validation answers; Qwen reuses those saved answers. Applying the Qwen validation request averages gives only **8.5–13.7 minutes** for the held-out answers before new cache controls and loading overhead. Original server caching, output-length differences, thermal load and architecture make that an optimistic reference.

| Model | Planning allowance at limit 240 |
|---|---|
| SmolLM2 | 30–90 minutes including training, selection and evaluation |
| Gemma | 20–60 minutes, conditional on access and successful first GPU run |
| LFM2 | 30–90 minutes; hybrid architecture makes scaling especially uncertain |
| Qwen | 20–45 minutes; no training or new validation inference |

These are rough scheduling allowances, not parameter-proportional predictions or an eight-hour guarantee. Allow roughly **2–5 hours overall**, and retain more time for slower kernels/thermal behavior. Raising held-out limit to 1,980 multiplies that portion by 8.25 and can exceed the planned weekend window. Per-command safety deadlines are four hours for a training command and six hours for an evaluation command; a timeout is a recorded failure, not a retry loop.

## Licences

- [SmolLM2-360M-Instruct](https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct) and [Qwen3-0.6B](https://huggingface.co/Qwen/Qwen3-0.6B): Apache-2.0.
- [Gemma](https://ai.google.dev/gemma/terms): Google's Gemma terms, including derivative/distribution conditions; official gated access is still missing.
- [LFM2 licence](https://huggingface.co/LiquidAI/LFM2-350M/blob/main/LICENSE): commercial-use conditions include an annual revenue threshold of US$10 million. This experiment treats it as **research only**, as instructed. It is not an Apache-licensed deployment candidate.

## Verification and files to commit

CPU verification: 75 benchmark smoke tests, with eight Python controller tests invoked through one harness test; root typecheck; shell syntax; real local tokenizer/template audits; safetensors-header and file-integrity checks; actual v2 rescoring of 5,940 saved Qwen validation answers. No GPU verification was attempted. The initial smoke invocation hit the shared read-only `node_modules/.vite-temp`; a temporary local dependency-link directory made the cache writable without installing or changing dependencies. The original `node_modules` symlink is restored after verification.

Production build passed; bundle gate: **358,883 / 400,000 gzip bytes**. The first parallel root test invocation had a cache-permission failure and a 1,515 ms result against an existing 1,500 ms simulation threshold. The serial rerun (`npm test -- --maxWorkers 1 --no-file-parallelism`) passed **all 1,119 tests in 79 files**. No application source or timing threshold was changed.

Files for the controller to review and commit:

- `bench/slm/.gitignore`
- `bench/slm/finetune/speaker-floor.sh`
- `bench/slm/finetune/speaker-floor.py`
- `bench/slm/finetune/speaker_floor_common.py`
- `bench/slm/finetune/speaker-floor-server.py`
- `bench/slm/finetune/speaker-floor-eval.ts`
- `bench/slm/finetune/speaker-floor.test.py`
- `bench/slm/speaker-floor.harness.test.ts`
- `agent-tradeoff/reports/45-report.md`

Do not stage generated data, downloaded models, logs, build-info files, the dependency-cache workaround, or the pre-existing `bench/slm/results` symlink. The pre-existing task brief was not modified.

Suggested commit message: `45: Prepare resumable speaker-floor experiment`

Remaining work: obtain authorized Gemma access, rerun CPU preparation/check, then have the controller launch when the GPU is free. GPU failures, measured quality, energy and latency will be reported by the run; none are fabricated here.

STATUS: BLOCKED
