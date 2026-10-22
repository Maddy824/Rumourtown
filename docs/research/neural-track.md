# The neural track: locate, intervene, freeze

Merged on 22 October 2026 from two independent designs and their cross-reviews (`agent-tradeoff/reports/38-neural-codex.md`, `38-cross-review-codex.md`, `38-cross-review-controller.md`). A design, not a result. Metrics follow `methods-formal.md`: $F$, $A$, $U$, $Q = FU$, act-macro $\bar Q$ and $\bar F$, over-abstention $O$, opportunity-based leakage $\mathcal{L}_K$; never $1 - F$ as leakage, never a product of marginal means.

## Three questions

1. **Locate.** Is the knowledge boundary (claim in the speaker's ledger or not) linearly readable inside the base model, at which layer, and does act-filtered tuning move the representation or only the readout that turns it into speech?
2. **Intervene with frozen weights.** Can a single direction added at inference shift the boundary, and does the curve it traces match the curve that training on the data mixture $\mu$ traces?
3. **Mechanism.** Is leakage on unseen stories dependence on the distractor span, and does it come with large policy drift?

The honest limit, stated once: probes show readable information, interventions show behavioural use, and freezing shows where capacity matters; none identifies a unique circuit. The track is secondary to the formal study and inherits its audit and confirmation rules.

## 0. Measurement contract

Checkpoints: Qwen3-0.6B base, act, verifier-only and unfiltered adapters from the screening run; Llama-3.2-1B and 3B base and act. Within any contrast the weights, tokenizer, chat template, precision, token cap and non-thinking setting are identical; the MLX base is compared with its adapter loaded, and fusion equivalence is checked separately. Screening numbers are exploratory until re-scored by the locked Phase 0 scorer.

Prompts are rebuilt exactly as `messagesFor` renders them (persona, effective ledger via `factsFor`, marked distractors, revisions, history, utterance, chat suffix), with byte-to-token span maps for every part. Gold, world truth and oracle labels stay in an evaluator sidecar that never enters a prompt. Development set: 2,000–4,000 prompts in matched pairs (knowledge present or absent for the same question; deletion, correction, teller and null pairs), balanced over bands, acts and distractor exposure, with length and mention confounds logged. Root seeds partition everything before pairs are formed; fitting, selection and confirmation roots are disjoint; stories and wording families are held out as in the formal study. Intervals: paired root-cluster bootstrap, 10,000 replicates, crossed with training-run resampling where runs are repeated. Audit: the formal two-person blinded audit covers steered, masked and tuned outputs.

## 1. Probes: where the boundary lives

**States.** Residual stream after each block $l = 1 \dots L$ (embeddings and the final normalised state as labelled controls), at three positions: (i) the last prompt token including the assistant suffix (primary; it predicts the first reply token), (ii) the mean over the final utterance tokens, (iii) the position *before* the first generated claim token (descriptive; claimless replies are missing and their rate is reported).

**Labels and probes.** Claim-in-ledger $y_K$ (binary; faithfully held false beliefs count as known); confidence band (multinomial over four bands; absent claims are N/A); gold act (multinomial over seven); entitlement $y_E$ among known claims (bank, later). $L_2$ logistic regression with the regulariser chosen by nested root-group folds (five outer, inner over $C \in \{10^{-3}, \dots, 10\}$), scalers fitted on fitting roots only, all descendants of a root in one fold. Score: AUROC (macro one-versus-rest for multinomial) with root-bootstrap intervals; fold variation and refit uncertainty reported separately.

**Controls.** Structure-preserving label permutation; uncontextualised embeddings; utterance-only and bag-of-token features; explicit-field readers. The last can be perfect, because the ledger is rendered in the prompt: decoding membership is not evidence of an epistemic module. The informative tests are aliases, paraphrases and template-held-out pairs, which separate relational integration from literal matching.

**Emergence layer.** On development roots, the earliest $l$ beginning a run of three consecutive layers with AUROC $\ge 0.80$ and a simultaneous root-bootstrap lower bound above 0.50 against the permutation null; N/A if absent; reported as $l/L$ with sensitivity at 0.75, 0.85 and 0.90; frozen before confirmation.

**Base against tuned.** Linear CKA per layer on identical rows and positions, column-centred: $\mathrm{CKA}_l = \|X_l^\top Y_l\|_F^2 / (\|X_l^\top X_l\|_F \|Y_l^\top Y_l\|_F)$, with identical-checkpoint, permuted-row and sample-size controls and an unbiased-HSIC sensitivity. Transfer probes base to tuned and back with the source scaler, weights and intercept frozen, scored by AUROC and log loss (intercept shifts are invisible to AUROC), against within-checkpoint refits as the ceiling. CKA is rotation-invariant and a fixed probe is not, so CKA near one can coexist with failed transfer when a small task subspace moves.

**Hypotheses and readings.**
- H1: $y_K$ becomes readable in the middle third of the base model. Reading if false: the boundary is not linearly represented before tuning.
- H2: tuning leaves early-layer CKA high and lowers it late. Reading: representational change localises late; it does *not* by itself establish a changed readout, because late blocks compute representations too.
- H3: on unseen stories the tuned model's refitted $y_K$ AUROC is unchanged while it leaks. Reading: linear accessibility is preserved and the failure is in use; falling AUROC means lost accessibility (not erased information); transfer failure with recovered refits means changed coordinates. Causal use is tested by the steering rescue and by matched-pair activation replacement, with the caveat that an intervention may use an alternative route.

## 2. Steering with frozen weights

**Direction.** On fitting roots, over matched ledger-edit pairs with equal weight: $\delta_l = \mathbb{E}[h_l \mid K = 1] - \mathbb{E}[h_l \mid K = 0]$, $v_l = \delta_l / \|\delta_l\|_2$, $s_l = \mathrm{SD}(v_l^\top h_l)$ on the balanced fitting set; a probe direction as comparator, with standardised-feature weights mapped back through the inverse feature scales before normalisation. Orientation fixed on fitting data (towards known); zero directions skipped. Each checkpoint gets its own direction; applying the base direction to the tuned model is a separate transfer test.

**Injection.** $h'_{l,t} = h_{l,t} + \alpha s_l v_l$, added once after block $l$ at the last prompt position and every decode position, so the first decision is affected; caches rebuilt per condition; $\alpha = 0$ must reproduce uninstrumented logits. A first-decision-only variant is compared on development. Controls: fixed-seed random directions of matched norm, and fluency, length, error and latency logging. No oracle, gold or fact lookup at inference.

**Grid and selection.** $\alpha \in \{-3, -2, -1, -0.5, 0, 0.5, 1, 2, 3\}$ in units of $s_l$; development-only candidate layers $\{l^\star - 2, l^\star, l^\star + 2, \lfloor L/2 \rfloor, \lfloor 3L/4 \rfloor\}$ (clipped, deduplicated, N/A fallback); one layer and direction chosen by maximum $\bar Q$ subject to development-frozen faithfulness, leakage and error guards, ties broken by smaller $|\alpha|$ then the shallower layer; retained at zero if nothing qualifies. Greedy decoding first; same-temperature coupled sampling as sensitivity.

**Curves.** $\bar F(\alpha), \bar Q(\alpha), O(\alpha), \mathcal{L}_K(\alpha)$ with $\bar U$, coverage, errors and latency, per split; non-dominated points in $(\bar Q, \bar F)$ form the empirical frontier. Frozen weights prevent parameter change, not behavioural damage: steering can alter fluency, length, source accuracy and act completion, which is why all outcomes are reported, not only $O$ and $\mathcal{L}_K$.

**Comparison with training.** The residual-mixture arms $w_\mu = R[A + \mu(1 - A)]$, $\mu \in \{0, 0.5, 1\}$, from the confirmation round give the training curve on the same probes. A monotone mapping $\alpha(\mu)$ is fitted on development propensities and its predictions for all four outcomes are tested on confirmation roots and stories with simultaneous equivalence margins (provisional $\pm 0.02$ absolute). Steering of the $\mu = 0$ adapter is the rescue test: can a direction restore faithfulness that act-filtered training eroded?

**A limited shared-latent model.** For a binary factual request ($K = 1$ warrants an answer, $K = 0$ warrants withholding) with answer probability $\sigma(s_K + b)$, where $s_1 > s_0$ are knowledge scores and $b$ a decision intercept, and under the restriction that known answers succeed, unknown answers leak and withholds are faithful: $O = 1 - \sigma(s_1 + b)$, $\mathcal{L}_K = \sigma(s_0 + b)$, so $\operatorname{logit}(1 - O) - \operatorname{logit}(\mathcal{L}_K) = s_1 - s_0$, an invariant that any pure intercept intervention must respect. If mixture fitting changes only the intercept with residual-to-withhold ratio $\rho$, then $b_\mu = b_0 - \log(1 + \rho\mu)$; if a local linear readout of steering gives $b_\alpha = b_0 + \kappa\alpha$, then $\alpha(\mu) = -\log(1 + \rho\mu)/\kappa$ predicts the same outcome curve under a different parametrisation. Only $(s_1 - s_0, b)$ are identified, not the underlying scores. The assumptions are strong (residual targets need not be literal abstentions; $\rho$ may vary by story; training may change the scores; probe directions may change $s_1 - s_0$ rather than $b$), so the invariant, the per-prompt propensity slopes and the held-out mapped outcomes are tested, and the model is rejected if they fail; the empirical curve comparison stands either way.

**Hypotheses.** H4: negative $\alpha$ lowers $\mathcal{L}_K$ and raises $O$ monotonically on both splits. H5: the mapped steering and training outcomes agree within the margins on confirmation (reading: the learned skill is an intercept shift the base already encodes); dominance of training at equal leakage, or non-monotone curves, rejects the shared-control account and measures what training adds.

Precedents, not novelty: contrastive activation addition, representation engineering, inference-time intervention. The contribution is state-verified outcomes and the paired comparison with a training curve on the same held-out stories.

## 3. Freezing: where the skill is implemented

**Grid on Qwen3-0.6B** ($L = 28$, blocks 1–14 bottom, 15–28 top): placement {attention q, k, v, o; MLP gate, up, down; both} × layers {all, bottom half, top half} × rank {4, 16}, 18 factorial cells; plus norm-only (the saved models have bias-free linears, so the BitFit analogue trains RMSNorm scales: 65,536 parameters), output-only low-rank deltas on the logits at ranks 4 and 16 with the tied embedding frozen on the input path, and the historical all-layer attention rank-8 reference: 22 runs, then two development-selected cells repeated with seeds 17 and 29 (26 runs). Frozen base is the zero-update comparator.

**Mechanics.** mlx-lm 0.32's `num_layers` selects the *top* blocks, so bottom-half cells use explicit module paths; trainable tensor names and counts are asserted from a manifest before each run. A linear with dimensions $d_{\text{in}}, d_{\text{out}}$ contributes $r(d_{\text{in}} + d_{\text{out}})$; Qwen's q projection is 2048 wide against a hidden size of 1024, so counts are read from tensors, not assumed square. All-layer counts: attention 1,146,880 (r4) / 4,587,520 (r16); MLP 1,376,256 / 5,505,024; both 2,523,136 / 10,092,544; output-only 611,840 / 2,447,360; half-depth cells are half of these.

**Training.** Same act set, tokenisation, ordered minibatches (batch 4), optimiser, learning rate $10^{-4}$, dropout 0.05, masked prompt loss, MLX scale 20 ($\Delta W = 20AB$, PEFT alpha $20r$, held so rank is not confounded with scaling), and a fixed update count equal to two epochs; no per-cell early stopping or learning-rate search; loss and update norms published to detect failed optimisation.

**Outcomes and hypotheses.** Per cell: $\bar Q, \bar F, \bar U$, leakage on fresh-seed and held-out-story splits, trainable count, and positive erosion $E_{\text{stories}} = \bar F_{\text{base}} - \bar F_{\text{cell}}$. H6: $E_{\text{stories}}$ increases with trainable MLP parameters while familiar-story $\bar Q$ saturates (rank 16 minus 4 within a $\pm 0.02$ margin). H7: attention-only cells erode less than MLP or both at matched depth and rank. H8: top-half cells change act behaviour more than bottom-half cells. H9: an output-only gain with stable knowledge-probe transfer supports the accessible-boundary, changed-readout account. Tests: Spearman and tie-adjusted Kendall $\tau_b$ across the 18 cells, recomputed under one shared root resample (cells share prompts and base, so independent-cell $p$-values are inappropriate); pre-specified paired contrasts with Holm within the family; one-seed grid associations labelled exploratory; only the repeated cells support training-run claims. Count is confounded with placement and capacity, so a parameter-specific causal claim needs a matched-budget follow-up.

**Selection of the repeated cells.** On development, the largest story-erosion contrast among cells with familiar-story $\bar Q$ within 0.02 of each other, ties broken by fewer parameters; if none qualifies, the $\bar Q$ winner and the least-eroding cell above a usefulness floor, labelled unmatched.

## 4. Mechanism: does leakage depend on the distractor span?

**Attribution.** For each oracle-labelled unknown-to-speaker sentence and each supported sentence on the same prompts, align the factual token span; when token $j$ is predicted the query is position $j - 1$. Per head and layer, mean attention mass onto the distractor span $m_D$ and the ledger span $m_L$, reported raw, per span token, and as $\log[(m_D/|D| + \epsilon)/(m_L/|L| + \epsilon)]$ with $\epsilon = 10^{-8}$; the target-matching distractor fact separated from the whole section, likewise for the ledger. Comparisons are matched on fact identity, span length, distance, position in the reply and sentence length, with root-clustered intervals and held-out head selection. Attention mass is descriptive; it is not a contribution measure.

**Causal test.** Block distractor keys at $-\infty$ before softmax for every later query, during prefill and decode, positions and causal masks preserved, cache rebuilt, reply regenerated; a decode-only variant separates immediate retrieval from prompt-stage transport. Controls: no-op mask; twenty fixed-seed random key spans of equal token count in matched position ranges (excluding ledger, distractor and special tokens); equal-length content replacement; and, if heads are ablated, the top 5% of heads by development distractor preference (frozen list, GQA mapping recorded) against equal-count random heads, zeroing per-head value-weighted outputs before the output projection. Primary statistic on all fixed leakage opportunities: $S_L = (\mathcal{L}_{\text{mask}} - \mathcal{L}_0) - \mathbb{E}_c(\mathcal{L}_{\text{random},c} - \mathcal{L}_0)$, with $S_Q$, $S_U$, coverage, faithfulness and over-abstention alongside. H10: $S_L < 0$ beyond the random controls with $S_Q$ near zero on answerable prompts. Reading: leakage depends on the distractor span, and a mask is a cheap defence; it is not proof of literal copying unless content swaps make leaked content track the replacement. A $Q$ drop under masking means generic disruption, not that "the same heads carry the ledger".

## 5. Drift and erosion

Cache the base model's greedy continuation $y^b$ once per prompt (fixed cap, EOS included if generated); teacher-force it into both models and compute, with full-vocabulary FP32 log-softmax in chunks,

$$D_i = \frac{1}{T_i} \sum_{t=1}^{T_i} \sum_{v} p_b(v \mid x, y^b_{<t}) \log \frac{p_b(v \mid x, y^b_{<t})}{p_t(v \mid x, y^b_{<t})},$$

an unsigned conditional divergence on greedy-base prefixes (not a sequence KL). Regress signed paired $\Delta F_i \in \{-1, 0, 1\}$ on $\log(1 + D_i)$, a story indicator and its interaction, act, baseline length and knowledge-exposure indicators, with root (and run) cluster intervals, on all rows of each split and never conditioned on tuned failure. H11: story-split drift exceeds seed-split drift for the act adapter, with a more negative drift–faithfulness slope, and the verifier-only adapter drifts less on stories. Association, not mediation: large drift can improve behaviour, and a tiny drift can flip a near-tied decision.

## 6. Calibration geometry

At a controlled, target-specific reply stem, tokenizer-specific disjoint first-token sets for assertion, hedge and deny/withhold, frozen on development, give $P_A, P_H, P_D$ and the uncovered mass; complete multi-token alternatives are scored through a prefix trie so a shared prefix is not counted twice. Plot the three masses and $\log[(P_A + \epsilon)/(P_H + \epsilon)]$ against the ledger band of the queried claim (doubt can license denial, so assertion-versus-hedge alone is incomplete), known-absent cases shown separately. Policy calibration: $q = P_A / (P_A + P_H + P_D)$ and $g = 1$ when the formal confidence rule warrants an unqualified assertion; ten fixed bins; $\mathrm{ECE}_{\text{policy}} = \sum_b (n_b/n)\,|\bar q_b - \bar g_b|$ with Brier score and bin counts. This is agreement with the evidence-to-speech rule on the covered alternative set, a nominal band-alignment gap, not calibration of world truth.

## 7. Order of work and compute

Frozen interventions before the grid: a transferable probe plus a successful steering rescue would answer the readout-versus-representation question more cheaply than another training sweep. Planning ranges for one M4 Max, sequential, to be replaced by measured prefill and decode rates in step 0.

| Order | Work | Machine hours |
|---|---|---:|
| 0 | Lock exports and splits; validate prompts, spans, no-op logits and cache equivalence on 100 prompts; measure throughput | 0.5–1 |
| 1 | About 3,000 Qwen prompt states for base, act and verifier adapters; probes, CKA, transfer, base-prefix KL, band diagnostics; freeze emergence and candidate layers | 2–5 |
| 2 | Steering screen on 256 development prompts; selected-layer nine-$\alpha$ curves on about 1,000 fresh probes with rescue and random-direction controls; 200–500 attention cases with staged masks and content swaps | 4–10 |
| 3 | 22-run Qwen grid plus four repeats; common evaluation; repeated cells confirmed on untouched roots and stories | 13–26 |
| 4 | 3B residual mixture (three $\mu$ × three seeds) and two selected placements × three seeds; mapped steering-versus-training comparison at matched leakage budgets | 28–33 |
| 5 | 1B replication on existing checkpoints; selected 3B probe, steer and mask checks; crossed bootstrap; audit reconciliation | 4–8 |

Total 51–83 machine hours of free local compute, plus 23–38 hours of harness and analysis implementation. A method that clears no audited usefulness and leakage guard is a valid negative result and is reported as such.

## 8. What the harness must implement (MLX, no new dependencies)

- Reproduce `factsFor` and `messagesFor` byte for byte with the chat suffix; keep ids, root, pair, story and act metadata and byte-to-token maps for every prompt part and generated claim; evaluator sidecar separate; hashes of model, data, tokenizer, config and source; resumable, duplicate-free rows compatible with `rescore.ts`.
- Capture embeddings, post-block residuals, final-normalised states and the specified positions; pooled states only; grouped scaling and fitting, multiclass probes, structured permutations, CKA, frozen-scaler transfer; manifests of fits and missing classes.
- Mean and probe directions with inverse-scale mapping, saved projected SDs, fixed orientation; post-block injection at the last prompt and decode positions, first-decision-only mode, activation replacement, cache rebuild, matched-norm random directions; fluency, length and error logs; frozen-weight checksums and zero-steering equivalence checks.
- A slow attention path reconstructing RoPE, Qwen q/k normalisation and grouped-query attention, validated against the fused path on prefill and cached-decode logits and greedy outputs; online span-mass reduction; pre-softmax masks for prefill and decode; content swaps; per-query-head output ablation before the output projection; no archiving of full attention tensors.
- Cached base continuations and chunked full-vocabulary FP32 conditional KL; tokenizer-specific alternative sets and trie likelihoods with uncovered mass; EOS and truncation preserved; deterministic or coupled decoding seeds; error-inclusive denominators.
- Grid runner: explicit module manifests for top, bottom and all; ranks; norm-only and untied output-delta controls; assertions on trainable counts and frozen input embeddings; fixed data order, updates and scale; loss, update norms, memory and timing exports; root- and run-cluster-ready summaries.

## Sources

Panickssery et al., contrastive activation addition, arXiv:2312.06681. Zou et al., representation engineering, arXiv:2310.01405. Li et al., inference-time intervention, arXiv:2306.03341. Hewitt and Liang, probe control tasks, EMNLP 2019. Kornblith et al., CKA, ICML 2019. Hu et al., LoRA, arXiv:2106.09685. Ben-Zaken et al., BitFit, arXiv:2106.10199. Jain and Wallace, attention is not explanation, NAACL 2019. Guo et al., calibration, ICML 2017. mlx-lm 0.32.2 sources (`models/qwen3.py`, `tuner/utils.py`).
