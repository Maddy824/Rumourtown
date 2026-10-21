# Literature check: verifier-filtered distillation for epistemic faithfulness (22 Oct 2026)

**Verdict.** I found no 2025-2026 paper that does what Rumourtown plans (fine-tune a small LM on replies filtered by a programmatic verifier over a simulated character's own belief state, with provenance, confidence and "unknown-to-speaker" labels). Every ingredient has prior work, though, so the contribution is defensible only as the combination plus the evaluation design (held-out rumor mechanisms, epistemic vs world faithfulness), not as any single technique.

Method note: searches ran through WebSearch only (arXiv, ACL Anthology, ICLR/NeurIPS pages, aggregators). I did not query Semantic Scholar or OpenReview directly. "Opened" = fetched with WebFetch; "seen" = URL and summary appeared in search results only. Absence of a hit is not proof of absence.

## (a) Character knowledge boundaries and hallucination
- TimeChara (seen): https://arxiv.org/abs/2405.18027 . Point-in-time character hallucination benchmark plus prompted "Narrative-Experts". Overlap: failure mode. No training, no simulated belief state.
- CHARM (opened): https://arxiv.org/abs/2609.01352 (1 Sep 2026). Separates boundary recognition from compliance; evaluation only, multiple choice. Overlap: the same diagnosis (model knows the fact, character should abstain).
- ERABAL (opened): https://arxiv.org/abs/2409.14710 . SFT and boundary-aware alignment on LLM-synthesised role dialogues. Overlap: training for boundary queries. Differs: boundary is persona-profile based, LLM-judged, no per-belief verifier.
- RoleMRC (opened): https://arxiv.org/abs/2502.11387 . Role-play MRC with respond/refuse/attempt by passage answerability; SFT released. Overlap: closest to "gold speech act" labels. Differs: static passages, no provenance or confidence.
- Memory-Driven Role-Playing / MREval (opened): https://arxiv.org/html/2603.19313v1 . "Memory-Bounding" (answer leakage, controlled response); prompt-only; LLM judge.
- RoleLLM (seen): https://arxiv.org/html/2310.00746v3 and Character-LLM (seen): https://preview.aclanthology.org/setup/2023.emnlp-main.814 . Fine-tuned role-play with some out-of-scope handling; style and persona focus. CharacterEval and InCharacter: only seen second-hand, not opened.
- SHARP (seen): https://arxiv.org/pdf/2411.07965 . Reports fine-tuning for role-play erodes knowledge retention; useful cautionary prior for the "memorise vs skill" question.
- When Roleplaying, Do Models Believe What They Say? (opened): https://arxiv.org/abs/2606.11502 . SFT/prompting change outputs, not internal truth representation. Supports the epistemic-vs-world distinction (a model can voice a false belief without believing it).

## (b) Fine-tuning to abstain or respect knowledge boundaries
- R-Tuning (seen): https://arxiv.org/pdf/2311.09677 . Refusal-aware SFT keyed to the model's own knowledge gap; claims abstention transfers out of domain as a "meta-skill". Differs: boundary is the model's parametric knowledge, not an externally specified belief set.
- Alignment for Honesty (seen): https://arxiv.org/pdf/2312.07000 . idk-responses plus prudence and over-conservativeness metrics. Differs as above; the over-conservativeness metric is worth borrowing.
- Kapoor et al., taught to know what they don't know (seen): https://arxiv.org/abs/2406.08391 . Calibration via small fine-tuning sets. Overlap: confidence calibration.
- Abstain-R1 (opened): https://arxiv.org/abs/2604.17073 . RLVR with rule-based abstention plus clarification reward, 3B. Overlap: rule-based reward, small model, abstention. Differs: RL not rejection-sampling SFT; unanswerable-from-context, not belief state.
- Ground-GRPO (seen): https://arxiv.org/html/2506.15522v1 . Verifiable rewards for answer, citation, refusal when evidence missing. Closest to "source naming".

## (c) Rejection sampling, expert iteration, verifier-guided self-training
- STaR (seen): https://arxiv.org/pdf/2203.14465 ; ReST-EM (seen): https://arxiv.org/abs/2312.06585 ; RAFT (seen): https://arxiv.org/abs/2304.06767 . The generic recipe. Not novel.
- The Verifier is the Curriculum (opened): https://arxiv.org/abs/2607.09709 . Deterministic-gate rejection-sampling self-distillation, 14B, held-out families; verifier precision drives gains. Strong support for your design and for an ablation on verifier strictness.
- Teacher-free self-training amplifies but does not compound (opened): https://arxiv.org/abs/2606.07856 . Qwen3-4B, exact verifier, STaR rounds raise ceiling but concentrate probability (pass@K crossover). Directly relevant to your self-distillation variant; expect to be asked about it.
- Self-Verified Distillation (seen): https://arxiv.org/pdf/2605.26132 . Filtered self-generated data beats unfiltered. Domains are math/code/science only; no dialogue or persona use found.

## (d) Faithfulness to (counterfactual) context
- FaithEval (seen): https://arxiv.org/abs/2410.03727 . Unanswerable, inconsistent, counterfactual contexts; evaluation only. Overlap: faithful-to-false-context is exactly your "repeat the false rumor" case, but framed as a QA benchmark.
- Knowledge-conflict tuning, KAFT/DisentQA/ContextDPO (seen only as names in a survey snippet): https://arxiv.org/html/2508.19720v3 . Small-model counterfactual fine-tuning exists.
- Dial BeInfo (opened): https://arxiv.org/abs/2311.09800 . Behavioural fine-tuning for knowledge-grounded dialogue, 3B, zero-shot to unseen domains. Closest prior on "dialogue faithfulness transfers across domains".

## (e) Theory of mind and belief tracking
- SimToM (seen): https://aclanthology.org/2024.acl-long.451 . Prompted perspective filtering. Your verifier is a programmatic version of its "what could X know" step.
- FANToM (seen): https://arxiv.org/abs/2310.15421 . Conversational information asymmetry, QA. Evaluation only.
- ToM-RL (seen): https://arxiv.org/abs/2504.01698 vs Small LLMs do not learn a generalizable ToM via RL (opened): https://arxiv.org/abs/2507.15788 . Training gains on ToM do not transfer to held-out datasets and may exploit dataset statistics. This is the single most important prior for your "skill or memorisation" question: the null result is plausible and must be a live hypothesis.
- Truth for Believable AI (opened): https://arxiv.org/abs/2609.26035 (22 Sep 2026). Per-claim confidence and typed provenance as a behaviour layer on a frozen Qwen2.5-0.5B; no fine-tuning, no NPCs. Nearest on provenance plus hedging; finds expression-fidelity and provenance margins fail on the real small model, and token-probability gating is below chance. Cite it and differentiate.

## (f) Small-model NPC dialogue
- Fixed-Persona SLMs with Modular Memory (opened): https://arxiv.org/html/2511.10277v1 . LoRA persona models (DistilGPT-2 to Mistral-7B), retrieval world memory, LLM-judge factual-consistency and out-of-scope refusal; no verifier, no rejection sampling, no belief provenance.
- Tricking LLM-Based NPCs into Spilling Secrets (opened): https://arxiv.org/abs/2508.19288 . Prompt-injection attacks on NPC secrets; attack study only.
- RPGBench (seen): https://arxiv.org/pdf/2502.00595 . NPC factual consistency evaluation; no training.
- Project Paradox "mango rumor" talk (seen via secondary write-ups only): https://www.startuphub.ai/news/mango-rumors-exposed-what-long-agents-forget . Same rumor/provenance motivation in an agent village; no paper found.

## (g) Prompt-injection robustness via fine-tuning
- StruQ and SecAlign (seen): https://arxiv.org/html/2410.05451v3 ; attacks on them: https://arxiv.org/pdf/2507.07417 . Fine-tuning defences exist (8B-scale) and are breakable by adaptive attacks.
- Instruction hierarchy (seen via blog): https://blog.simonwillison.net/2024/Apr/23/the-instruction-hierarchy/ . I found no systematic study at 0.6B-4B. Keep injection claims modest.

## Defensible claims
- A programmatic verifier that checks a reply against the speaker's own belief store (supported / contradicts / unknown-to-speaker / chatter, plus confidence and source naming) used as the rejection filter for SFT of sub-2B students. No prior work found combining these.
- Separating epistemic faithfulness (faithful to a false belief) from world faithfulness as two measured axes in a fine-tuning study; existing work treats counterfactual faithfulness only as QA benchmarks.
- Held-out rumor mechanisms as a transfer test for a belief-state skill, with seed-held-out as the weaker control. Prior ToM-RL work shows exactly this kind of OOD gap but on external datasets, not generated mechanisms.
- Whether verifier-accepted self-distillation (expert iteration) matches teacher distillation at 0.6B-1.7B, on a non-math/code task. Prior self-distillation results are code/math/synthetic-DSL.
- Stress-axis profile (pressure, false premise, distractors, correction, injection, long conversation) on a fully simulated ground truth, which gives exact labels rather than LLM judges.

## Claims to avoid
- "First to fine-tune role-play models to respect knowledge boundaries" (ERABAL, RoleMRC, R-Tuning family).
- "First rejection-sampling or verifier-filtered fine-tuning for small models" or "first rule-based verifier for abstention" (ReST-EM, 2607.09709, Abstain-R1).
- "First small-model NPC fine-tuning" (2511.10277).
- "Teaches theory of mind" or "belief tracking" in general; claim only the narrow skill you measure.
- "Robust to prompt injection" beyond the tested attack set.
- "Skill, not memorisation" unless held-out mechanisms show it; a null or partial result is a legitimate and publishable outcome given 2507.15788.
- Any claim that verifier accuracy equals ground truth without a human-labelled audit of the verifier itself.

## Baselines reviewers will demand
1. Base students, zero-shot and with a strong system prompt including the belief list; and few-shot prompting.
2. Teacher (Qwen3-4B) alone, plain sampling and best-of-8 with verifier at inference (no training), to show training adds something over inference-time filtering.
3. Unfiltered SFT on teacher outputs (does the filter matter?), and filtered-but-no-speech-act-gate (does the gold act matter?).
4. Verifier strictness ablation (lenient vs strict gate), per 2607.09709; and matched data volume controls.
5. R-Tuning or honesty-style SFT (abstain on out-of-belief only) and a plain "refuse everything uncertain" policy, with over-conservativeness reported.
6. Preference or RL alternative on the same verifier: DPO on accepted vs rejected, and a GRPO/RLVR run (Abstain-R1 style).
7. Retrieval or belief-in-context with a structured prompt (SimToM-style two-step filter) as the non-training route.
8. Content-memorisation control: train on one mechanism or shuffled-belief data and test on others; also a seed-only split to separate the two generalisation levels.
9. Larger frontier model as LLM judge on a sample, to validate the rule-based verifier, plus a human audit.
10. Capability-retention check (general chat, instruction following) since SHARP and PerMix-style work report fine-tuning costs.
11. Multiple seeds and confidence intervals; 2606.07856 shows small-K trajectories are fragile.

## Sharpest framing
"Staying inside a belief state is a trainable, verifiable skill: we use a simulator-derived epistemic verifier as a rejection filter to distil it into sub-2B models, and test whether it transfers to unseen rumor mechanisms or only to unseen seeds, separating faithfulness to a character's beliefs from faithfulness to the world." Lead with the transfer question and the two-axis evaluation, treat the filtered-distillation recipe as the vehicle, and cite 2507.15788 and 2609.26035 as the strongest motivating and contrasting priors.
