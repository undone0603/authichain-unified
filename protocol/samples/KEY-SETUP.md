# GB-15 / PM-454 — sample passport signing key (for Zac)

Run these on your own machine, not in a chat or on the box. Needs OpenSSL 3+ and Node 18+.

## 1. Generate the keypair (private key stays on your machine)
```bash
openssl genpkey -algorithm ed25519 -out authichain-sample-passport.key.pem
chmod 600 authichain-sample-passport.key.pem
```

## 2. Print the PUBLIC key as a did:key
```bash
node -e 'const c=require("crypto"),A="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";let b=Buffer.concat([Buffer.from([237,1]),c.createPublicKey(c.createPrivateKey(require("fs").readFileSync(process.argv[1]))).export({format:"der",type:"spki"}).subarray(-32)]),n=BigInt("0x"+b.toString("hex")),s="";while(n>0n){s=A[Number(n%58n)]+s;n/=58n}console.log("did:key:z"+s)' authichain-sample-passport.key.pem
```
Paste ONLY that `did:key:z6Mk...` line to CF Deploy. It is public. It gets committed to
`protocol/samples/ISSUER.json` (field `"issuer"`). The test checks the sample's issuer against it.

## 3. Store the PRIVATE key as a GitHub Actions secret (only if we want CI to re-sign)
```bash
gh secret set SAMPLE_PASSPORT_SIGNING_KEY --repo undone0603/authichain-unified < authichain-sample-passport.key.pem
```
Optional. CI only *verifies* and never needs the key. You can skip this, sign once locally
(step 4), and keep the .pem offline.

## 4. Sign the sample once (after the draft PR lands on your machine)
```bash
SAMPLE_SIGNING_KEY_PEM_FILE=./authichain-sample-passport.key.pem \
  node protocol/samples/sign-sample.mjs protocol/samples/ebike-pack.unsigned.json \
  > protocol/samples/ebike-pack.passport.json
node protocol/verifier.mjs protocol/samples/ebike-pack.passport.json   # expect "valid-unanchored", exit 0
```
Commit only `ebike-pack.passport.json`. Never commit the .pem, never paste it anywhere, and don't
put it in a Worker secret: no Worker signs this sample.

Rules: this key is only for the sample. Don't reuse the DOGFOOD_BOT_KEY_* bot keys or the
attestation JWKS key. Revoke it by deleting the GH secret and replacing ISSUER.json in a PR.
