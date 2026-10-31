# SPDX-License-Identifier: Apache-2.0
"""Port of protocol/jws.test.mjs. Same fixture files (protocol/examples/)."""

import base64
import json
import unittest
from pathlib import Path

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

from authichain_verify import did_key_from_jwk, public_key_from_did_key, verify_attestation_jws, verify_record

EX = Path(__file__).resolve().parents[2] / "examples"
VALID = (EX / "attestation-fixture.jws").read_text().strip()
TAMPERED = (EX / "attestation-fixture-tampered.jws").read_text().strip()
JWKS = json.loads((EX / "attestation-fixture.jwks.json").read_text())
RECORD = json.loads((EX / "record.json").read_text())
NOW = "2026-10-01T00:00:00Z"


def b64u(data):
    if not isinstance(data, (bytes, str)):
        data = json.dumps(data, separators=(",", ":"))
    if isinstance(data, str):
        data = data.encode()
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def sign_jws(header, payload):
    priv = Ed25519PrivateKey.generate()
    x = b64u(priv.public_key().public_bytes(Encoding.Raw, PublicFormat.Raw))
    signing_input = f"{b64u(header)}.{b64u(payload)}"
    sig = b64u(priv.sign(signing_input.encode()))
    jwk = {"kty": "OKP", "crv": "Ed25519", "x": x, "kid": header.get("kid"), "alg": "EdDSA", "use": "sig"}
    return f"{signing_input}.{sig}", {"keys": [jwk]}


PAYLOAD = json.loads(base64.urlsafe_b64decode(VALID.split(".")[1] + "=="))
HEADER = {"alg": "EdDSA", "kid": "k1", "typ": "AC-ATTESTATION+JWS"}


class VerifyAttestationJws(unittest.TestCase):
    def test_accepts_valid_fixture(self):
        r = verify_attestation_jws(VALID, JWKS, now=NOW)
        self.assertEqual(r["verdict"], "valid-offline")
        self.assertEqual(r["checks"], {"kid": True, "signature": True})
        self.assertEqual(r["payload"]["subject"]["serial"], "SN-001")

    def test_rejects_tampered_fixture(self):
        r = verify_attestation_jws(TAMPERED, JWKS, now=NOW)
        self.assertEqual(r["verdict"], "invalid")
        self.assertEqual(r["reasons"], ["signature_invalid"])

    def test_rejects_unknown_kid(self):
        other = {"keys": [{**JWKS["keys"][0], "kid": "other"}]}
        self.assertEqual(verify_attestation_jws(VALID, other, now=NOW)["reasons"], ["kid_not_in_jwks"])

    def test_rejects_right_kid_wrong_key(self):
        _, jwks = sign_jws(HEADER, PAYLOAD)
        swapped = {"keys": [{**jwks["keys"][0], "kid": JWKS["keys"][0]["kid"]}]}
        self.assertEqual(verify_attestation_jws(VALID, swapped, now=NOW)["reasons"], ["signature_invalid"])

    def test_rejects_expired_payload(self):
        r = verify_attestation_jws(VALID, JWKS, now="2027-06-01T00:00:00Z")
        self.assertIs(r["checks"]["signature"], True)
        self.assertEqual(r["reasons"], ["expired"])

    def test_non_verified_decision_and_non_active_status(self):
        jws, jwks = sign_jws(HEADER, {**PAYLOAD, "decision": "warning", "status": "revoked"})
        r = verify_attestation_jws(jws, jwks, now=NOW)
        self.assertIs(r["checks"]["signature"], True)
        self.assertEqual(r["reasons"], ["decision:warning", "status:revoked"])

    def test_rejects_wrong_typ_and_alg(self):
        jws, jwks = sign_jws({**HEADER, "typ": "JWT"}, PAYLOAD)
        self.assertIn("typ_unexpected:JWT", verify_attestation_jws(jws, jwks, now=NOW)["reasons"])
        jws, jwks = sign_jws({**HEADER, "alg": "none"}, PAYLOAD)
        self.assertIn("alg_unsupported:none", verify_attestation_jws(jws, jwks, now=NOW)["reasons"])

    def test_rejects_malformed_input(self):
        self.assertEqual(verify_attestation_jws("not-a-jws", JWKS)["reasons"], ["jws_malformed"])
        self.assertEqual(verify_attestation_jws("a.b.c", JWKS)["reasons"], ["jws_malformed"])


class JwksPinning(unittest.TestCase):
    def test_did_key_from_jwk_round_trips(self):
        did = did_key_from_jwk(JWKS["keys"][0])
        raw = public_key_from_did_key(did).public_bytes(Encoding.Raw, PublicFormat.Raw)
        self.assertEqual(b64u(raw), JWKS["keys"][0]["x"])

    def test_passes_when_signer_in_jwks(self):
        raw = public_key_from_did_key(RECORD["issuer"]).public_bytes(Encoding.Raw, PublicFormat.Raw)
        r = verify_record(RECORD, None, now=NOW, jwks={"keys": [{"kty": "OKP", "crv": "Ed25519", "x": b64u(raw)}]})
        self.assertEqual(r["verdict"], "valid-unanchored")
        self.assertIs(r["checks"]["issuerInJwks"], True)

    def test_fails_when_signer_not_in_jwks(self):
        r = verify_record(RECORD, None, now=NOW, jwks=JWKS)
        self.assertEqual(r["verdict"], "invalid")
        self.assertEqual(r["reasons"], ["issuer_not_in_jwks"])


if __name__ == "__main__":
    unittest.main()
