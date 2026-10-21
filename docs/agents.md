# Agents in RumorTown

RumorTown has a local agent environment for testing movement and information sharing in a synthetic social world. It runs without network calls, an API key or AI credits. Townspeople use the authored simulation rules. A controller operates the traveller through five bounded tools.

In the game, open **More → For developers → Try a local agent**. A local planner visits the square, old bridge, Eastbank market and community gardens. The persistent notice shows its destination and $0 credit usage. **Take over**, manual walking, writing a whisper or rewinding stops it. Pause and open sheets can hold the tour. It stops after four destinations or 600 game minutes. This is a simple scripted planner, not an LLM reasoning system.

## Run a complete example

With Node 22 or later, from the repository root:

```sh
npm install
npm run agent:demo
npm run agent:replay -- .agent-runs/demo/actions.json
```

The demo walks to the square, observes until someone is visible, approaches them, tells a written story and watches for another 480 minutes. It saves `actions.json` and `research.json` in ignored `.agent-runs/demo/`. Replay writes to `.agent-runs/replay/`. An optional final directory argument changes either destination. The same source revision, seed and actions reproduce the full simulation export, including player movement. Changes to the model or cast reject older replay versions.

## Connect a controller

```sh
npm run --silent agent:serve
```

Send one JSON object per line to stdin; stdout returns one JSON response per line. Startup notices go to stderr. For example:

```json
{"id":1,"tool":"describe","arguments":{}}
{"id":2,"tool":"observe","arguments":{}}
{"id":3,"tool":"move","arguments":{"placeId":"square"}}
{"id":4,"tool":"wait","arguments":{"ticks":30}}
```

`describe` returns JSON schemas, place IDs, public names and roles, and run limits. `export` returns the current action replay. These two CLI commands are separate from the agent tool set. This is a small local JSON-lines protocol, not an MCP server or a hosted endpoint.

| Tool | Arguments | Behaviour |
|---|---|---|
| `observe` | `{}` | Traveller position and current nearby speech/activity, without advancing time |
| `move` | `placeId` | Start a walkable route to a named place; call `wait` to walk it |
| `approach` | `villagerId`, `ticks` | Follow a currently visible person, stopping near them or at the step limit; check `reached` |
| `wait` | `ticks` | Advance the entire simulation, including any current walking route |
| `whisper` | `listener`, `text`, `about`, `kind`, `severity` | Tell a sentence to someone within two tiles who is not its subject |

Whisper text is 1–100 characters after trimming and NFC normalization. Meaning is explicit: choose a supported category and severity 1, 2 or 3. The engine does not infer the sentence's meaning or truth. The returned `claimId` identifies its subsequent spread in research events.

`wait` and `approach` accept 1–120 ticks per call. A run ends at 2,700 ticks or 2,000 successful mutating actions. Observations remain available afterward. Invalid requests return `ok: false` without changing the simulation. Starting a fresh process creates a fresh seed-731 environment.

## TypeScript adapter

Source: [`environment.ts`](../apps/rumortown/src/agent/environment.ts).

```ts
import { createAgentEnvironment, replayAgentRun } from '../apps/rumortown/src/agent/environment.js';

const env = createAgentEnvironment(731);
const observation = env.observe();
const result = env.call('move', { placeId: 'square' });
env.call('wait', { ticks: 30 });
const replay = replayAgentRun(env.replay());
```

Use the repository's TS-aware bundler, as the runnable example does, to resolve `.js` imports to TypeScript sources. The adapter is repository source, not a separately published npm package. The independent [`rumormind` library](../packages/rumormind/README.md) provides the belief/relationship machinery for other projects.

An LLM controller can consume the tool schemas, choose a tool, pass its arguments to `env.call`, and repeat with the returned observation. The supplied examples use a scripted policy; connecting a paid model is separate work and its calls are **not covered by the interpretation Worker's budget ledger**. Keep such a controller local or bring its calls under a server budget before exposing it. Do not give a public browser an API key.

## Observation and evaluation boundaries

Normal observations show only people within six tiles and line of sight, their public activity and currently visible speech. They omit hidden beliefs, source chains, schedules, secrets and future events. `research()` is an evaluator-only export of full internal state; do not feed it to a policy intended to operate with partial information.

Observations are snapshots, not a complete hearing history: a controller that waits a long time can miss conversations. Whisper proximity follows the game's two-tile rule. Time changes only through bounded `wait`/`approach` calls. Returned data is detached from internal state.

Replay pins are regression checks, not evidence of psychological validity. Compare several seeds and declare the information available to each controller. See [research assumptions](research-model.md) and [credit controls and phone alerts](credit-controls.md).

## In-game conversation controller

The game's **Talk or act** sheet now uses the existing budgeted Worker at `POST /play` for creative replies and short action proposals. It sends the nearby speaker's voice, mood and activity, up to three previous exchanges and the available places. The response is `{reply, action, target}`; allowed actions are `none`, `move`, `approach`, `pause`, `resume` and `look`. The browser validates every proposal and performs it only when the player clicks its action button. There are no combat or death tools.

This path is separate from the deterministic developer adapter above: conversation text is not inserted into the simulation, research exports or shared links. It has no continuous model loop. Each Send uses one bounded inference attempt, with the existing provider fallback and shared visitor/spending caps. See [credit controls](credit-controls.md#conversation-and-actions). Local walking shortcuts and the autonomous tour still cost no AI credits.

## Create reusable content and behaviors

See [rumor and behavior add-ons](rumor-addons.md) for the versioned shared story library and `npm run addon:draft`. The development command previews a brief for free, or starts one explicitly requested coding-agent job in an isolated worktree with `--run`. Its generated code must pass tests and review before release. The published result runs locally for all visitors. Coding-agent usage belongs to the developer account and is separate from the live interpretation budget.
