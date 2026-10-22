# 35: The controller's review of the independent methods draft (35-methods-codex.md)

## Errors it found in my draft, accepted

1. **Proposition 2 overclaimed.** Under a fixed binary gate with exact fitting, the informative survivors of round 1 pass again, so the shift stops after one round; geometric collapse needs a persistent failure channel (approximate fitting, generalisation to new informative replies). My draft now states the one-round result as the claim and the iterated collapse as a hypothesis with a direct test (a second self-distillation round).
2. **Proposition 3 assumed a perfect gate.** With false negatives, $\mathbb{E}_n Q^* = q_+ G_n + q_- r^{n-1}$ can fall. Added.
3. **Wrong numbers in the reconciliation paragraph.** I quoted act completion (47.3% to 31.8%) as $Q$; $Q$ was 39.5% to 30.9% on held-out seeds and rose on held-out stories. Fixed.

## What its draft has that mine lacks, to adopt in the merge

- The exact first-pass selection law $p_n(y) = \pi(y)[w(y)G_n + (1-w(y))r^{n-1}]$ with $G_n = (1-r^n)/s$, the exhaustion rate $r^n$ and the limit of the uninformative share $u/s$ (not one). Cleaner than my (3) and covers the exhaustion branch the harness actually implements.
- The distinction between $A$ (pure act completion) and $U = \mathbf{1}_M P G A$, so that $Q = FU$ matches Phase 0 exactly, including protocol validity and the source and calibration gates. My $U$ silently dropped $P$ and $G$.
- Task-level denominators that include errors ($\bot$), with the completed-reply legacy rates kept separately. My definitions conditioned on completion without saying so.
- Leakage split into epistemic ($\mathcal{L}_K$) and authorisation ($\mathcal{L}_E$) with opportunity-based denominators, and $Q_E = Q\,\mathbf{1}_{\neg J}$ for the bank.
- The M-step bookkeeping: pooling accepted samples without the per-prompt $Z_t(x)$ weights prompts by acceptance rate, and the first-passing target in `make-data.ts` weights surviving prompts by $1 - (1-Z_t)^K$ and drops zero-survivor prompts. This is a concrete prompt-coverage bias our arms must report.
- McNemar is not exact on correlated probes; use one probe per root as a diagnostic and the cluster bootstrap for the primary endpoint; bootstrap margin tests with Holm over four elementary hypotheses; the centred-bootstrap $p$-value formula.
- The full delta-method variance for Rogan–Gladen, the requirement $D = s_e + s_p - 1 > 0$, correction of the joint outcome $Q$ with its own confusion matrix rather than correcting $F$ alone, and the union-bound argument for how good the per-label audit must be; no universal 90% gate.
- Null interventions in minimal pairs (change something irrelevant, expect invariance), directed change sensitivity, and the CheckList framing; my sensitivity measure could not estimate the "only when" direction.
- The retention hypothesis ($\Delta_{Q,d} - \Delta_{Q,\text{seeds}} \ge -\gamma_Q$) alongside the transfer hypothesis, and the crossed stories-by-wording design.
- Power by simulation over $(m, K)$ designs with audit misclassification included, instead of a single closed-form approximation.

## What mine has that its draft lacks, to keep

- A readable exposition: the paper's methods section must be followable in one pass; the merged version should carry Codex's precision in the definitions and proofs and my ordering and prose.
- The constrained formulation $\max \mathbb{E}[U]$ s.t. $\mathbb{E}[1-F] \le \varepsilon$ presented as the organising idea, with each training recipe as an operating point; Codex has the same Lagrangian but as a late aside.
- The data-mixture knob written as a weight on faithful-but-off-act examples ($w_\mu = R_Q + \mu R_F(1-U)$), with the observation that the act set already contains every correct abstention, which explains why "adding abstentions" cannot help; Codex's $q_\alpha$ mixture of distributions is equivalent at the data level and should be the notation used, with my explanation kept.
- The energy-per-verified-useful-answer definition and break-even formula for the deployment paper.
- The explicit list of matched controls across arms (count, updates, prompt support, teacher pool, target length) stated once, early.

## Points to settle in the merge

- Use Codex's symbols ($F, A, U, Q, \mathcal{L}_K, \mathcal{L}_E, \bar Q$) and its task-level denominators throughout; my $N(y)$ for uninformative replies and $n_t$ for their mass are convenient and can stay.
- Keep my Propositions 1 and 3 as the short statements, with Codex's proofs and the exhaustion branch.
- Margins: Codex proposes $\delta_F = 0.02$, $\delta_Q = 0.03$; mine were 0.03 and 0.05. Take the stricter fidelity margin (0.02) and the more conservative usefulness target (0.05) as provisional, to be fixed on development data.
- Primary contrasts: Codex's two (best mixture against verifier-only SFT; best mixture against same-temperature best-of-4) are better than mine (tuned against base), because they test the method against its nearest competitors.
