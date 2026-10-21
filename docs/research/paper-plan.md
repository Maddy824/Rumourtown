# Paper plan: faithful to a lie

## Claim (qualified, not "first ever")
When a deterministic simulation owns the world's truth and each character's beliefs (with provenance and uncertainty), we can measure two different things that current hallucination metrics conflate:
- **World faithfulness:** does the character say only things true in the world? (Not wanted: a villager who heard a lie *should* repeat it.)
- **Epistemic faithfulness:** does the character say only what *they* believe, with the confidence and source they actually have? A villager faithfully repeating a false rumor is not hallucinating; a villager inventing a sighting is.

We report the smallest model that is epistemically faithful under an orchestrator that answers state-determined requests without generation, and the reliability–cost frontier of a cascade that verifies replies against the character's belief state.

Working title: **Faithful to a Lie: Epistemic Faithfulness and the Cost of Small-Model Characters with Simulation-Owned Beliefs.**

## Closest work and how we differ (full list in literature-2026-10-22.md)
- CASCADE (CHI 2026 EA): code-governed coordination with on-demand LLM; we add capacity and verification experiments and the epistemic/world split.
- Fixed-persona SLMs with modular memory (2025): small local NPC models; we add simulation-owned evolving beliefs with provenance and false beliefs.
- FActScore, RAGTruth, FaithEval: claim-level support metrics; we adapt them to per-character, time-varying belief states.
- FrugalGPT, RouteLLM, AutoMix: routing and cascades; our escalation signal is a state oracle, not a learned or self-assessed score.
- RumorSphere, Hu et al. 2025: LLM rumor simulations where models drive beliefs; ours keeps belief dynamics deterministic and research-grounded.

## Venues and timeline
1. arXiv preprint as soon as the core factorial and annotation are done.
2. **IEEE CoG 2027** (planning estimate: March) or **AIIDE 2027** (planning estimate: June): technical paper with benchmark, ablations, annotation.
3. **CHI PLAY 2027** (planning estimate: February, likely too early) or 2028: the player study (48–72 counterbalanced participants).
4. ACL ARR deadline 4 January 2027 only if the benchmark generalises beyond the game; otherwise skip.
Verify all 2027 deadlines when announced.

## Minimum experiment set
- **Core factorial:** model size (3B, 8B, 70B; plus one second family, e.g. Qwen or Mistral on Workers AI) × grounding (cast list only vs character facts) × routing (always-model vs orchestrated). Plus an in-browser SLM condition.
- **Baselines:** deterministic templates; grounded 70B; constrained fact-to-text; an AutoMix-style self-verification cascade; our state-verified cascade; an oracle escalation upper bound.
- **Test set:** at least 50 held-out stories × 3 decoding seeds; short and long conversations; probes for false premises, corrections, provenance chains, ignorance ("I haven't heard"), action paraphrases and injections. Tuning stories kept separate.
- **Metrics:** epistemic faithfulness and world faithfulness (claim level), provenance accuracy, calibrated uncertainty (does "I'm fairly sure" match the belief's confidence?), persona consistency, action accuracy, interpretation accuracy, injection resistance, abstention and useful-answer coverage, verifier precision and recall, escalation rate, p50/p95 latency, cost per 100 messages, browser cold start.
- **Validation:** at least 500 stratified outputs double-annotated by humans (blind to condition), agreement reported, disagreements adjudicated; LLM judges only as an auxiliary signal, validated against the human labels.
- **Statistics:** paired, story-clustered intervals or hierarchical models; effect sizes; multiplicity correction; preregistered non-inferiority margins before running the main experiment.

## Threats to validity and responses
1. Circular scoring: the verifier must not be the metric. Human annotation decides; verifier precision and recall are reported against it.
2. Confounds of size: matched families, same decoding settings, repeated seeds, cluster by story.
3. Synthetic world: rules are computational ground truth, not validated psychology; vary rule settings and network shapes, hold out story mechanisms, and run the player study.

## Build list (replaces 24-slm-agent-study.md items 1–3)
1. `bench/agents/`: scenario generator (seeded villages, stories, conversations with known belief states), runner across conditions through a local Worker, outputs JSONL plus a results table.
2. Claim extractor and dual verifier (epistemic vs world), with a hand-labelled development set.
3. Annotation tool: a small static page that shows one output with the character's belief state and collects labels (supported by belief / unsupported / contradicts belief / true-in-world), exported as CSV.
4. Cascade in the Worker behind a flag, so it can be measured, not just shipped.
5. Analysis notebook or script producing the tables and figures.
