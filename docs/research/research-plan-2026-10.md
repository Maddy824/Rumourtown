# Research plan: useful within bounds (October–November 2026)

Merged from two independent reviews written on 22 October 2026 (`agent-tradeoff/reports/30-strategy-controller.md` and `agent-tradeoff/reports/30-strategy-review.md`; the second includes a live literature search with 28 sources). Where they disagreed, the reasoning for the choice is given here.

## The paper in one paragraph

Small language models can voice agents cheaply, but an agent must say only what it knows, say it with the right confidence and source, still be useful, and treat instructions inside its inputs as data. We build a controlled benchmark from a deterministic simulation, where every claim's truth, every agent's belief, confidence and direct source are known. We use it to show that a verifier which only checks "not wrong" buys faithfulness with silence, to measure whether act-aware filtered distillation into 0.6–3B models improves useful, in-bounds answers on held-out seeds and held-out stories (or fails in an interpretable way), and to test transfer to a second synthetic domain, a bank, where knowing a fact and being allowed to say it are different things.

Working title: *Useful within bounds: measuring and training small language-model agents to answer from what they know.*

## What we will not claim

- Not "first" at knowledge-boundary training, verifier-filtered distillation, asymmetric-information agents or paired abstention tests. Close prior work: RoleMRC, ERABAL, TimeChara, CHARM, Muses-Bench, CoPriva, Ground-GRPO, AgentAbstain, ReST-EM, "Truth for believable AI" (links in the review).
- Not that two withheld story families measure "mechanism" generalisation in general. They are two withheld stories.
- Not banking readiness, privacy or compliance from a synthetic bank.
- Nothing about player experience without a player study.

The defensible contribution is the controlled, audited measurement, the anti-silence finding, and whatever the training and transfer results are, including negative ones.

## Key distinction (from the review, adopted)

**Epistemic fidelity** asks whether the agent says only what it knows. **Authorization** asks whether this recipient may receive it. In the village they nearly coincide; in a bank they do not: a true, known fraud flag must still not be told to the customer. The bank extension therefore gets its own access oracle and a known-but-forbidden test, and village-trained adapters are not expected to have learnt permission-following.

## Phase 0: make the measurement valid (before any new experiment)

These fix problems both reviews found. All are code changes to the harness and oracle; results already collected are re-scored, not regenerated.

1. **World truth independent of belief.** Score claim-level world truth separately and publish the four cells (believed and true, believed and false, unknown and true, unknown and false), plus unanswered rates. Today a true statement the speaker does not know fails both scores.
2. **No credit for omission.** Provenance: required-source coverage and exact direct teller, scored separately; a missing source fails when one was asked for. Calibration: "not applicable" when no claim was made, not an automatic pass.
3. **Silence loses.** Report answerable coverage, unnecessary abstention, appropriate abstention, act-macro success and claim recall. An empty or chatter-only reply scores zero on an answerable request.
4. **Whole-seed splits.** Training and validation never share a simulation seed; checkpoints are chosen on validation only. The already-inspected test results count as exploratory.
5. **Minimal pairs.** A generator that holds state and question fixed and changes one thing: the speaker knows or does not, source A or B, confidence high or low, current or corrected belief. Pilot: 100 pairs per held-out split.
6. **Baselines that cost nothing.** Always abstain; deterministic state-to-text templates; a perspective-filtering prompt (SimToM-style); a few-shot grounded prompt.
7. **Speech-act check.** Widen the surface proxy where it is plainly wrong ("I am half sure" is a hedge), then calibrate it against the human audit.

## Phase 1: the overnight run becomes the screening run

The six adapters and the paired evaluation now running are kept as screening results with one seed. They answer "is anything there?", not the paper's question. Re-score them under phase 0.

## Phase 2: repair the training targets, then compare training with inference-time control

1. Act-balanced targets with at least 50 distinct training states per act, reporting shortfalls. Fill rare acts (name the source, hedge, refuse an injection) first with deterministic templates grounded in exact state, then with teacher samples only for the rare acts.
2. Count- and update-matched arms: unfiltered, verifier-only, verifier-plus-act, balanced. Screen on Qwen3-0.6B with one seed, confirm the best comparison on Llama-3.2-3B with three seeds, two epochs, validation-selected checkpoints.
3. Compare against inference-time control under the same candidate budget: first-passing best-of-4 and act-aware selection, and a small-to-large cascade on a capped subset.
4. Preference training (DPO) only after the audit, with rejected replies that are either unsupported or unnecessary refusals, and compared against continued supervised training for the same updates. No reinforcement learning in this round.

## Phase 3: the bank pilot

100 held-out bank pairs from independent seeds: customer A and B, posted, pending and reversed records, amended documents, direct-source provenance, advisory and research divisions behind a barrier, revoked entitlement, injected documents. Keep the fact core (id, text, confidence, source, world truth) and add recipient, access, status and version. Two tests: (i) entitlement filtering supplies only allowed evidence, and the question is whether the village skill transfers; (ii) mixed context with known-but-forbidden records, scored by the access oracle. Zero-shot village adapters first, before any bank training. Policies are synthetic and labelled as such; a banking practitioner's review is requested if available.

## Phase 4: credibility

- **Human audit.** The owner labels 200–250 outputs in the first fortnight; a second independent person is a prerequisite for publication. Blinded, stratified, with reported agreement and the oracle's precision and recall per label.
- **Large-model reference.** `llama-3.3-70b` on Workers AI, capped at 120 calls in total, at most 2,000 Neurons a day and only from quota the live game is not using. No OpenRouter spending for research.
- **Statistics.** Paired differences with cluster-bootstrap intervals over root seeds; a small prespecified family of primary contrasts with Holm correction; all axes reported, as exploratory.

## Owner decisions needed

1. A second annotator (a friend or colleague, about four hours).
2. Optionally, an hour from someone who knows banking operations, to sanity-check the synthetic bank's policies.
3. Whether to publish the benchmark and results openly on rumourtown.dev and GitHub when ready (recommended).

## Venues and timing

| Target | When | What it needs |
|---|---|---|
| ACL Rolling Review (full paper) | 4 January 2027 | Phases 0–4 complete, two raters, bank pilot |
| An ACL or EMNLP workshop | Next suitable deadline | Phases 0–2 and the audit pilot |
| AIIDE or IEEE CoG 2027 | Spring 2027 (dates to confirm) | The games framing; live-format adapter check |
| ACM IKDD CODS 2027 | About August 2027, if it follows 2026 | The bank extension as a data and applied contribution |

## Two-week schedule (23 October – 5 November)

| Dates | Work | Owner time |
|---|---|---|
| 23–24 Oct | Phase 0 code fixes (Codex), re-score the screening run, freeze definitions | 2 h review |
| 25–26 Oct | Minimal-pair generator and free baselines; first anti-silence results table | 2 h review |
| 27–30 Oct | Balanced targets and matched arms; 0.6B screen, 3B confirmation queued overnight | 1 h review |
| 29–31 Oct | Bank pilot generator, access oracle, zero-shot transfer run | 2 h review |
| 31 Oct–3 Nov | Owner labels 200–250 items; second rater if found | 6–8 h |
| 3–5 Nov | Three-seed confirmations, intervals, 70B subset; results write-up and venue decision | 3 h |

Compute is local and free. Every spending cap stays as it is.
