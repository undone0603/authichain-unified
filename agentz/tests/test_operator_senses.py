"""Offline tests for the AgentZ local operator senses. No model, TTS or network needed."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from agentz.operator_senses import analyze_evidence, local_endpoint, read_image, speak_local


class OperatorSensesTests(unittest.TestCase):
    def test_queued_probe_never_claims_token_validity(self):
        result = analyze_evidence({"job": {"status": "queued"}, "markers": [
            "PRODUCTION_CLOUDFLARE_TOKEN_PREFLIGHT_PASS"]})
        self.assertFalse(result["credential_validated"])
        self.assertFalse(result["deployment_authorized"])
        self.assertIn("runner", result["recommendation"])

    def test_success_requires_both_job_conclusion_and_marker(self):
        self.assertFalse(analyze_evidence({"job": {"status": "completed",
            "conclusion": "success"}})["credential_validated"])
        self.assertTrue(analyze_evidence({"job": {"status": "completed",
            "conclusion": "success"}, "markers": [
            "PRODUCTION_CLOUDFLARE_TOKEN_PREFLIGHT_PASS"]})["credential_validated"])

    def test_failed_probe_does_not_authorize_deployment(self):
        result = analyze_evidence({"job": {"status": "completed", "conclusion": "failure"},
            "markers": ["PRODUCTION_CLOUDFLARE_TOKEN_PREFLIGHT_PASS"]})
        self.assertFalse(result["credential_validated"])
        self.assertFalse(result["deployment_authorized"])

    def test_remote_or_embedded_credential_endpoint_refused(self):
        for endpoint in ("https://127.0.0.1:1234/v1", "http://example.com/v1",
                         "http://user:pass@127.0.0.1:1234/v1",
                         "http://127.0.0.1:1234/v1?token=abc",
                         "http://127.0.0.1:1234/api/v1"):
            with self.subTest(endpoint=endpoint), self.assertRaises(ValueError):
                local_endpoint(endpoint)
        self.assertEqual(local_endpoint("http://127.0.0.1:1234/v1"),
                         "http://127.0.0.1:1234/v1")

    def test_image_must_be_supported_and_bounded(self):
        with tempfile.TemporaryDirectory() as directory:
            p = Path(directory) / "screenshot.png"
            p.write_bytes(b"not an image")
            with self.assertRaises(ValueError):
                read_image(p)
            p.write_bytes(b"\x89PNG\r\n\x1a\n" + b"abc")
            mime, encoded = read_image(p)
            self.assertEqual(mime, "image/png")
            self.assertTrue(encoded)

    def test_speech_unavailable_is_safe(self):
        with patch("agentz.operator_senses.shutil.which", return_value=None):
            self.assertFalse(speak_local("Operator briefing"))


if __name__ == "__main__":
    unittest.main()
