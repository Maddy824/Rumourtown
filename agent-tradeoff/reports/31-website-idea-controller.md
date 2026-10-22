# 31: Website idea, the controller's independent view (22 October 2026)

Written before reading the Codex review (`31-website-idea-review.md`).

## What spreads, in one line each

- **Wordle:** one daily puzzle, the same for everyone, a spoiler-free shareable grid.
- **Gandalf (Lakera):** "make the AI tell you the password", levels that get harder, bragging rights; players produced a huge attack dataset as a by-product.
- **TinyStories / Phi-1 / TRM:** a tiny model beating giants on something people care about.
- **AI Town:** watch little agents live their lives.

Rumourtown already has the AI Town part. The missing ingredients are a daily ritual, a challenge against the model, and a "tiny beats giant" number.

## Five candidates

1. **Who knows? (daily theory-of-mind puzzle).** Each day one seeded rumour spreads through the village in fast-forward. The player answers four questions with taps, not typing: "Does Rosa know?", "Who did Ben hear it from?", "What does Tom think Mira believes?", "Who is wrong but sure?". Then the reveal: your score next to a 600M model and a 70B model on the same puzzle, plus a shareable grid. Spreads like Wordle. Research: a large human baseline on simulator-generated theory-of-mind questions with exact answers, and a public human-against-model comparison. Cost: about $0, because the models answer each day's puzzle once, offline; players only tap. Risk: it must be fun, not homework.
2. **Keep the secret (Gandalf-style levels).** Each level a villager guards something: a secret, or knowledge they do not have ("make Pim confirm a rumour he never heard"). Defences rise by level: prompt only, grounded facts, the verifier guard, the fine-tuned small model, both. Spreads through bragging. Research: attack success per defence on an opt-in, moderated dataset; the information-flow paper's red team. Cost: a model call per message, so it needs an in-browser model or a strict daily quota. Risk: cost and abuse; typed text needs consent.
3. **Belief X-ray.** While you talk, each sentence a villager says shows a small source tag ("Mira told me") or a red mark when the guard caught something it should not know. Makes the research visible. Low cost, good companion to 1 and 2.
4. **A brain in your browser.** The villagers' voices run on a small model downloaded into the browser: no server, no cost, works offline. Strong technical wow; a heavy download on phones.
5. **The leaderboard page.** Public results of the benchmark: models against each other and against people. Credible, less fun on its own.

## Recommendation: "Who knows?", then "Keep the secret"

Start with **Who knows?** because it is the only idea that is daily, viral-shaped, nearly free at any scale, phone-friendly, needs no typed text (so no privacy problem), keeps the simulation deterministic, and directly produces the "tiny model against people and giants" result the research needs. The puzzle answers come from the simulation's exact state, so scoring is perfect.

Launch hook: *"Can you keep track of village gossip better than an AI? Today's rumour: 4 questions, 1 minute."*

Then **Keep the secret** as phase two, once an in-browser small model or the Workers AI adapter makes per-message calls affordable. It turns players into the red team for the information-flow research.

Belief X-ray ships inside both, as the reveal.

## Research value

- Human performance on exactly the questions small models are tested on, by difficulty (first-order, second-order belief, source, confidence). Few theory-of-mind benchmarks have large human baselines on fresh items.
- Fresh items every day: no contamination.
- The same items answered offline by the base and fine-tuned small models, the 4B teacher and a 70B reference: a daily, public measurement.
- Consent: answers are taps, anonymous, and stored only as aggregate counts per question and option, with an explicit note.
