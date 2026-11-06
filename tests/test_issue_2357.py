"""Behavioral Trust Kernel regressions for issue #2357.

Each test executes the *real* protocol/trust-kernel/evaluate.mjs in Node.
These tests prove only local decision semantics; they do not verify a live
signature, authenticate an issuer, inspect a physical item, or authorize
external enforcement. No network or credentials are required.
"""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
EVALUATOR = ROOT / "protocol" / "trust-kernel" / "evaluate.mjs"


def actual(payload):
    if not EVALUATOR.is_file():
        raise AssertionError(f"Missing real evaluator: {EVALUATOR}")
    node = shutil.which("node")
    if not node:
        raise AssertionError("Node required for trust regression tests")
    with tempfile.TemporaryDirectory() as directory:
        input_file = Path(directory) / "case.json"
        input_file.write_text(json.dumps(payload), encoding="utf8")
        result = subprocess.run(
            [node, str(EVALUATOR), str(input_file)],
            text=True, capture_output=True, cwd=ROOT, timeout=10, check=False,
            env={"PATH": os.environ.get("PATH", "")},
        )
        if result.returncode:
            raise AssertionError(f"Evaluator exit {result.returncode}: {result.stderr[:500]}")
        return json.loads(result.stdout)


class TrustKernelBoundaries(unittest.TestCase):
    def assert_no_automatic_enforcement(self, response):
        self.assertNotIn("counterfeit", response["decision"].lower())
        self.assertNotIn("quarantine", response)
        self.assertNotIn("notify_authorities", response)
        self.assertNotIn("payment", response)

    def test_unknown_record(self):
        r = actual({"objectFound": False, "objectId": "never-issued"})
        self.assertEqual(r["decision"], "not_found")
        self.assertIn("object_not_found", r["reasons"])
        self.assert_no_automatic_enforcement(r)

    def test_explicitly_missing_record_with_attacker_crypto(self):
        r = actual({
            "objectFound": False,
            "attestation": {"issuer": "self-declared", "decision": "verified"},
            "crypto": {"signatureValid": True, "issuerTrusted": True,
                       "identityValid": True, "statusActive": True},
        })
        self.assertEqual(r["decision"], "not_found")
        self.assert_no_automatic_enforcement(r)

    def test_unsigned_issuer_claim_does_not_verify(self):
        r = actual({"objectFound": True, "attestation": {"issuer": "self-declared", "status": "active"}})
        self.assertNotEqual(r["decision"], "verified")
        self.assertEqual(r["vector"]["issuer"], "unknown")
        self.assert_no_automatic_enforcement(r)

    def test_valid_signature_without_issuer_trust_does_not_verify(self):
        r = actual({"objectFound": True, "crypto": {"signatureValid": True, "statusActive": True}})
        self.assertNotEqual(r["decision"], "verified")
        self.assertEqual(r["vector"]["issuer"], "unknown")

    def test_explicitly_untrusted_issuer_is_invalid(self):
        r = actual({"objectFound": True, "crypto": {
            "signatureValid": True, "issuerTrusted": False, "statusActive": True}})
        self.assertEqual(r["decision"], "invalid")
        self.assertIn("issuer_untrusted", r["reasons"])

    def test_missing_identity_verification_not_verified(self):
        r = actual({"objectFound": True, "identity": {"serial": "CLAIMED"}, "crypto": {
            "signatureValid": True, "issuerTrusted": True, "statusActive": True}})
        self.assertNotEqual(r["decision"], "verified")
        self.assertEqual(r["vector"]["identity"], "partial")

    def test_identity_mismatch_blocks_verification(self):
        r = actual({"objectFound": True, "identity": {"serial": "MISMATCH"}, "crypto": {
            "signatureValid": True, "issuerTrusted": True,
            "identityValid": False, "statusActive": True}})
        self.assertEqual(r["decision"], "invalid")
        self.assertIn("identity_mismatch", r["reasons"])

    def test_inactive_status_cannot_verify(self):
        r = actual({"objectFound": True, "crypto": {
            "signatureValid": True, "issuerTrusted": True,
            "identityValid": True, "statusActive": False}})
        self.assertNotEqual(r["decision"], "verified")

    def test_inactive_or_suspended_attestation_overrides_positive_crypto_flags(self):
        positive = {
            "signatureValid": True, "issuerTrusted": True,
            "identityValid": True, "statusActive": True,
        }
        for bad_status in ["inactive", "suspended", "blocked", "pending", "disabled"]:
            with self.subTest(bad_status=bad_status):
                r = actual({
                    "objectFound": True,
                    "attestation": {"status": bad_status},
                    "crypto": positive,
                })
                self.assertEqual(r["decision"], "blocked")
                self.assertIn("attestation_inactive_or_blocked", r["reasons"])
                self.assert_no_automatic_enforcement(r)

    def test_record_invalid_or_not_found_decision_cannot_be_overridden_by_flags(self):
        positive = {
            "signatureValid": True, "issuerTrusted": True,
            "identityValid": True, "statusActive": True,
        }
        for bad_decision in ["invalid", "not_found"]:
            with self.subTest(bad_decision=bad_decision):
                r = actual({
                    "objectFound": True,
                    "attestation": {"decision": bad_decision},
                    "crypto": positive,
                })
                self.assertEqual(r["decision"], "invalid")
                self.assertIn("attestation_decision_conflict", r["reasons"])
                self.assert_no_automatic_enforcement(r)

    def test_consistent_active_attestation_and_trusted_flags_can_still_verify(self):
        r = actual({
            "objectFound": True,
            "attestation": {"status": "active", "decision": "verified"},
            "crypto": {
                "signatureValid": True, "issuerTrusted": True,
                "identityValid": True, "statusActive": True,
            },
        })
        self.assertEqual(r["decision"], "verified")
        self.assertEqual(r["vector"]["physical_binding"], "unknown")
        self.assert_no_automatic_enforcement(r)

    def test_revoked_record_is_blocked(self):
        r = actual({"objectFound": True, "attestation": {"status": "revoked"}, "crypto": {
            "signatureValid": True, "issuerTrusted": True, "identityValid": True}})
        self.assertEqual(r["decision"], "blocked")

    def test_expired_attestation_is_expired(self):
        r = actual({"objectFound": True, "attestation": {"status": "expired"}, "crypto": {
            "signatureValid": True, "issuerTrusted": True, "identityValid": True}})
        self.assertEqual(r["decision"], "expired")

    def test_uncertain_scans_are_anomalies_not_accusations(self):
        r = actual({"objectFound": True, "depth": "history", "scans": [
            {"at": "2026-11-05T12:00:00Z", "region": "A"},
            {"at": "2026-11-05T12:01:00Z", "region": "B"},
            {"at": "2026-11-05T12:02:00Z", "region": "C"},
        ]})
        self.assertEqual(r["decision"], "anomaly")
        self.assertIn("cloned_identity_pattern", r["reasons"])
        self.assert_no_automatic_enforcement(r)

    def test_identity_failure_takes_priority_over_scan_anomaly(self):
        r = actual({"objectFound": True, "depth": "history", "identity": {"serial": "BAD"}, "crypto": {
            "signatureValid": True, "issuerTrusted": True,
            "identityValid": False, "statusActive": True},
            "scans": [
                {"at": "2026-11-05T12:00:00Z", "region": "A"},
                {"at": "2026-11-05T12:01:00Z", "region": "B"},
                {"at": "2026-11-05T12:02:00Z", "region": "C"},
            ]})
        self.assertEqual(r["decision"], "invalid")
        self.assert_no_automatic_enforcement(r)

    def test_lookup_depth_does_not_claim_scan_history(self):
        r = actual({"objectFound": True, "depth": "lookup"})
        self.assertEqual(r["vector"]["scan_behavior"], "unknown")
        self.assertIn("scan_history_not_in_lookup_depth", r["unknowns"])

    def test_mock_digest_is_not_real_provenance(self):
        r = actual({"objectFound": True,
            "evidence": [{"type": "inspection", "digest": "sha256:mock-digest-example"}],
            "crypto": {"evidenceIntact": True}})
        self.assertEqual(r["vector"]["provenance"], "unknown")
        self.assertIn("mock_digest_unusable", r["reasons"])

    def test_verified_crypto_still_does_not_prove_physical_authenticity(self):
        r = actual({"objectFound": True, "crypto": {
            "signatureValid": True, "issuerTrusted": True,
            "identityValid": True, "statusActive": True}})
        self.assertEqual(r["decision"], "verified")
        self.assertEqual(r["vector"]["physical_binding"], "unknown")
        self.assertIn("physical_binding_not_inspected", r["unknowns"])
        self.assert_no_automatic_enforcement(r)


if __name__ == "__main__":
    unittest.main()
