# Research

Rumourtown separates the world's state from each villager's beliefs. This makes it possible to ask whether generated dialogue stays faithful to what a character knows, including false beliefs, uncertainty and remembered sources.

- **Epistemic faithfulness:** does the reply match this character's beliefs, confidence and sources?
- **World faithfulness:** is the reply true in the authored world?

A villager can faithfully repeat a lie they believe. Inventing an eyewitness account is a different error. These distinctions concern a synthetic game world; they do not validate the simulation as a model of real people.

## Current plan

[Useful within bounds](research-plan-2026-10.md): the merged research plan of 22 October 2026, covering what to claim and not claim, the measurement fixes that come first, the training and bank-transfer experiments, and the timeline. The fine-tuning study it builds on is [here](finetune-study.md).

## What is implemented

The [SLM harness](../../bench/slm/README.md) exports real seeded simulation snapshots, separates held-out seeds and story mechanisms, and generates probes across twelve stress axes. It compares persona-only prompting, grounding, citations, planning, verifier-guided sampling, cascades and schema-constrained output. Fixture and smoke tests check the harness without model calls. Generated datasets and run outputs stay out of git.

The browser [verifier](../../apps/rumortown/src/agentic/verifier.ts) labels reply sentences against belief records. The [runtime guard](../../apps/rumortown/src/agentic/guard.ts) removes sentences it labels unsupported or contradictory and supplies an ignorance reply when none remain. The [orchestrator](../../apps/rumortown/src/agentic/orchestrator.ts) answers supported moves, visits, provenance questions and news from local state before asking a model.

## What has been measured

The [verifier development notes](verifier-notes.md) record 20/20 core cases and 2/4 hard cases on a small development set, both with rules alone and with local embeddings. Those are development observations, not held-out precision or recall. Implication and world-knowledge mappings remain failure cases.

Fixture smoke runs validate transports, methods and result handling. They do not measure real model quality, latency or cost. The comparative model study, independent human annotation, browser inference and fine-tuning remain planned work. No smallest faithful model has been established.

## Reading map

| Document | Purpose |
|---|---|
| [Research model](../research-model.md) | Belief rules, evidence, parameter choices and limitations |
| [SLM limits program](slm-limits-program.md) | Hypotheses, twelve stress axes, inference methods and training plans |
| [Paper plan](paper-plan.md) | Baselines, human validation, metrics and threats to validity |
| [Verifier notes](verifier-notes.md) | Development measurements and known errors |
| [Product impact](product-impact.md) | Implemented features and planned uses of research results |
| [Literature review](literature-2026-10-22.md) | Related work and limits on novelty claims |
| [Harness guide](../../bench/slm/README.md) | Commands, splits, output formats, costs and reproducibility |

The simulation's seeded replay is deterministic for fixed inputs and engine/content versions. Model outputs, provider availability and remote timing are not deterministic. Synthetic probe labels and the verifier need independent human validation before supporting comparative performance claims.
