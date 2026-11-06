# Package Evidence Intake — offline demonstration, not product authentication

This CLI produces a reproducible, **redacted observation report** using photos, video, label transcriptions and QR observations. It hashes local evidence bytes (SHA-256) and explicitly separates *observed* from *authenticated*. The hash is **not** a digital signature. The tool does not access Michigan's state tracking system, validate laboratory CoAs, resolve QR sites, or issue any seal. Do not call its result a confirmed genuine or counterfeit product.

Run with Node 22+ (no install, no credentials):

```sh
node --test tools/package-evidence/report.test.mjs
node tools/package-evidence/cli.mjs tools/package-evidence/examples/trade-sample-redacted.json > /tmp/package-evidence-report.json
```

The public fixture intentionally omits media and uses invented, redacted-style identifiers; `FILE_UNAVAILABLE` is expected. Real media stays out of public Git. For a private case, place the files in a private directory, update the local JSON `files[].path` to be **relative** to that directory, and run the CLI there. Never publish a raw scan, purchaser ID, contact, file, key, or full state tracking number without permission.

### Evidence rules

- Detached tracking labels may belong to different items: `CROSS_SCOPE_RECONCILIATION_REQUIRED` is a request for issuer reconciliation, **not a counterfeit verdict**.
- A QR URL is an address, **not** proof the business issued the package. QR target validation and signed issuer attestations are separate product features.
- Genetics passports require actual CoAs, issuer authorization, human/source review, and subsequent controlled issuance. A trade sample photo is not a CoA.
- Even when files hash successfully, the report status remains `NOT_AUTHENTICATED`, and counterfeit determination remains `NOT_DETERMINED`.
- Reports use fail-closed redaction: unknown/free-form observation fields are masked; product/manufacturer/sale-status strings are shown only when they pass a sensitive-token check. Full QR payloads are never written to the report.
- Media hashes are computed in a bounded stream (512 MiB per source); paths and symlink targets must remain inside the supplied evidence directory.
- Never resell a package marked `TRADE SAMPLE — NOT FOR RESALE`. This tool is for selling authentication software and documenting packaging evidence, **not physical cannabis**.

The existing commercial offer (see `src/lib/plans.ts`) is the **$49 StrainChain genetics passport for one cultivar** at `https://authichain.com/checkout/strainchain_passport`. It is not a $49 forensic authenticity finding. For manufacturer batch/label integrations beyond that product, the `/trumark` page invites an asynchronous written packet rather than inventing a new Stripe SKU.
