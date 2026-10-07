# Dependabot triage: critical alerts (2026-10-01)

Scope: every **critical** advisory in a dependency manifest Dependabot scans in
this repo. Highs and moderates are listed under "Not done", with the reason.

## Method

No tool in this session can read the Dependabot alert list, so each manifest
was audited directly against GitHub advisory data:

- **npm (15 `pnpm-lock.yaml` files):** each lockfile was copied with its
  `package.json` into a scratch directory and checked with
  `pnpm audit --ignore-workspace`. The root lockfile was checked in place.
- **Rust (3 `Cargo.lock` files):** matched against a fresh clone of the RustSec
  advisory database. CVSS 3.x base scores were computed where an advisory has
  one.
- **Python (`requirements-agentz.txt`):** every line is a `>=` floor with no
  pin, so there is no resolved version to match. Dependabot does not alert on
  unpinned ranges.

## Critical findings and what was done

All criticals were the same three Next.js advisories, in six vendored or
reference **docs sites**. None of these is built or deployed by any workflow
in this repo; each is a standalone project with its own lockfile.

| Advisory            | Issue                                                   | Fixed in |
| ------------------- | ------------------------------------------------------- | -------- |
| GHSA-p293-qw3h-jr36 | Unauthenticated remote code execution (Windows hosts)   | 16.3.3   |
| GHSA-2xp9-vwfh-vxw4 | Unauthenticated remote code execution (image optimizer) | 16.3.3   |
| GHSA-vcvr-r3jv-pc5j | Remote code execution in `next/og` `ImageResponse`      | 16.3.6   |

| Project                                                                   | Was     | Now    |
| ------------------------------------------------------------------------- | ------- | ------ |
| `apps/agent-browser/docs`                                                 | 16.2.11 | 16.3.6 |
| `apps/agent-browser/examples/environments`                                | 16.2.11 | 16.3.6 |
| `apps/chatbot/agent-browser/agent-browser/docs`                           | 16.2.11 | 16.3.6 |
| `apps/chatbot/browser-native-chatbot-v3/agent-browser/agent-browser/docs` | 16.2.11 | 16.3.6 |
| `docs/technical-reference/docs-agent-browser`                             | 16.1.1  | 16.3.6 |
| `docs/technical-reference/docs-chatbot-agent-browser`                     | 16.1.1  | 16.3.6 |

How the change was made:

- The four vendored projects already carry the agent-browser "scoped security
  overrides" block in their `pnpm-workspace.yaml`. Its `next` override had gone
  stale (`<16.2.11 → 16.2.11`) and is raised to `<16.3.6 → 16.3.6`.
- Exact `next` pins in `package.json` move to 16.3.6.
- Each lockfile was regenerated with `pnpm install --lockfile-only`, never edited
  by hand, and passes `pnpm install --frozen-lockfile`.
- 16.3.6 is the version the root app runs. 16.3.8 was one day old and would
  fall under the repo's minimum-release-age policy.
- The lockfile diffs are `next` and what it pulls in: `@next/*`,
  `@swc/helpers`, `sharp`, and peer-suffixed entries such as `geist` and
  `@vercel/analytics` that embed the `next` version.

**After:** `pnpm audit` reports **0 critical in all 15 npm lockfiles**, including
the root.

Dependabot showed 29 critical alerts at push time. The audit above finds 16
critical findings (the 3 advisories × 4 lockfiles, plus 2 × 2 for the 16.1.1
copies). Dependabot counts per manifest and per alert, so its number can differ.
Re-check the Dependabot page after this merges; any critical still open there
is in a manifest this audit did not cover.

## Not done (and why)

- **The three agent-browser CLI projects** (`apps/agent-browser`, and the two
  copies under `apps/chatbot/`) were left alone.
  - They carry the same override block, but none of them resolves `next`, so
    the override is inert there.
  - `apps/agent-browser/pnpm-lock.yaml` is also **out of date with its own
    `package.json`**: node-simctl `^9.1.1` against a locked `^7.4.0`, and newer
    playwright-core and webdriverio. Regenerating it pulls in those upgrades, a
    change beyond this triage.
- **Highs and moderates** were out of scope.

  | Lockfile                             | High | Moderate |
  | ------------------------------------ | ---: | -------: |
  | root                                 |   11 |       15 |
  | each docs site                       |   16 |        5 |
  | `examples/environments`              |   18 |       27 |
  | each agent-browser CLI copy          |   19 |       23 |
  | each `docs/technical-reference` copy |   40 |       20 |
  | `workers/authichain-gateway`         |   17 |       38 |
  | `worker`                             |    2 |        9 |

- **Rust** has no critical:
  - The only scored advisory is RUSTSEC-2026-0285 (rustls 0.23.37 → ≥0.23.45),
    CVSS 5.3.
  - The unscored ones are h2 (empty-frame DoS), crossbeam-epoch, and three
    rustls-webpki name-constraint and CRL issues (≥0.103.13), plus the
    unmaintained `paste` and `core2`.
  - The fix is `cargo update -p <crate>` in each `cli/`.

## Ways to cut the alert count (owner decisions)

- **Delete the duplicate vendored trees.** Every advisory currently shows up
  three to five times. The trees are:
  - `apps/chatbot/agent-browser/agent-browser`;
  - `apps/chatbot/browser-native-chatbot-v3/agent-browser/agent-browser`;
  - `docs/technical-reference/docs-*-agent-browser`.

  `apps/agent-browser` would remain the single vendored copy.

- **Delete the stale per-member lockfiles** in `worker/` and `workers/*/`. These
  directories are root workspace members and install from the root
  `pnpm-lock.yaml`, but Dependabot still scans their own lockfiles.
