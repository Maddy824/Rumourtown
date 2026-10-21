# Project instructions

## Attribution

- The project owner is Madhav Sunil, GitHub `Maddy824`.
- Use `Madhav Sunil <94164709+Maddy824@users.noreply.github.com>` for repository commits.
- Do not add assistant bylines or assistant `Co-Authored-By` trailers to commits, pull requests, documentation or launch copy.
- Check commit attribution before pushing. Preserve attribution for any actual human contributors.

## Development

- Continue on `build/village`; stage explicit files rather than all working changes.
- Preserve existing uncommitted work and generated build-info files.
- Run root typechecking, tests, production build and `.github/workflows/check-bundle.mjs` before pushing code changes.
- Keep simulation updates deterministic. Use the library's fixed-order maths, seeded randomness and stable iteration; no wall-clock or unseeded randomness in simulation code.
- Use the same pinned raw replay hash across supported Node versions and browsers. Inspect a changed replay before updating the pin.
- Keep runtime dependencies unchanged unless the owner authorizes an addition.
- UI copy uses sentence case and plain words. Verify desktop, 360 px width and keyboard access for UI changes.
- Record follow-up work in `agent-tradeoff/`; completed original stages and remaining account/launch steps are listed there.
