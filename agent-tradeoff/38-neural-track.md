# 38: The neural track: probe, freeze, steer

A thinking task. Do not edit code. Live web search is available: use it for citations. Do not read `docs/research/neural-track.md` (another reviewer's independent design, for later cross-review).

## Read first

`docs/research/methods-formal.md` (definitions of $F$, $A$, $U$, $Q$, leakage, the mixture $w_\mu$, the audit), `docs/research/finetune-study.md` (screening results: act-filtered adapters gained usefulness on new worlds and lost faithfulness on unseen stories), `bench/slm/finetune/train.sh` (LoRA rank 8 on q, k, v, o in every layer; mlx-lm), `bench/slm/strategies.ts` (how prompts are built: persona, rendered ledger, distractors, history, utterance), `bench/slm/README.md`.

## The owner's ask

"Dig deep into the maths and neurals, and maybe freeze and try stuff." The study so far treats the model as a black box that is trained and scored. This track opens it: where in the network the knowledge boundary is represented, what changes when an adapter is trained, whether the boundary can be moved at inference with frozen weights, and why leakage happens mechanically.

## Hardware and models

One M4 Max, 36 GB. Students: Qwen3-0.6B (28 layers, hidden 1024), Llama-3.2-1B, Llama-3.2-3B; MLX is the runtime (mlx-lm 0.32, with model internals accessible in Python). Existing adapters from the screening run are in `bench/slm/results/finetune/*/adapter`. Hidden states and attention for a few thousand prompts are cheap; a LoRA run on 0.6B takes about 20 minutes, on 3B about 90.

## What to produce

1. **Probing design.** For each layer $l$, a linear probe on hidden states for: claim-in-ledger (known vs unknown-to-speaker), entitlement (bank, later), confidence band, and gold act. Specify the token positions used (last prompt token; mean over the utterance; the first token of the generated claim), the probe (logistic regression with cross-validation over root seeds, not over probes), the metric (AUROC, with a seed-clustered interval), and the derived quantity "boundary emergence layer". Then representational comparison base against tuned: linear CKA per layer, and a transfer test (does a probe trained on the base read the tuned model, and vice versa). State hypotheses and what each outcome would mean.
2. **Steering with frozen weights.** Mean-difference (contrastive activation addition) directions $d_l = \bar h_l^{\text{known}} - \bar h_l^{\text{unknown}}$ and, for comparison, a probe-weight direction; added at layer $l$ with coefficient $\alpha$ during generation. Specify normalisation, the layer-selection rule, the $\alpha$ grid, and the outcome curves: $F$, $Q$, over-abstention and leakage as functions of $\alpha$, as a frontier to be compared with the training-side frontier traced by $\mu$. State the mathematical relation you expect between the two frontiers and how to test it. Cite the steering literature (contrastive activation addition, representation engineering, inference-time intervention) and say exactly what is new here (the state-verified outcome and the comparison to training) and what is not.
3. **Freezing ablations.** A LoRA placement grid: attention only, MLP only, both; all layers, top half, bottom half; rank 4 and 16; plus bias-and-norm-only (BitFit-style) and a readout-only control. Equal data (the act set), equal updates, one training seed for the grid, three for the two most informative cells. Outcomes: $Q$ and $F$ on held-out seeds and held-out stories, trainable-parameter count, and the erosion $\Delta F_{\text{stories}}$. Hypotheses to pre-register, for example that erosion on unseen stories increases with trainable MLP parameters while usefulness on seen stories does not, and that attention-only adapters erode less. Say how to test them (ordinal association across cells with cluster intervals).
4. **Mechanism of leakage.** For sentences the oracle labels unknown-to-speaker, attention mass from the generating positions onto the distractor span against the ledger span, by layer and head, compared with supported sentences; then a causal test: at inference, mask attention to the distractor span (or ablate the top distractor-attending heads) and measure the change in leakage and in usefulness. Specify the attribution measure, the control (random spans of equal length) and the statistic.
5. **Drift and erosion.** Per-example $\mathrm{KL}(\pi_{\text{base}} \,\|\, \pi_{\text{tuned}})$ on the base's own greedy continuation, on held-out seeds and stories; regress the faithfulness change on drift with root-seed clustering; state the hypothesis that story-split erosion is accompanied by larger drift than seed-split gains.
6. **Calibration geometry.** Relation between the ledger's confidence band and the model's probability mass on asserting versus hedging tokens at the decision point; an expected-calibration-error style summary.
7. **Theory, where possible.** A simple generative model under which the mixture $\mu$ and the steering coefficient $\alpha$ act on the same latent "answer versus withhold" variable, giving a prediction for the shapes of the two frontiers; or, if no clean model exists, say so and propose the empirical comparison only.
8. **Compute plan and order,** with hours, and what Codex can build (an MLX probing and steering harness reading the public scenario and probe exports; the LoRA grid runner) versus what needs the owner.

Write it to `agent-tradeoff/reports/38-neural-codex.md`, under 220 lines, sentence case, no emoji, with URLs for every citation you opened. End your last message with a five-line summary.
