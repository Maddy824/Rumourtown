# Independent read-only review

Base: `37b1784`. Intended tracked and untracked changes reviewed; unrelated build-info, `19b-report.md` and `seo.test.ts` excluded. No edits, model inference or network calls by the reviewer.

Critical: none. Important: one found and resolved.

## Resolved: unrelated firsthand evidence

The old witnessing loop treated written stories as authored facts by category. Reproduced with seed 731: Rosa seeing Ada give her a shawl acquired firsthand belief in the unrelated library story about mending Ben's coat. `apps/rumortown/src/sim/agents/witness.ts:35` now excludes written stories and prevents them from authorizing typed evidence. Independently repeated the scenario after the fix: the actual shawl witness remains; false firsthand events are zero. Three regression tests cover positive/negative stories and typed-evidence contamination.

## Minor, deferred

`apps/rumortown/src/ui/whisper.ts:343`: choosing a library story during pending typed interpretation correctly invalidates the old response, but Whisper remains disabled until that request finishes. A later UX change can release the free selection while preserving revision protection. No incorrect claim is applied.

## Requirements

| Requirement | Assessment |
|---|---|
| 24 reusable static stories; strict validation and stable loading | Met |
| Browse without simulation mutation or inference | Met |
| Selection races and self-subject protection | Met, with minor waiting-state observation |
| Published sentence preserved through written-claim replay | Met |
| No invented eyewitness evidence | Met after fix |
| Isolated owner-operated drafting; argument handling and preserved failures | Met on inspection and mocked tests |
| Preview without inference; no automatic merge/push/deploy | Met |
| Lightweight model configuration with unchanged spending boundaries | Met |
| Actual coding-agent execution and live model quality/availability | Cannot verify without inference; disclosed |

Independently ran 74 scoped pack/UI/provider/drafting tests and the real-engine witness reproduction. Controller verification: 827 tests, typecheck, production build and bundle gate passed; 353,767 / 400,000 bytes. Supplied desktop/360 px evidence records no overflow, no inference calls and preserved replay wording.

Verdict: ready to commit and release through the established process.
