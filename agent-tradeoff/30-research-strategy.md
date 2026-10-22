# 30: Research strategy review: how to make the SLM study valuable

This is a thinking task, not a build task. Do not edit code. You have live web search: use it.

## Read first

- `docs/research/finetune-study.md` (the study, its methodology fixes and early observations)
- `docs/research/literature-finetune-2026-10-22.md` and `docs/research/literature-2026-10-22.md` (prior work, novelty check)
- `docs/research/paper-plan.md`, `docs/research/slm-limits-program.md`, `docs/research/product-impact.md`
- `bench/slm/README.md`, `bench/slm/types.ts`, `bench/slm/probes.ts` (what is actually measured), `apps/rumortown/src/agentic/verifier.ts` (the oracle)
- `bench/slm/data/finetune/stats.json` and the per-act table below

## Where things stand (22 October 2026, 10:40)

- A deterministic village simulation gives every villager beliefs with confidence and direct sources. A rule-based oracle labels each reply sentence as supported, contradicting, unknown-to-speaker, chatter or out-of-character, and checks calibration and provenance. Probes cover 12 stress axes, with held-out seeds and two held-out rumor mechanisms.
- Teacher: Qwen3-4B-Instruct-2507, 8 samples for each of 1,600 training probes. 72% of samples pass the oracle, but only 33% also perform the gold speech act. Per act, on-act sample rates: abstain 51%, assert 46%, propose-action 18%, deny 13%, hedge 8%, name-source 5%, refuse-injection 5%. The resulting "act" training set (719 examples) is about 60% abstentions.
- Six LoRA students trained (Llama-3.2-3B, Qwen3-0.6B with three filters, Llama-3.2-1B, and Llama-3.2-3B in the live game's /play format). Every run's validation loss is lowest near two epochs and rises in the third. Paired evaluation on test-seed and test-mechanism splits starts around 11:05; results are not in yet.
- Earlier observations (pre-fix, small n): verifier-guided best-of-4 raised epistemic faithfulness 87%→94.5% but lowered on-task behaviour 43%→32%; models adopt other villagers' claims as their own (45% on the distractor axis); Llama-3.2-1B invents plausible fact ids when asked to cite.
- Real-world angle the owner cares about: Workers AI accepts LoRA adapters for Llama-3.2-3B, so a tuned adapter could serve the live game. The owner also wants industry value, especially banking: per-customer knowledge boundaries, information barriers (Chinese walls), provenance, document-borne prompt injection, on-premises small models.

## What we want from you

Be the sceptical senior reviewer and research lead. Independently (do not just agree with the current plan):

1. **Honest value assessment.** As the study stands, what would a reviewer at AIIDE/IEEE CoG, an ACL workshop, ACM CODS-COMAD and a bank's applied-AI team each say? Strongest and weakest points.
2. **Search the literature** (2024 to October 2026) for anything that already does: knowledge-boundary or information-barrier faithfulness for LLM agents; per-user access-scoped generation; verifier-filtered distillation with programmatic verifiers; abstention-aware fine-tuning trade-offs (over-refusal); multi-agent information asymmetry benchmarks; finance or banking LLM benchmarks for grounded customer answers, information barriers or MNPI leakage. Give URLs and one line on overlap. Say which you opened.
3. **Propose the three most valuable reframings or extensions**, ranked, each with: the claim it would let us make, the minimum experiment, what it needs (compute on an M4 Max 36 GB, data, people), the risk, and the venue it fits. Consider at least: (a) a second, synthetic domain with the same schema (for example a bank with customers, entitlements, posted/pending records, information barriers between divisions, documents carrying injections) to test whether the method and even the village-trained adapter transfer; (b) fixing the abstention skew and the teacher's inability to name sources or hedge (balanced or templated targets, a stronger teacher, preference optimisation such as DPO with oracle-scored pairs, or rejection sampling from the student itself); (c) making the benchmark itself the contribution (release, leaderboard, the "faithful to the character vs true in the world" split); (d) anything better you find.
4. **Experimental rigour checklist** a reviewer would demand: seeds and repeats, confidence intervals clustered by scenario, multiplicity, baselines (list them concretely, including a large model and verifier-at-inference), the human audit, over-refusal and helpfulness metrics so silence cannot win, and contamination checks.
5. **A one-page plan** for the next two weeks that maximises value per hour of the owner's time (the owner is one person; compute here is free; Workers AI and OpenRouter spending must stay inside the existing caps).

Write it to `agent-tradeoff/reports/30-strategy-review.md`: plain Markdown, sentence case headings, no emoji, under 220 lines. Mark every claim from search with its source. End your last message with a five-line summary.
