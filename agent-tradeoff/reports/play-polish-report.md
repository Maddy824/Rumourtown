# Quiet music, natural play and a luminous arrival

## Requested behavior

- The welcome remains open until a deliberate click or key. A softer sky, halo, drifting lights and glowing hover/focus entrance replace the heavy cloud boards and white instruction strip. Day/night coloration and reduced motion remain supported.
- An original procedural ambient score starts on entry, with slow pads, sparse chimes and a fixed low master gain. More → Quiet music toggles it and remembers mute locally. Hidden tabs suspend audio; returning resumes it. No audio downloads, dependencies or AI calls.
- One short welcome replaces the three-card introduction. The main button is Talk or act. It selects a nearby awake villager where available, accepts natural conversation and requests, remembers three exchanges while open, and offers explicit action buttons. Spread a rumor remains available for actual rumor propagation.
- `/play` bypasses the local taxonomy matcher. A compact model prompt uses speaker voice, mood/activity, recent exchanges and known places. It asks for context on ambiguous input such as “kill”; it does not invent a generic rumor or an unsupported world change. Supported proposals are walking, visiting a villager, pause/resume and looking around. There are no combat or death mechanics.
- Natural watching is the default. More → Rumor lines and More → Read conversations are independent controls. Lines are optional; reading mode adds the slower conversation presentation. Next beat remains available as a deliberate reading action.
- The live conversation now retains speaker/listener/claim context and filters unrelated topics while preserving the full exchange in history. Written claims stay quoted rather than being rewritten into the villager's own eyewitness account. Countable objects read as “a loaf” or “a book”.

## Budget, privacy and replay

No spending limits, secrets, Wrangler environments, dependencies or billing configuration changed. Conversation and interpretation share the same global ledger, free-first provider sequence, $0.019 daily / $7 lifetime paid caps, visitor/global quotas and aggregate phone digests. AI activity and allowance failures are shown in the conversation panel. Walking shortcuts, background agents and music remain local. The phone subscription still needs the owner's setup.

Conversation text and generated replies are never put in the API cache, ledger, shared links or research exports. The browser keeps up to three exchanges in memory. This improvisation is distinct from deterministic simulated beliefs and background authored gossip.

The pinned authored replay remains `6137d96970f7a28e05e2fb37b57b9495274d1c256208d084818a336332994184` in Node tests and Chrome. Text changes affect typed countable-object claims and developer-written claims only; no action scheduling, beliefs or random draws changed. Written quotes still consume the same single random draw and respect rewind-memory clearing.

## Validation

- Root typecheck, full test suite, production build and compressed asset gate passed before the final review fix; the final full rerun and deployment evidence are appended below.
- Browser tests at 1280 × 800, 360 × 800 and 360 × 640 verified indefinite landing, keyboard entry, one-step welcome, freeform requests without rewriting, context history, explicit action execution, budget failure without a guessed rumor, line/reading toggles and keyboard mute. These conversation tests mock AI responses and spend no credits.
- Chrome rumor-view tests verified no forced scene or line by default, Next beat stopping at tick 78, the current rumor label, line toggling and turning reading off. Browser replay matches the pin.
- Actual Web Audio output was sampled for 18 seconds at desktop and phone widths: RMS approximately 0.00135–0.00138, peak below 0.008, with signal in every sampled window. No audio context before entry, one context after enabling, suspension on mute, and persisted mute after reload. This is signal verification, not a claim of a subjective listening review.
- Read-only review findings and resolutions: `play-polish-review.md`. Screenshots, browser scripts and result JSON are beside this report. Existing unrelated `19b-report.md`, `seo.test.ts` and generated build-info files remain outside these commits.

## Publication

Final root checks passed: typecheck, **795 tests in 68 files**, production build, **350,201 gzip bytes** under the 400,000-byte gate, and whitespace checks. The committed suite excludes the existing 12 untracked SEO tests (783 tests in 67 files). Two workers were used to avoid competing CPU-heavy suites; an earlier fully parallel run hit pre-existing wall-time thresholds under concurrent browser load. The final repeat passed without changing those thresholds. Production API dry-run compilation also passed with unchanged bindings and caps. Both independent reviews have no remaining Critical or Important findings.

Commit, CI and deployment evidence pending.
