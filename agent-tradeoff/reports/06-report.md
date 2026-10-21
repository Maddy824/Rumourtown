# 06: Library publish preparation

Status: DONE. `rumormind@0.1.0` ships compiled ES modules and declarations, zero runtime dependencies, explicit exports, MIT licence (Madhav Sunil, 2026), author, repository, keywords and side-effect metadata. `prepublishOnly` builds and runs only the library's 40 tests. Root licence and both workspace lockfiles are aligned.

The optional `development` export points at source. Vite and the game's TypeScript custom conditions select it, so a clean checkout can typecheck/build before the library's dist exists. Verified by temporarily moving dist out of the workspace and rerunning typecheck and the game build, then restoring it.

Verification: package build; all 40 package tests; pack dry run; root typecheck, all 512 tests, production build and 295,977-byte bundle gate. The README's exact first example ran with plain Node against the compiled package and printed `0.646`, `0.560`, `0.75`. npm's default cache is outside the writable sandbox; the dry run used `/private/tmp/rumortown-npm-cache`, without changing global cache ownership.

Dry-run archive: **17,216 bytes**, **51,173 bytes unpacked**, **27 files**:

```text
LICENSE
README.md
package.json
dist/belief.d.ts
dist/belief.js
dist/claims.d.ts
dist/claims.js
dist/index.d.ts
dist/index.js
dist/mood.d.ts
dist/mood.js
dist/registry.d.ts
dist/registry.js
dist/relationships.d.ts
dist/relationships.js
dist/repair.d.ts
dist/repair.js
dist/retell.d.ts
dist/retell.js
dist/rng.d.ts
dist/rng.js
dist/sideTaking.d.ts
dist/sideTaking.js
dist/transmission.d.ts
dist/transmission.js
dist/tuning.d.ts
dist/tuning.js
```

No npm publish or release tag was created; the owner still needs to configure trusted publishing and authorize the release.
