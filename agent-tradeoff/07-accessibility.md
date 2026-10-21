# 07: Accessibility pass

Audit `apps/rumortown/src/ui/` and `apps/rumortown/src/styles/app.css` against this list and fix what fails, without changing the look:
- Every control reachable and operable by keyboard in a sensible order: the postbox, the three pins, speed buttons, the timeline slider, the whisper sheet (open, choose, whisper, close with Escape), tags (open on Enter when a villager is focused via a hidden list of villagers, close with Escape), the story drawer, the day-end card.
- Visible focus rings on all of them (3 px ink outline with 2 px offset or equivalent), never removed.
- A polite live region that mirrors speech bubbles at most once every 2 seconds, and announces whispers and day ends.
- All icon-only buttons have accessible names; images and canvas have `aria-label`s; the canvas has `role="img"` with a short description of the village.
- Colour contrast of text on paper tags and on the felt at least 4.5:1 (compute for the tokens; adjust ink or paper if needed).
- `prefers-reduced-motion` disables the thread draw animation and walk bob.
- The page works at 360 px wide with no horizontal scroll and at 200% browser zoom.
Add tests where possible (`apps/rumortown/src/ui/a11y.test.ts` using jsdom-free DOM checks on the built markup if feasible; otherwise document a manual checklist in the report). Run typecheck, tests and build; commit `apps/rumortown/src/ui` and `apps/rumortown/src/styles` with a message starting `07:`.
