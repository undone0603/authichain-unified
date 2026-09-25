# Good first issue candidates (protocol/)

These are proposed starter tasks. **They have not been filed as GitHub issues, and no `good first issue` label has been created yet.** Both wait on maintainer approval. Each one below is a real gap found in the current tree (Sep 25, 2026). None needs the monorepo installed.

## 1. Friendly CLI errors in `verifier.mjs`
`node verifier.mjs --help` and `node verifier.mjs bad.json` (a missing file or invalid JSON) currently crash with a raw Node stack trace.
- **Do:** handle `-h/--help`, a missing file and a JSON parse error. Print a one-line message to stderr and exit 2 (usage error), keeping exit 0/1 for verdicts.
- **Done when:** the three cases print clean messages, and the conformance suite still passes 28/28 (`node conformance/run.mjs --strict -- node verifier.mjs`).

## 2. Run the protocol tests in CI
No GitHub Actions workflow runs `protocol/` tests or the conformance suite today, so a regression in `verifier.mjs` would not be caught on a PR.
- **Do:** add a small workflow, triggered on `pull_request` with `paths: protocol/**`, on Node 18 and 22. It should run the three commands from `CONTRIBUTING.md`, with `permissions: contents: read`.
- **Done when:** the workflow is green on a PR that touches `protocol/` and doesn't run on unrelated PRs.

## 3. One test runner for `protocol/`
`qfs/envelope.test.mjs` uses `node:test`, while `verifier.test.mjs` and `conformance/conformance.test.mjs` use vitest. Running every protocol test needs `npx vitest` plus `node --test`.
- **Do:** port the two vitest files to `node:test` + `node:assert/strict` (the API is close), so that `node --test protocol/` runs everything with zero installs.
- **Done when:** `node --test` in `protocol/` reports the same test count as before (26 across the two vitest files + 3 QFS), all passing.

## 4. Show example output for each verdict in `README.md`
The README says what the verifier does but doesn't show what `verified`, `valid-unanchored` and `invalid` look like.
- **Do:** add three short example outputs, produced by running the verifier on existing fixtures (`valid-anchored-polygon`, `valid-unanchored`, `sig-tampered-subject`). Paste the real output; don't hand-write it.
- **Done when:** a reader can tell the three verdicts apart without opening `SPEC.md`.

## 5. (stretch, "help wanted") A second-language verifier
`conformance/README.md` already shows `python3 verify.py` as an example target. No second implementation exists.
- **Do:** write a small Python (or Go/Rust) verifier in its own directory that passes `node conformance/run.mjs --strict -- <your command>`.
- **Done when:** 28/28 strict. This is a larger task, and it's the strongest evidence that the spec is implementable from the text alone.
