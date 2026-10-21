# CI portability follow-up

The first GitHub Linux/Node 22 run passed typechecking and 518 tests but rejected the replay hash. Investigation compared the full event logs on Mac Node 25, Node 22 and Chrome. They contained the same 3,015 events and story; six Node-22 events and 22 Chrome events differed only in the last bits of belief probabilities. Native elementary maths is implementation-approximated, so seeded randomness alone is insufficient for byte-identical floating-point logs.

Added a dependency-free, fixed-order elementary-math implementation in `packages/rumormind/src/math.ts`: range-reduced 20-term exponential, 25-term logarithm, normalised eight-step Newton square root, scaled two-dimensional distance and positive-base power. No native exp/log/pow/sqrt/hypot is used by those helpers. Subnormal exponential scaling enters the subnormal range once, avoiding repeated rounding down to zero. Tests cover accuracy, extrema, signed zero, NaN, infinities, subnormals, model distances/decay and native-function independence.

Replaced the affected belief, gossip, familiarity, movement, witnessing-distance and reflection paths; rendering continues using native visual maths. This fixes the underlying arithmetic rather than rounding event serialization or accepting per-platform hashes.

Actual raw JSON logs are **500,614 bytes**, **3,015 events**, and byte-identical across Mac Node **22.23.3**, Node **25.8.2**, and Chrome. SHA-256:

`96b3b00e49f8703f5360d43dcda137466c42bbbdc45be8386ce9e8e2e234f983`

The prior 900-tick story is preserved: 1,700 lines, 545 belief events, exposed ending. The replay test pins the cross-runtime hash. CI now runs Node 22 and Node 25 as separate jobs, both checking the same value. Browser verification remains an actual local Chrome check, not an automated Safari claim.

All **523 tests across 30 files** pass in the local Node 22 run; typecheck, library build, production build and **296,646/400,000-byte** asset gate pass. Updated benchmark and package dry-run results: 24 villagers run 2,700 ticks in 526.8 ms; the 60-person stress case has a 24.8933 ms p95. The archive is now **18,696 bytes**, **55,757 unpacked**, **29 files**, adding `dist/math.js` and `dist/math.d.ts` to the earlier pack list. These supersede the earlier benchmark/pack snapshots.

Independent read-only numeric review approved the diff, with no Critical or Important findings. It ran 13 focused math/replay tests, checked the bundle gate, and swept 20,001 exponential inputs with a maximum 8.9×10⁻¹⁶ relative error against native results. Overflow, underflow and special values passed. Existing public signatures are unchanged; helper exports are additive.
