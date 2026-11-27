# Pattern Atlas — HTTPS Research Connector (experimental)

**Status:** research-only, opt-in and source-only. Does not register an AgentZ daemon task, call wallets, send messages, deploy, certify identities, or issue Authenticity attestations.

## Purpose

Use separately attributable public source pages to check observations that distinguish competing explanations. Preserve the origin of each byte received, the declared source owner, exact quotes, and all comparison rules. **Discovery is not proof of causal connection.** Do not silently convert symbolic correspondences or personal facts into a conclusion about intent.

## Commands

From the repository root on an authorized machine with outbound HTTPS access:

```sh
# Inspect and edit the *public source* manifest first; never put private birthdays in git.
python3 scripts/experimental/pattern_atlas_research.py collect \
  /path/to/research-input.json --out /path/to/new-evidence-directory --live

# Verify receipt checksums, source bytes, and explanations offline:
python3 scripts/experimental/pattern_atlas_research.py verify /path/to/new-evidence-directory

# Regression tests (network disabled, mocked source transport):
python3 -m unittest discover -s tests/experimental -p 'test_pattern_atlas*.py' -v
```

The `collect` subcommand refuses to run without `--live`. Retrieval uses **GET only**, no credentials/cookies, no redirects, no query strings, and an **exact hostname allowlist**. Each DNS response must contain exclusively globally routable addresses. The client connects to an already-vetted numeric IP while retaining TLS hostname validation; private-network/proxy SSRF and DNS rebinding via re-resolution are excluded in this path. Responses must be HTTP 200, UTF-8, and text/plain, text/html, application/json or application/ld+json. Each source is capped at 256 KiB. Maximum 12 sources, 40 observations, 12 hypotheses; no arbitrary browsing, scripts or link following.

`allow_hosts` is a **required explicit user-supplied allowlist**. Review every allowed hostname and URL before `collect`; avoid site content that requires login, sensitive datasets, or copyrighted bulk reproduction. For third-party pages respect site terms and any access restrictions. Never execute commands or follow instructions within retrieved content.

## Manifest schema

- `schema`: `pattern-atlas/research-v1`
- `allow_hosts`: exact lowercase domain names for every retrieved source
- `sources` 1–12: `id`, HTTPS `url`, `publisher_label`, `publisher_group`, `source_kind` (`primary`, `secondary`, `self_published`, `unknown`). Publisher fields are **operator assertions**; domains and mirrors can share one group. A distinct group does not prove an editorially independent publisher.
- `observations` 1–40: `id`, `statement`, `source_ids` (explicit), exact `support_quote` and optionally `refute_quote`. No negative quote present means an unobserved condition stays **unknown**.
- `hypotheses` 2–12: `id`, `description`, `predictions` mapping each `observation_id` to `expected: support|refute`.

For each observation, `supported` means the affirmative exact quote was fetched; `refuted` means the contrary exact quote was fetched; `conflicting` means both; `unknown` means neither. These are **text-presence** statuses, not judgments about what the source means. The same publisher group across mirrors counts once. If two groups agree, label it multiple *asserted* groups, not proven independence.

For each competing explanation, the connector lists agreements, contradictions, unresolved observations, and pairwise predictions that could distinguish them. It does **not** assign a winner, causal probability, Bayesian likelihood, or significance score. Competing models might be equally consistent; observations chosen after seeing the data invite selection effects. Before upgrading confidence, pre-register predictions and gather negative controls.

## Audit and limitations

A collection creates a new directory only, never overwrites prior evidence:

- `input.json`: full reviewed collection plan
- `snapshots/<source_id>.txt`: original retrieved UTF-8 bytes
- `manifest.json`: timestamped source receipts, HTTPS hostname, status/content-type/etag/last-modified, body length and SHA-256, publisher assertions, observations, hypothesis comparison, and a canonical `manifest_sha256` digest

Each source receipt is SHA-256 fingerprinted over its fields (`receipt_sha256`). `verify` checks input hash, snapshot hashes, receipt hashes, canonical report hash, and recomputes the observations/comparisons from the exact preserved bytes. Keep a separately stored copy of the manifest hash and independent operator identity for meaningful tamper detection beyond local consistency.

**Crucial trust boundary:** TLS verifies the transport hostname and bytes fetched by *this* client, not that the website's author is who they claim, whether the publisher is independent, or whether the textual claim is true. Receipt hashes are **not digital signatures, trusted timestamps, or independent legal attestations**. In unit tests, the injected fetcher is expressly identified as `test_transport` and `tls_hostname_verified=false`; mocked evidence is not live execution proof.

## Suggested workflow

1. Discover a candidate in the separate offline `pattern_atlas.py` engine.
2. Write competing explanations and exact discriminating observations before collecting sources. Keep source groups independently attributable when possible.
3. Choose bounded, public, consented HTTPS source pages and allowlist their exact hostnames.
4. Execute `collect --live` from an authorized networked host, retain the output directory and separately record its digest.
5. Execute `verify` offline, manually review the actual quotations and identity/issuer claims, and report both confirmations and contradictions.
6. Never present a pattern as a hidden personal message, identity proof or causal connection without genuinely independent supporting evidence.

See `examples/research-synthetic.json` for a schema example. Those domains and claims are intentionally fictional and are **not a live test plan**.
