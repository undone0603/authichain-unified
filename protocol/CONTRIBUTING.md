# Contributing to the AuthiChain Protocol

Thanks for your interest. This guide covers **`protocol/` only**: the verification specification (`SPEC.md`), the zero-dependency reference verifier (`verifier.mjs`), the conformance suite (`conformance/`) and the QFS-ready envelope (`qfs/`). That directory is Apache-2.0.

The rest of this repository is the proprietary AuthiChain platform (see `docs/project/LICENSE.md`) and is **not** open to outside contributions. Please keep pull requests inside `protocol/`.

## What we're looking for

- Bug reports where the reference verifier disagrees with `SPEC.md`, or where the spec is ambiguous. Two careful readers should not reach different verdicts.
- New conformance fixtures that pin down an edge case.
- Independent implementations in other languages that pass the conformance suite. Tell us and we'll link them.
- Docs fixes.

Starter tasks are listed in [`GOOD_FIRST_ISSUES.md`](GOOD_FIRST_ISSUES.md).

## Setup

You need Node.js 18 or newer (maintainers test on 22). The verifier has **no dependencies**, so you don't need `npm install` or the monorepo's `pnpm install` to work on it.

```bash
git clone https://github.com/undone0603/authichain-unified.git
cd authichain-unified/protocol
node conformance/run.mjs --strict -- node verifier.mjs     # 28/28 passed means you are set up
```

Conformance fixtures wrap a record (`{ id, record, anchor, expect }`). The conformance runner unwraps them for you. To verify a raw record, pass a file that contains only the record object.

## Running the tests

From `protocol/`:

```bash
# 1. Conformance suite: the contract every implementation must meet (28 fixtures)
node conformance/run.mjs --strict -- node verifier.mjs

# 2. QFS envelope tests (node:test, no install)
node --test qfs/envelope.test.mjs

# 3. Verifier unit tests + conformance-in-CI test (vitest)
npx -y vitest@3 run --root . --config /dev/null verifier.test.mjs conformance/conformance.test.mjs
```

All three must pass before a PR is reviewed. If you change fixture generation, run `node conformance/generate.mjs` and commit the regenerated fixtures. Generation is deterministic (fixed seeds), so re-running it on an unchanged generator must produce no diff.

## Changing the spec

- Behaviour changes to `SPEC.md` need a matching change to `verifier.mjs` **and** at least one conformance fixture that fails before the change and passes after it.
- Keep the verifier dependency-free and offline. A verifier that has to call an AuthiChain server is not proof of anything (see `SPEC.md` §0).
- Say in the PR description whether the change is breaking for existing records. The spec is `0.1.0 (draft)`, and breaking changes will bump the minor version.

## Pull request process

1. Fork, branch from `main`, and keep the PR focused on one change.
2. Run the three test commands above.
3. Fill in the PR template (summary, related issue, tests).
4. Sign off every commit (see below).
5. A maintainer (see `.github/CODEOWNERS`) reviews. Expect questions: we would rather understand a change than merge it quickly.

## Licensing and sign-off (DCO)

Contributions to `protocol/` are accepted under the **Apache License 2.0** (`protocol/LICENSE`). Under Apache-2.0 §5, anything you intentionally submit is licensed under the same terms. There is no separate CLA.

We ask for a [Developer Certificate of Origin 1.1](https://developercertificate.org/) sign-off on each commit. It certifies that you wrote the change or otherwise have the right to submit it:

```bash
git commit -s -m "verifier: reject empty proofValue"
```

This adds `Signed-off-by: Your Name <you@example.com>` to the commit. Use your real name.

Please add `SPDX-License-Identifier: Apache-2.0` to the header of new source files.

## Code of conduct

Be respectful, assume good faith, and keep discussion about the work. We follow the [Contributor Covenant v2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). Report conduct concerns privately to the maintainer (@undone0603 on GitHub) rather than in the thread.

## Reporting security issues

**Do not open a public issue for a vulnerability.** Use GitHub private vulnerability reporting: [Security → Report a vulnerability](https://github.com/undone0603/authichain-unified/security/advisories/new). The full policy is in [`docs/project/SECURITY.md`](../docs/project/SECURITY.md).

Protocol-level weaknesses count, for example a way to make the reference verifier return `verified` for a record that `SPEC.md` says is `invalid`. Known, documented limitations (no revocation in v0.1, "garbage in", anchor ≠ existence; see `SPEC.md` §8) are not vulnerabilities, but proposals to address them are welcome as normal issues.
