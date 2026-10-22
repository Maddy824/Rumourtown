# First-visit UX review

Reviewed the six supplied 390 × 844 screenshots, `CONTINUE.md` section 3, and the UI source. This is a review and proposed work, not an implementation or live browser test.
Screenshot key: S1 welcome (`02-entered.png`); S2 Talk (`04-talk-sheet.png`); S3 listener picker (`05-spread.png`); S4 composer (`06-after-walk.png`); S5 sent (`10-sent.png`); S6 Story (`11-story.png`). Menu and Explore findings use the supplied inventories plus source; those open panels are not pictured.

## 1. Where a first-time visitor gets lost, ranked

| Rank | Severity | Evidence | Lost moment and consequence |
| --- | --- | --- | --- |
| 1 | Critical | S1–S2 | The promised activity is spreading a rumor, but the prominent postbox opens a general chat form. The rumor action is below that form or inside More. The visitor must discover the game's main action before playing. |
| 2 | Critical | S2 | The visible sheet ends at the textarea: neither Send nor Spread a rumor is visible. There is no clear cue to scroll. The visitor can type without discovering how to submit or reach the promised activity. |
| 3 | Critical | S4 | Both sources of ready-made stories are collapsed. The visitor meets a blank writing task before seeing a playable example. The bold death-story placeholder resembles entered text, yet Whisper is disabled; neither the empty state nor the next step is obvious. |
| 4 | Critical | S5 | “Ben reacted” hides what he said, whether he believed anything, and what to watch next. After the most demanding action, the reward is a vague receipt and an unexplained switch. The visitor cannot tell whether the game worked. |
| 5 | High | S6 | The panel spends its first screen on the repeated status, follow switch, heading, dare, village toggle, selector and face chain. The first actual event is cut off at the bottom. Opening Story still does not reveal the story. |
| 6 | High | S1–S6 | Walk, Talk or act, Spread a rumor, Whisper, Story, Follow the thread and What’s happening describe overlapping steps with different names. “Talk” also invites telling a story, without explaining that chatting and planting a tracked rumor are separate actions. |
| 7 | High | S1 | Enter village leads to another large welcome card. The default “Start exploring” dismisses instructions; the useful guided action, Meet Ben, is secondary. The card explains three future tasks without exposing their controls or saying what a satisfying first result looks like. |
| 8 | High | S3 | Whisper initially becomes an eight-person travel directory. Roles do not explain whom to choose, how far away they are, or what Walk to will do afterward. A visitor may assume another manual search is required; automatic reopening on arrival exists but is not explained. |
| 9 | High | S5–S6 | Follow a rumor could mean tracking its history, drawing lines, slowing dialogue or moving the camera. More has two additional watching switches. Their relationship and current effect are unclear; camera movement can feel unrequested. |
| 10 | High | S6; source | Selecting a rumor changes the chain, but `story.ts` filters event rows by all player stories, not the selected claim. With multiple whispers, the selector and event list can tell different stories. The default already excludes unrelated village stories; preserve that useful behavior. |
| 11 | High | S4–S6 | Writing “Someone killed Tom” can sound like commanding a death. No visible explanation distinguishes telling a claim, someone hearing it, believing it, and a real event. A face chain shows transmission, not agreement or proof. |
| 12 | Medium | S1–S6 | Time alternates among Held, Slow and 1× as panels open. “Held” is unfamiliar, the clock advances independently of the task, and there is no nearby reason for each pause. A visitor may wait for gossip while a sheet has stopped time. |
| 13 | Medium | S6 | “Your dare” introduces Wren and a task that was not the visitor's chosen story; its sentence is clipped. It reads like a mandatory objective competing with following the whisper. |
| 14 | Medium | S6 | Faces, arrows and slash-separated branches require decoding. “The stranger” suddenly replaces “You.” Tap targets do not visibly explain that they locate people, and the chain has no short reading key. |
| 15 | Medium | S1–S5 | The camera shows only part of town; tapping paths, finding people and opening the wider map are separate discoveries. S2's generic walk to the square does not solve finding a listener. S3's picker provides no spatial context. |
| 16 | Medium | S1, S5–S6 | The status strip first says “agents,” then offers an expandable reaction without a clear “Read” label. In source it retains the latest event without its age, so an old reaction can look current. Before a whisper, decorative faces imply an exchange that has not happened. |
| 17 | Medium | S1–S6; menu inventory | More gives the core rumor action equal weight with replaying the arrival, sound, developer material and About. There is no grouping or indication of which items open tools and which change settings. |
| 18 | Medium | S1–S6; Explore inventory | Explore mixes travel with a research notebook tab, while More calls the same destination Notebook. A newcomer cannot distinguish their story history from research exports and experiments. |
| 19 | Medium | S1–S4, S6 | Large sheets hide the village while the top pins and postbox remain visually available. Story adds a second header and expansion control; switching layers becomes another task. S6 covers the postbox entirely, contrary to the phone rule. |

Source caveat: S5 is reported as following off, but `app.ts:doWhisper()` already calls `showTrail(true)`. Verify the deployed version, pressed-state styling and later state changes; do not assume adding that call fixes the screenshot. `watchBeats` still starts false, so readable exchange playback is not enabled by that call.

## 2. A simpler structure, keeping every feature

### The first 60 seconds

- **0–10 seconds:** Keep Enter village. Replace the second long card with the short explanation below and primary “Try a whisper”; secondary “Explore on my own.” Point out “You” on the map. Help remains available without blocking entry.
- **10–25 seconds:** Try a whisper selects a nearby awake listener and says “Walk to Ben to whisper. We’ll open your story when you arrive.” Use the existing walk and reopen flow, with visible walking status and Cancel. Choose another person remains available. At night suggest an awake person at the inn; never promise a sleeping listener.
- **25–40 seconds:** Open “Whisper to Ben.” Put three existing ready-made stories in view as selectable cards, with no selection made silently. Follow them with “Write your own” and “More story ideas,” retaining every library collection and authored village story. Show the chosen text and a visible send action.
- **40–60 seconds:** After the visitor explicitly sends, show Ben's actual reply and open the compact view of that rumor. Offer “Watch what happens” and “Keep exploring.” Gossip may take longer or never happen; do not script a telling to meet this timing target.

### Bottom and top controls

- **Bottom:** Make the postbox the primary **Whisper** control; add a plain **Talk** button beside it and retain **Time** at the right. Whisper always enters the rumor flow; Talk opens conversation and travel requests. Nearby-person tags keep their existing actions. Reserve space so sheets, banners and footers never cover the postbox.
- **Top:** Clock at left; **Map**, **Rumors**, **More** at right. Map contains districts, places and people. Rumors opens the story history. Use those same names in headings, help and buttons; retire Story / What’s happening as competing destination names.
- **Time:** Show the actual state as “Paused,” “Slow,” “Normal,” “2×” or “8×” on the closed control; explain “Paused while you choose a story” inside Whisper. Keep pause, all speeds, timeline scrubbing, replay pins and next-event stepping in Time. Opening a panel must make its time effect explicit.
- **Status:** One short, dated result above the bottom controls, with “Read reply” or “View rumor.” Before the first whisper use “Try a whisper to see what happens,” without pretend conversation faces. Hide this strip beneath modal sheets instead of stacking competing messages.

### Immediately after a whisper

Show “You told Ben: ‘[confirmed story]’,” followed by his actual recorded reply. Summarize belief only when existing state supports it; otherwise say “He heard it. That doesn’t mean he believes it.” No invented reaction or guaranteed spread.
Keep a waiting state such as “Waiting to see whether Ben passes it on.” Replace it with actual dated tellings as they happen. Close the held composer and restore the previous playback state; if the visitor had paused time, show “Resume village” explicitly.
Make “Watch what happens” enable readable conversation playback and camera following for this rumor. Label its continuing switch “Follow the speaker,” display “Following paused while you explore” after manual movement, and offer Resume. Keep map lines independently optional and do not force camera following merely to read the history.

### Rumors panel default

Default to **Your latest rumor**, with its full text, the latest relevant event and actual reply visible before settings or diagrams. Before any whisper, show “You haven’t whispered yet” and “Try a whisper.”
Below the latest result, show earlier relevant events newest first, with names, times, quoted exchanges and “Find them.” Filter by the selected rumor and its supported corrections or consequences; preserve the full history behind “All village stories.”
Keep the rumor selector for multiple stories. Move the branching face chain into “Who told whom,” with “Each pair shows a telling. Hearing is not believing”; call the player “You.” Retain clickable faces, expanded exchanges, panel expansion and the end-of-day result.
Move the dare into a collapsed **Optional challenge** below the events. Put “Follow the speaker,” “Show rumor lines” and “Slow down for conversations” under **Watching options**, explaining each effect. Avoid duplicating the status strip as a second panel header.

### More menu grouping and feature map

| Group | Contents and names |
| --- | --- |
| Play and share | Whisper shortcut; Share this village, including existing replay sharing. |
| Watching options | Follow the speaker; Show rumor lines (was Rumor lines); Slow down for conversations (was Read conversations). Mirror the same states in Rumors, not independent copies. |
| Sound | Quiet music with a visible on/off state. |
| Help and about | How to play (was How it works); Watch the arrival again (was Replay the arrival); About. Explain that watching the arrival does not restart the village. |
| Research and building | Research notebook (was Notebook, same exports, comparisons and sources); Developer guide, retaining local agent play and every guide link. |

Map retains district travel, places, all people, name display and nearby conversations; its main view no longer advertises research as an equal play mode. Research notebook opens the existing research view from More. Person details, natural conversation, all stories, sound, sharing, replay, day endings and developer tools remain available.

### Twenty-second explanation in plain words

“You’re visiting a village. Tell one person a story, then watch who repeats it, doubts it, or takes sides. People remember who told them and decide what to believe. A rumor doesn’t make something true. Talk, explore, or try another story. There’s no single right ending.”

## 3. Smallest useful two-day implementation

Paths below are under `apps/rumortown/src/`. Reuse the existing sheets, walking, recorded exchanges and event history; no new renderer, model call, dependency or simulation rule is needed.

| When | Source files to touch | Concrete deliverable |
| --- | --- | --- |
| Day 1, first | `ui/app.ts`, `ui/opening.ts` | Primary Whisper postbox, adjacent Talk; short welcome with Try a whisper routed to an awake listener using `walkToVillager(id, true)`. Explain walking and allow cancellation. Rename top pins Map and Rumors. |
| Day 1, next | `ui/whisper.ts`, `ui/play.ts`, `styles/app.css` | Render three existing story choices above optional typing; keep both full collections accessible. Replace the death placeholder with “Write a short story about the village.” Use “Review story” for typed drafts, then “Whisper to Ben”; ready-made choices can send explicitly. Pin the relevant action footer in both forms above the phone keyboard. |
| Day 1, finish | `ui/app.ts`, `ui/story.ts` | On successful send reveal the selected rumor's compact result and recorded reply. Add an honest waiting state; make Watch what happens turn on the existing reading/follow behavior. Check the S5 pressed-state mismatch. |
| Day 2, first | `ui/story.ts`, `styles/app.css` | Latest event and reply first; filter rows to the selected rumor and related claims. Move optional challenge, chain and watching settings below events. Call the player You and keep the postbox clear even with the expanded panel. |
| Day 2, next | `ui/tools.ts`, `ui/app.ts`, `ui/field-guide.ts`, `ui/how-it-works.ts`, `ui/timebar.ts` | Group existing menu actions; use matching destination and watching names; route Research notebook from More. Replace Held with Paused and explain automatic pauses. These are small presentation edits, not rebuilt tools. |
| Day 2, finish | Existing relevant `ui/*.test.ts` and browser checks | Verify a complete whisper without scrolling to discover an action; typed preview and fallback; no claim sent before confirmation; correct selected-rumor events after two whispers; paused/normal time and manual camera takeover. Check desktop, 390 × 844, 360 px, phone keyboard, Tab/Enter/Escape, focus return and postbox clearance. Run root typecheck, tests, production build and bundle gate before pushing implementation. |

Keep the typed-story preview and explicit disclosure that confirmed words enter dialogue, research exports and shared replay links. Replace technical wording where useful, but preserve consent, moderation and budget limits. Use sentence case and plain words, with no arrows in buttons, middle dots or exclamation marks.
Defer a redesigned atlas, richer relationship charts, a branching tutorial and new rumor mechanics. The two-day acceptance target is one understandable loop: find Whisper, choose a story, send it, read a real reply, and know where later tellings will appear. This review changes only this report; implementation and all device checks remain follow-up work.

## Five-line summary

1. Make Whisper the obvious first action and keep Talk separately available.
2. Show story choices and usable send controls before asking visitors to write.
3. After sending, reveal the real reply and explain the wait for further gossip.
4. Open Rumors on the chosen story's events, with diagrams and settings below.
5. Reuse existing features in two days; verify phones, keyboard access and consent.
