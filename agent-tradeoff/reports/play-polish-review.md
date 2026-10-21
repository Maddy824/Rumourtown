# Play and presentation review

Read-only review covered the current audio lifecycle, shared inference boundary, conversation UI integration, rumor playback and written-claim grammar.

## Findings addressed

- An audio scheduling failure could leave a running context while the control said off. The failure path now clears its interval and suspends the context.
- Visiting a sleeping or unavailable person could silently select another nearby speaker. Explicit visits now preserve the intended recipient, or explain that they are asleep/out of reach and select the village narrator. Crowded-space selection keeps the requested awake person. Two regression tests cover this.
- Multi-topic conversations lost line-level claim, listener and speech-act context. The live script now follows the selected rumor and its authored corrections. The full transcript remains in history, and the panel names the current speaker/listeners and rumor.
- Arbitrary written prose could become a false first-person eyewitness statement or malformed conjugation. Written claims now remain quoted and attributed. Countable taxonomy objects receive articles without changing their canonical fields or ids.

## Boundary checks

Both `/play` and `/interpret` use the same admission, visitor/global quota, reservation, funding and settlement path. Paid dispatch is still conditional on a funded hold. Conversation prose/context/replies never enter caches, ledger calls or phone digests. Server and browser both validate proposed actions and destinations. Action proposals need a click before execution.

Independent probes exercised free, paid and fallback settlement, exhausted budgets, a shared visitor quota across routes, and absence of prose in ledger storage. Existing Worker/provider tests passed; committed `/play` and client-boundary regression tests now retain the important cases.

UI inspection verified abort/revision checks on close or recipient changes, default-off line/reading controls, movement releasing camera following, and modal cleanup. Browser evidence and full-suite results are in `play-polish-report.md`. Live provider response quality is separate from mocked browser validation.
