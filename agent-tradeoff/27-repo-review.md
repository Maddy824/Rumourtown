# 27: Repository review for a public portfolio

Read `agent-tradeoff/CONTINUE.md` section 3 first. Do not touch `apps/api`, `apps/rumortown/src` or `bench/` (other tasks own them). You may edit top-level docs, `docs/`, `.github/`, `LICENSE`, `package.json` scripts and metadata.

## Goal

A recruiter or researcher opens the GitHub repo. In two minutes they should understand what Rumourtown is, see that it is live, see the engineering (deterministic simulation, beliefs with provenance, cost-capped AI, the epistemic verifier, the SLM study), and be able to run it. Review the repository as that reader, then fix what you can.

## Check

1. Top-level `README.md`: what it is in one sentence, the live link, a screenshot or GIF reference if one exists in the repo, architecture in a short diagram (text or mermaid), how to run, how to test, the research (`docs/research/`, `bench/slm/`), the cost cap story, license. Plain words, sentence case, no hype, no emoji walls.
2. Each workspace has a short README (`packages/rumormind`, `apps/rumortown`, `apps/api`, `bench/slm`), consistent with the code.
3. Repo hygiene: stray files at the root, generated files tracked by mistake (`tsconfig.tsbuildinfo`, `dist/`, result dumps), `.gitignore` gaps, large files in history (`git rev-list --objects --all` plus sizes), dead docs that contradict the current code, broken links in Markdown.
4. Commit history: authors and trailers. The owner's rule is that no AI assistant appears as a contributor (no `Co-Authored-By` assistant trailers, no "Generated with" lines). Report any commit that breaks this, by hash; do not rewrite history.
5. `package.json` metadata (name, description, repository, license, engines), CI workflow sanity, LICENSE present.
6. Anything that would embarrass the owner in front of a recruiter (TODO notes with private details, personal paths, secrets: report secrets by file and commit only, never print them).

## Deliverables

- Fix docs and hygiene directly (small, careful edits; keep existing correct content).
- `agent-tradeoff/reports/27-repo-review.md`: findings, what you changed, what needs the owner (history rewrites, GitHub settings such as topics, description, social preview, pinned repo).
- You cannot commit; list files to commit and a plain commit message without assistant attribution.

End your last message with `STATUS: DONE` or `STATUS: BLOCKED`.
