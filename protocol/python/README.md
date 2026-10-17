# authichain-verify (Python)

Python port of the [`authichain-verify`](https://www.npmjs.com/package/authichain-verify) offline reference verifier for the AuthiChain Verification Specification v0.1.0 ([`../SPEC.md`](../SPEC.md)). Apache-2.0. Its only dependency is [`cryptography`](https://pypi.org/project/cryptography/).

Not on PyPI yet. Install from a checkout:

```bash
pip install ./protocol/python
authichain-verify protocol/examples/record.json
# {"verdict": "valid-unanchored", ...}
```

## Check a seal against the published key

```bash
curl -sO https://authichain.com/protocol/jwks.json
authichain-verify --jwks jwks.json seal.jws          # compact-JWS attestation seal
authichain-verify --jwks jwks.json record.json       # record, signer pinned to the JWKS
```

```python
import json
from authichain_verify import verify_attestation_jws, verify_record

jwks = json.load(open("jwks.json"))
print(verify_attestation_jws(open("seal.jws").read(), jwks)["verdict"])   # valid-offline | invalid
print(verify_record(json.load(open("record.json")))["verdict"])          # verified | valid-unanchored | invalid
```

Same checks, verdicts, reason strings and exit codes as the JS CLI (exit 0 for `verified` / `valid-unanchored` / `valid-offline`, 1 for `invalid`, 2 for usage; `ALLOW_TESTNET=1` accepts testnet anchors). A seal check does not cover live revocation, and a valid signature does not by itself prove the physical item in hand is the one the seal names.

## Tests

```bash
cd protocol/python && PYTHONPATH=src python3 -m unittest discover -s tests
cd .. && PYTHONPATH=python/src node conformance/run.mjs --strict -- python3 -m authichain_verify
```

The unit tests port `protocol/verifier.test.mjs` and `protocol/jws.test.mjs` case for case, and run all 28 conformance fixtures in-process. Python 3.9+.
