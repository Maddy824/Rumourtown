# Open stories

Typed rumors no longer require an event from a twelve-category list. The story is the text itself; actor, affected person, valence and importance are annotations used by the social simulation. “Someone killed Tom” can have an unknown actor and Tom as the affected person. Its valence is neutral toward the actor, so it does not blame the victim. Discoveries, weather, impossible events and world news can use a village-wide topic.

The public UI previews exact text, people, reputation effect, importance and any proposed question before confirmation. Confirmed wording is included in dialogue, research exports and replay links. Unsent input is not included. Backend logs and caches never store the raw story. This explicitly replaces the previous typed-text privacy rule; do not enter private information.

## For developers

- `POST /rumor` accepts `{text,turnstileToken}` with a 1–100 character story and a real human-verification token. It returns `{actor,affected,valence,severity,question}`. Cast ids or `null` identify people; valence is -1/0/+1 and severity is 1/2/3. There is no event-category field.
- This route uses the existing origin/rate checks and global budget ledger: Workers AI, then capped OpenRouter fallback. No inference bypass or separate spend pool exists. `/interpret` remains the legacy taxonomy endpoint for old clients.
- `createOpenClaim(text, meaning, cast)` in `apps/rumortown/src/sim/registered-claim.ts` makes a bounded, canonical `story_` claim for local simulation/replay. `neutralMeaning()` supports arbitrary stories without inference.
- The local agent protocol adds `whisperStory` with `{listener,text}`. It uses neutral meaning and zero AI credits. The agent still needs an awake listener within two tiles. Existing `whisper` remains compatible for authored-category callers.
- Unknown or unreliable model answers fall back locally, preserving the words. The player can also continue without waiting or leave everyone unassigned. Ongoing villagers do not call a model on each tick or telling.

Example agent call:

```json
{"tool":"whisperStory","arguments":{"listener":"mira","text":"someone killed tom"}}
```

## Research and limitations

Research exports identify this version as `v4-open-stories-1` and include the story annotations and attention parameters. Older agent research replays with a different model version are deliberately rejected rather than labeled as the new model. Ordinary game share links retain their existing decoding and authored-event replay hash.

Allegations never kill characters, create objects, establish historical facts or add eyewitness evidence. The old authored world is unchanged by merely hearing a story. The model's general knowledge supports interpretation, not fact checking or an exhaustive world database. It can still misunderstand roles or language; review the interpretation. Neutral fallback preserves text but does not provide semantic comprehension. The social simulation is a research-informed sandbox, not a validated predictor of real people. See [the design and research notes](superpowers/plans/2026-10-21-open-rumors.md).
