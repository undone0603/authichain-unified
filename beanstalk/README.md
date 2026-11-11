# Beanstalk \u2014 Protected-ref Guard and Snapshot Utility

Conservative baseline implementation for AuthiChain verifiable provenance infrastructure.

**Original policy unrecovered.** Prior session work was unavailable; no matching code, branches, or PRs on main. Assumptions documented below. This is client-side infrastructure only.

## What the hook enforces

Opt-in protection of explicitly configured branch refs (e.g. `refs/heads/main` or globs like `refs/heads/release/*`) against:

- Non-fast-forward updates
- Deletions

Valid fast-forward updates and creations are allowed. Normal work on unprotected branches is unaffected. Enforcement occurs in the `reference-transaction` hook's prepared phase, before protected refs change.

Configuration:
```bash
git config --add beanstalk.protectedRefs 'refs/heads/main'
```

## Snapshot mechanism

Creates an immutable-by-convention snapshot of a selected Git revision:

- Tracked content only (via `git archive`)
- Prefers reflink (`cp --reflink=always`) when the filesystem supports it
- Ordinary-copy fallback otherwise
- Strict-reflink mode available
- Machine-readable manifest records: commit, format version, copy mode, content hash, timestamp
- Verification recomputes the content hash and detects alterations or missing content

Excludes by default: untracked files, ignored files, `.env*`, credentials, LFS blobs (unless already in the tree).

## Threat model

**Protected state:** Configured branch refs only.

**What is protected:** Non-FF updates and deletions of those refs, when the hook is present and config is set.

**Bypasses (explicit):** Anyone controlling the local repository can:
- Remove or edit the hook
- Change `core.hooksPath`
- Unset the config
- Edit repository metadata directly

**Guarantees that depend on trusted server-side enforcement:**
- Remote push rejection of non-FF / delete on protected branches
- Required status checks
- Any commercial or compliance claim about provenance

A local Git hook alone does **not** create tamper-proof provenance, security isolation, or a commercial moat.

## Installation

```bash
beanstalk/install.sh          # prefers .husky symlink if present
beanstalk/status.sh
beanstalk/uninstall.sh
```

Idempotent and reversible. Does not change global Git config or silently replace other hooks.

## How this supports AuthiChain provenance

Commit-bound snapshot manifests can serve as evidence for AuthiChain verification flows when:

- The manifest is Ed25519-signed or anchored via existing AuthiChain attestation paths
- Verification is served through the metered API (Stripe usage records)
- Server-side GitHub branch protection and required checks are enabled

Without those, the snapshot is local content-integrity evidence only.

## Limitations

- Client-side only; fully bypassable locally
- Symbolic refs are noted but not fully validated
- Partial porcelain operations (reset --hard, etc.) may change working tree before ref transaction fails
- Reflink not executed in environments without btrfs/XFS support
- No blockchain, token, or external service invented here

## Benchmark

Reflink benchmark **not executed in this environment**. Runnable script provided for suitable hosts. Do not treat ordinary-copy timings as reflink results.

## Revenue / Growth notes (founder decision)

Local hooks and snapshots are not a commercial moat. For revenue use, attested snapshots can be packaged as a metered "Provenance Snapshot" add-on:

- Free: 10 verified snapshots/month (lead magnet + upgrade CTA)
- Starter: $29/mo + $0.02 overage
- Pro: $99/mo + $0.01 overage
- COGS estimate ~$0.002/verified snapshot \u2192 >80% margin at volume

Growth loops (zero founder time): free `/verify-snapshot` lead magnet, optional QR deep-link to sealing-commit snapshot, programmatic SEO pages.

**Founder yes/no required:**
1. Merge after CI green?
2. Enable free 10-snapshot/mo verification lead magnet with upgrade CTA?
