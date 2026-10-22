# 31: The controller's review of "Catch the bluff" (31-website-idea-review.md)

## What it gets right

- **Honest and shippable.** Recorded small-model replies cost $0 at any scale, need no new dependency, no typed text and no server inference, and the plan ships in a week. The disclosure ("recorded model replies") avoids pretending to be live.
- **It puts real SLM output in front of people.** Players judge actual Qwen3-0.6B replies, with the raw, guarded and tuned arms blinded. That is research data the paper needs (human judgments of usefulness and evidence errors), and it shows the anti-silence trade-off: "dodges the question" is a first-class verdict.
- **The reveal teaches the core distinction.** Separating "Mira believes a false rumour" from "the model invented a witness" makes the paper's main idea visible in one screen.
- **Careful feasibility.** Real download sizes (Qwen3-0.6B MLC 352 MB), cited speed measurements, iOS and Android WebGPU caveats, and the right call to keep in-browser inference as a separate, later, opt-in lab.
- **Integration detail I missed:** the challenge must bypass the orchestrator's deterministic shortcuts, or "who told you?" tests the router instead of the model; and `villagerFacts` shows four beliefs while `factRefs` holds more, so the model's view and the verifier's references must be aligned first.

## Where I think it falls short

1. **No reason to come back.** A fixed pack of 216 recorded replies is exhausted in a few sessions; once seen, the answers are known and shareable. Gandalf and Wordle both had a renewal mechanism (harder levels, a new puzzle daily). Without one, spread stalls after the first wave.
2. **Low agency.** Three authored question buttons and a four-way verdict make the player a labeller. It risks feeling like annotation work in a costume. Gandalf's pull was free-form attack; the free-form version here is deferred to the browser lab.
3. **Missing the "tiny against giant" number.** The precedents it cites spread because a small model was compared with something big. Here the player judges the small model but never sees it measured against people or a large model on the same task.
4. **The share is weak.** "Pack and score" is identical content for everyone; there is no spoiler-free grid that invites comparison.
5. **Player labels are noisy and selection-biased.** The proposal says so and does not count votes as independent evidence, which is right; it means the research value is mainly the demonstration and the hard-case collection, not the labels.

## What I would take into a merged design

Keep the bluff round exactly as designed (recorded, blinded arms, verdict before reveal, two-layer reveal). Fix the first four gaps by making it **daily**: each day a new seeded rumour, generated and recorded in advance as a season pack, with a short "Who knows?" round where the player answers belief questions by tapping, then one bluff to catch. The share is a spoiler-free grid with the day's number and how the tiny model and a large model did on the same questions.
