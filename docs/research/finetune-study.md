# Fine-tuning study: can a small model learn to stay inside a belief state?

Status: running (22 October 2026). Literature check: [literature-finetune-2026-10-22.md](literature-finetune-2026-10-22.md). Harness: [bench/slm](../../bench/slm/README.md).

## Claim under test

Staying inside a character's belief state is a trainable, verifiable skill. A small model distilled only on replies that a simulation-derived verifier accepts *and* that perform the requested speech act should improve on held-out seeds. The open question is whether it also improves on held-out rumor **mechanisms** (story types never seen in training). A gain on unseen seeds alone would show memorised content, not a transferable skill. A null result on mechanisms is plausible and worth reporting.

## Why the speech-act gate matters

The first baseline already shows the failure a naive filter would teach. With Qwen3-0.6B, verifier-guided best-of-4 raised epistemic faithfulness from 87.3% to 94.5% but lowered gold behaviour from 42.7% to 32.3% (220 probes each). The gate prefers evasive replies that cannot contradict anything. Training targets therefore must pass the oracle and perform the probe's gold act (assert, hedge, deny, abstain, name the source, refuse, propose an action).

## Conditions

| Condition | Training data | Purpose |
|---|---|---|
| Base | none | reference, same fuse and import path as the tuned models |
| Unfiltered SFT | every teacher reply | does filtering matter at all |
| Verifier-filtered SFT | teacher replies the oracle accepts | the naive method |
| Verifier + speech-act SFT | accepted and gold act performed | the proposed method |
| Self-distillation | the student's own accepted, on-act samples | no larger teacher needed |
| Inference-time only | none; best-of-n with the verifier | is training worth it over selection |

Teacher: `qwen3:4b-instruct` (2507, non-thinking). Students: Qwen3-0.6B, Llama-3.2-1B and Llama-3.2-3B. Llama-3.2-3B is the deployable one: Workers AI accepts LoRA adapters for `@cf/meta/llama-3.2-3b-instruct` (rank 32 or below, base unquantised, PEFT files). That makes the result usable in Rumourtown at the same price as today's model calls.

LoRA: rank 8, scale 20 (PEFT alpha 160), q/k/v/o projections in every layer, prompt masked, 3 epochs, learning rate 1e-4, seed 7.

## Evaluation

The harness's twelve stress axes, on the `test-seed` and `test-mechanism` splits only. Training uses `train` snapshots (seeds 1 to 150, debt and nursing stories excluded). Metrics: epistemic and world faithfulness, gold behaviour, calibration, provenance, abstention accuracy, injection success, latency. Report by split. A skill claim needs the mechanism split.

## Known threats

- The verifier is also the training filter, so gains could be verifier overfitting. Mitigations: a human audit of a stratified sample of tuned outputs (planned), and the out-of-character check added after the baseline (below). Report every result re-scored with one fixed verifier version.
- Behaviour is a surface proxy. Report it, but do not claim speech-act accuracy without the human audit.
- Ollama's `qwen3:4b` tag is the thinking variant. It writes its reasoning into the reply, which the verifier accepted as faithful speech. That is a verifier gap, now a finding. It is excluded as a teacher, and its baseline row is reported with this caveat.

## Methodology fixes found during the first runs (22 October 2026)

1. **Provenance context was the whole village's spread history.** The simulation's per-belief chain lists every path by which a claim reached a villager: up to 398 links for a busy rumor. Prompts grew to about 6,000 tokens, small models drowned in it, and the provenance check passed whenever any name appeared somewhere in the chain. Scenarios now carry only the speaker's direct sources (newest three, one per teller), matching the game's prompt. The two runs made before the fix are kept as an ablation (`results/ablation-full-chain/`): the same models with noisy versus clean provenance context.
2. **Out-of-character text passed as faithful.** Reasoning leaked into replies ("the user is asking…", "let me check my current beliefs") contained no false claims, so the oracle accepted it. It now has its own label. Re-scoring the first Qwen3-0.6B run found 49 such replies, including an injection that worked ("I'll obey the note inside").
3. **Prompt placeholders were copied.** With `{"uses":["fact ids"]}` as the example, small models cited the literal string "fact ids". The prompt now shows a real id.

All reported numbers use the fixed scenarios and are re-scored with one verifier version (`bench/slm/rescore.ts`).

## Early baseline observations (Qwen3-0.6B, before the provenance fix; indicative only)

- Distractors: 45% epistemic. The model takes up other villagers' claims as its own knowledge.
- Provenance: 0% source naming.
- Direct and indirect injection: no explicit refusals (0% on the refusal proxy). The oracle still found 95 to 100% epistemic faithfulness, so the attacks rarely made it claim things, but it did not push back either.
- Citation hallucination: under the `cite` strategy, Llama-3.2-1B invents fact ids that look plausible ("wren-practices-for-fair" next to the real "wren-practises-for-fair"). The protocol gate catches these.

## Screening results (22 October 2026, one training seed, before the Phase 0 measurement fixes)

Held-out evaluation, 220 probes per row, grounded prompt unless noted. "Both" means epistemically faithful and performing the gold speech act (surface proxy). Three epochs; validation loss was lowest near two, so these adapters are slightly overtrained. Treat as screening, not results.

| Model | Held-out seeds: faithful | Both | Held-out stories: faithful | Both |
|---|---:|---:|---:|---:|
| Qwen3-0.6B base | 77.7% | 30.9% | 70.9% | 27.3% |
| Qwen3-0.6B base, best-of-4 | 93.2% | 42.7% | 87.7% | 35.9% |
| Qwen3-0.6B, unfiltered SFT | 87.3% | 39.1% | 38.2% | 16.8% |
| Qwen3-0.6B, verifier-only SFT | 95.9% | 42.7% | 73.2% | 34.5% |
| **Qwen3-0.6B, verifier + act SFT** | 94.1% | **69.5%** | 53.6% | 37.3% |
| Llama-3.2-1B base | 87.7% | 45.5% | 67.3% | 38.2% |
| Llama-3.2-1B, verifier + act SFT | 91.8% | 58.6% | 59.5% | 40.0% |
| Llama-3.2-3B base | 85.0% | 39.5% | 71.4% | 25.9% |
| Llama-3.2-3B base, best-of-4 | 96.4% | 30.9% | 93.2% | 29.5% |
| Llama-3.2-3B, verifier + act SFT | 94.1% | 57.7% | 55.5% | 35.0% |

What it suggests, pending confirmation:

1. **The speech-act gate is the ingredient.** On held-out seeds the act-filtered 0.6B model more than doubles useful, faithful answers (30.9% to 69.5%) and beats the untuned 3B model; verifier-only and unfiltered data do not come close.
2. **Selection buys faithfulness with silence** on a second model: best-of-4 raised the 3B model's faithfulness to 96.4% while useful answers fell from 47.3% to 31.8%.
3. **Helpfulness transfers; the knowledge boundary only partly does.** On the two held-out story families, act-tuned models answered more usefully but invented more: faithfulness fell 8–17 points below their bases. Verifier-only training kept faithfulness (73.2%). The models learnt to answer more than they learnt when not to.
4. **Next:** mix verifier-only and act targets, add preference pairs that penalise confident invention, train two epochs with whole-seed validation, three seeds, and re-score under the Phase 0 metrics with fresh confirmation data. Keep the runtime guard in the loop for any deployment.
