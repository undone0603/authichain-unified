# Draft seal — reversible step toward the vision

Vision: a scan resolves to a signed provenance record anyone can verify offline (`protocol/SPEC.md`). Today Starter sells generations. Signed verification is in development. This step drafts the record shape and forces the existing verifier to reject it until a key signs it.

Not done here: signing, Polygon anchor, dynamic redirect, Stripe price edit, mail, deploy.

## Run

```bash
node --test protocol/draft-record.test.mjs
```

Expected: exit 0, one log line `event=draft_seal verdict=unsigned-draft seal=false`, and `verifyRecord` returns `invalid`.

## Observability

`draftLog()` emits `event`, `generationId`, `verdict`, `seal`, `idempotencyKey`. No metric backend. Alert: none, because this path cannot claim verified.

## Cost

$0/month. Removes hand-building a record JSON (~15 min per generation test).

## Founder-only

Issuance key, JWKS publish, wrangler deploy, DNS. Do not add `ISSUER_PRIVATE_KEY` to this branch.

## Yes/no

Merge `autonomy/draft-seal-2026-10-06` and run the test only — do not deploy?
