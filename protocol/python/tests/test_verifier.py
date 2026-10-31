# SPDX-License-Identifier: Apache-2.0
"""Port of protocol/verifier.test.mjs, case for case."""

import copy
import hashlib
import unittest

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

from authichain_verify import (
    base58_decode,
    base58_encode,
    canonicalize,
    public_key_from_did_key,
    signing_bytes,
    verify_record,
)

NOW = "2026-06-01T00:00:00Z"


def make_record(**overrides):
    """Build a real signed record with a freshly generated Ed25519 key."""
    priv = Ed25519PrivateKey.generate()
    raw = priv.public_key().public_bytes(Encoding.Raw, PublicFormat.Raw)
    did = "did:key:z" + base58_encode(b"\xed\x01" + raw)
    proof_over = overrides.pop("proof", {})
    record = {
        "@context": ["https://www.w3.org/ns/credentials/v2", "https://authichain.com/protocol/v1"],
        "type": ["VerifiableCredential", "ProvenanceRecord"],
        "issuer": did,
        "validFrom": "2026-01-01T00:00:00Z",
        "credentialSubject": {
            "id": "https://id.gs1.org/01/09506000134352/21/SERIAL123",
            "gtin": "09506000134352",
            "serial": "SERIAL123",
        },
        **overrides,
    }
    record["proof"] = {
        "type": "Ed25519Signature2020",
        "created": "2026-01-01T00:00:00Z",
        "verificationMethod": f"{did}#{did[8:]}",
        "proofPurpose": "assertionMethod",
        **proof_over,
    }
    sig = priv.sign(signing_bytes(record))
    record["proof"]["proofValue"] = "z" + base58_encode(sig)
    return record


def anchor_for(record, **over):
    return {
        "recordHash": "sha256:" + hashlib.sha256(signing_bytes(record)).hexdigest(),
        "chain": "polygon:137",
        "txHash": "0x" + "a" * 64,
        "anchoredAt": "2026-01-01T00:05:00Z",
        **over,
    }


class Canonicalize(unittest.TestCase):
    def test_sorts_keys_so_two_serialisations_agree(self):
        self.assertEqual(canonicalize({"b": 1, "a": 2}), '{"a":2,"b":1}')
        self.assertEqual(canonicalize({"a": 2, "b": 1}), canonicalize({"b": 1, "a": 2}))

    def test_nesting_and_arrays_keep_element_order(self):
        self.assertEqual(
            canonicalize({"z": [3, 1, 2], "a": {"y": 1, "x": 2}}),
            '{"a":{"x":2,"y":1},"z":[3,1,2]}',
        )


class Base58DidKey(unittest.TestCase):
    def test_round_trips_through_decode(self):
        self.assertEqual(base58_decode(base58_encode(bytes([1, 2, 3, 250]))), bytes([1, 2, 3, 250]))

    def test_rejects_did_key_that_is_not_ed25519(self):
        not_ed = "did:key:z" + base58_encode(b"\xec\x01" + bytes(32))
        with self.assertRaisesRegex(ValueError, "not an Ed25519"):
            public_key_from_did_key(not_ed)


class ValidPaths(unittest.TestCase):
    def test_valid_unanchored_for_good_record_without_anchor(self):
        r = verify_record(make_record(), None, now=NOW)
        self.assertEqual(r["verdict"], "valid-unanchored")
        self.assertIs(r["checks"]["signature"], True)
        self.assertEqual(r["reasons"], [])

    def test_verified_for_good_record_with_mainnet_anchor(self):
        rec = make_record()
        r = verify_record(rec, anchor_for(rec), now=NOW)
        self.assertEqual(r["verdict"], "verified")
        self.assertIs(r["checks"]["anchorHash"], True)


class RejectsTampering(unittest.TestCase):
    def test_detects_modified_subject_after_signing(self):
        rec = make_record()
        rec["credentialSubject"]["serial"] = "TAMPERED"
        r = verify_record(rec, None, now=NOW)
        self.assertEqual(r["verdict"], "invalid")
        self.assertIn("signature_invalid", r["reasons"])

    def test_detects_anchor_hash_mismatch(self):
        rec = make_record()
        r = verify_record(rec, anchor_for(rec, recordHash="sha256:" + "0" * 64), now=NOW)
        self.assertEqual(r["verdict"], "invalid")
        self.assertIn("anchor_hash_mismatch", r["reasons"])


class RequiredFields(unittest.TestCase):
    def test_rejects_each_missing_top_level_field(self):
        for field in ["@context", "type", "issuer", "validFrom", "proof"]:
            with self.subTest(field=field):
                rec = make_record()
                del rec[field]
                r = verify_record(rec, None, now=NOW)
                self.assertEqual(r["verdict"], "invalid")
                self.assertIn(f"missing_field:{field}", r["reasons"])

    def test_rejects_record_without_subject_id(self):
        rec = make_record()
        del rec["credentialSubject"]["id"]
        self.assertIn("missing_field:credentialSubject.id", verify_record(rec, None, now=NOW)["reasons"])


class ValidityWindow(unittest.TestCase):
    def test_not_yet_valid(self):
        rec = make_record(validFrom="2030-01-01T00:00:00Z")
        self.assertIn("not_yet_valid", verify_record(rec, None, now=NOW)["reasons"])

    def test_expired(self):
        rec = make_record(validUntil="2026-02-01T00:00:00Z")
        self.assertIn("expired", verify_record(rec, None, now=NOW)["reasons"])


class MotivatingFailureModes(unittest.TestCase):
    def test_refuses_testnet_anchor(self):
        rec = make_record()
        r = verify_record(rec, anchor_for(rec, chain="eip155:80002"), now=NOW)
        self.assertEqual(r["verdict"], "invalid")
        self.assertIn("anchor_not_mainnet:eip155:80002", r["reasons"])

    def test_accepts_testnet_only_when_opted_in(self):
        rec = make_record()
        r = verify_record(rec, anchor_for(rec, chain="eip155:80002"), now=NOW, allow_testnet=True)
        self.assertEqual(r["verdict"], "verified")

    def test_rejects_truncated_tx_hash(self):
        rec = make_record()
        r = verify_record(rec, anchor_for(rec, txHash="0x" + "e" * 49), now=NOW)
        self.assertEqual(r["verdict"], "invalid")
        self.assertIn("tx_hash_malformed", r["reasons"])

    def test_rejects_non_caip2_chain(self):
        rec = make_record()
        self.assertIn("chain_not_caip2", verify_record(rec, anchor_for(rec, chain="polygon"), now=NOW)["reasons"])


class VerdictDiscipline(unittest.TestCase):
    def test_only_three_verdicts(self):
        for rec, anchor in [(make_record(), None), (make_record(), anchor_for(make_record())), ({}, None)]:
            self.assertIn(
                verify_record(rec, anchor, now=NOW)["verdict"],
                ["verified", "valid-unanchored", "invalid"],
            )

    def test_never_verified_with_reasons(self):
        rec = make_record()
        r = verify_record(rec, anchor_for(rec, chain="eip155:80002"), now=NOW)
        self.assertGreater(len(r["reasons"]), 0)
        self.assertNotEqual(r["verdict"], "verified")


if __name__ == "__main__":
    unittest.main()
