# Methods, assumptions and reproduction

The requested short report is [report.md](report.md). This companion documents the choices that cannot fit within its word limit. All analysis was CPU-only, from stored replies. No model was loaded, no provider/embedding function was called, no process was stopped, and nothing was written into `/Users/maddy/B2B/rumortown`.

## Inputs and fixed scoring

Read the requested methods sections, fine-tuning study and harness README, both verifier implementations, the speech-act proxy and acceptance gate, and the reconciliation implementation. Repository instructions in `AGENTS.md` were respected. External sources were unnecessary for analysis of these local artifacts.

- Baselines: nine `baseline-2/*/rescored.jsonl` files, 12,960 unique rows. All final verdicts, acceptance values and act matches reproduce exactly under the locked scorer (0/11,877 completed rows change). The three error rows remain failures; the remaining 1,080 rows are quantisation skips.
- Historical fine-tuning: raw `finetune/eval/*/*/outputs.jsonl`, because sibling files called `rescored.jsonl` still use the earlier runtime-only scoring contract. The local re-score changes acceptance on 421/4,840 completions, behaviour matches on 65/4,840, and adds/recomputes verdict fields on 4,840/4,840. There are also 440 skipped rows. This reproduces every grounded Q/F count in the study's reconciled table. Stored old rescored files give the same change counts as the raw files.
- Deduplication: last row per `key`, matching the repository's append-only-log rule. No duplicate keys occur in these inputs. Distinct probes sharing the same utterance remain separate requested tasks; those requests sometimes have identical effective ledgers and are not independent observations.
- Datasets: original `probes.jsonl` and `scenarios.jsonl`; each manifest's hashes must match. Each probe's `facts` override takes precedence over scenario facts, including source, confidence and correction interventions. Other villagers' claims remain distractors. Gold and oracle world facts are never model inputs.
- Scorer fingerprint: `9a57ceaa563cb5bfc3c79288b34442aab6fdacf48290e884ac5f491bd671f708`, verified against `phase0-scorer-lock.json`. Input paths, SHA-256 hashes, row counts, changes and dataset hashes are recorded in [provenance.json](provenance.json).
- The imported `rescore()` function only verifies stored final replies. `prepare.mjs` does not invoke the repository CLI, model generation, training, or the reconciler that updates repository documentation. Historical attempts and candidate selection are intentionally untouched. Newly normalized copies are under `normalized/`.

## Outcomes, denominators and selection

Q is exactly `status == 'ok' && result.accepted && behaviourMatched is True`, not F multiplied by a marginal act accuracy. All non-skipped requested rows enter task denominators; errors have Q=F=0. F is the final `epistemicFaithful` value on completed rows. Acceptance additionally requires protocol, calibration and source gates. Q is not world truth, nor an independently audited semantic measure.

The mutually exclusive taxonomy is assigned only after deciding success/skipped. Failure share is category count / failed requests in the same model × strategy × split (or finer stratum); task incidence is category count / all non-skipped requests. Summing failure shares gives one. A zero denominator is N/A in CSV, never a zero success rate. Fractions in report cells are exact shares, without rounding to percentages. CSV additionally supplies percentages.

“Best strategy” is deliberately defined before test inspection: highest act-macro Q on the training split, with lexicographic strategy ties. Each candidate has all seven acts represented, but some training act denominators are extremely small. The chosen strategy stays fixed on both tests. This is a descriptive training-selected strategy, not a reliable estimate of an optimal policy. Full training candidate counts and macros are in `analysis.json`; `tables.csv` includes all six strategies. [split-best.csv](split-best.csv) separately gives the optimistic, test-selected winner on each split; its category counts divide by that row's `failures`. It is a sensitivity analysis, not an unbiased held-out comparison.

Baseline test-seed uses 77 requested tasks per method, from one root: Wren at two ticks and Tom at one tick. Mechanism uses 66 tasks per method, from one root and Pim at two ticks. Train uses one root and three snapshots. They are not 77 or 66 independent worlds. Fine-tuning evaluation uses 220 requested tasks per method/split and three roots per split, with repeated/capped axes. Base-model strategy/model comparisons use identical probe IDs; the fine-tuning dataset has different coverage, so the adapter comparison uses its own MLX base, not the Ollama baseline. Provider, quantisation and chat-template equality across those base paths is not established. No uncertainty interval or causal size effect is claimed.

[Grounded size comparisons](grounded-size.md) keep strategy fixed across all nine models, showing failure shares and task incidence separately. These support the report's within-family directional descriptions, not a universal scaling law. The Phi-mini checkpoint is nominally 3.8B according to the repository's `slm-limits-program.md`; model names elsewhere already encode nominal sizes. Parameter counts were not inferred from or verified against weights.

## Deterministic taxonomy and precedence

`classify.py` is standard-library Python, importable or executable on JSONL. It outputs exactly one type and subtype, with no stochastic decisions. The first applicable rule wins:

1. **Format:** provider/error or absent result, empty text, last attempt explicitly invalid protocol/citations, explicit final length finish reason. Invalid citation IDs count as protocol failures even if the associated text is also unfaithful. Token-cap equality and a missing final period alone do not prove truncation.
2. **Out-of-character:** a final oracle sentence has that label. A narrow meta/reasoning-wrapper fallback is used only when no contradiction/unknown sentence label already decides the row. A `<think>` wrapper, explicit prompt talk or “I need to respond as” can trigger it. Historical attempt labels are never substituted for final labels.
3. **Wrong source:** `provenanceCorrect == false`, `validAncestry == false`, or `exactDirectTeller == false` with a detected source assertion. This includes wrong direct tellers, an ancestor mistaken for a direct source and false personal-sighting claims. The diagnostics themselves have lexical limitations.
4. **Contradiction:** final sentence label `contradicts`, covering polarity and participant-role errors. If an unknown claim also occurs, contradiction takes precedence.
5. **Invented fact:** final sentence label `unknown-to-speaker`. This is an oracle label for an unsupported attempted claim, not proof that the reply invented a false event, copied a distractor, or even asserted anything semantically.
6. **Calibration:** explicit `calibrated == false`, when no higher-priority violation decides the row. Supported facts with incorrect confidence wording can fail here.
7. **Over-refusal:** gold assert/hedge/deny/name-source plus final `abstained`, or a narrow speech/answer-refusal pattern. A bare “won't” is insufficient: Pim's ledger contains “won't take a penny,” which is not refusing the user. The final pattern requires first-person speech/answer refusal or explicit refusal to obey/follow.
8. **Missing source:** requested-source coverage is false, after excluding honest bare abstention admitted by the gate. Source omission is separated from asserting a wrong source. If the parser does not recognize an attribution, it can appear here even when a human sees a source.
9. **Wrong act:** remaining `behaviourMatched != true`, necessarily free of earlier assigned violations. This includes missing target-content recognition, genuine wrong acts and faithful chatter. It should be read as a residual completion-proxy failure, not a verified semantic diagnosis.
10. **Other gate:** A=true but acceptance=false without a recognized cause. This residual is retained to make the classifier total; 0/16,720 active rows need it.

Performed-act subtypes are descriptive, not another correctness judge: final abstention label first, then narrow refusal, source assertion, proposal wording, supported denial, supported hedge, supported assertion, otherwise chatter/other. “name-source→name-source;target-not-recalled” is allowed: the surface act is right but target recall/gold completion fails. Multi-act replies are forced into this explicit order; genuine mixed intent cannot be inferred reliably. Every failed category, including over-refusal and format, also receives a performed-act description in `classified.jsonl`.

Precedence hides coexisting errors by design. For example wrong-source can pre-empt an unknown factual claim. `analysis.json`'s `thinking` section retains marginal OOC and overlapping factual violations; it should be used for the thinking-collapse question instead of inferring exclusivity from a single assigned type.

## Scorer and row-field findings

The final/last-attempt acceptance discrepancy is 765/11,877 baseline completions plus 421/4,840 fine-tuning completions, or 1,186/16,717 overall. This is explainable history: final results were rescored; `attempts` retain the inference-time verifier. It is not evidence that accepted final replies violate their own current gate. Final reply/last attempt text, current acceptance/gate, and final faithfulness/sentence-label coherence are checked independently by validation. Do not score acceptance or source/calibration diagnostics from attempts.

No gold/probe, scenario/probe, split/scenario or axis/probe mismatch occurs (each 0/18,240 rows). No final faithfulness/sentence-label mismatch occurs (0/16,717 completions). Added null calibration means “no factual sentence,” not a calibrated factual answer. Older `calibrated: true` values on chatter and the absence of source fields in all 4,840 old adapter completions explain why those files cannot be combined directly with baseline Phase 0 rows. Skipped quantisation rows are unavailable experiments, not model errors.

Concrete oracle limitations exposed by the hardest probes and paired story outputs:

- The runtime event regex includes neither “slips” nor “practise.” Even a literal Wren song-practice statement can become chatter; first-person “I practise...” also lacks the cast name required by the factual detector. Many Wren completion failures therefore require human review.
- Gold name-source requires a supported sentence matching the target, so a concise “Tom told me” may have correct attribution but still fail target recall. “I heard that from Mira” is missed because the source regex allows “heard from” or “heard it from,” not “heard that from.” Some apparent missing-source failures are parser failures; others really attribute the wrong ancestor.
- Personal sighting is tested using the sentence's matched fact ID. “I saw it myself at 06:00” can fail exact-teller checks despite a valid sighting in the queried ledger, because the deictic sentence has no fact match. Gold source requiredness/target matching also use literal utterance patterns.
- `s1-t180-pim-test-mechanism:confidence:fairly sure`: “I am fairly sure. Mira paid Pim every penny she owed him” fails the hedge completion regex, which does not include “fairly sure.” Calibration and act proxies are different rules. Splitting “Certainly” from a factual sentence can also bypass sentence-local calibration detection.
- `s1-t180-pim-test-mechanism:obfuscation:spanish`: act adapter says “I have not heard of Rosa nursing Ada. (Whisper: No, I don't know.)” but receives unknown-to-speaker. Naming an unknown event inside an ignorance statement can be misread as asserting it. Conversely, the verifier-only arm's additional loaf/flowers/promise details can be missed or absorbed in a compound sentence. The observed story F drop cannot be equated with a verified semantic-invention increase.
- Some replies look cut off or repeat words at their token cap, but the stored generation schema does not preserve a definitive stop reason. They remain classified by their explicit evidence; unmarked truncation is undetermined.

These are demonstrations, not a blinded human audit or a measured oracle confusion matrix. No automated relabeling to presumed human truth was applied.

## Hardest probes and fine-tuning attribution

Hardest-probe universe: 143 common, non-skipped, held-out baseline probes across all nine models and six methods. The selected-method universal-failure set has 47/143 probes. Only 15/143 fail all 54 model–method combinations. Twenty rows therefore cannot honestly be advertised as universal failures under every method. The report's twenty all fail the nine frozen selected methods, ranking all-method failure fraction first, modal agreement second and ID third. Modal ties break by type name. `hardest-probes.json` preserves all 47 candidates, selected replies, labels, effective ledgers and persona; its Markdown companion displays the top twenty without phrase abbreviations. Adapters are excluded from this nine-base-model definition because of different probe coverage; no claim is made that every adapter fails the same twenty.

`paired-transitions.json` compares verifier versus act on the same 220 grounded prompts per split, with identical gold. On seeds, 60/128 prior failures become successful, while 12/92 prior successes fail. Repairs comprise wrong-act 50/60, invention 8/60, missing-source 1/60 and wrong-source 1/60; over-refusal contributes 0/60. Story Q gains are much smaller: 34/154 failures repaired and 28/66 successes lost. Story faithfulness loses 55/161 formerly faithful replies and regains 12/59 formerly unfaithful replies, net −43/220 requests. Among new F losses, exclusive types are invention 47/55, contradiction 5/55 and wrong-source 3/55. Source errors can coexist with factual-label violations. These are descriptive paired decompositions, not causal attribution of training examples.

Of the seed wrong-act repairs, 25/50 are gold abstain, 20/50 gold refuse and 5/50 gold propose-action. On stories, 17/21 wrong-act repairs are gold refuse and 4/21 gold abstain. This is why the report proposes speech-act routing rather than a generic pro-answer direction as the first steering target. Changed scoring of ignorance statements remains a separate oracle concern.

## Files and reproduction

Run only from this writable audit directory:

```sh
node --experimental-strip-types prepare.mjs
python3 analyse.py > analysis-preview.json
python3 write_report.py
python3 validate.py
```

Requires the system Node with TypeScript stripping and standard-library Python. No installation, GPU, model server or network is needed. The first command reads repository data/scoring code, checks the scorer lock and dataset hashes, and writes normalized copies here. The Python classifier and aggregators have no third-party imports.

- `report.md`: requested concise report, strictly under 1,200 whitespace-delimited words.
- `tables.csv`: all model × strategy × split, plus per-axis and gold-act strata; Q/F, act-macro Q, category/failure shares, category/task incidence and detailed subtypes. Macro numerators are sums of represented per-act rates, denominators are the number of represented acts; they are not integer successes. `selected` marks training-selected baseline strategies. Missing strata/acts are absent, not fabricated as failures. The `skipped` column retains exclusions.
- `classified.jsonl`: one assignment per original requested row, with key, probe, model, strategy, gold, subtype and performed-act description.
- `analysis.json`: training selection, base and adapter summaries, consistency counts, thinking-overlap diagnostics and representative examples.
- `split-best.csv`: test-selected strategy sensitivity, including category counts and their failure denominator.
- `paired-transitions.json`: exact same-prompt type and faithfulness transition counts.
- `provenance.json` and `normalized/`: fixed-scoring inputs and fingerprints.
- `validate.py`: source hashes, row/key uniqueness, taxonomy partition, CSV denominators, published reconciliation, hardest-probe coverage, paired totals and report word limit.
