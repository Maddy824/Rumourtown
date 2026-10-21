**Rumourtown is promising, but its components are established. The strongest contribution is a controlled benchmark of the cost of dialogue faithful to explicitly maintained character state.**

Coverage: live searches through **22 October 2026**; later October publications cannot yet be covered. Venue recommendations and sample sizes below are my judgments, not acceptance requirements.

The closest work is:

- [Generative Agents, Park et al. (UIST 2023)](https://arxiv.org/abs/2304.03442): 25 agents using memory, reflection and planning; evaluated believability rather than authoritative-state fidelity across model sizes.
- [Generative Agent Simulations of 1,000 People (2024; revised 2026)](https://arxiv.org/abs/2411.10109): interview/survey-grounded individual simulations; predicts human responses rather than enforcing game-state consistency.
- [AgentSims (2023)](https://arxiv.org/abs/2308.04026): configurable sandbox for task-based agent evaluation; precedes Rumourtown’s benchmarking idea, without its particular reliability–cost study.
- [Project Sid (2024)](https://arxiv.org/abs/2411.00114): 10–1,000+ Minecraft agents developing roles, rules and culture; emphasizes emergent societies rather than inexpensive faithful dialogue.
- [Comme il Faut (AIIDE 2011)](https://ojs.aaai.org/index.php/AIIDE/article/view/12454): authored social rules and state; establishes that simulation-owned relationships and behavior are longstanding.
- [CASCADE (CHI 2026 Extended Abstracts)](https://arxiv.org/abs/2604.03091): code-governed social coordination with on-demand LLM interaction; **closest architectural overlap**, without Rumourtown’s proposed capacity/verification experiments.
- [Orchestrated Reality (2026 preprint)](https://arxiv.org/abs/2606.16014): canonical JSON world state with validated updates; transitions remain LLM-driven, unlike your deterministic social dynamics.
- [KNUDGE (2022/2023)](https://arxiv.org/abs/2212.10618): dialogue trees faithful to *The Outer Worlds* quests, personas and relationships; primarily dialogue generation rather than evolving epistemic state.
- [SASS, Ubisoft La Forge (NLP4ConvAI 2023)](https://aclanthology.org/2023.nlp4convai-1.11/): adaptive retrieval of character speech styles; industry precedent for persona-controlled generation, not factual guarantees.
- [Fixed-Persona SLMs with Modular Memory (2025 preprint)](https://arxiv.org/abs/2511.10277): local NPC models spanning DistilGPT-2, TinyLlama and Mistral, evaluating factuality and latency; **directly weakens “small models for grounded NPCs” novelty**.
- [Measuring and Controlling Persona Drift (2024)](https://arxiv.org/abs/2402.10962): measures conversational drift and proposes attention changes; evaluates instruction persistence rather than changing simulation-defined moods.
- [Lies, Deceit, and Hallucinations (CHI 2024)](https://www.mikeyin.xyz/files/chi2024.pdf): 29-player qualitative study distinguishing meaningful NPC deception from accidental errors; investigates perceived trust, not runtime model-size thresholds.
- [Symbolically Scaffolded Play (2025 preprint)](https://arxiv.org/abs/2510.25820): detective-game prompts and JSON/RAG scaffolding; finds role-dependent benefits and believability costs, without systematic capacity comparisons.
- [Open-Ended NPC Dialogue (CoG 2025)](https://ieeexplore.ieee.org/document/11114150/): 64 participants comparing static/rephrased/hybrid/open dialogue; measures engagement rather than state fidelity.
- [Known by the Machine (CHI PLAY 2026, accepted program)](https://programs.sigchi.org/chiplay/2026/program/content/265043): longitudinal NPC-memory/player-experience study; concerns relational presence rather than factual verification.
- [Small Language Models Are the Future of Agentic AI (2025)](https://arxiv.org/abs/2506.02153): NVIDIA position advocating specialized, heterogeneous agents; motivation rather than evidence for your task.
- [WebLLM (2024; revised 2026)](https://arxiv.org/abs/2412.15803): browser inference using WebGPU/WebAssembly; enables deployment but establishes no NPC reliability threshold.
- [Chuang et al. (NAACL Findings 2024)](https://aclanthology.org/2024.findings-naacl.211/): LLM opinion dynamics and prompted confirmation bias; models determine belief evolution rather than merely verbalizing it.
- [Hu et al. (2025)](https://arxiv.org/abs/2502.01450): rumor transmission across personas and network structures; studies propagation, not utterance faithfulness.
- [RumorSphere (2025/2026)](https://arxiv.org/abs/2509.02172): million-scale hybrid rule/LLM rumor simulation; selectively invokes LLMs for core agents, rather than verified player dialogue.
- [Pohl et al. (2026 preprint)](https://arxiv.org/abs/2607.28347): compares simulated belief updates against 391 humans; cautions against equating plausible agents with behavioral validity.
- [FActScore (EMNLP 2023)](https://aclanthology.org/2023.emnlp-main.741/): atomic-claim support against sources; useful metric foundation, without temporal character-specific knowledge.
- [RAGTruth (ACL 2024)](https://aclanthology.org/2024.acl-long.585/): human-annotated unsupported/contradictory generation; provides detector methodology rather than simulation ground truth.
- [FaithEval (ICLR 2025)](https://arxiv.org/abs/2410.03727): unanswerable, inconsistent and counterfactual contexts; closely motivates tests of faithful false beliefs.
- [FrugalGPT (2023; TMLR 2024)](https://lingjiaochen.com/papers/2024_FrugalGPT_TMLR.pdf): learned answer scoring and cost-sensitive cascades; your cascade alone is established.
- [RouteLLM (ICLR 2025)](https://arxiv.org/abs/2406.18665): preference-trained selection before generation; differs from checking generated replies against state.
- [AutoMix (NeurIPS 2024)](https://arxiv.org/abs/2310.12963): self-verification and confidence-based escalation; a particularly important cascade baseline.
- [Unified Routing and Cascading (ICML 2025)](https://proceedings.mlr.press/v267/dekoninck25a.html): jointly optimizes selection and escalation; makes quality estimation central.
- [Ask Your Advisor (October 2026 preprint)](https://arxiv.org/abs/2610.13870): learned consultation during agent workflows; extends escalation beyond initial task routing, without your epistemic oracle.

**The defensible gap** is a reproducible evaluation of *selective generation under explicit epistemic constraints*: world truth, each character’s beliefs, provenance, uncertainty and authorized actions are independently inspectable. Measure how this boundary changes the smallest adequate model and the reliability–cost frontier. I found no verified identical study; that supports a qualified gap, not a “first-ever” claim.

Crucially, a villager faithfully repeating a false rumor is **not hallucinating**. Evaluate fidelity to their permitted belief state separately from truth in the world.

Venue fit and timing:

| Venue | Submission timing | Evidence I would target |
|---|---|---|
| **AIIDE / IEEE CoG: strongest first-paper fit** | 2027 unverified; planning estimates June / March, based on [AIIDE 2026](https://sites.google.com/view/aiide2026/calls/call-for-papers) and [CoG 2026](https://register.cog2026.org/?id=1&seccion=informacion&subSeccion=contenido). | Strong technical baselines, reproducible scenarios, ablations; human study if claiming player benefits. |
| **CHI PLAY** | 2027 unverified; approximately February, following the [2026 organizer announcement](https://www.linkedin.com/posts/chiplay_chiplay2026-chiplay-sigchi-activity-7424446574656757760-44W-). | Powered player comparison; provisionally 48–72 counterbalanced participants, plus interviews. |
| **ACL** | **[4 January 2027 ARR deadline](https://2027.aclweb.org/calls/main/)**. | Public benchmark, rigorous annotation, multiple families, routing baselines and statistical uncertainty. |
| **TMLR / NeurIPS** | [TMLR rolling](https://jmlr.org/tmlr/faq.html); NeurIPS 2027 unverified, roughly May anticipated. | Generalizable findings across tasks/domains; a game implementation alone is unlikely sufficient. |

[CHI 2027](https://chi2027.acm.org/Authors/Papers/), [AAAI-27](https://aaai.org/conference/aaai/aaai-27/submission-instructions/) and [ICLR 2027](https://iclr.cc/Conferences/2027/AuthorGuidelines) main-paper deadlines have passed. No venue has a universal human-study minimum.

The three biggest validity threats are:

1. **Wrong construct or circular scoring.** Culprit identification measures reasoning/game completion, not voicing fidelity. Separate these outcomes; audit free-text claim extraction and verifier false accepts with blinded human annotations. Report completeness/abstention to prevent silence winning.
2. **Confounded size and inflated sample size.** Training, quantization, prompting and routing coverage can explain differences. Use matched families/settings, repeat seeds, report generated-only and overall results, and cluster uncertainty by story/session—not individual messages.
3. **Synthetic-world generalization.** Deterministic rules provide computational ground truth, not validated human psychology. Document behavioral assumptions, vary rules/topologies, hold out story mechanisms, and test actual players.

**Proposed title:** *Rumourtown: The Cost of Faithful NPC Dialogue with Simulation-Owned Beliefs*

Proposed abstract—150 words, describing planned work:

> Language models can make game characters conversational, but fluent dialogue can contradict the world those characters inhabit. We propose Rumourtown, a browser game with 36 villagers whose beliefs, information provenance, moods, relationships, and actions are maintained by a deterministic social simulation. Language models verbalize character state; an orchestrator answers supported requests directly and reserves generation for open conversation. We investigate how model capacity, grounding, routing, and verification affect reliability and deployment cost. A controlled evaluation compares small, medium, and large open models, browser inference, and a cascade that escalates responses failing factual verification. Tests distinguish world truth from character belief and measure unsupported claims, provenance errors, persona consistency, action execution, interpretation accuracy, and injection resistance. We report latency distributions and cost alongside reliability, supported by blinded human assessments of dialogue and play. The study targets reproducible evidence about the smallest adequate model under explicit reliability constraints, rather than universal thresholds.

The minimum credible experiment set:

- **Core factorial:** three sizes × grounding on/off × always-model/orchestrated, sharing identical scenarios. Add browser deployment and one second-family replication.
- **Baselines:** deterministic templates; grounded 70B; constrained fact-to-text; learned routing; AutoMix-style cascade; state-verified cascade; oracle escalation. Include verifier and rejected-generation overhead.
- **Test set:** provisionally ≥50 held-out stories, three decoding seeds, short/long conversations; false premises, corrections, provenance chains, ignorance, action paraphrases and injection attacks. Keep tuning stories separate.
- **Measurement:** all proposed metrics, verifier precision/recall, escalation rate, useful-answer coverage, p50/p95 latency, memory and cost/100 messages; browser download/cold-start and device costs separately.
- **Validation:** ≥500 stratified outputs independently double-annotated; agreement and adjudication. Use paired story-level intervals or hierarchical models, effect sizes and multiplicity correction. Preregister reliability/noninferiority margins; power the player study around them.

Your 12-story pilot motivates this design; it cannot establish a general capacity threshold.