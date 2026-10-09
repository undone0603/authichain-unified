# Sample passport (fictional pack)

`ebike-pack.passport.json` is a **sample, fictional pack, not an issued passport**. The
brand and the 48 V `EXAMPLE-LMT-48V-14Ah` pack are invented (see `SAMPLE_PACK` in
`workers/authichain-com/src/battery-sample-audit-page.ts`). Its id is a `urn:`, not a live GS1 id.

Check it yourself:

    node protocol/verifier.mjs protocol/samples/ebike-pack.passport.json   # "valid-unanchored", exit 0
    node --test protocol/samples/samples.test.mjs

The verifier accepts any self-consistent did:key. The test also checks that the signer
matches the public key in `ISSUER.json`. Signing: `sign-sample.mjs` with a local key (never committed).
