# Open rumors

Owner instruction: public input must not be restricted to twelve categories or an ever-growing matcher.

The simulation contract gains `story` with open prose and bounded social annotations: actor, affected person, reputation valence, importance, and an optional clarifying question. The event itself has no taxonomy. Unknown actors use the neutral village topic, so a victim is not blamed. Existing authored claims/replay semantics remain compatible. Player allegations never become world-state facts or eyewitness evidence.

This owner-requested change supersedes the earlier blanket ban on typed prose in dialogue and replay links. Exact wording is only registered after an explicit preview and disclosure that dialogue, research exports and shared links contain the story. Unsent text stays out of those surfaces. No raw prose enters backend caches or logs. Sharing remains the player's choice, although the local address hash updates after confirmation as it already does for published library stories.

A single budgeted inference may annotate a novel story and suggest one question. Ongoing simulation speech is local, seeded and bounded. Typed stories bypass the legacy local classifier: its first-mentioned-person heuristic can reverse passive roles. This increases inference demand, bounded by the unchanged shared limits; authored library stories and neutral play remain free. A neutral local fallback keeps novel stories playable during outages and cap exhaustion. This is not a promise of omniscience, reliable fact checking, or arbitrary new gameplay mechanics.

## Research basis and limits

[Johnson, Hashtroudi and Lindsay (1993), Source monitoring](https://pubmed.ncbi.nlm.nih.gov/8346328/) describes how people attribute information to sources, including errors that mix fiction and fact. The engineering implication used here is to keep an allegation's provenance separate from witnessed evidence; generated language cannot add an observation.

[Brady et al. (2017), Emotion shapes diffusion](https://pmc.ncbi.nlm.nih.gov/articles/PMC5514704/) found associations between moral-emotional language and diffusion in political social-media networks, including group-boundary effects. The existing simulation's salience, relationships and belief state provide a limited analogue; we do not transplant the paper's coefficients or claim they validate a fictional village. General knowledge is supplied by the model's learned language understanding, while character knowledge comes from each ledger. These are deliberately different sources.

The feature is useful for reproducible experiments with social transmission, not a validated predictor of real populations. AI annotations are fallible and user-correctable; general world stories remain allegations rather than fact-checked news.

Open stories receive a bounded novelty/importance bonus of `0.12 + 0.06 × severity` when the listener has not heard them. It competes with the numerous preloaded authored rumors, uses the existing 0.85 utility cap, and changes telling decisions only, never confidence or evidence. This is gameplay tuning, not an empirically estimated psychological coefficient.
