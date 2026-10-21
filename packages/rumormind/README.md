# Rumormind

Zero-dependency, engine-agnostic TypeScript for beliefs with provenance, relationships,
gossip, retelling, mood, side-taking and repair. Callers supply ticks and randomness;
the library has no scheduler, framework, DOM, wall clock or network access.

Import the public API from `rumormind`. Use `createRng(seed)` for reproducible runs;
custom `Rng` functions must return numbers in `[0, 1)`.
Numeric inputs must be finite. Scoring functions clamp input factors to the documented
ranges; their outputs are model utilities, not calibrated psychological probabilities.

## Usage

For a published release, install `rumormind` and save this example as `example.mjs`.
Run it with `node example.mjs`; the package ships ES modules and TypeScript declarations.
In this repository, first run `npm install` and `npm run build -w packages/rumormind`.
The example prints `0.646`, `0.560` and `0.75`.

```js
import { BeliefLedger, ClaimRegistry, createRng, DEFAULT_TUNING, Relationships } from 'rumormind';
const rng = createRng(42);
const registry = new ClaimRegistry([
  { id: 'theft', kind: 'theft', about: 'tom', valence: -1, contradicts: ['delivery'] },
  { id: 'delivery', kind: 'kindness', about: 'tom', valence: 1, contradicts: ['theft'] },
]);
registry.validate();
const ledger = new BeliefLedger('mira', rng);
const relations = new Relationships();
relations.setTrust('mira', 'rosa', 0.6);
const theft = registry.get('theft');
const delivery = registry.get('delivery');
ledger.hear(theft, registry.claims, {
  source: 'rosa', strength: 1, trust: relations.trust('mira', 'rosa'), tick: 1,
});
console.log(ledger.confidence('theft').toFixed(3)); // 0.646
ledger.see(delivery, registry.claims, 2);
console.log(ledger.confidence('theft').toFixed(3)); // 0.560
relations.setTrustCeiling('mira', 'stranger', DEFAULT_TUNING.exposedLiarTrustCeiling);
console.log(relations.adjustTrust('mira', 'stranger', 1)); // 0.75
```

## Public interface

- `BeliefLedger(owner, rng, tuning?)`: `hear`, `see`, `confidence`, `knows`,
  `rememberedOrigin`, `forget` and `toJSON`. Hearing and seeing accept a
  `ReadonlyMap<ClaimId, Claim>` for resolving contradictions.
- `Relationships(tuning?, defaultTrust = 0.5)`: directed trust, affinity, setters,
  adjustments and symmetric `closeness`. Negative trust adjustments weigh more than gains.
- `tell(...)`: transfer a speaker's belief and possibly its remembered attribution.
  `tellScore(input, tuning?)` and `tellThreshold = 0.7` support gossip decisions.
- `Claim`, `ClaimId`, `CharacterId`, `Tuning`, `DEFAULT_TUNING`, `Rng`, `createRng`,
  `clamp`, `logit` and `sigmoid` remain available.

`relationships.setTrustCeiling(from, to, ceiling)` sets a directed ceiling in
`0..1` and immediately lowers existing trust if necessary. Later `setTrust` and
`adjustTrust` calls respect it. Call it with
`DEFAULT_TUNING.exposedLiarTrustCeiling` (`0.75`) after exposure; the library does
not detect lies itself. There is no expiry. Calling the setter again replaces the
ceiling, so callers enforcing permanent exposure should never raise it.

## Claim registry

`RegisteredClaim` extends `Claim` with optional `alternativeOf: ClaimId`. This field
belongs on the innocent explanation and points to the accusation it explains away.
`ClaimRegistry<C extends RegisteredClaim>` preserves any additional claim fields.

```ts
import { ClaimRegistry, type RegisteredClaim } from 'rumormind';

const claims: RegisteredClaim[] = [
  { id: 'stole', kind: 'stole', about: 'tom', valence: -1, contradicts: ['gaveTo'] },
  {
    id: 'gaveTo', kind: 'gaveTo', about: 'tom', valence: 1,
    contradicts: ['stole'], alternativeOf: 'stole',
  },
];
const registry = new ClaimRegistry(claims);
registry.validate();
registry.contradictionsOf('stole'); // [the gaveTo claim]
registry.alternativeOf('stole'); // the gaveTo claim
```

The constructor accepts an iterable of claim objects and defaults to empty. Use
`add(claim)` to register and `get(id)` to retrieve. Duplicate ids throw.
`registry.claims` is the map accepted by `BeliefLedger` and `tell`; claims are held by
reference. Register every claim before calling `validate()`, and validate again after
editing links. Validation rejects missing contradiction targets, self contradictions,
non-mutual contradictions and missing alternative targets.

`contradictionsOf(id)` returns resolved claims in the authored `contradicts` order.
Unknown ids return `[]`; unresolved targets are omitted until validation catches them.
`alternativeOf(id)` performs a reverse lookup, returning the first registered explanation
whose `alternativeOf` points to `id`, or `undefined`. It does not infer alternatives
from valence or treat the link as bidirectional.

## Retelling

`retell(claim: Retelling, rng, tuning?: Partial<RetellTuning>)` returns a fresh
`{ core, details, qualifiers }`. Core text is preserved, surviving strings keep their
order, and neither the input arrays nor tuning data are mutated.

```ts
import { createRng, retell } from 'rumormind';

const next = retell({
  core: 'Tom carried bread.',
  details: ['at dawn', 'for Ada', 'without paying'],
  qualifiers: ['I think'],
}, createRng(42), {
  detailDropRate: 0.2,
  qualifierDropRate: 0.1,
  inventionRate: 0.025,
  inventionPool: ['the basket was covered'],
  detailTags: new Map([
    ['for Ada', ['social']],
    ['without paying', ['negative']],
  ]),
});
```

`DEFAULT_RETELL_TUNING` uses detail loss `0.2`, qualifier loss `0.1`, invention
probability `0.025`, an empty invention pool and no tags. Rate overrides are clamped
to `0.1..0.25`, `0.05..0.15` and `0..0.05`, respectively. These are independent
per-item loss probabilities, not guaranteed percentages in each short story.

Keep strings unchanged and provide tags via `detailTags`, a read-only map keyed by
the exact detail string. Either `social` or `negative` halves the detail's loss
probability; both tags together still halve it only once. Untagged details use the
full rate. Qualifiers do not receive the tag preference.

At most one invention is appended, sampled uniformly over eligible pool entries.
Entries already present in the original details are ineligible, even if dropped.
An empty eligible pool prevents invention. Duplicate eligible pool entries act as
sampling weights. RNG calls follow details, qualifiers, then an invention trial if
the eligible pool is nonempty, then a pool selection if that trial succeeds.
The same input, tuning and RNG sequence reproduce the same output.

## Mood and appraisal

`Mood` holds named modifiers:

```ts
import { Mood, appraise } from 'rumormind';

const mood = new Mood();
mood.add('accused in public', -0.7, 100);
mood.add('defended by a friend', 0.3, 50);
mood.value(49); // -0.4, within floating-point precision
mood.value(50); // -0.7
mood.list(50); // [{ label: 'accused in public', delta: -0.7, untilTick: 100 }]
mood.expire(100); // permanently discard expired modifiers

const emotions = appraise({ goalImpact: -1, blame: 1, certainty: 0.8, control: 0.5 });
// { anger: 0.4, fear: 0.6, shame: 0, gratitude: 0 }
```

Adding the same label replaces its delta and expiry. A modifier applies immediately,
with exclusive expiry: it is live only when `tick < untilTick`. There is no stored
start tick or historical timeline. `value(tick)` sums live deltas, then clamps the
total to `-1..1`. `list(tick)` returns independent copies in insertion order.
Neither read method removes data; `expire(tick)` does, and can be called repeatedly.
`add` rejects non-finite deltas and expiry ticks.

`appraise(input: AppraisalInput): Appraisal` returns anger, fear, shame and gratitude
in `0..1`. `goalImpact` ranges from `-1` (harm) to `1` (benefit). `blame` ranges from
`-1` (self) through `0` (nobody) to `1` (another person); for benefits it means credit.
Certainty and control are `0..1`. With `harm = max(0, -goalImpact)` and
`other = max(0, blame)`, the tuned formulas are:

- Anger: `harm * other * certainty * control`.
- Fear: `harm * (1 - certainty * control)`.
- Shame: `harm * max(0, -blame) * certainty`.
- Gratitude: `max(0, goalImpact) * other * certainty`.

## Side-taking

`sideScore(input: SideScoreInput)` returns
`loyaltyToAccuser - loyaltyToAccused + perceivedWrongness + expectedReciprocity - conflictCost`.
Loyalties and conflict cost are `0..1`. Wrongness and reciprocity are signed
`-1..1`: positive supports the accuser, negative supports the accused.
Conflict cost is specifically the cost of backing the accusation; the subtraction
can move the score toward the accused. General reluctance to take either side can
instead be expressed through a higher choice threshold.

`chooseSide(score, threshold = 0.4)` returns `'accuser'` at or above the positive
threshold, `'accused'` at or below its negative, and `'neutral'` between them.
Zero always stays neutral, including with a zero threshold. A negative or non-finite
threshold throws. All terms have unit weight; this is a tuned decision rule.

## Forgiveness and trust repair

`forgivenessScore(input: ForgivenessInput)` takes six `0..1` inputs. Perceived intent
means intent to cause harm. The score is:

```text
clamp(0.5 + 0.42 * apology + 0.51 * empathy
          - 0.49 * perceivedIntent - 0.41 * anger
          + 0.2 * relationshipValue - 0.2 * exploitationRisk, 0, 1)
```

The four specified correlate values are used verbatim. The intercept, additive use
of correlations, relationship and risk weights, and clamping are tuning decisions.
Increasing apology, empathy or relationship value never lowers the score; increasing
intent, anger or exploitation risk never raises it. Saturation can flatten changes.

`trustRepair({ kind, response })` returns a multiplier for a **positive repair
increment**, to be applied through `Relationships.adjustTrust`. It does not multiply
existing trust or guarantee full recovery.

| Kind | Apology | Denial | Denial with evidence |
|---|---:|---:|---:|
| `integrity` | 0.6 | 0.8 | 1.2 |
| `competence` | 1.2 | 0.6 | 1.0 |

Response literals are `'apology'`, `'denial'` and `'denial-with-evidence'`.
All multiplier magnitudes are tuned. Integrity repair favours exonerating evidence;
competence repair favours apology over bare denial.

## Evidence

Sources below are carried over from the repository's
[design evidence table](../../docs/superpowers/specs/2026-10-21-rumortown-design.md#8-simulation-rules-and-defaults)
and existing `tuning.ts` comments; they were not independently reverified online.
“Measured direction” distinguishes an empirical pattern from a tuned numerical
implementation. Rows describe implemented library rules, not every planned game rule.

| Rule | Default | Measured or tuned | Source |
|---|---|---|---|
| Mutual claim contradictions | Explicit validation; both links required | Tuned data invariant | Task 2 brief |
| Alternative explanation lookup | First registered reverse `alternativeOf` link | Tuned API convention | Task 2 and Task 3 build briefs |
| Hearsay evidence | `hearsayWeight = 1.0`, scaled by trust and strength | Tuned; measured advice-taking direction | Bailey et al. 2023, 346 effects |
| First-hand evidence | `firsthandWeight = 2.5` | Measured direction; tuned multiplier | Weizsäcker 2010 |
| Repeated-origin evidence | `nonIndependentFactor = 0.5` | Measured direction; tuned factor | Weaver 2007; Yousif 2019 |
| Familiarity | `min(1.0, 0.45 * (n - 1)^0.25)` for `n > 1`; zero on first hearing | Measured direction; tuned scale and cap | Ye et al. 2026; Hassan & Barber 2021 |
| Motivated acceptance | First-hearing prior offset: `valence * 0.6 * affinityToTarget` log-odds | Tuned extrapolation | Pfänder & Altay 2025 |
| Correction with an alternative | Remove `0.6` of positive log-odds at full credibility | Measured direction; tuned fraction | Walter & Murphy 2018 |
| Bare correction | Remove `0.4` at full credibility | Measured direction; tuned fraction | Walter & Murphy 2018 |
| Continued influence | Residual `0.2` of peak positive log-odds; never raise belief | Measured direction; tuned fraction | Ecker 2022 |
| Passing source attribution | `attributionPassRate = 0.5` | Tuned | Transmission-chain work, as cited by the design |
| Source memory loss | `sourceMemoryHalfLifeTicks = 240`; per-tick chance `ln(2) / 240` | Tuned | Source-monitoring literature, as cited by the design |
| Trust loss asymmetry | Negative adjustments multiplied by `2` | Measured direction; tuned multiplier | Schweitzer 2006 |
| Exposed liar trust ceiling | `0.75` of full trust, applied explicitly with `setTrustCeiling` | Measured direction; tuned ceiling | Schweitzer 2006 |
| Confidence drives telling | Confidence coefficient `1`; decision threshold `0.7` | Measured direction; tuned score | DiFonzo & Bordia; Pezzo & Beckstead 2006 |
| Negative content sharing | Odds `1.5`, contributing `ln(1.5)` to tell score | Measured odds; tuned score mapping | Acerbi 2022 |
| Gossip recipient closeness | `+0.3` listener closeness; `-0.3` target closeness for harmful claims | Measured pattern; tuned weights | Dores Cruz et al. 2021 |
| Stifling when listener knows | Tell score `-0.6` | Tuned model | Maki–Thompson rumor models |
| Interesting-if-true | Tell score `+0.2 * interest` | Measured direction; tuned weight | Altay et al. 2021 |
| Detail loss per retelling | `0.2`, constrained to `0.1..0.25` | Measured direction; tuned probabilities | Moussaïd 2015; Bebbington 2017 |
| Qualifier loss per retelling | `0.1`, constrained to `0.05..0.15` | Measured direction; tuned probabilities | Task 2 brief; transmission-chain sources in the design |
| Invention per retelling | `0.025`, constrained to `0..0.05`; empty pool disables | Tuned probability | Task 2 brief |
| Preferred detail survival | Social or negative tags halve the drop rate once | Measured direction; tuned half-rate | Bebbington 2017; Task 2 brief |
| Mood causes | Named replacement, exclusive expiry, sum clamped to `-1..1` | Tuned | Design section 7, RimWorld pattern; Task 2 brief |
| Anger appraisal | Harm × other blame × certainty × control | Tuned | Design section 7 appraisal inputs; Task 2 brief |
| Fear appraisal | Harm × (1 − certainty × control) | Tuned | Design section 7 appraisal inputs; Task 2 brief |
| Shame appraisal | Harm × self blame × certainty | Tuned | Design section 7 appraisal inputs; Task 2 brief |
| Gratitude appraisal | Benefit × other credit × certainty | Tuned | Design section 7 appraisal inputs; Task 2 brief |
| Side score | Loyalty difference + wrongness + reciprocity − conflict cost; unit weights | Theory and experiments; tuned formula | DeScioli & Kurzban, as cited by the design |
| Side choice | Neutral for magnitude below `0.4`; zero always neutral | Tuned threshold | Task 2 brief |
| Apology and forgiveness | Coefficient `+0.42` | Measured correlate; tuned use as additive weight | Fehr et al. 2010 meta-analysis |
| Empathy and forgiveness | Coefficient `+0.51` | Measured correlate; tuned use as additive weight | Fehr et al. 2010 meta-analysis |
| Intent and forgiveness | Coefficient `-0.49` | Measured correlate; tuned use as additive weight | Fehr et al. 2010 meta-analysis |
| Anger and forgiveness | Coefficient `-0.41` | Measured correlate; tuned use as additive weight | Fehr et al. 2010 meta-analysis |
| Relationship value and forgiveness | Coefficient `+0.2` | Tuned magnitude; specified positive direction | Task 2 brief |
| Exploitation risk and forgiveness | Coefficient `-0.2` | Tuned magnitude; specified negative direction | Task 2 brief |
| Forgiveness baseline and bounds | Intercept `0.5`, clamp to `0..1` | Tuned | Task 2 implementation |
| Integrity trust repair | Apology `0.6`, denial `0.8`, evidence-backed denial `1.2` | Measured ordering for evidence versus apology; tuned multipliers | Kim et al. 2004, as cited by the design |
| Competence trust repair | Apology `1.2`, denial `0.6`, evidence-backed denial `1.0` | Tuned multipliers | Task 2 implementation |

## Checks

Simulation maths uses fixed-order `deterministicExp`, `deterministicLog`,
`deterministicSqrt`, `deterministicHypot` and `deterministicPow` helpers. Native
transcendental implementations can differ in their final bits across engines.
The game pins the same raw replay hash in Node 22, Node 25 and a browser check;
its CI runs the Node versions separately. `deterministicPow` supports nonnegative
bases, which covers the model's familiarity and memory-decay rules. Renderers
can continue using native `Math` for visual work.

From the repository root:

```sh
cd packages/rumormind && npx tsc --noEmit
```

Then, again from the repository root:

```sh
npx vitest run packages/rumormind
```
