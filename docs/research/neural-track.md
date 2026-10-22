# The neural track: probe, freeze, steer

Draft of 22 October 2026, written independently of `agent-tradeoff/reports/38-neural-codex.md`; the two will be merged. Notation from `methods-formal.md`.

## Why open the model

The training results so far say *what* happened (act-filtered adapters answer more and leak more on unseen stories) but not *where* or *why*. Three questions, each with a frozen-weight experiment:

1. Where is the knowledge boundary represented, and does tuning move it or merely change the readout?
2. Can the boundary be shifted at inference, with no training, and does that trace the same frontier as training does?
3. Is leakage copying from the distractor span?

## 1. Probes: where the boundary lives

For a prompt $x$ whose utterance asks about claim $c$, let $h_l(x) \in \mathbb{R}^{d}$ be the residual-stream state at layer $l$ at the last prompt token (also tried: mean over the utterance tokens, and the state at the first generated token). Labels: $y_K = \mathbf{1}[c \in K_a]$ (known), $y_E = \mathbf{1}[c \in E_{a,r}]$ (entitled; bank only), the band $b_c$, and the gold act $g(x)$.

A logistic probe $p_l(y = 1 \mid h) = \sigma(w_l^\top h + b_l)$ is fitted per layer with $L_2$ regularisation, cross-validated over root seeds (all probes from one seed in the same fold). Report AUROC$_l$ with a seed-clustered bootstrap interval, and the **emergence layer** $l^\star = \min\{l : \text{AUROC}_l \ge 0.9\}$. Control: a probe on shuffled labels; a probe on a prompt that omits the ledger (what is decodable from the question alone, which bounds any "world knowledge" shortcut).

Base against tuned: linear CKA$_l$ between $H_l^{\text{base}}$ and $H_l^{\text{tuned}}$ on the same prompts; probe transfer (fit on base, test on tuned, and the reverse). Hypotheses: (H1) $y_K$ becomes linearly decodable in the middle third of the network in the base model, so the boundary is *represented* before tuning; (H2) act-filtered tuning leaves CKA high in early layers and lowers it in late layers, consistent with a changed readout rather than a changed representation; (H3) on unseen stories the tuned model's probe accuracy for $y_K$ is unchanged while its behaviour leaks, which would locate erosion in the readout, not the representation. Each outcome has a reading: if (H3) fails and probe accuracy also drops, tuning damaged the representation itself.

## 2. Steering: moving the boundary with frozen weights

Mean-difference direction at layer $l$: $d_l = \bar h_l^{\,y_K = 1} - \bar h_l^{\,y_K = 0}$, normalised to unit length and scaled by the per-layer activation norm $\sigma_l$; for comparison the probe direction $w_l / \|w_l\|$. During generation add $\alpha \sigma_l d_l$ to the residual stream at layer $l$ for every generated position (contrastive activation addition). Layer choice: the emergence layer and two layers above it. Grid $\alpha \in \{-3, -2, -1, -0.5, 0, 0.5, 1, 2, 3\}$.

Outcomes as functions of $\alpha$: $F$, $Q$, over-abstention $O$, epistemic leakage $\mathcal{L}_K$, on held-out seeds and stories. Prediction: negative $\alpha$ (towards "unknown") lowers $\mathcal{L}_K$ and raises $O$; positive $\alpha$ the reverse; the curve $(O(\alpha), \mathcal{L}_K(\alpha))$ is a frontier.

The comparison that matters: training traces a frontier $(O(\mu), \mathcal{L}_K(\mu))$ through the data mixture; steering traces $(O(\alpha), \mathcal{L}_K(\alpha))$ with frozen weights. If the two curves coincide to within their intervals, the skill the adapter learned is a one-dimensional shift the base already encodes, and deployment can use steering (no training, instantly reversible, no erosion by construction). If training dominates (higher $Q$ at equal leakage), the adapter adds something beyond a direction. Either result is a finding; the second also measures how much.

A simple latent model makes the prediction precise. Suppose at the decision point the model holds a scalar evidence score $z = u + \beta\,\mathbf{1}[c \in K_a] + \epsilon$ and answers when $z > \theta$. Steering adds a constant to $z$ (shifts $\theta$ effectively); training on mixture $\mu$ changes both $\theta$ and, through data, the slope $\beta$. Under this model the steering frontier is the ROC-type curve of a fixed classifier as its threshold moves, while training can rotate the curve. A test: fit the two-parameter (threshold, slope) model to each frontier; equal slopes with different thresholds means steering suffices.

Not new: mean-difference steering and representation engineering are established; probing for truth and knowledge directions is established. New here: the outcome is state-verified (faithfulness and act completion against a simulator-known ledger, not a judgement), and the direct comparison between an inference-time frontier and a training-time frontier on the same held-out stories.

## 3. Freezing: where the skill is implemented

A LoRA placement grid on Qwen3-0.6B with the act set, equal updates, one training seed:

| Modules | Layers | Rank | Trainable parameters |
|---|---|---|---|
| attention (q, k, v, o) | all / top half / bottom half | 4, 16 | reported |
| MLP (gate, up, down) | all / top half / bottom half | 4, 16 | reported |
| both | all | 4, 16 | reported |
| biases and norms only | all | — | smallest |
| readout only (final norm and head) | — | — | control |

Outcomes per cell: $Q$ and $F$ on held-out seeds and stories, and erosion $\Delta F_{\text{stories}} = F^{\text{cell}}_{\text{stories}} - F^{\text{base}}_{\text{stories}}$. Pre-registered hypotheses: (H4) erosion increases with trainable MLP parameters (Kendall's $\tau$ across cells, with seed-clustered intervals), while $Q$ on seen stories saturates early; (H5) attention-only adapters reach most of the usefulness gain with less erosion; (H6) the readout-only control recovers part of the gain, consistent with (H2). The two most informative cells (likely attention-all-r16 and MLP-all-r16) are repeated with three seeds and carried into the confirmation round if they beat the default.

## 4. Mechanism: is leakage copying?

For each generated sentence the oracle labels unknown-to-speaker, take the positions that produced its claim words and compute, per layer and head, attention mass $A_{\text{distractor}}$ onto the distractor span and $A_{\text{ledger}}$ onto the ledger span; compare with supported sentences on the same prompts. Statistic: the difference in $A_{\text{distractor}} - A_{\text{ledger}}$ between leaked and supported sentences, clustered by root seed, against a control using random spans of equal length. Causal test: regenerate with attention to the distractor span masked (or with the top-$k$ distractor-attending heads ablated) and measure $\Delta \mathcal{L}_K$ and $\Delta Q$. Prediction: leakage falls sharply under masking with little loss of $Q$ on answerable prompts, which would say leakage is copying and that an inference-time mask is a cheap defence; if $Q$ also falls, the same heads carry the ledger.

## 5. Drift predicts erosion

Per example, $D(x) = \mathrm{KL}\big(\pi_{\text{base}}(\cdot \mid x, y_{<t}) \,\|\, \pi_{\text{tuned}}(\cdot \mid x, y_{<t})\big)$ averaged over the base model's own greedy continuation. Regress $\Delta F$ (tuned minus base, per example) on $D$ with root-seed clustering, separately on seeds and stories. Hypothesis (H7): mean drift is larger on stories than on seeds for the act adapter, and within stories larger drift predicts faithfulness loss; the verifier-only adapter shows less drift on stories.

## 6. Calibration geometry

At the first generated token, the probability mass on assertion openings versus hedge openings (a fixed lexicon, validated on development data) against the ledger band of the queried claim. Summary: expected calibration error between the band's nominal confidence (sure 0.9, fairly sure 0.7, half 0.5, doubt 0.25) and the asserted mass, by model.

## 7. Compute and order

1. Hidden-state extraction for 3,000 probes × 3 models: about one hour. Probes and CKA: minutes.
2. Steering sweep: 9 $\alpha$ × 3 layers × 440 held-out probes × generation: about three hours on 0.6B.
3. LoRA grid: 14 cells × 20 minutes on 0.6B, plus 2 cells × 3 seeds: about six hours.
4. Attention attribution and masking: about two hours.
5. Drift and calibration: inference only, under an hour.

All local, all free. The probing and steering harness is a Python MLX module reading the public scenario and probe exports and writing rows the existing `rescore.ts` and the analysis code can score; the grid runner extends `train.sh` with module, layer and rank options.
