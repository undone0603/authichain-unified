"""AgentZ self-identity binding tests."""
import os
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest import mock

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from agentz.core import identity


def _pem(key):
    return key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                             serialization.NoEncryption())


class IdentityTests(unittest.TestCase):
    NOW = datetime(2026, 11, 19, tzinfo=timezone.utc)

    def test_published_identity_is_bound(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            s = identity.identity_status(self.NOW)
        self.assertEqual(s["agent_id"], "agent:authichain:agentz")
        self.assertEqual(s["did"], "did:web:authichain.com:agents:agentz")
        self.assertTrue(s["did_key"].startswith("did:key:z6Mk"))
        self.assertFalse(s["expired"])

    def test_without_key_dir_possession_is_unproven_and_cannot_sign(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            s = identity.identity_status(self.NOW)
        self.assertEqual(s["key_possession"]["status"], "unproven")
        self.assertFalse(s["can_sign_as_self"])

    def test_a_different_key_is_reported_as_mismatch_never_proven(self):
        with tempfile.TemporaryDirectory() as d:
            Path(d, identity.KEY_FILE).write_bytes(_pem(Ed25519PrivateKey.generate()))
            with mock.patch.dict(os.environ, {"AGENTZ_KEY_DIR": d}, clear=True):
                s = identity.identity_status(self.NOW)
        self.assertEqual(s["key_possession"]["status"], "mismatch")
        self.assertFalse(s["can_sign_as_self"])

    def test_the_matching_key_proves_possession(self):
        key = Ed25519PrivateKey.generate()
        did = identity.did_key_from_pem(_pem(key))
        with tempfile.TemporaryDirectory() as d, mock.patch.object(identity, "DID_KEY", did):
            Path(d, identity.KEY_FILE).write_bytes(_pem(key))
            with mock.patch.dict(os.environ, {"AGENTZ_KEY_DIR": d}, clear=True):
                s = identity.identity_status(self.NOW)
        self.assertEqual(s["key_possession"]["status"], "proven")
        self.assertTrue(s["can_sign_as_self"])

    def test_expired_identity_cannot_sign_even_with_the_key(self):
        key = Ed25519PrivateKey.generate()
        did = identity.did_key_from_pem(_pem(key))
        # Derive from the published roster: a hardcoded date broke when the
        # identity was re-issued with a later validUntil.
        later = datetime.fromisoformat(identity.VALID_UNTIL.replace("Z", "+00:00")) + timedelta(days=1)
        with tempfile.TemporaryDirectory() as d, mock.patch.object(identity, "DID_KEY", did):
            Path(d, identity.KEY_FILE).write_bytes(_pem(key))
            with mock.patch.dict(os.environ, {"AGENTZ_KEY_DIR": d}, clear=True):
                s = identity.identity_status(later)
        self.assertTrue(s["expired"])
        self.assertFalse(s["can_sign_as_self"])

    def test_garbage_key_file_is_unproven(self):
        with tempfile.TemporaryDirectory() as d:
            Path(d, identity.KEY_FILE).write_bytes(b"not a key")
            with mock.patch.dict(os.environ, {"AGENTZ_KEY_DIR": d}, clear=True):
                s = identity.identity_status(self.NOW)
        self.assertEqual(s["key_possession"]["status"], "unproven")

    def test_reports_whether_it_trusts_its_own_signatures(self):
        with mock.patch.dict(os.environ, {"AGENTZ_TRUSTED_ISSUERS": identity.DID_KEY}, clear=True):
            self.assertTrue(identity.identity_status(self.NOW)["trusts_own_signatures"])
        with mock.patch.dict(os.environ, {}, clear=True):
            self.assertFalse(identity.identity_status(self.NOW)["trusts_own_signatures"])

    def test_identity_is_read_from_the_published_roster(self):
        pub = identity.published_identity()
        self.assertEqual(identity.DID_KEY, pub["did_key"])
        self.assertEqual(identity.DID_WEB, "did:web:authichain.com:agents:agentz")
        self.assertTrue(identity.IDENTITIES.is_file())

    def test_did_key_encoding_matches_the_published_form(self):
        # Ed25519 did:keys always start with z6Mk (multicodec 0xed01 + base58btc).
        did = identity.did_key_from_pem(_pem(Ed25519PrivateKey.generate()))
        self.assertTrue(did.startswith("did:key:z6Mk"))

    def test_status_never_contains_key_material(self):
        key = Ed25519PrivateKey.generate()
        pem = _pem(key).decode()
        with tempfile.TemporaryDirectory() as d:
            Path(d, identity.KEY_FILE).write_text(pem)
            with mock.patch.dict(os.environ, {"AGENTZ_KEY_DIR": d}, clear=True):
                text = repr(identity.identity_status(self.NOW))
        self.assertNotIn("PRIVATE KEY", text)
        self.assertNotIn(pem.splitlines()[1], text)


if __name__ == "__main__":
    unittest.main()
