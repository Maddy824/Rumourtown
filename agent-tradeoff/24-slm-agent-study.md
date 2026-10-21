# 24: Study — small language models as grounded agents in a deterministic world

Owner direction: make Rumourtown a research platform as well as a game, studying agents on small language models (SLMs), and keep the system technically lean. This file is the study design and the build list.

## Research question
When a deterministic simulation holds the truth about every agent (beliefs with provenance, moods with causes, relationships) and an orchestrator decides per message whether a model is needed at all, **how small can the model voicing each agent be before it stops being trustworthy?** And what does it cost in latency and money to stay trustworthy at each size?

Why it is interesting: most "LLM agent" work lets the model own the agent's state, so failures are hallucinated memories and drifting personas. Here the state is owned by a research-grounded simulation, and the model only speaks for it. That turns hallucination into something measurable (a statement either matches the agent's facts or it does not) and makes small models viable, which matters for cost, latency and on-device play.

## Hypotheses
1. Routing removes most model calls: at least 60% of player messages (moves, visits, provenance questions, news) can be answered exactly from state with no model.
2. With grounding, an 8B model matches a 70B model on fact fidelity for conversation, but not on structured interpretation of open stories (pilot: 6/12 vs 10/12 on naming the culprit).
3. A cascade (SLM first, verified against the agent's facts, escalated to a larger model only on failure) keeps 70B-level fidelity at a fraction of 70B calls.
4. Persona consistency depends more on grounding than on model size.

## Conditions
- Models (Workers AI, free tier): `llama-3.2-3b-instruct`, `llama-3.1-8b-instruct-fast`, `llama-3.3-70b-instruct-fp8-fast`; optionally an on-device SLM in the browser (WebGPU, Qwen-class 0.5–1.5B) for desktop users.
- Grounding: none (cast list only, the original design) vs facts from the orchestrator.
- Routing: always-model vs orchestrated.
- Cascade: single model vs 3B → 70B escalation on verification failure.

## Metrics (all automatic, reproducible from a seed)
- **Fact fidelity:** share of factual claims in a reply that are supported by the agent's facts; hallucination rate = unsupported claims about people or events. A claim extractor maps reply sentences to (subject, predicate) and checks them against the facts and the simulation's ground truth.
- **Action accuracy:** move, visit and command intents resolved to the right target (the 20-phrasing suite in `agentic/orchestrator.test.ts`, extended to 200).
- **Interpretation accuracy:** actor, affected, valence and severity on the story set (12 pilot items, extend to the 200 in `apps/api/evals/lies.json`).
- **Persona consistency:** a judge model (70B) blind-scores whether a reply fits the villager's dossier voice, plus a cheap lexical check against each villager's catchphrases and register.
- **Injection resistance:** the injection items in the eval set.
- **Cost and speed:** model calls per 100 player messages, p50/p95 latency, Workers AI neurons and OpenRouter dollars.

## Pilot data already collected (2026-10-22, `reports/qa-2026-10-22.md`)
| Model | Culprit named | Valence | Failures | Median |
|---|---|---|---|---|
| 3B | 3/12 | 4/12 | 2 | 0.6 s |
| 8B | 6/12 | 8/12 | 1 | 0.7 s |
| 70B | 10/12 | 11/12 | 0 | 1.5 s |
Ungrounded chat invented facts with both 3B and 70B; orchestrated routing answers moves in 55 ms with no model.

## Build list (in order)
1. `bench/agents/` harness: replays a fixed set of 300 player messages (moves, visits, provenance, news, open conversation, injections) against fixed seeds and villagers, through the orchestrator and through each model condition, via a local Worker. Outputs `bench/agents/results.md` with the metrics table and a CSV.
2. Fact verifier (`agentic/verify.ts`): extracts factual statements about cast members from a reply and checks them against the facts given; used both as the metric and as the cascade's escalation trigger. Unit-tested on hand-labelled replies.
3. Cascade in the Worker: `/play` tries `WORKERS_AI_PLAY_MODEL` small first; if the client-side verifier (or a server-side twin) finds an unsupported claim, re-ask the large model once. Ledger and limits unchanged.
4. On-device experiment (optional, desktop only, behind a setting): a WebGPU SLM voices villagers with the same facts; same metrics, zero server cost.
5. Write-up: `docs/research/slm-agents.md` with method, results, limits and what it means for building agents; a summary table in the README. Claims must match the data.

## What to say on the CV (only once the numbers exist)
"Built a research platform where 36 research-grounded agents live in a deterministic simulation and small language models voice them only when needed; measured hallucination, persona consistency, cost and latency across 3B, 8B and 70B models and an SLM-first cascade."
