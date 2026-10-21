# 07: Accessibility pass

Status: DONE for the local implementation and Chrome checks below. Physical Safari, screen-reader usability and named-phone performance remain external checks.

Added a keyboard-discoverable villager list so all 24 tags can be opened regardless of camera range. The summary appears on focus, Enter expands it, buttons open tags, Escape closes and returns focus to the same button. Canvas has role `img` and a village/control description. A separate polite, atomic status announces whispers and day endings; bubble speech retains its existing 3.5-second throttle. Existing names, modal Tab trapping, Escape handling, radio controls and focus rings remain in use. Reduced-motion preference already reaches the renderer (walking/thread animation) and CSS transitions.

Seven jsdom-free tests compute WCAG contrast directly from the shipped CSS, including alpha-blended secondary ink. Enabled the real CSS raw import in Vitest rather than testing copied token values. Ratios: ink/paper 12.58, ink/oat 10.51, paper/board 5.63, berry/paper 8.85, moss/paper 5.34, mustard ink/paper 5.61; all exceed 4.5:1. Secondary ink also passes.

## Browser checklist completed

- 1440×900 Chrome: canvas, pins, story, postbox, radio speed controls, timeline and villager tag open/close are keyboard accessible. Mira's off-camera tag opens with Enter from the cast list; Escape restores its button focus.
- Copied the share link through the actual Copy button and read clipboard output. A new browser page loads it at tick 130 with the tick-60 Mira whisper already replayed. A same-page hash navigation is not a reload; the fresh-page verification was performed separately.
- Ran the full first evening at 8×: exposed ending, stranger trust 41%, correct polite announcement, keyboard-usable Keep going/share controls. Rewound with the timeline's Home key to tick 0.
- 360×640: no horizontal overflow, postbox opens with Enter and closes with Escape. Screenshot `07-phone.png`.
- CSS zoom 200% at 1440×900: no horizontal overflow. This is a layout proxy; physical browser zoom and screen-reader reading order deserve an owner pass.
- `prefers-reduced-motion: reduce` active during the check; no page exceptions.

Screenshots: `07-desktop.png`, `07-evening.png`, `07-phone.png`. Root typecheck, **519 tests across 29 files**, production build and **296,228/400,000-byte** gzip gate pass. Manual assistive-technology checks are not represented as automated coverage.
