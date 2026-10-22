# 30: Research strategy, the controller's independent view (22 October 2026)

Written before reading the independent review (`30-strategy-review.md`), so the two can be compared. The merged plan goes in `docs/research/research-plan-2026-10.md`.

## The phenomenon worth owning

The most valuable thing the study has found is not "small models can be fine-tuned". It is **scope leakage**: a model speaking for one agent uses information that is *in its context* but is *not that agent's to use*. In Rumourtown the context carries other villagers' claims, corrected beliefs and the player's false premises. Before the provenance fix, Qwen3-0.6B was faithful only 45% of the time on the distractor axis: it adopted what others said as its own knowledge.

This differs from the usual faithfulness problem. In retrieval-augmented generation every retrieved passage is fair to use; the error is ignoring or contradicting it. Here some of the context is forbidden, so "use your context" is the wrong instinct. That is exactly the shape of the problems industry has:

- a customer assistant whose context holds other customers' records (multi-tenant leakage);
- agents on two sides of an information barrier sharing a workspace;
- a support agent who may see a fraud flag but must not reveal it;
- documents that carry instructions (indirect prompt injection), which are content, not commands.

Closest known prior work to check against: contextual-integrity privacy benchmarks such as ConfAIde (Mireshghallah et al., ICLR 2024) and PrivacyLens (2024) test whether models reveal private information that is in context. What we add: a simulator with ground truth for every claim, belief confidence and provenance, the split between faithful to the agent and true in the world, held-out mechanisms, and a training method, not only an evaluation. (To be verified against Codex's search.)

**Proposed framing:** *Scoped faithfulness: keeping small language-model agents inside what they are entitled to know.* Rumourtown is the controlled test bed; the method and the measurement are the contribution.

## Honest weaknesses today

1. **One oracle does everything.** It filters training data and grades results, so gains may be learning to please the oracle. It is rule-based and tuned on one domain.
2. **"Did what was asked" is a regular-expression proxy.** "I am half sure" is a correct hedge it misses.
3. **The teacher cannot show the rare acts.** Name the source 5%, hedge 8%, refuse an injection 5%. The tuned students will lean on abstaining.
4. **One domain, one teacher, one training seed, about 20 probes per axis.** Too thin for claims per axis.
5. **Silence can still win** in any metric that rewards only not being wrong.

## What would make it valuable, ranked

### 1. Fix the training signal with what we already have (days, no new generation)

The 12,800 scored samples already contain the contrast we need. For each probe they include replies that are faithful and on task, replies that are faithful but evasive, and replies that are unfaithful.

- **Preference training (DPO) with verifier-derived pairs.** Chosen: faithful and on task. Rejected: *faithful but evasive* first, unfaithful second. This directly teaches "not wrong is not enough", which supervised filtering cannot. It is a specific, testable claim: preference pairs that include evasive-but-safe rejections reduce over-abstention without raising leakage.
- **Fill the rare acts deterministically.** The simulation knows every belief's band and direct source, so correct "name the source" and "hedge" replies can be composed from state ("Mira told me this morning, but I only half believe it"). Mix a measured share into training and report the effect, including any stiffness of style.
- **A balanced condition.** Cap abstentions so each act is represented.
- **Three training seeds** per condition, two epochs (the validation minimum in all six runs).

### 2. An independent second judge and a human audit (credibility)

- Score a stratified sample with an independent large local model (the installed Qwen3.6, free) as a second judge. Report agreement with the oracle, and the headline results under both judges.
- Run the blinded audit tool on 300 to 500 items with the owner and at least one other person. Report the oracle's precision and recall per label. Without this no reviewer will trust the numbers.
- Replace the behaviour regex with a labelled speech-act classifier calibrated on the human audit, or at least widen it and validate it.

### 3. A second, synthetic domain: a bank (generality and industry value)

Same schema, new world: customers, accounts and transactions as "beliefs" with status as confidence (posted = sure, pending = half believe, disputed = doubt), the source system or document as provenance, other customers' and other divisions' records as forbidden context, true facts the agent is not entitled to (a fraud flag, a credit decision in progress) as unknown-to-speaker, and uploaded documents carrying injected instructions. The probe templates carry over (pressure, false premises, distractors, corrections, injections).

Three experiments, each a sentence in an abstract:
1. Baseline the same nine models on the bank. Is scope leakage worse with numbers, dates and accounts?
2. **Trained in a village, tested in a bank.** Do the Rumourtown adapters transfer zero-shot? Either answer is interesting: a transferable skill, or a domain-bound one.
3. Train on the bank and compare.

Needs: a generator, a bank lexicon and slot-based claim matching in the verifier (amounts, dates, statuses are easier to check than gossip), and the same harness. Risk: a synthetic bank is not a real bank; we say so, and the point is controlled ground truth that a real bank cannot give for red-teaming.

### 4. The benchmark as a public artifact

Release the scenarios, probes, oracle, harness and audit tool, with a results page on rumourtown.dev. A benchmark people can run is worth more to a CV than one paper, and it compounds: other people's results become citations.

## Metrics that stop silence from winning

Primary: **faithful and on task** (oracle-faithful and performs the gold act), with confidence intervals. Always report beside it: over-abstention (abstained when an answer was expected), leakage (unknown-to-speaker or forbidden-context claims), injection success, calibration, provenance accuracy, latency and cost per 100 replies. Show results as a frontier of leakage against helpfulness, not a single score.

## Rigour checklist

- Three training seeds; three decoding seeds where sampling is used.
- Confidence intervals by bootstrap clustered on scenario; paired tests (McNemar) for base against tuned; Holm correction across axes.
- At least 600 probes per held-out split for the headline numbers; per-axis results reported with their intervals, not as headline claims.
- Baselines: base model; grounded prompt; verifier best-of-n at inference; unfiltered, verifier-only and act-filtered supervised training; DPO; a large model (local Qwen3.6, and the 70B on Workers AI only if it fits the free allowance with the live game protected); deterministic templates as a floor.
- Contamination: training and test splits share probe templates; report a template-held-out split as well.
- Report the methodology failures we found (provenance bloat, out-of-character acceptance, placeholder copying) as lessons, not hidden fixes.

## Timeline and venues

- This week: finish the paired evaluation; DPO and rare-act conditions from existing samples; three seeds; second judge; the owner labels 200 items.
- Next week: the bank domain and the transfer experiment; a second annotator.
- Then: write up. ACL Rolling Review closes 4 January 2027 for a full paper; AIIDE and IEEE CoG for the games framing; an ACL or EMNLP workshop as the fast first publication. Dates for CODS-COMAD 2027 need checking before planning around it.
