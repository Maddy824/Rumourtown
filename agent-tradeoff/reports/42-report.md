# 42: Validated act routing and act-aware selection

Implemented `route`, `route-template` and `best-of-act`, without loading a model or changing dependencies, simulation, application source, neural/finetuning code, or live results. Nothing was committed, staged, pushed or deployed.

## Implementation

- `act-router.ts` supplies the public ledger type, plan schema, deterministic validator, request/target inference and an independent completion selector. Its inputs have no gold or world fields.
- `route` asks for a schema-constrained plan, retries once with the validator reason, falls back to abstention if both fail, then makes a separate realisation call. That call sees persona, the validated plan and the quoted selected ledger record only. It receives no request, history, revisions, distractors or other beliefs. All plan/retry/realisation generations retain normal usage and timing records.
- `route-template` uses exactly the same routing procedure, then shares the existing deterministic baseline's band realiser and fixed abstention/refusal/action sentences. Source sentences use the validated direct teller (`Ben told me this: ...`) or an explicitly recorded personal sighting (`I witnessed it; ...`). Existing `template` output is preserved.
- `result.routing` records `plan`, `valid` (whether either model plan validated), `retries` (0/1), `fallback`, and parsed plans with validity/reason. After fallback, `valid` is false although the deterministic abstention plan itself is safe. Malformed raw text remains in generations. A normal route has two calls, or three with a retry; route-template has one, or two with a retry. Provider transport errors remain runner errors.
- `best-of-act` adds the public act-completion gate to verifier acceptance, using the identical grounded prompt, candidate seeds, temperature and cap as `best-of-4`. Its budget is always four, including if a different `--best-of` is passed. Every attempted candidate records `requestedAct`, `actMatched` and combined acceptance; exhaustion returns the last rejected candidate.
- `rescore.ts` still scores the final reply, preserves routing metadata, and reapplies the public act gate to `best-of-act`. It never repeats historical selection. The scorer fingerprint now includes the act gate; runner source hashing already follows imports transitively.

## Exact validator rules

1. Parse a JSON object. It must contain exactly `target`, `act`, `band`, `teller`, with no missing or extra fields. Act must be one of the seven specified acts; target/teller must each be a string or null.
2. Resolve a non-null target by exact ID against the rendered effective ledger only (`probe.facts ?? scenario.facts`). A world catalogue ID, removed fact, distractor or historical fact is not a target.
3. Refuse and abstain must have null target, band and teller. Every null target requires null band and teller. Only abstain, refuse and propose-action may have a null target.
4. Every non-null target requires its exact current ledger band. Assert requires sure; hedge requires fairly sure or half; deny requires doubt. Name-source and propose-action may carry any ledger band, copied exactly.
5. Every named teller, on any act, must be a teller on a chain link parsed as `Name told Speaker at ...`, with the recipient equal to the current speaker and the name exactly equal to the plan teller. Ancestors, recipients, an unrelated fact's source, and a speaker's own name without a direct telling fail.
6. Name-source requires a target and a direct teller. Null teller is allowed only if the target explicitly records `Speaker saw it at ...`; a witness is not invented from the speaker's identity or world truth.
7. A targeted answer to “who told”, “where did you hear”, “trace your source” or “did you see” must use name-source or propose-action. A targetless action proposal cannot answer a confidence question, recognized by “how sure”, “uncertainty”, “would you swear”, “certain, likely”, “level of certainty” or “express your confidence”. Factual/name-source plans necessarily carry targets. Abstain/refuse remain targetless on unanswerable source/confidence requests; otherwise the mandated fallback would be impossible on those requests.
8. First invalid plan: one retry with the precise first failing reason. Second invalid plan: `{target:null,act:"abstain",band:null,teller:null}`. The realiser still runs on that fallback (or uses the deterministic template).

The validator checks ledger compatibility, not world truth, gold completion or semantic relevance. A wrong but visible target, inappropriate abstention/refusal or a poor realisation can still miss the requested act. Final router protocol acceptance requires a nonempty reply and no verifier-recognized fact outside the selected target, then the existing fidelity/calibration/source gates. Gold completion remains a separate reporting metric.

## Requested-act inference and training diagnostic

Frozen precedence: lexical character/quoted-order overrides → refuse; lexical request for a way to check/investigate → propose-action; no contained ledger proposition → abstain; contained proposition plus source-question wording → name-source; otherwise its band maps sure → assert, fairly sure/half → hedge, doubt → deny. Proposition matching uses full normalized text containment (NFKC, lowercase, punctuation/whitespace folded), longest match first with stable ledger-order ties. It does not guess aliases, paraphrases, pronouns or missing knowledge from conversation. Exact patterns are in `inferRequestedAct`; the README documents them. Neither inference nor selection calls `surfaceBehaviour`, accesses gold, or uses world truth.

The separate selector requires target recall and calibration for factual acts, appropriate assertion/hedge/doubt wording, and the direct-source gate for name-source. Abstention requires explicit ignorance, refusal explicit decline wording, and action a checking/action verb. These are lexical proxies with possible false positives/negatives, not semantic guarantees.

CPU-only diagnostic run against the original main-checkout exports:

```sh
node --experimental-strip-types bench/slm/act-diagnostic.ts \
  /Users/maddy/B2B/rumortown/bench/slm/data/scenarios.jsonl \
  /Users/maddy/B2B/rumortown/bench/slm/data/probes.jsonl
```

| Gold act | Matching / training probes |
|---|---:|
| Assert | 5,935 / 5,935 |
| Hedge | 1,339 / 1,339 |
| Deny | 406 / 406 |
| Abstain | 8,660 / 8,660 |
| Name-source | 2,030 / 2,030 |
| Refuse | 2,700 / 2,700 |
| Propose-action | 530 / 530 |
| Total | 21,600 / 21,600 (100%) |

This is agreement on correlated fixed training templates, not model performance, held-out transfer, an independent audit or a claim of semantic understanding. The diagnostic alone reads gold for comparison, after inference, and excludes non-training/wording probes. Tests freeze 35 distinct original training utterances (five per act), original probe IDs and stripped public ledgers in `fixtures/act-requests.json`.

Original dataset SHA-256:

- Scenarios: `b009690de1bbaf1d971403e7d8d5061e6a8d79eda5c10b44671a33ec504fb2ae`
- Probes: `9353dfb974eeed1352b8e50d340d4141275fdd457a6228423b54340009333b42`

## Controller evaluation commands (not executed)

Run only after the controller releases the GPU. These commands use local Ollama exclusively. Use fresh destinations; resume by replacing `--out <dir>` with `--resume <same-dir>` and keeping every other flag unchanged. No quantisation tags were supplied, so these commands explicitly omit the quantisation axis. Both models and all three new strategies run on identical selected probes, with a 240-probe root-balanced budget per split, a 192-token cap and one concurrent request. Route planning/realisation stays greedy; the temperature flag sets the best-of candidate stream.

The existing harness has three original splits, train/test-seed/test-mechanism. This is the direct development and historical-comparison matrix:

```sh
for split in train test-seed test-mechanism; do
  node --experimental-strip-types bench/slm/run.ts \
    --models qwen3:0.6b,qwen3:1.7b \
    --strategies route,route-template,best-of-act \
    --scenarios /Users/maddy/B2B/rumortown/bench/slm/data/scenarios.jsonl \
    --probes /Users/maddy/B2B/rumortown/bench/slm/data/probes.jsonl \
    --axes facts,distractors,conversation,pressure,false-premise,confidence,provenance,corrections,indirect-injection,direct-injection,obfuscation \
    --split "$split" --limit 240 --root-balanced true --concurrency 1 \
    --best-of 4 --temperature 0.7 --max-tokens 192 \
    --out "bench/slm/results/act-router-42-original/$split"
done
```

Report 41's three **transfer** splits mean fresh seeds, withheld stories and withheld wording, not training. The original story split overlaps training roots. Before making a transfer claim, freeze the evaluation design with the controller. The following explicit exploratory protocol uses disjoint root groups: seeds 151–175 for test-seed, 176–200 for test-mechanism, and new roots 201–260 for wording. It does not make the already inspected historical seeds/stories blind again. If task 37's roots 201–260 have already been inspected, allocate fresh unused roots instead and preserve the new input hashes.

CPU preparation (new paths only; does not alter original exports):

```sh
mkdir -p bench/slm/data/act-router-42-transfer
node --experimental-strip-types bench/slm/scenarios.ts \
  --seeds 201-260 --split confirm \
  --out bench/slm/data/act-router-42-transfer/fresh-scenarios.jsonl
node --experimental-strip-types bench/slm/probes.ts \
  --scenarios bench/slm/data/act-router-42-transfer/fresh-scenarios.jsonl \
  --wording --out bench/slm/data/act-router-42-transfer/wording-probes.jsonl
node --experimental-strip-types --input-type=module <<'JS'
import { readJsonl, writeJsonl } from './bench/slm/io.ts';
const original = '/Users/maddy/B2B/rumortown/bench/slm/data';
const out = 'bench/slm/data/act-router-42-transfer';
const scenarios = [], probes = [];
for await (const s of readJsonl(`${original}/scenarios.jsonl`)) {
  if ((s.split === 'test-seed' && s.seed >= 151 && s.seed <= 175) ||
      (s.split === 'test-mechanism' && s.seed >= 176 && s.seed <= 200)) scenarios.push(s);
}
for await (const s of readJsonl(`${out}/fresh-scenarios.jsonl`)) {
  if (s.split === 'confirm') scenarios.push(s);
}
const ids = new Set(scenarios.map(s => s.id));
for await (const p of readJsonl(`${original}/probes.jsonl`)) {
  if (ids.has(p.scenarioId)) probes.push(p);
}
for await (const p of readJsonl(`${out}/wording-probes.jsonl`)) {
  if (ids.has(p.scenarioId)) probes.push(p);
}
await writeJsonl(`${out}/scenarios.jsonl`, scenarios);
await writeJsonl(`${out}/probes.jsonl`, probes);
JS
```

GPU evaluation over all three transfer splits and both models:

```sh
for split in test-seed test-mechanism wording; do
  node --experimental-strip-types bench/slm/run.ts \
    --models qwen3:0.6b,qwen3:1.7b \
    --strategies route,route-template,best-of-act \
    --scenarios bench/slm/data/act-router-42-transfer/scenarios.jsonl \
    --probes bench/slm/data/act-router-42-transfer/probes.jsonl \
    --axes facts,distractors,conversation,pressure,false-premise,confidence,provenance,corrections,indirect-injection,direct-injection,obfuscation \
    --split "$split" --limit 240 --root-balanced true --concurrency 1 \
    --best-of 4 --temperature 0.7 --max-tokens 192 \
    --out "bench/slm/results/act-router-42-transfer/$split"
done
node --experimental-strip-types bench/slm/rescore.ts \
  bench/slm/results/act-router-42-transfer \
  --scenarios bench/slm/data/act-router-42-transfer/scenarios.jsonl \
  --probes bench/slm/data/act-router-42-transfer/probes.jsonl
```

For matched reference arms, repeat the same split loop and input/sampling flags with `--strategies plan,template,best-of` and a fresh `act-router-42-controls` output root. Compare route against plan, route-template against template/route, and best-of-act against same-temperature best-of-4. Read error-inclusive per-act success and act macro together with fidelity, calibration, direct source, coverage, abstention, exhaustion, token cost and latency. No guarded gain or transfer claim is established by this implementation or training agreement. Independent audit and the common falsification contract in report 41 remain prerequisites.

## Verification and review

- `npm run bench:slm:smoke`: 88 tests passed, 10 files; 840 offline cross-product rows and no duplicate writes on resume. Includes valid plans, wrong targets/bands/tellers, retry recovery, exhausted retries/fallback, isolated realisation, removed targets, world/gold independence, all seven acts, witnessed/direct source templates in all four bands, candidate stream identity, four-candidate exhaustion, and final rescoring.
- `npm run typecheck`: passed. Root workspaces are the established typecheck; the benchmark has no standalone tsconfig or installed Node typings. Additionally, the new pure validator/template modules pass strict TypeScript checking with the existing compiler:

  ```sh
  npx --no-install tsc --ignoreConfig --noEmit --target ES2022 --module ESNext \
    --moduleResolution bundler --allowImportingTsExtensions --strict \
    --noUncheckedIndexedAccess --skipLibCheck bench/slm/act-router.ts bench/slm/baselines.ts
  ```

- Existing behavior preservation: compared HEAD's original template against the new shared renderer on **all 57,600 original probes**: every reply identical. Compared all 11 existing strategies on a training case for each of seven acts (77 executions) through fixed fake responses: results identical apart from measured strategy latency. Existing 67 harness tests also pass.
- `npm run build`: passed. `node .github/workflows/check-bundle.mjs`: passed, 358,883 bytes gzipped / 400,000-byte budget.
- `npm test -- --maxWorkers 1 --no-file-parallelism`: all 1,040 repository tests passed in 78 files. Initial parallel run reported five timing failures in untouched game tests plus the SEO build's shared-cache write failure. After isolating caches locally, the serial run passed every test without changing thresholds or application code.
- Read-only diff review: no application/simulation/runtime dependency changes; old strategy branches, prompts, seeds and gates preserved; plan validator sees the same effective ledger as its prompt; second-call context contains only selected evidence; act selector has no gold-based proxy dependency; rescoring preserves the new gate. No remaining critical/important implementation finding identified. Lexical matching and verifier false positives/negatives remain research limitations.

## Rulings and follow-up

- The task arrived in a dedicated worktree on `research/act-router`, with `build/village` checked out in another worktree and `.git` read-only. Stayed in that worktree, preserving its untracked brief and live-results symlink. The controller can apply the explicit files to `build/village`; switching this worktree would have conflicted with the existing checkout. No commit was attempted, as the brief forbids it.
- Referenced reports 40 and 41 were absent here; read their exact files from `/Users/maddy/B2B/rumortown/agent-tradeoff/reports/` read-only. The original data exports were also read there; no dataset regeneration or live result writes were performed.
- Initial dependency setup was a symlink into the main checkout, so Vite's cache writes were denied. Native loading passed harness tests but the app config depends on bundled `__dirname`. A local ignored dependency-link directory now points at the same installed packages while keeping Vite caches local. No package/dependency bytes or manifests changed. This enables the exact normal smoke/build commands in this sandbox.
- Name-source with null teller means an explicit personal sighting; otherwise null source is rejected. Abstention/refusal remain legal without targets even on confidence/source requests. These choices avoid fabricated tellers and make the mandated fallback possible; they do not prove task completion.
- The controller owns later GPU evaluation and study-design decisions. The original three-split matrix and the separate transfer protocol above make the ambiguous “three splits” explicit. Do not conflate training agreement with wording transfer or treat historically inspected cases as fresh confirmation.
- UI and phone/keyboard checks do not apply: no UI changed. Replay pins are unchanged because no simulation code changed. Generated build-info files were not staged or reverted.

## Files to commit

Stage these explicit paths only (the brief and pre-existing live-results symlink are not implementation files):

```text
bench/slm/act-router.ts
bench/slm/act-diagnostic.ts
bench/slm/act-router.harness.test.ts
bench/slm/fixtures/act-requests.json
bench/slm/strategies.ts
bench/slm/baselines.ts
bench/slm/rescore.ts
bench/slm/smoke.harness.test.ts
bench/slm/README.md
agent-tradeoff/reports/42-report.md
```

Plain commit message: `42: Add validated act routing and act-aware best-of-four`

Use repository author `Madhav Sunil <94164709+Maddy824@users.noreply.github.com>`; no assistant attribution or co-author trailer.

STATUS: DONE

Tests: 88 harness and 1,040 repository tests passed; root and strict core typechecks, production build, bundle gate and diff whitespace check passed. No model evaluation run.
