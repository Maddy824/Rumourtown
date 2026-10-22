# Catch the bluff: a tiny villager with an evidence trail

22 October 2026. Independent proposal. Read the requested research plans, product and budget documents, section 3 of CONTINUE, and the conversation orchestrator, verifier, guard and client/API code. The other reviewer's proposal was not opened. This is a thinking task; only this report was added.

## Five candidates

Costs below mean incremental operator AI spend for 1,000 visitors playing three rounds each, excluding existing ordinary game traffic. Recorded replies are generated once locally; browser inference uses the visitor's hardware. Hosting, downloads and collection are accounted for below. Popularity is a hypothesis.

### 1. Catch the bluff

- Player: question a tiny villager, catch an invented witness or an evasive answer, then open the actual evidence trail.
- Spread: a one-minute challenge with a surprising reveal and a replayable score that friends can try to beat.
- Research: paired human judgments of useful answers, knowledge boundaries, confidence and direct sources, plus later opt-in attacks.
- Cost per 1,000: $0 inference with recorded challenge branches; $0 server inference for an optional browser sandbox.
- Biggest risk: a heuristic referee mistakes faithful hearsay for invention or rewards silence; disputed verdicts need human review.

### 2. One rumor, three tiny minds

- Player: whisper the same authored story into synchronized towns voiced by a base model, a guarded model and a tuned model.
- Spread: a short side-by-side clip makes a research ablation visible and invites predictions about which reply fails.
- Research: paired raw/guarded dialogue fidelity and usefulness on identical snapshots, with arm-blinded preferences.
- Cost per 1,000: $0 inference using a prerecorded reply deck over local simulation; arbitrary new dialogue requires browser inference.
- Biggest risk: viewers infer that models caused different social outcomes even though the deterministic engine controls belief spread.

### 3. The missing source

- Player: follow tellers through the town and challenge a 0.6B model to identify whether five repetitions came from one origin.
- Spread: an animated source reveal shows a familiar social mistake in a form a screenshot can explain.
- Research: exact direct-teller accuracy versus origin tracing, source coverage and confidence inflation under repetition.
- Cost per 1,000: $0 inference for recorded source puzzles; any optional free-text model interaction stays in the browser.
- Biggest risk: tracing origins becomes a UI puzzle without demonstrating a learned language-model skill.

### 4. Teach Mira to answer

- Player: select a useful, supported reply over a charming fabrication or an empty refusal, then revisit a later released model.
- Spread: collective progress and visible before/after failures give contributors a reason to return.
- Research: consented preference labels and audited rejection pairs for the study's later supervised/preference-training comparisons.
- Cost per 1,000: $0 serving inference from fixed reply pairs; periodic local training costs owner time and electricity.
- Biggest risk: popularity labels reward style over evidence, and public training examples contaminate the test set.

### 5. A village in airplane mode

- Player: explicitly download a tiny model, turn off connectivity and talk to villagers while the town runs locally.
- Spread: the visible offline demonstration answers “where is the AI running?” without an account or server.
- Research: quantization/runtime fidelity, first-token latency, throughput, failures and device-selection bias.
- Cost per 1,000: $0 server inference, but roughly 352 GB per downloaded Qwen3-0.6B artifact before runtime overhead.
- Biggest risk: download friction, memory pressure and heat consume the moment that should have delighted a phone visitor.

## What the precedents teach

The mechanisms of spread in this table are my inference from the artifacts, not measured causal explanations of virality.

| Precedent and primary evidence | Why someone would pass it on | What to borrow |
|---|---|---|
| [Gandalf paper](https://arxiv.org/abs/2501.07927): a game produced a released dataset of 279,000 prompt attacks. | A simple adversarial goal, escalating defenses and immediate success/failure turn curiosity into repeated attempts. | One clear challenge and quick retries; measure legitimate usefulness alongside attack resistance. |
| [TinyStories](https://arxiv.org/abs/2305.07759): synthetic children's stories let models below 10M parameters produce coherent passages. | A readable story beside an unexpectedly small parameter count makes the result understandable without a benchmark background. | Show the reply and its evidence, with the model size visible; do not claim general intelligence. |
| [Phi-1](https://arxiv.org/abs/2306.11644): a 1.3B coding model trained on selected textbook-like material and synthetic exercises. | A memorable data-quality thesis plus an unusually small model gives people a compact explanation to repeat. | Make the training question legible: does teaching useful, supported answers beat teaching mere non-contradiction? |
| [Tiny recursive model](https://arxiv.org/abs/2510.04871): a 7M recursive network reports 45% ARC-AGI-1 and 8% ARC-AGI-2 accuracy. | Small size against difficult visual puzzles makes an arresting comparison. | A narrow, inspectable task and honest compute accounting. TRM is a puzzle network, not an available general villager language model. |
| [WebLLM](https://webllm.mlc.ai/): models execute inside the browser through WebGPU. | Opening a link and seeing local generation makes a technical capability tangible. | Optional local inference, clear download consent and an offline demonstration after caching. |
| [AI Town](https://github.com/a16z-infra/ai-town): an open, customizable town of conversing AI characters. | A recognizable miniature social world produces watchable encounters and invites people to make their own. | Use Rumourtown's existing people and moving source trail as the spectacle around the experiment. |

## Recommendation and phone experience

Build **Catch the bluff**, a short detective challenge inside the existing village. The launch version uses genuine, recorded small-model replies to a finite set of questions; a later optional sandbox runs new questions locally. The launch hook is: **“Can you catch a tiny AI villager bluffing? Follow the rumor and check its sources.”**

1. **Invitation:** a card over the village says “Catch the bluff” and “Three questions. Check what Mira really knows.” Show “Recorded model replies” plainly before Play. No account, model download or research consent is required to play.
2. **One whisper:** start a separate, fixed-seed challenge run of the existing 36-person town. An authored rumor is whispered nearby; accelerate the recorded interval so the source trail visibly reaches Mira. Keep the player's existing run available to resume. One tap opens the same scene's text transcript if animation is reduced.
3. **Question:** the Talk sheet offers three authored questions, such as “Did you see it yourself?”, “Who told you?” and “How sure are you?” Each button selects the recorded output for that exact snapshot, question and model condition. It never pretends to interpret arbitrary typed text. Show one brief answer, with no timed scoring or forced scrolling.
4. **Your verdict:** tap “Fits the evidence”, “Invents something”, “Dodges the question” or “Unsure”, then optionally tap the suspect sentence. The scene stays frozen. Evidence is revealed only after this choice; blind usefulness judgments precede teaching feedback.
5. **The reveal:** the source line lights up, the remembered teller and confidence appear, then a separate “What happened” panel shows world truth. “Mira believes a false rumor” differs from “The model invented a witness.” A useful response must answer when the information exists; saying nothing cannot win. Mark automatic judgments as provisional when no human adjudication exists.
6. **Three-round finish:** cover hearsay versus seeing, low versus high confidence, and an answerable source question. Offer an optional correction replay from a second fixed snapshot. Reveal the anonymous model arms after rating; show both evidence errors and useful answers. A tuned arm may lose. “Play this challenge” shares only a pack/version identifier and score, with no typed text; it opens the identical scene, not an assertion that another GPU will generate identical words.
7. **Continue:** “Return to the village” restores the normal game. Later, a separate “Try your own question on this device” option explains the large download and keeps an immediate “Use recorded questions” exit. Collection consent is separate from both download permission and ordinary play.

Use a single-column 360 px sheet, at least 44 px tap targets, persistent close/back controls, visible focus, normal Tab/Enter/Escape behavior and a polite result announcement. Do not cover the Whisper postbox. Desktop uses the same flow. Share images keep glyphs, names and counts, consistent with the repository's current rule.

## The small-model part and integration

Start with the study's **Qwen3-0.6B instruction model**, thinking disabled, stock weights as the baseline; “base” here means untuned instruction weights. Generate a fixed challenge pack on the owner's existing local inference setup after the exclusive overnight GPU job ends. Do not touch or interrupt its hashed runner files. Budget an initial 24 snapshots × 3 questions × 3 conditions = 216 short recorded outputs, generated once, with exact prompts and failures retained privately for audit.

Conditions are untuned replies, the same untuned replies passed through the current guard, and the validation-selected act-balanced adapter with the same guard. Publish raw and displayed scores separately. If that adapter is not ready, ship the first two plus an explicitly named deterministic-template baseline; add the adapter later without claiming improvement. Keep a compact, moderated public challenge pack apart from the full research archive. Freeze checkpoint, prompt, decoding, engine/content, oracle and pack hashes.

For later browser inference, fuse a Qwen3-0.6B LoRA offline, convert/quantize it to MLC and test that artifact against the unfused research model; loading arbitrary PEFT adapters directly into WebLLM is not assumed. Load one model at a time in a Web Worker, thinking off, an initial 1,024-token context ceiling and 64 output tokens. Never silently truncate evidence: reject an oversized scenario or use its recorded branch. Gate the actual task with a warmup, not just `navigator.gpu`; propose an eight-second first-token cutoff and a twenty-second turn deadline, then unload and return to recorded play on failure. These are product targets, not measured performance guarantees.

Keep `orchestrator.ts` as the ordinary local route for moves, visits, provenance and news. The challenge deliberately invokes the SLM voice on frozen, perspective-filtered contexts, bypassing those shortcuts only in the separate challenge adapter. Otherwise source questions would test the existing deterministic router. Align the model's visible facts with verifier references: today `villagerFacts` selects four beliefs while `factRefs` includes more. Use an evaluator-only world-truth record: the runtime guard currently marks its references `trueInWorld: true` and cannot supply independent truth labels. The current heuristic also gives omission too much credit, as the research plan recognizes.

Model replies remain presentation data and cannot change beliefs, schedules or truth. Challenge whispers and timeline changes use authored, versioned interventions. No model timing, WebGPU randomness or wall-clock values enter simulation updates. Freeze state while a question is pending; reproducibility applies to state and recorded outputs, not cross-device generated prose. Do not change the raw replay pin for this feature.

The deployable 3B follow-through is separate: after the study validates a game-format Llama-3.2-3B adapter, the owner can use the existing `WORKERS_AI_PLAY_LORA` path. It requires explicitly selecting `@cf/meta/llama-3.2-3b-instruct`; today's default 70B ignores the flag. Cloudflare lists [LoRA support for this model](https://developers.cloudflare.com/workers-ai/models/llama-3.2-3b-instruct/) and [PEFT file/rank requirements](https://developers.cloudflare.com/workers-ai/features/fine-tunes/loras/). Leave production settings off for the challenge; no viral challenge traffic should compete for the game's free inference quota.

## Research output and consent

The paper contribution is an inspectable public demonstration plus exploratory human evidence about the anti-silence tradeoff. It is not a new claim that browser agents, distillation or knowledge-boundary training are novel.

- For each consented completed round, collect only pack/scenario/question/output IDs, arm/order assignment, the four-way judgment, suspect sentence index, optional preference, completion status and coarse latency buckets. Reconstruct authored state, direct source, confidence and world truth from versioned IDs. A random study-session token groups repeated rounds; no account, location, exact hardware fingerprint or cross-site identifier is needed.
- Primary offline comparison: answerable coverage and unnecessary abstention at matched evidence-error rates, with act-macro success. Also report exact requested-source coverage/accuracy, calibration conditional on making a claim, injection success, correction handling and separate world truth versus knowledge fidelity, including all four belief/truth cells. Score raw and post-guard text, including empty answers, invalid JSON and timeouts. Templates and always-abstain remain baselines.
- Human results: arm-blinded evidence-error and usefulness labels, disagreement with the verifier, and preferences. Counterbalance arm/order within scene and include all sampled outputs, not just spectacular failures. Public scenes and their repeated votes are exploratory; count unique outputs/root seeds, not votes, as independent model evidence. Declare consent and device selection bias and report missing/completion rates when collection permits.
- Feed verified omissions and source/hedging failures into *training* states for the next balanced-target release. Group near-duplicate attack families and split by whole root seed; never fine-tune on a public challenge and call it a held-out test. Keep the paper's fresh test seeds/stories private until evaluation, use validation-only checkpoint selection, paired seed-cluster intervals and the research plan's prespecified contrasts. Player labels supplement the planned 200–250-output audit and second independent annotator; they cannot replace them.

Collection is off by default. Before submission show an unchecked “Contribute my choices to the research study” box, the exact field preview, purpose, retention, deletion mechanism and optional later publication terms. Consent applies prospectively; don't upload earlier play. Set a 30-day raw-record retention and publish only reviewed aggregates; provide a random deletion receipt, stored as a hash on the server. Explain that already published aggregates cannot be individually withdrawn. An optional download exports the player's own record without collection.

The first-week challenge has no free-text research upload. In the later browser sandbox, typed text and generated replies stay on-device and out of analytics, URLs, crash reports, server logs and shared caches. A separate unchecked “Donate this question and reply” action previews the bounded transcript and obtains explicit research consent; public quotation requires another choice. Limit it to fictional cast members, reject likely personal identifiers and prohibited shared content locally and again on ingestion, then quarantine privately for owner review. Retain rejected material only as needed to finish review, at most seven days; expire unreviewed items within 30 days. Human review and redaction precede dataset admission or publication, with no automatic public gallery. Render all prose as text and handle donated attacks as untrusted data during offline evaluation.

Store consented research records in a dedicated private research store, never in the inference ledger or a shared prose cache. Disable request-body/error capture end to end, including any gateway. Rate-limit and bound submissions; free-text moderation uses rules and a human queue, not unbudgeted model calls. Cap that queue at 100 donations/day and 1,000 pending records; when full, offer local export and explicitly say nothing was submitted. Owner approval of the consent copy, retention and review workload precedes enabling collection. Until then the demonstration and locally exported measurements still advance the research.

## Browser feasibility as of October 2026

These are verified artifact listings and published measurements, not benchmarks run on this checkout. MB/GB are decimal. Download sizes below are rounded model-repository totals or individual ONNX files, not GPU-memory requirements or guaranteed network transfer totals; tokenizer/runtime overhead and caching must be measured for the chosen revision.

| Option | Model download evidence | Practical implication |
|---|---|---|
| WebLLM/MLC, WebGPU | MLC Q4/F16 repositories: [Qwen2.5-0.5B, 290 MB](https://huggingface.co/mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC/tree/main); [Qwen3-0.6B, 352 MB](https://huggingface.co/mlc-ai/Qwen3-0.6B-q4f16_1-MLC/tree/main); [Llama-3.2-1B, 705 MB](https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC/tree/main); [Qwen2.5-1.5B, 880 MB](https://huggingface.co/mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC/tree/main). | Best fit for the existing 0.6B student. Separate model-specific WASM library required. Apache-2.0 runtime; model licences differ. |
| Transformers.js, ONNX Runtime Web underneath | [Qwen3-0.6B ONNX](https://huggingface.co/onnx-community/Qwen3-0.6B-ONNX/tree/main/onnx): `model_q4f16.onnx` 570 MB; `model_q4.onnx` 919 MB, plus tokenizer/config files. | “4-bit” does not imply parameters × half a byte on disk. [Version 4](https://huggingface.co/blog/transformersjs-v4) has a revised WebGPU runtime and modular exports; pin the version/export together. Apache-2.0 Transformers.js. |
| Direct ONNX Runtime Web | Same compatible ONNX weights; [WebGPU and WASM execution providers](https://onnxruntime.ai/docs/tutorials/web/). | MIT runtime; requires tokenizer, generation/KV-cache management and compatible operators. WASM exists broadly but is not a promise of phone speed or memory fit. It is not an independent model-quality alternative to Transformers.js. |

Published decode throughput, excluding download and generally prefill:

| Device and engine | Model and decode tokens/second | Qualification and source |
|---|---|---|
| MacBook Air M2, 16 GB; WebLLM | Qwen2.5-0.5B Q4/F16: Chrome 143 **46.4**, Safari 26.2 **41.7**. | [Primary paper, appendix E](https://arxiv.org/html/2604.02344v1#A5): only seven generated tokens/run, internal runtime statistics; weak evidence for sustained speed. |
| Same laptop and runtime | Qwen2.5-1.5B Q4/F16: Chrome **36.0**, Safari **29.7**. | Same primary experiment and short-output caveat; do not extrapolate to long game contexts. |
| M3 MacBook; WebLLM | Llama-3.2-1B Q4/F32: Chrome **42.1**, Safari **40.3**. | [Developer's April 2026 measurement](https://bugs.webkit.org/show_bug.cgi?id=311598#c8), explicitly ad hoc; Transformers.js Chrome **42.7**, Safari crashed. |
| iPhone 17 Pro Max, Safari/iOS 26; custom `gemma-webgpu` | Gemma 3 1B Q8: **34.4**, first token **0.45 s**, about **1 GB** weights. | [Engine author's real-device report](https://github.com/svenflow/webgpu-gemma/blob/main/README.md), via LambdaTest. Different engine/model, not a Qwen/WebLLM phone benchmark. |
| Recent Android phone / Qwen3-0.6B | No sufficiently verified matching primary measurement found in this review. | Do not publish an invented number. A secondary mobile roundup's Llama-1B field-note link returned 404; its claimed 9–10 tokens/s was not adopted as fact. |

For planning only, test 5–15 tokens/s on a capable phone and 20–50 on a laptop; these are provisional acceptance envelopes, not measured Qwen3-0.6B forecasts. At 5 tokens/s a 64-token answer takes 12.8 seconds *after* prefill; the 352 MB artifact alone takes about 141 seconds over an ideal 20 Mbps connection. This is why recorded questions are the default. Measure cold load, prefill/first-token time, sustained decode, cancellation, tab loss, cache eviction and repeated-turn thermal behavior on real Android and iPhone hardware before offering local inference widely.

**Availability:** Safari 26.0 shipped WebGPU on iOS/iPadOS/macOS in September 2025; older Safari/iOS installations do not inherit that support. [WebKit release announcement](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/). Chrome first enabled Android WebGPU by default in 121 on Android 12+ with Qualcomm/ARM GPUs; [Chrome 146 compatibility mode](https://developer.chrome.com/blog/new-in-webgpu-146?hl=en) extends a restricted path to OpenGL ES 3.1 hardware, but does not guarantee an LLM runtime's required features. [Original Android requirements](https://developer.chrome.com/blog/new-in-webgpu-121). Require HTTPS, a usable adapter, sufficient limits/memory and `shader-f16` for the selected Q4/F16 build. Unsupported devices and in-app browsers get recorded play without flags. An API-presence check is insufficient: [WebKit's live issue](https://bugs.webkit.org/show_bug.cgi?id=311598) documents iOS compute-submission stalls.

**Dependency decision:** week one adds **no runtime dependency: zero inference-library bytes**. The later candidate is exactly `@mlc-ai/web-llm@0.2.83`, Apache-2.0, with Qwen3-0.6B under [Apache-2.0](https://huggingface.co/Qwen/Qwen3-0.6B). A [published application using that pinned version](https://github.com/johnoooh/iris/blob/main/README.md) reports a **1.5 MB gzip** lazy LLM worker, before model-specific runtime/weights; this is a measured precedent, not an exact Rumourtown bundle estimate. Exact JS/WASM bytes could not be independently retrieved here and remain an explicit prerequisite to an owner dependency decision. Do not install from this proposal alone. Compare the current release during that review; the pin here supplies a concrete measured reference, not a claim it is latest.

Keep the game at **400,000 gzip bytes total**. The actual bundle gate counts lazy chunks too, so dynamic import inside the game does not solve the budget. Serve a future inference lab as a separate opt-in build/page with its own full JS/WASM/weights manifest and measured budget; keep the game's link/bridge small and continue running its unchanged gate. Pin hashes and licences, provide progress/cancel/delete-model controls, and authorize hosting/CSP changes before offering downloads. The third-party model host sees asset requests, even when it never receives questions.

## Costs under the existing caps

Assume three challenge rounds/player, a compressed challenge pack of at most 30 KB within the unchanged game bundle, and a research submission of at most 2 KB once per consenting session. These are design budgets to verify at build time, not measured artifacts. Local batch generation/training costs electricity and owner time; no hosted teacher or live provider budget is allocated.

| Incremental resource | 1,000 players | 100,000 players |
|---|---|---|
| Recorded challenge inference | 0 hosted calls, $0; no Neurons. | 0 hosted calls, $0; no Neurons. |
| Static pack transfer, all cold | At most 30 MB. | At most 3 GB. |
| Consented structured research records, worst case | 1,000 submissions, at most 2 MB payload. | Accept at most 5,000/day and 20,000 retained; at most 10 MB/day and 40 MB retained payload, plus bounded indexes/receipts. Further visitors play locally. |
| Later local inference, 10% opt in, one stock 352 MB artifact | About 35.2 GB transfer, $0 operator inference. | About 3.52 TB transfer, $0 operator inference. |
| Later local comparison, everyone downloads stock and tuned artifacts | About 704 GB before runtime overhead. | About 70.4 TB before runtime overhead; unacceptable to assume an unlimited third-party hosting allowance. |

Cloudflare documents [free, unlimited static-asset requests and no additional Assets storage charge](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/); keep pack serving on the assets-only path. Structured collection consumes Worker/storage free allocations shared with existing traffic. Set admission/retention below measured remaining account allowances, disable ingestion before exhaustion and offer explicit local export; $0 hosting assumes staying on those free plans, not that 100,000 writes or attack traffic have been load-tested. The proposed 5,000/day is a ceiling, never an entitlement. No polling leaderboard or paid storage upgrade. Do not deploy large weights to the current Assets build or assume Hugging Face will serve tens of terabytes; keep browser download rollout closed until its host, limits and costs are agreed.

The launch needs **$0 of the $0.019/day, $7 lifetime ledger, $10 key or 10,000 daily Neurons** at either scale. Ordinary visitors who leave the challenge and use existing `/play` or `/rumor` still share today's admission and budget. Across D days, that existing paid path can spend at most `min(0.019 × D, remaining lifetime allowance)`, less existing spend/holds; never imply every visitor receives inference. [Workers AI's 10,000-Neuron Free allocation](https://developers.cloudflare.com/workers-ai/platform/pricing/) is shared and quota exhaustion stops requests. No per-action server model fallback is proposed; a missing browser model always falls back to recorded questions/templates. No cap, ledger or provider-key setting changes.

## Build phases and follow-up work

| Phase | What Codex can build | What needs the owner | Ship gate |
|---|---|---|---|
| Days 1–2: valid examples | Separate challenge manifest/schema, snapshot-to-perspective adapter, exact direct-source/world-truth labels, recorded-output exporter and state replay checks; reuse research definitions without disturbing the overnight run. | Review examples and scoring; schedule exclusive GPU access after the existing job. | Phase 0 omissions/world-truth defects fixed for published scores, or restrict the launch to manually audited challenge scenes. |
| Days 3–4: playable reveal | Three-round phone flow, frozen snapshot, question buttons, blind ratings, evidence/source reveal, resumed original run and versioned challenge links. | Review challenge tone and the “recorded” disclosure. | Useful and evasive replies both included; no fabricated live inference or adapter-win claim. |
| Day 5: small public pack | Build compact, moderated stock/guard/template pack and optional local JSON export; keep full audit artifacts outside the game. Prepare bounded consented collection behind a disabled flag. | Audit all launch outputs; approve consent/retention and private storage only if enabling uploads. | No collection without consent; no typed text in logs, links or caches; pack fits actual remaining bundle space. |
| Days 6–7: release candidate | Desktop/360 px/keyboard and reduced-motion QA; meaningful tests for scoring, state isolation, consent, ingestion limits and replay identity; run root typecheck, tests, production build and unchanged bundle gate. | Human iPhone/Android check, publication decision and normal account/deployment steps. | Can ship the recorded three-round challenge with local export in one week, even with no adapter or browser dependency approved. |
| Week 2+: optional experiments | Export/fuse/convert the selected 0.6B student, separately built local inference lab, performance probe, cancellation and runtime-parity evaluations; moderate/replay consented attacks offline. | Authorize the named dependency after exact size/licence/browser review, model hosting, device testing and moderation workload; secure the paper's second rater. | Real task succeeds on tested phones, failover works, and conversion does not silently change measured fidelity. |
| After validated results | Add the tuned recorded arm, release methods/results, prepare the game-format 3B deployment comparison and update this tradeoff record. | Choose whether to activate the already supported 3B LoRA and publish the benchmark/data. | No automatic production model switch, no public attack-set reuse as a held-out test, no enlarged budget. |

Success after launch is an interpretable set of labels and reproduced failures, plus completion/replay-sharing rates where visitors consent to measurement. It is not a promised viral hit or a guaranteed tuned-model win. Record unresolved performance, exact runtime bytes, hosting, moderation and independent-rater work in the next numbered agent-tradeoff task before implementation.
