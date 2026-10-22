# 31: One idea for rumourtown.dev that joins the SLM research to a public "wow"

A thinking task. Do not edit code. Live web search is available: use it for feasibility facts and precedents.

## Read first

- `docs/research/research-plan-2026-10.md` (the research direction) and `docs/research/finetune-study.md`
- `README.md`, `docs/how-it-works.md`, `docs/architecture.md`, `docs/credit-controls.md`, `docs/AGENTS.md`
- `apps/rumortown/src/agentic/` (orchestrator, verifier, guard), `apps/rumortown/src/ui/play.ts` (Talk or act), `apps/api/src/play.ts`
- `agent-tradeoff/CONTINUE.md` section 3 (rules)

## The ask

The owner wants an idea that can be built into the live website and that:

1. **Is about small language models** and advances the research (produces data, measurements or a demonstration a paper could use).
2. **Gets a public reaction.** Precedents worth studying for why they spread: Lakera's Gandalf (a prompt-injection game whose players generated a large attack dataset), TinyStories, Phi-1 "Textbooks are all you need", the Tiny Recursive Model on ARC-AGI, WebLLM demos, AI Town. Find what made each travel.
3. **Fits the product:** a phone-first browser game where 36 villagers hold beliefs with confidence and sources, rumours spread deterministically, and players whisper and talk to villagers.

## Hard constraints

- Money: live AI spending is capped (ledger $0.019/day, $7 lifetime, OpenRouter key $10; Workers AI free allocation 10,000 Neurons/day shared with the live game). An idea that needs a model call per player action must either run **in the player's browser** (WebGPU) or fit inside these caps with graceful fallback. Never loosen a cap.
- Workers AI accepts LoRA adapters for `@cf/meta/llama-3.2-3b-instruct`; an off-by-default flag `WORKERS_AI_PLAY_LORA` already exists.
- Bundle budget 400 KB gzipped for the game; model weights may load lazily and separately. A new runtime dependency (for example an in-browser inference library) needs the owner's authorisation, so state exactly which one, its size, licence and browser support.
- Privacy: typed text never goes to server logs or shared caches. Collecting anything players type for research needs explicit, opt-in consent and moderation; say how.
- Phones must work, at least in a degraded mode. Determinism of the simulation must be kept.

## What to produce

1. **Five candidate ideas**, each in five lines: what the player does, why it would spread, what research it yields, cost per 1,000 players, the biggest risk.
2. **Your one recommendation**, developed: the player experience screen by screen on a phone; the SLM part (which model, where it runs, fine-tuned or not, fallback); exactly what research data or measurement it produces and how that feeds the paper; the consent and moderation design; costs at 1,000 and 100,000 players under the caps; a launch hook (the one sentence people would share).
3. **Feasibility facts with sources:** in-browser model options in October 2026 (for example WebLLM / MLC, transformers.js, ONNX Runtime Web) with download sizes and tokens per second for 0.5–1.5B models on a recent phone and laptop; WebGPU availability on iOS Safari and Android Chrome.
4. **A build plan** in phases, with what Codex can build, what needs the owner, and what can ship in one week.

Write it to `agent-tradeoff/reports/31-website-idea-review.md`, plain Markdown, sentence case, under 200 lines. End your last message with a five-line summary.
