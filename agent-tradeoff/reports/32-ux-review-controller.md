# 32: Why the site confuses people, and a simpler shape (controller, independent)

Walked through the live site on 22 October 2026 at 390×844 as a first-time visitor. Screenshots in `.playwright-mcp/ux/`.

## Where people get lost, worst first

1. **The main thing is buried five steps deep.** Whispering a rumour, the heart of the game, goes: Talk or act → scroll past a chat box → Spread a rumor → "Walk closer to someone" → pick a person and wait for the walk → open a collapsed section to find a story → Whisper. Most people will never get there.
2. **Nothing tells you what happens after you whisper.** The only feedback is "Ben reacted to your whisper" and a "Follow a rumor" switch that is off. The payoff (watching it travel and seeing who believes it) is opt-in and unexplained.
3. **No goal.** Nothing says what you are trying to do or when you have done well. The "dare" exists but is truncated inside the Story panel.
4. **The welcome reads like a manual.** Three concepts (walk, whisper, follow the thread), two competing buttons ("Start exploring", "Meet Ben"), and it names a button you cannot see ("Spread a rumor" lives inside Talk or act).
5. **Too many controls with vague names:** Explore, Story, More, Talk or act, Time (Held / Slow / 1×), Meet the villagers, the Now bar, Follow a rumor. "Talk or act" mixes chatting, walking and whispering.
6. **The Story panel is dense.** Switch, Expand, dare, Include village stories, a story picker, a chain of faces, and a long timeline where every entry repeats "Show me" and "Read the exchange". Other villagers' stories mix with yours.
7. **An empty box asks you to invent a rumour.** The ready-made stories are hidden; the placeholder ("Someone killed Tom") is dark and odd for a first try.
8. **Jargon:** "agents", "dare", "chain", "Now:", "Rumor lines", "Notebook", "Developer guide" sitting in the same menu as music.

## The simple shape: one loop, said in one line

**Start a rumour. Watch it spread. See who believes it.** Everything else is optional depth.

### First 60 seconds (replaces the welcome card)

1. One sentence over the village: *"Everyone here remembers who told them what. Start a rumour and watch it spread."* One button: **Start a rumour**.
2. **Pick a rumour:** three cards ("Tom stole bread from the bakery", "Mira owes Pim money", "Jonah is seeing Rosa"), plus "Write my own".
3. **Pick who hears it:** three nearby faces. Your traveller walks there automatically; no "walk closer" step.
4. The camera follows the rumour by itself. A small tracker appears: **"Your rumour: heard by 3 · believe it 2 · doubt it 1"**, with faces.
5. After the first telling, one hint: *"Tap anyone to ask what they heard."*

### Controls

- **Bottom:** one big **Whisper** button (the postbox), and a smaller **Talk** button. Time becomes a single pause/speed control with an icon and a word.
- **Top:** **Map** (was Explore), **Your rumour** (was Story), **Menu** (was More).
- After a whisper, following is **on by default**; the tracker replaces the Now bar while your rumour is moving.

### The rumour panel, default view

"Your rumour's journey": the chain of faces, the believe/doubt counts and the three latest moments, each one line. Everything else (all village gossip, the challenge, filters, full timeline, conversations) sits under **More detail**.

### Menu grouping

- **Play:** How to play, Watch the intro again, Share this village.
- **Settings:** Music, Show rumour paths, Slower conversations.
- **For the curious:** Research notebook, How it works inside, Developer guide, About.

### The 20-second explanation (for "How to play" and the About card)

> Rumourtown is a tiny village of 36 people. Each one remembers who told them what, and how much they trust that person. Tell someone a rumour, true or false, and watch it travel. Some believe it, some doubt it, some defend the person it is about. Talk to anyone to hear what they think, and why.

## Smallest change set that fixes most of it (about two days)

1. A three-step first-rumour flow (pick rumour, pick person, auto-walk and auto-follow), replacing the welcome card. Files: `ui/app.ts`, `ui/whisper.ts`, the welcome module, `styles/app.css`.
2. Ready-made stories shown first in the whisper sheet; "Write my own" second; a friendlier placeholder.
3. Follow on by default after the player's whisper; the tracker with believe/doubt counts (counts come from the simulation's existing belief state).
4. Rename the top and bottom controls, split Talk from Whisper, and regroup the menu.
5. Story panel: default to "Your rumour's journey"; move the rest under More detail.
6. Copy pass: remove "agents", "dare", "Now:"; sentence case; plain verbs.

All features stay; only what is shown first and what things are called change. The simulation and replay pin are untouched.
