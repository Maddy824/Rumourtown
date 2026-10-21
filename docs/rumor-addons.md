# Reusable rumors and behavior add-ons

The villagers keep their local goals, relationships, beliefs and movement. New visitors reuse the same published content and behavior code. Opening the game, browsing the rumor library and spreading one of its stories make no model calls.

The first library contains 24 stories in three collections: Secrets after dusk, Market mischief and Quiet kindness. Open **Talk or act → Spread a rumor → Browse the rumor library**, choose a collection and story, then choose a listener and whisper it. A selection is a rumor, not proof that the described event happened. Stories are added to a run only when the player uses them.

## Add stories once

Add a JSON file to `apps/rumortown/src/content/rumor-packs/packs/`. Vite discovers files on the next build. Every visitor receives that version through the static game assets; no shared database, per-player generation or model retraining is involved.

```json
{
  "schema": 1,
  "id": "garden-secrets",
  "version": 1,
  "title": "Garden secrets",
  "stories": [
    {
      "id": "spare-seeds",
      "text": "Nia leaves spare seeds outside the shop for neighbours who cannot pay",
      "about": "nia",
      "kind": "kindness",
      "severity": 1
    }
  ]
}
```

Packs contain 1–48 stories. IDs must be unique, lowercase slugs. Each sentence starts with its subject's existing cast name and fits 100 characters. `kind` uses an existing social category; `severity` is 1, 2 or 3. Unknown fields, missing residents, unsupported kinds and executable markup are rejected. Renderers use text nodes. Validation checks structure, not the truth or literary quality of a story: review the sentence and its category together before publishing.

New themes and situations fit a pack. A genuinely new mechanic, such as investigating a missing object, requires a behavior change. Merely naming a new kind does not implement it.

The selected story uses the existing self-contained written-claim replay format. Replays carry the published sentence and meaning, so editing or removing a later pack cannot change that saved story. Pack stories do not become eyewitness evidence for unrelated authored events. Player conversations and original typed whispers are never harvested into this library.

## Ask a coding agent for a new add-on

Write a feature brief in a local text file. Preview the task without making a model call:

```sh
npm run addon:draft -- --kind behavior --name investigate-rumors --request /tmp/rumor-brief.txt
```

Use `--kind story` for another content pack. Add `--run` to launch one development job with the locally installed, authenticated Codex CLI. The script creates a detached worktree under ignored `.agent-runs/addons/<name>/worktree`, based on the current **committed HEAD**, installs locked dependencies, and asks the coding agent to implement the brief. Uncommitted changes in the main checkout are not copied. Existing draft names are never overwritten.

The command prints a usage notice before starting. Codex uses its configured developer account/model; this is **separate from the site's $10 OpenRouter allowance**. Preview mode is free. The workflow has one invocation, no automatic retries and a 30-minute process timeout; this is not a dollar or token cap. The existing development agent can also author the same files directly without starting this command.

After the agent exits, the wrapper independently runs typechecking, the full tests, production build and bundle check. Failed jobs retain their worktree for inspection. A successful job leaves `checks-passed.txt`; that records automated checks only. Review the diff **and untracked files**, run the independent review required by `CONTINUE.md`, and adopt the reviewed changes into `build/village` using the normal release process. The wrapper has no merge, push or deployment step. The agent is instructed not to publish; its configured sandbox and permissions still apply. This is a developer tool, not a public endpoint or a security boundary against untrusted coding agents.

For behavior code, document the trigger, local decision rule, maximum work per tick, fallback and information available to the agent. Keep seeded randomness, deterministic ordering and replay compatibility. Add a regression case for the requested behavior, inspect changes to full-day traces, and report research assumptions separately from evidence. Do not make a new AI call for each villager or visitor.

CLI integration follows [official OpenAI documentation for non-interactive Codex](https://developers.openai.com/codex/noninteractive/) and the installed CLI's `codex exec --help`.

## Hybrid inference for unfamiliar input

Saved packs and local simulation cost no AI credits. Typed interpretation retains its conservative local path and signed exact-wording cache. Freeform **Talk or act** still uses context-aware inference; a stored story is not a substitute for understanding an unrelated message.

Remote requests try Cloudflare's [Llama 3.2 3B](https://developers.cloudflare.com/workers-ai/models/llama-3.2-3b-instruct/) first, then OpenRouter's `liquid/lfm-2.5-2.6b:free`, with `google/gemini-2.5-flash-lite` as the capped paid fallback. The [OpenRouter catalog](https://openrouter.ai/api/v1/models) listed the 2.6B free model with structured outputs on 21 October 2026. Availability can change. Outputs are validated and invalid responses never become game actions.

Cloudflare's [free daily allocation](https://developers.cloudflare.com/workers-ai/platform/pricing/) is limited; it is not unlimited free inference. The existing $0.019 daily and $7 lifetime OpenRouter caps, reservation-before-dispatch, notifications and request limits remain in place. No visitor triggers the development command. Hosting costs and developer-agent usage are separate from the game's AI budget.
