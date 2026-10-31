# Cloudflare estate reconciliation

`config/cloudflare-estate.json` is the repository-side ledger for Worker ownership.

The ledger deliberately distinguishes **reported-live external Workers** from verified Cloudflare state. It is not evidence that an external Worker still exists. Before retirement, confirm the Worker, routes, triggers, consumers, bindings, and secret names in Cloudflare.

## Invariants

- A production Worker has one canonical source directory.
- A Worker identity is not declared by multiple repo `wrangler.toml` files.
- External Workers remain explicitly tracked until verified retired.
- Verification and consensus Workers are critical and cannot be retired through repository cleanup alone.
- This audit is read-only and does not call Cloudflare or mutate production.

Run:

`node scripts/cloudflare/audit-estate.mjs`
