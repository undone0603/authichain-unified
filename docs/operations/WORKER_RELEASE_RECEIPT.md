# AuthiChain app protected release receipt

After the protected `attestation-bootstrap` workflow is approved, Wrangler's **real deployment invocation** uses `--outdir .release-receipt/bundle`. A preceding read-only Cloudflare GET records the active deployment/version. Another GET afterward requires a **new** 100%-active deployment, a new version ID, and Wrangler-origin version metadata created in this release window. The job records the exact checked-out protected-main SHA and GitHub run ID.

The same release runner calculates SHA-256 per bundled output file and SHA-256 of sorted `SHA256SUMS` and publishes the bundle, `SHA256SUMS`, and `receipt.json` as a short-retention GitHub Actions artifact. Any missing bundle, unexpected symlink, unchanged Worker version, absent API evidence, or artifact upload failure blocks the next live attestation step. Rollback does not generate a forward-release receipt.

**Trust boundary:** the receipt proves the hashed bundle was generated in the release job and Cloudflare reported the resulting new deployment/version. It does **not** by itself prove Cloudflare's remote script bytes are identical to those bundled bytes, nor does it prove the runtime database identity. Independent remote source content attestation (or a matched remote code digest), the protected SHA, and a successful authenticated two-connection database check remain separate certification conditions. Do not relabel previous Worker versions as the newly merged commit.

No binding values, database credentials, or payment/customer data belong in the receipt. The artifact can include bundled application source; restrict repository Actions artifact access and keep retention short. Do not dispatch an incomplete production release merely to produce this evidence.
