# 38: The controller's review of the independent neural design (38-neural-codex.md)

## Errors and gaps in my draft, accepted

1. **Attention attribution position.** I measured attention "from the positions that produced the claim words"; the prediction of token $j$ is made at query position $j-1$. Fixed in the merge.
2. **Emergence layer.** My single-layer threshold (first AUROC $\ge 0.9$) is fragile; adopt the run-of-three at $\ge 0.80$ with a root-bootstrap lower bound above chance and a structure-preserving permutation null, plus sensitivity at 0.75 and 0.85, decided on development roots and frozen.
3. **Probe control.** My "omit the ledger" control bounds the question-only shortcut, but the more important control is the one Codex names: explicit-field readers can be perfect because the ledger is *rendered in the prompt*, so decoding membership is not evidence of an epistemic module. The informative test is aliases, paraphrases and template-held-out pairs, which separate relational integration from literal matching.
4. **Steering units.** Normalising by the activation norm $\sigma_l$ mixes layers of different scale; use the projected standard deviation $s_l = \mathrm{SD}(v_l^\top h_l)$ so $\alpha$ is in comparable units, and map logistic-probe weights back through the feature scaler before normalising. Verify $\alpha = 0$ reproduces uninstrumented logits.
5. **Where to inject.** Only from the last prompt position onward (so the first decision is affected) and every decode position; rebuild the cache per condition. My draft injected at "every generated position" without the last prompt token.
6. **Latent model.** My threshold/slope sketch is subsumed by Codex's two-score model, which yields a testable invariant and a mapping $\alpha(\mu)$ with explicit assumptions; adopt it, including the honest statement that neither knob is a Lagrange multiplier.
7. **Grid mechanics.** Bottom-half placement cannot use `num_layers`; readout-only must be a low-rank adapter on logits with tied embeddings frozen; BitFit is norm-only here; parameter counts come from a tensor manifest (Qwen attention per block is $r(4d + 2q + 2k)$ with $q = 2048$).
8. **Drift regression.** Add the story indicator, its interaction with drift, act, length and exposure covariates; never condition the sample on tuned failure.
9. **Calibration.** Add a deny/withhold token set and report uncovered mass; doubt can license denial, so assert-versus-hedge alone is incomplete.

## What Codex's design has that mine lacks

- The measurement contract up front: formal metrics only, no $1 - F$ as leakage, no multiplied marginals; MLX base compared with its adapter loaded, with fusion equivalence checked separately.
- Balanced development pairs with length and mention confounds logged; root-seed folds with inner folds for the regulariser; probe uncertainty split into fold variation and refit uncertainty.
- CKA with identical-checkpoint and permuted-row controls, sample-size sensitivity and an unbiased-HSIC estimate; transfer probes without target refitting or recentering, with log loss to catch intercept shifts AUROC hides.
- The full causal-masking protocol: keys masked at $-\infty$ for every later query, prefill-and-decode versus decode-only blocking, twenty random equal-length key-span controls, a frozen top-5% head list with GQA mapping, and the statistic $S_L$ that subtracts the generic-masking effect.
- The mixture arms trained inside the same plan, the frozen $\alpha(\mu)$ mapping tested on confirmation, and a pre-registered practical-equivalence margin.
- Realistic compute: 50–90 machine hours, not my 13; my estimates ignored rank-16 MLP cells, full-attention capture and the 3B repeats.

## What mine has that Codex's lacks

- A shorter statement of the three questions and the readings of each outcome (H1–H7), useful as the paper's framing; Codex's pre-registered interpretations are more precise and should replace my hypothesis list in substance while keeping the numbering and one-line readings.
- The explicit deployment implication of a steering result (reversible, no erosion by construction) and the "readout versus representation" framing of erosion, which Codex states but does not foreground.
- Kendall's $\tau$ for the grid association; Codex uses Spearman. Either is fine; report Spearman as primary (it handles ties as specified) and Kendall as sensitivity.

## Points to settle in the merge

- Order of work: Codex's "frozen interventions before the grid" is right; a transferable probe and a successful steering rescue of the $\mu = 0$ adapter are cheaper and more diagnostic than more training.
- Keep the full 18-cell grid plus controls, but as exploratory with one seed; only the two repeated cells support training-run claims.
- The harness must reproduce the TypeScript prompt strings byte for byte and keep the evaluator sidecar out of the prompt; validate the slow attention path against the fused one before any causal claim.
- Compute budget to be measured in step 0 from prefill/decode rates, replacing both drafts' estimates.
