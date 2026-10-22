# The neural track: locate, intervene, freeze

Research design, 22 October 2026. No experiments were run and no code was changed for this report. The independent `docs/research/neural-track.md` was not read. Inputs read: `methods-formal.md`, `finetune-study.md`, `train.sh`, `strategies.ts`, `bench/slm/README.md`, public export types, saved model configurations and installed MLX source.

## 1. Question and measurement contract

The central distinction is between losing a representation of the knowledge boundary and changing how an intact representation controls speech. A third possibility is a content-specific shortcut that works on familiar stories. Probing can distinguish readable information; frozen interventions and freezing ablations test its behavioural use. None alone identifies a unique circuit.

Screening motivates, rather than establishes, these hypotheses: Qwen's act adapter increased held-out-seed faithful-and-on-act replies from 30.9% to 69.5%, while held-out-story faithfulness fell from 70.9% to 53.6%. These are legacy, single-run screening measurements, not the formal primary endpoint. Reconcile and re-score the raw rows before interpreting them; the study's prose and tables contain inconsistent best-of figures.

Use the formal definitions throughout: raw faithfulness $F$, admissible act completion $U$, success $Q=FU$, act-macro $\bar Q$ and $\bar F$, over-abstention $O=\Pr(H\mid B)$, and opportunity-based leakage $\mathcal L_K=\Pr(MJ_K\mid K)$. Also show $\bar U$, answerable coverage, unanswered-answerable, errors and every numerator/denominator. Never substitute $1-F$ for leakage or multiply marginal means to estimate $Q$. In the bank add $Q_E$ and $\mathcal L_E$.

Start with existing base/act/verifier/unfiltered Qwen checkpoints, and base/act for both Llamas. Match underlying weights, tokenizer, chat template, precision, token cap and non-thinking settings within each comparison; compare direct MLX base with its loaded adapter, then check fusion equivalence separately. An Ollama-to-MLX difference is not an adapter effect. Keep old checkpoints as exploratory diagnostics.

Join scenario and probe exports by identifiers; use `factsFor(s,p)` to honour confidence/correction overrides. Render exactly `messagesFor`: persona, current ledger, explicitly untrusted distractors, revisions, history, utterance, then the model's chat suffix. Gold, world truth and audit metadata stay in an evaluator sidecar. Record byte-to-token span maps, including duplicate mentions and history. No appended gold act or knowledge label may enter generation.

Draw approximately 2,000–4,000 development prompts with balanced knowledge-present/absent pairs, four confidence bands, acts and distractor exposure. Balance entity/story/template and ledger length where possible; keep the queried proposition visible in both pair members. Include knowledge deletion, correction, teller and null pairs. Log residual length/mention confounds; use matched padding as a sensitivity analysis, not evidence that padding is neutral.

Partition by root seed before constructing pairs or variants. Training, probe fitting, hyperparameter/layer selection and confirmation roots are disjoint. Hold out whole story families, both polarities, aliases and indirect mentions, and separately wording families. Existing debt/nursing examples are already inspected exploratory holdouts; fresh stories are required for new confirmation. Report each story separately; two families do not support a population claim about stories.

Use paired root-cluster bootstrap intervals, 10,000 replicates, retaining every descendant of each selected root and recomputing ratio denominators and fixed act-macro means. For repeated training, cross a resample of training runs with one common root resample; publish run-level results because three runs give weak variance estimates. Condition on story families unless enough independent families are collected to resample them. This track is secondary to the formal study; freeze any new confirmatory family and multiplicity correction in advance.

Apply the formal two-person blinded audit to at least 500 distinct, stratified outputs, including steered, masked and tuned replies; retain inclusion probabilities and adjudication disagreements. Re-estimate endpoint-specific confusion for $F$, $Q$ and leakage as needed, with joint audit/root uncertainty and sensitivity analysis when correction is unstable. Apparent safety from errors, silence or oracle vocabulary tricks is not success.

## 2. Probes and boundary emergence

Extract the residual stream after each complete transformer block, before the next block's RMSNorm; also save embeddings and final-normalised states as separately labelled controls. Layer $l$ means completed block $l$, numbered 1 through $L$. Fit separate linear probes for each label and position:

| Label | Target and exclusions | Probe and score |
|---|---|---|
| Claim in ledger | Queried proposition is present in the effective speaker ledger, including faithfully held false beliefs; not whether world truth agrees | L2 logistic regression; binary AUROC |
| Confidence | Sure, fairly sure, half, doubt for the queried ledger entry; absent targets are N/A, never a fifth confidence value | Multinomial logistic regression; macro one-vs-rest AUROC and confusion matrix |
| Gold act | Seven formal acts, each computed from request and effective evidence | Multinomial logistic regression; macro one-vs-rest AUROC; report unsupported classes |
| Entitlement, later | Among known propositions, discloseable to this recipient versus known-but-forbidden | Binary logistic regression/AUROC; separately decode knowledge and permission |

Positions are (i) the last prompt token, including the fixed assistant-generation suffix, primary because it predicts the first reply token; (ii) mean residual over final-user-utterance tokens, excluding roles/special tokens; (iii) residual after the first token of the first oracle-matched generated factual claim, descriptive. For (iii), also save the preceding position, which predicts that token. Claimless replies are missing, with their rate reported; comparing only surviving claims otherwise creates selection bias. Teacher-force one common neutral claim continuation into both models as a separate alignment diagnostic, never as an outcome or inference input.

Fit feature centring/scales on fitting roots only. Use five outer root-group folds and inner root-group folds to select $C\in\{10^{-3},10^{-2},10^{-1},1,10\}$ by log loss, preserving class support; all descendants and pair sides stay together. Folds are over root seeds, not individual probes or training-run seeds. Refit on development fitting roots after selection and evaluate once on fresh roots/stories. Bootstrap AUROC by root; show fold variation and refit uncertainty separately from an interval conditional on a frozen probe.

Controls: label permutation at the matched-pair/root structure; uncontextualised embeddings; utterance-only and bag-of-token features; simple explicit-field readers for confidence and exact ledger membership. The last controls may perform perfectly because these are rendered inputs: decoding them is not evidence of a special epistemic module. Test aliases/paraphrases and template-held-out pairs to distinguish relational integration from literal matching. Probe selectivity and causal relevance are distinct concerns [4].

Define boundary emergence prospectively on knowledge pairs at the primary position: the earliest $l$ in a run of three consecutive layers with AUROC at least 0.80 and a simultaneous lower confidence bound above 0.50, using a root-bootstrap band over all layers and a structure-preserving permutation null. Report N/A if absent, and $l/L$ across architectures. Determine it on development roots; confirmation tests the frozen layers without searching again. This is an operational readability threshold, not the first place the network possesses knowledge; report threshold sensitivity at 0.75/0.85.

For identical prompt rows, centre base/tuned feature matrices $X_l,Y_l$ across examples and compute linear $\mathrm{CKA}_l=\|X_l^\top Y_l\|_F^2/(\|X_l^\top X_l\|_F\|Y_l^\top Y_l\|_F)$ [5]. Use the same position and balanced example weights, bootstrap roots, and compare against identical-checkpoint and permuted-row controls. Prefer prompt-only states and common teacher-forced continuations over different generated strings. High-dimensional finite-sample CKA can be optimistic; publish sample-size sensitivity and an unbiased-HSIC sensitivity estimate.

Transfer probes base→tuned and tuned→base without target refitting or target recentering: keep each source probe's scaler, coefficients and intercept fixed, and evaluate both target and source on identical fresh rows. AUROC tests ranking; add log loss/calibration to detect intercept shifts invisible to AUROC. Within-model refitted probes provide the ceiling. Cross-width probe transfer between model families is undefined without a separately specified alignment and is outside this design.

Pre-register interpretations: unchanged CKA and transferable knowledge decoding despite erosion favour altered readout/decision use; lower CKA plus failed transfer but recovered within-tuned AUROC favour a coordinate change; reduced within-tuned knowledge AUROC on new stories suggests lost linear accessibility or a story shortcut, not erased information. Changed act decoding with stable knowledge decoding favours policy movement. High CKA with failed probe transfer is possible when a small task-relevant subspace moves. No probe or CKA outcome alone demonstrates a causal boundary.

In bank mixed-evidence tests, knowledge is held fixed while recipient policy changes; only public recipient/permission information enters the prompt. Redacted-evidence tests separately assess the safer entitlement-filtered interface. A hidden forbidden record absent from all public inputs cannot be decoded as a known-but-forbidden item; do not manufacture an entitlement result from an inaccessible label.

## 3. Frozen steering and the training frontier

On fitting roots only, form matched pairs differing in target knowledge and average $d_l=\mathbb E[h_l\mid\mathrm{known}]-\mathbb E[h_l\mid\mathrm{unknown}]$, giving each pair equal weight and balancing content, band and act where feasible. Use primary last-prompt states; do not use generated-claim states to learn the primary direction. Fit each checkpoint's own direction; applying a base direction to tuned states is a distinct transfer experiment.

Let $v_l=d_l/\|d_l\|_2$ and $s_l=\mathrm{SD}(v_l^\top h_l)$ on the balanced fitting set. Inject $h'_{l,t}=h_{l,t}+\alpha s_lv_l$, so $\alpha$ is in baseline projected-standard-deviation units; save $\|d_l\|$, $s_l$ and residual RMS. Zero directions are skipped. For the logistic-weight comparator fitted on standardised features, map weights back as $v\propto\beta/\mathrm{SD}(h)$ before unit normalisation and use the same projected-SD convention. Orient both toward known on fitting data; positive need not mean better speech.

Add once after the chosen block at the last prompt position and every subsequent decode position, so the first reply decision is affected; leave earlier prompt positions untouched. Rebuild the KV cache per condition and record that later layers cache edited states. Compare this schedule with a development-only first-decision-only intervention. Set dropout off and verify $\alpha=0$ reproduces uninstrumented outputs/logits. No oracle-dependent sign, fact lookup or gold-dependent on/off switch is allowed at inference.

Evaluate $\alpha\in\{-3,-2,-1,-0.5,0,0.5,1,2,3\}$ for mean and probe directions. On development only, nominate layers $l_\ast-2,l_\ast,l_\ast+2,\lfloor L/2\rfloor,\lfloor3L/4\rfloor$, clipped/deduplicated; omit emergence candidates when N/A. Select one layer/direction by maximum $\bar Q$ subject to development-frozen faithfulness, leakage and error guards, breaking ties by smaller $|\alpha|$, then shallower layer. If none qualifies retain zero steering. Lock candidates, selection and grids before confirmation.

Draw split-specific curves $\bar F(\alpha),\bar Q(\alpha),O(\alpha),\mathcal L_K(\alpha)$ with paired intervals, plus $\bar U$, coverage, errors and latency. Plot nondominated points in $(\bar Q,\bar F)$ and usefulness/coverage against leakage and over-abstention; abstention can raise $F$ without improving $Q$. Use greedy decoding first and same-temperature coupled sampling as sensitivity; use fixed prompt/candidate seeds and never compare a greedy arm with a hotter arm as an intervention effect.

Train the formal residual-mixture arms $w_\mu=R[A+\mu(1-A)]$ for $\mu\in\{0,0.5,1\}$ with matched counts, updates, act balancing and boundary-pair quota; record normalisation and surviving prompts. The act set already contains warranted abstentions: $\mu$ weights faithful failures to complete the act, rather than adding missing abstention examples. Compare base steering with this training curve, and steering of the $\mu=0$ adapter as a separate rescue test, using identical confirmation probes.

Fit a monotone mapping $\alpha(\mu)$ on development response propensities, then test its frozen predictions for $\bar F,\bar Q,O,\mathcal L$ on confirmation. Compare success at prespecified common leakage budgets and faithfulness floors; interpolate only bracketed operating points, with deployment randomisation between policies explicitly identified if used. Do not extrapolate or select a new best test point. Bootstrap the whole mapping/selection procedure on development roots and paired test contrasts on confirmation roots; cross training-run uncertainty as above.

Pre-register practical equivalence as all four mapped outcome differences within ±0.02 absolute rate points using simultaneous intervals; this is provisional until development power planning freezes it. Non-rejection of a difference is not equivalence. Dominance, different pair correctness, or non-monotone/unmatchable curves rejects the simple shared-control account. Sparse $\mu$ values give operating points, not proof of the continuous optimal frontier.

CAA already averages contrastive residual directions and adds them during generation [1]; representation engineering already studies population representations for monitoring/control [2]; ITI already shifts selected attention-head activations and studies a truthfulness/helpfulness trade-off [3]. These methods are precedents, not our novelty. The proposed contribution is state-verified speaker knowledge, confidence and later permission outcomes, causal distractor controls, and a paired comparison with the training-mixture frontier. A believed-false claim may be faithful here; this is not a new TruthfulQA method or a claim of first-ever steering/training comparison.

## 4. A limited shared-latent model

Assume a binary factual request: $K=1$ means answer warranted, $K=0$ means abstention warranted. A latent decision is $Z\sim\mathrm{Bernoulli}(\sigma(s_K+b))$, where $Z=1$ answers, $s_1>s_0$ are fixed knowledge scores, all answers when $K=1$ are faithful, all answers when $K=0$ leak, and all withholds are faithful. This deliberately excludes source errors, calibrated hedging and permission failures. Let $p=\Pr(K=1)$, $a_k(b)=\sigma(s_k+b)$.

Then $O=1-a_1$, $\mathcal L_K=a_0$, $F=1-(1-p)a_0$, $U=Q=p a_1+(1-p)(1-a_0)$. Increasing $b$ raises answering and leakage, lowers over-abstention and faithfulness; $Q$ can have a single interior maximum or be monotone on a restricted range. Eliminating $b$ gives $\operatorname{logit}(1-O)-\operatorname{logit}(\mathcal L_K)=s_1-s_0$: a testable invariant. Arbitrary heterogeneous scores need not yield a concave or single-peaked $Q$ curve.

A compatible population-fitting model has answer-target mass $a(x)>0$, already-present withhold mass $n_0(x)>0$, and residual faithful-withhold mass $n_1(x)$. Mixture fitting gives answer odds $a(x)/(n_0(x)+\mu n_1(x))$. If $n_1(x)/n_0(x)=\rho$ is constant and training changes only the decision intercept, $b_\mu=b_0-\log(1+\rho\mu)$. A local linear readout of steering gives $b_\alpha=b_0+\kappa\alpha$.

Thus $\alpha(\mu)=-\log(1+\rho\mu)/\kappa$ predicts the same outcome curve with a different parametrisation, provided $\kappa\ne0$. This correspondence uses steering of the $\mu=0$ policy; base steering has its own fitted intercept offset. Increasing restraint raises $F$, lowers leakage and raises $O$, with potentially peaked $Q$. Neither $\mu$ nor $\alpha$ is inherently a Lagrange multiplier.

The assumptions are strong: residual targets need not be literal abstentions, $n_0=0$ creates a support discontinuity, $\rho$ may depend on knowledge/story, and training may change scores or answer quality. Probe directions may alter $s_1-s_0$ rather than $b$. Fit the invariant and offsets on development, test per-example propensity slopes and held-out outcomes, and inspect whether drift is approximately one-dimensional. If these fail, retain the empirical frontier comparison and reject this mechanism; no general equivalence theorem follows from $w_\mu$ alone.

## 5. Freezing ablations

Run the full Qwen grid: placement {q/k/v/o attention only, gate/up/down MLP only, both} × layers {all, bottom half, top half} × rank {4,16}, giving 18 cells. Bottom is blocks 1–14 and top 15–28; for 1B these are 1–8 and 9–16. Add one all-layer bias-and-norm cell and readout-only LoRA at ranks 4 and 16, giving 21 cells, plus a fresh all-layer attention rank-8 historical-placement reference: 22 runs before repeats. Frozen base is a zero-update comparator.

Use exactly the same act dataset, tokenisation/truncation, ordered minibatches, batch size 4, optimiser, learning rate $10^{-4}$, dropout 0.05, masked prompt loss and fixed update count corresponding to two epochs. Match effective tokens and report truncation. Keep MLX scale 20 ($\Delta W=20AB$), equivalent to PEFT alpha $20r$; holding PEFT alpha fixed would confound rank with scaling. No per-cell early stopping or learning-rate search; publish training loss and update norms to detect a cell that simply failed optimisation. LoRA changes low-rank matrices while freezing base weights [6].

The installed runtime is `mlx-lm 0.32.2`. Its `num_layers` conversion selects the final blocks, so bottom-half needs explicit module paths/custom conversion; a smaller `num_layers` value alone would silently repeat top-half [11]. Assert the exact trainable tensor names and counts before any run.

These saved configurations use bias-free linears and RMSNorm. The BitFit-style cell therefore trains existing RMSNorm scales, including Qwen q/k norms, with no invented biases; pure bias-only is a zero-parameter null. Report it as norm-only, not original BitFit, which trains biases [7]. Counts are 65,536 for Qwen, 67,584 for 1B and 175,104 for 3B, subject to a tensor-manifest check.

All three saved models tie embedding/readout weights. Implement readout-only as $\mathrm{logits}=W_{\mathrm{embed}}h+20A_{\mathrm{out}}B_{\mathrm{out}}h$, freezing embeddings and all hidden blocks; do not train a tied embedding wrapper, which changes input processing. This is an output-only low-rank control, with $r(d+V)$ parameters, not full dense-head tuning. Qwen implementation details, including q/k RMSNorm and tied output, are visible in MLX [10].

For a selected linear with dimensions $d_{in},d_{out}$, trainable LoRA count is $r(d_{in}+d_{out})$. Write $q=H_qd_h$, $k=H_{kv}d_h$, hidden $d$, MLP $m$: attention count per block is $r(4d+2q+2k)$; MLP is $3r(d+m)$. Count actual tensors, never assume four square attention projections: Qwen has $q=2048$ despite $d=1024$.

| Qwen all-layer cell | Rank 4 parameters | Rank 16 parameters |
|---|---:|---:|
| Attention only | 1,146,880 | 4,587,520 |
| MLP only | 1,376,256 | 5,505,024 |
| Both | 2,523,136 | 10,092,544 |
| Readout only | 611,840 | 2,447,360 |

Top/bottom-half placement counts are half the corresponding all-layer counts; readout and norm controls are not halved. The historical rank-8 attention reference has 2,293,760 parameters. For the Llamas use the same formula with their GQA dimensions and publish counts, saved precision, adapter bytes and peak memory.

Define signed $\Delta F_{\mathrm{stories}}=\bar F_{tuned,stories}-\bar F_{base,stories}$; positive erosion magnitude $E_{stories}=-\Delta F_{stories}$, without clipping. Report $\bar Q,\bar F,\bar U$ and leakage on fresh-seed/familiar-story and held-out-story splits, plus their paired differences; familiar-story usefulness is evaluated on held-out roots, not training rows.

Pre-register: H1, $E_{stories}$ increases with trainable MLP parameter count, while familiar-story $\bar Q$ saturates; H2, attention-only erodes less than MLP/both at matched depth/rank; H3, top-half changes act/readout behaviour more than bottom-half; H4, a readout-only gain with stable knowledge-probe transfer supports an accessible-boundary/readout account. These are architecture-level associations, not claims that attention only routes or MLP only stores knowledge.

Test H1 with Spearman rank association, ties retained, between MLP count and $E_{stories}$ across the 18 factorial cells, with root-cluster intervals that recompute every cell outcome and the association. Repeat within depth, and report paired MLP-present/absent contrasts controlling rank/depth and total parameter count as a sensitivity analysis. Test saturation using rank 16-minus-4 $\bar Q$ contrasts and a development-frozen ±0.02 equivalence margin; a nonsignificant slope does not establish no benefit. Test H2/H3 with prespecified paired cell contrasts and Holm correction within the freezing family. Counts are confounded with placement/capacity, so an optional matched-parameter follow-up is needed for a parameter-specific causal claim.

Use training seed 7 for the grid. Select two informative cells on development by the largest story-erosion contrast among cells with familiar-story $\bar Q$ within 0.02 of each other; tie-break by fewer total parameters, then fixed manifest order. If no pair qualifies, choose the development $\bar Q$ winner and least-eroding cell meeting a development usefulness floor, and label the unmatched comparison. Add seeds 17 and 29 for each, then confirm on untouched roots/stories. Grid-wide ordinal intervals from one run are conditional/exploratory; only the selected repeated cells support training-run uncertainty claims.

## 6. Leakage mechanism and causal controls

For each oracle-labelled unknown-to-speaker sentence and each supported sentence, align its factual token span. If token $j$ is being predicted, measure attention from query position $j-1$, not from $j$ after it has already been read. For head $h$, layer $l$, average $m_D=|T|^{-1}\sum_{t\in T}\sum_{k\in D}A_{lh}(t,k)$ and analogously $m_L$ over ledger tokens. Record raw masses, per-token masses $m_D/|D|$, $m_L/|L|$, and $\log[(m_D/|D|+\epsilon)/(m_L/|L|+\epsilon)]$ with frozen $\epsilon=10^{-8}$. Empty spans are N/A.

Separate the matching distractor fact from the whole distractor section, and target-matching ledger from the whole ledger. Match or adjust descriptive comparisons for fact identity, token distance, ledger/distractor length, history and sentence length; compare unknown versus supported using root-weighted contrasts and clustered intervals. Repeated sentences remain within their root. Teacher-forced replay of saved replies holds generated text fixed for attribution, but is not a new behavioural outcome. Attention maps alone are not causal explanations [8].

For a causal test, set distractor key logits to $-\infty$ before softmax for every query after that span, across all layers during prefill and generation; preserve causal masking and token positions. Rebuild cache and regenerate from scratch. Also test decode-only blocking to distinguish immediate retrieval from prompt-stage transport. Blocking only decode can miss distractor information already copied into later prompt representations; surviving leakage under full blocking may originate in the question, history or pretraining and does not exonerate all distractors.

Controls: no-op mask; twenty fixed-seed random key-span masks with equal token count and matched eligible position ranges, excluding ledger, distractor and special tokens; report unmatched cases where no eligible control exists. Keep equal-length distractor replacement as a secondary content-removal test. If head ablation is used, select the top 5% of heads by development unknown-minus-supported distractor preference, freeze the list, and zero their per-head value-weighted outputs before the output projection. Compare equal-count random-head sets and report GQA query-head mapping.

Primary causal statistic is $S_L=(\mathcal L_{mask}-\mathcal L_0)-\mathbb E_c(\mathcal L_{random,c}-\mathcal L_0)$ on all fixed leakage opportunities, with paired root-cluster intervals; negative values indicate a distractor-specific reduction beyond generic masking. Report analogous $S_Q,S_U$, coverage, faithfulness and over-abstention on all probes, not only baseline-leaking outputs. A leakage drop accompanied by collapsing useful completion is generic suppression. Publish baseline-leaker transition tables as secondary diagnostics and audit changed sentences.

## 7. Drift, erosion and confidence geometry

For each prompt, cache the base's own greedy continuation $y^b_{1:T}$, with a fixed cap and EOS. Teacher-force this identical prefix into base and tuned models. Compute $D_i=T^{-1}\sum_{t=1}^T\sum_v p_b(v\mid x,y^b_{<t})\log[p_b(v\mid\cdot)/p_t(v\mid\cdot)]$ using full-vocabulary FP32 log-softmax; include EOS if generated, report truncation and both mean and summed KL. Chunk vocab/positions rather than retaining all logits. A sampled-token log-probability difference alone is not this KL. This is divergence on greedy-base prefixes, not sequence KL under the full base distribution.

Regress paired $\Delta F_i=F_{tuned,i}-F_{base,i}$ on $\log(1+D_i)$, story-split indicator, their interaction, act, baseline length and knowledge/exposure indicators, with root-cluster bootstrap intervals. Use a linear mean model for the signed {-1,0,1} outcome, plus stratified/rank sensitivity; never condition the primary sample on tuned failure. With repeated training, cross run and root resampling. Analyse story versus seed drift within common root/act strata where possible, acknowledging the original splits otherwise mix these factors.

Hypothesis: story-split erosion has greater drift than seed-split gains and a more negative drift–faithfulness slope. First compare all-story versus all-seed drift distributions adjusted for act/length; then compare prespecified erosion/gain subsets descriptively, since outcome selection changes the estimand. Large drift with unchanged $F$, or erosion with tiny drift, falsifies the simple drift account. KL is nonnegative and symmetric drift magnitude cannot explain the direction of a policy change by itself; regressions are association, not mediation.

At a controlled decision point, hold a public, target-specific reply stem fixed and define tokenizer-specific, disjoint first-token sets for assertion, hedge and deny/withhold from a development-frozen phrase inventory. Sum next-token probability mass $P_A,P_H,P_D$ and report uncovered mass $1-P_A-P_H-P_D$. Ambiguous/shared prefixes are excluded from token sets; separately score complete multi-token alternatives through a prefix trie, rather than counting their first token twice. The stem/alternative task is a diagnostic change to the prompt, separate from natural-reply outcomes.

For present-ledger confidence pairs, plot $P_A,P_H,P_D$ and $\log[(P_A+\epsilon)/(P_H+\epsilon)]$ against sure/fairly sure/half/doubt, with root intervals and paired monotonic trends. Doubt can license denial, so assertion-versus-hedging alone is incomplete. Keep the target's wording/polarity fixed and show known-absent cases separately. Do not equate ledger confidence with objective truth probability: false beliefs can be voiced faithfully.

Define a policy-calibration analogue, following the binning idea of ECE [9]: $q_i=P_A/(P_A+P_H+P_D)$ and $g_i=1$ only when the formal confidence rule warrants an unqualified assertion. In ten fixed equal-width bins, $\mathrm{ECE}_{policy}=\sum_b(n_b/n)|\bar q_b-\bar g_b|$, with root intervals; show Brier score, signed band-specific gaps and bin counts. This measures agreement with the evidence-to-speech rule on the covered alternative set, not calibration of world truth. Report low covered mass and natural-output oracle calibration beside it; do not hide excluded/ambiguous cases.

## 8. Build scope, compute order and decisions

All estimates below are planning ranges for one M4 Max/36 GB, not measured runtimes. Run models sequentially, keep the same precision within contrasts, and stop/rescale on memory pressure without silently changing precision. Use batch 1–4 and checkpoint gradients for training; save only required pooled states, reduce attention online and compute KL with one checkpoint loaded at a time. A 3,000-prompt Qwen cache of three FP16 pooled positions over 28×1024 states is about 0.52 GB per checkpoint; full $n_{heads}\times T^2$ attention is not cheap and must not be archived wholesale.

| Order | Work | Machine hours | Codex implementation time |
|---|---|---:|---:|
| 0 | Lock/re-score exports, manifests and root/story splits; no-op logits, span and cache checks on 100 prompts; benchmark actual throughput/memory | 0.5–1 | 3–5 h |
| 1 | Qwen base/old-adapter pooled states, probe/CKA/transfer, base-prefix KL and confidence alternatives; about 3,000 prompts | 2–5 | 6–10 h |
| 2 | Qwen steering development screen on 256 prompts; selected layer curves on 1,000 fresh probes; 200–500 full-attention cases and causal masks | 3–7 | 5–8 h |
| 3 | Qwen 22-cell/control/reference runs plus four repeats, fixed two-epoch budget; shared evaluation | 10–20 train + 3–6 eval | 4–6 h |
| 4 | Nine mixture runs (three μ × three training seeds), then two selected placement cells × three seeds on 3B; reuse an exactly matching μ=0 run only | 22.5 train + 5–10 eval | 2–4 h |
| 5 | 1B base/old-act replication, selected probing/steering/masking on 3B, bootstrap and audit reconciliation | 4–8 | 3–5 h |

Total machine budget is approximately 50–90 hours, plus 23–38 hours of harness/analysis work, which can partly overlap machine time. The 3B training estimate is 15×90 minutes; Qwen's 20-minute historical rank-8 run is only an anchor, because rank-16 MLP/both cells and full-attention instrumentation cost more. A three-seed new 1B placement confirmation is optional, add 2–5 training hours plus evaluation after a pilot. Step 0 replaces these estimates using measured prefill/decode rates, not parameter count alone.

Codex can later build an isolated MLX harness reading public scenario/probe exports, reproducing TypeScript prompt strings, storing token/span maps and evaluator-only labels separately, collecting pooled residuals, reconstructing RoPE/qk-normalised GQA attention in a validated slow path, applying residual/mask/head interventions, computing exact conditional KL, and writing scored per-probe rows. Validate fused-versus-slow attention logits and generation with no intervention, including cached decode; numerical disagreement must be resolved before causal comparisons. No runtime dependency addition is necessary or authorised.

The LoRA runner can emit explicit trainable-module manifests, implement bottom/top selection, norm-only and output-only controls, enforce data/update equality, hash source/data/base/adapter/tokenizer/config, resume without duplicate rows, and export cluster-ready summaries. Meaningful checks include root isolation, absence of sidecar labels in prompts, token alignment, frozen-weight checksums, exact trainable counts, $\alpha=0$ equivalence, and equal-length random controls. These are future build tasks; this request authorises a design report only.

The owner supplies sustained machine time/power and available disk, any gated model access not already present, independent second auditors/adjudication, newly authored held-out stories and wording, and final development-frozen decision margins/budgets. No account, deployment or bank-readiness claim follows from this study. The optional bank needs public permission scenarios and a separately audited semantic-disclosure oracle before entitlement experiments.

Proceed through frozen interventions before the grid: a transferable probe plus a successful tuned-model rescue is cheaper and more diagnostic than another adapter sweep. Run the full requested grid even if steering fails, but keep its one-seed associations exploratory; repeat selected cells before training claims. If no method improves $\bar Q$ within audited faithfulness/leakage guards, record that negative result, the accessible-versus-used boundary distinction, and remaining follow-up here. No benchmark or simulation code is part of this deliverable.

## Sources opened

[1] Panickssery et al., CAA: https://arxiv.org/abs/2312.06681
[2] Zou et al., representation engineering: https://arxiv.org/abs/2310.01405
[3] Li et al., inference-time intervention: https://arxiv.org/abs/2306.03341
[4] Hewitt and Liang, probe control tasks: https://aclanthology.org/D19-1275/
[5] Kornblith et al., representation similarity/CKA: https://proceedings.mlr.press/v97/kornblith19a.html
[6] Hu et al., LoRA: https://arxiv.org/abs/2106.09685
[7] Ben-Zaken et al., BitFit: https://arxiv.org/abs/2106.10199
[8] Jain and Wallace, attention interpretation limits: https://aclanthology.org/N19-1357/
[9] Guo et al., calibration: https://proceedings.mlr.press/v70/guo17a.html
[10] MLX-LM 0.32.2 Qwen model source: https://github.com/ml-explore/mlx-lm/blob/v0.32.2/mlx_lm/models/qwen3.py
[11] MLX-LM 0.32.2 adapter conversion source: https://github.com/ml-explore/mlx-lm/blob/v0.32.2/mlx_lm/tuner/utils.py
