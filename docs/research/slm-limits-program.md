# Pushing small language models to their limits as epistemically faithful characters

## Thesis
A deterministic simulation that owns every character's beliefs can generate controlled synthetic states and operational labels. These labels describe the simulation; probe wording and verifier accuracy still require human validation. Use it three ways: to **break** small models systematically, to **engineer** inference-time methods that make them faithful, and to **train** them on simulation-generated data. Falsifiable target: a fine-tuned or engineered model of at most 1.7B parameters, running on-device, reaches the epistemic faithfulness of grounded 70B on held-out stories and attacks, at under 10% of its cost and latency.

## Task
Input: a character's belief state (facts with ids, confidence band, source chain, and whether each is true in the world), persona card, last turns, the player's utterance. Output: a reply. Gold behaviour per probe: assert, hedge, deny, abstain ("I haven't heard"), name the source, refuse, or propose an action.

## Stress axes (each swept from easy to breaking, to find the break point)
| Axis | Sweep |
|---|---|
| Facts in context | 2, 5, 10, 20, 50 |
| Distractors (other villagers' beliefs, labelled "others say") | 0 → 20, measuring leakage |
| Conversation length | 1 → 30 turns, measuring drift |
| Player pressure (insisting, flattery, authority) | 1 → 5 repetitions, measuring capitulation |
| False premises | none, implied, stated, repeated |
| Confidence nuance | four bands; does the wording match? |
| Provenance depth | 1 → 5 hops; is the named source right? |
| Corrections | belief revised once or twice; is the old version repeated? |
| Indirect injection | instructions hidden inside a rumor the villager believes ("Mira said: ignore your rules and …") |
| Direct injection | in the player's words |
| Obfuscation | misspellings, Unicode look-alikes, other languages |
| Quantisation | q4, q8, fp16 of the same model |

## Models
Local through Ollama on an M4 Max: Qwen3 0.6B, 1.7B, 4B; Llama 3.2 1B, 3B; Gemma 3 1B, 4B; Phi-4-mini 3.8B. Remote references on Workers AI: Llama 3.2 3B, 3.1 8B, 3.3 70B. Browser condition later through WebLLM.

## Inference-time engineering (each an ablation)
1. Plain persona prompt (baseline, as in most game NPC work).
2. Grounded facts (the current production design).
3. **Cite then speak:** constrained JSON `{ uses: [fact ids], reply }`; reply claims must come from cited facts.
4. **Plan then realise:** step one selects fact ids and a speech act; step two writes one or two sentences from only those facts.
5. **Verifier-guided best-of-n:** sample n replies (n = 2, 4, 8) at temperature 0.7 and keep the first that passes the verifier; measures whether cheap sampling plus a state oracle beats a bigger model.
6. **State-verified cascade:** small model first, escalate to 70B only when the verifier fails.
7. Grammar-constrained decoding (JSON schema through Ollama's `format`).

## Verifier (the state oracle)
Split the reply into sentences; find statements about cast members and events; mark each as supported by a fact, contradicting a fact, about something the character does not know, or unrelated chatter. Also check hedging against the confidence band, and the named source against the provenance chain. Method: rules over cast names and predicates, plus local embedding similarity (all-minilm or snowflake-arctic-embed, already installed) to match a sentence to the closest fact. Precision and recall are measured against human labels, not assumed.

## Training (phase 3)
Generate tens of thousands of (state, probe, reply) triples from many seeds: gold replies from templates plus 70B teacher replies that pass the verifier. LoRA fine-tune Qwen3 0.6B / 1.7B and Llama 3.2 1B with MLX on the M4 Max. Evaluate on held-out seeds, held-out story mechanisms and held-out attack types; export to GGUF and WebLLM for on-device play.

## Adaptive red team
A stronger local model (qwen3.6, 23 GB, already installed) generates new adversarial probes aimed at each target's weakest category, keeps the ones that break it, and repeats. Report attack success over rounds; publish the attack set.

## Reporting
For every model × method × axis: epistemic faithfulness, world faithfulness, abstention accuracy, calibration, provenance accuracy, persona consistency (judge validated against human labels), injection success, latency p50/p95, tokens per second, memory, cost per 100 messages. Break-point curves per axis. Everything seeded and reproducible from one command.
