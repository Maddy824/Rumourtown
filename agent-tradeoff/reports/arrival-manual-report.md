# Manual landing entry

Implemented the owner's request to keep the landing page open until deliberate input.

The welcome screen and paused village now wait indefinitely. Enter village, a background click, Enter, Space or a character key begins the existing 2.8-second arrival. A second input can skip the animation. Reduced motion waits for input too, then uses its 350 ms transition. Tab, modifier shortcuts and the author link retain normal keyboard behavior; key repeats do not dismiss the gate. Replaying the intro returns to the same manual gate.

Validation: root typecheck, all 777 local tests, production build, gzip gate (346,495 bytes under 400,000), and diff whitespace checks passed. Updated existing arrival tests verify sixty seconds without entry, normal and reduced-motion input, and replay. Chrome checks at 1280 px and 360 px verified the title remains visible, simulation tick stays fixed while waiting, Enter/background click/letter key enter, Tab does not enter, and no horizontal overflow or page errors.

Published commit `0b3ae9dc6f10b5d95194cbf137b1c62eb07d1ce6` to `build/village` and deployed Cloudflare version `4171ecf0-3eef-4a11-8664-84497d7b3078`. The subsequent visual/music/conversation follow-up is recorded in `play-polish-report.md`; it retains the manual entry gate. No simulation, API or spending changes. Existing unrelated files remain untouched.
