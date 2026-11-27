"""Standard-library acceptance tests: opt-in bounded research / evidence receipts."""
from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "experimental" / "pattern_atlas_research.py"
spec = importlib.util.spec_from_file_location("pattern_atlas_research", SCRIPT)
mod = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = mod
spec.loader.exec_module(mod)


def fixture():
    return {
        "schema": "pattern-atlas/research-v1",
        "allow_hosts": ["alpha.example.org", "beta.example.edu", "mirror.example.org"],
        "sources": [
            {"id": "alpha", "url": "https://alpha.example.org/facts", "publisher_label": "Alpha Institute",
             "publisher_group": "alpha", "source_kind": "primary"},
            {"id": "beta", "url": "https://beta.example.edu/record", "publisher_label": "Beta University",
             "publisher_group": "beta", "source_kind": "secondary"},
            {"id": "mirror", "url": "https://mirror.example.org/facts", "publisher_label": "Alpha Institute mirror",
             "publisher_group": "alpha", "source_kind": "self_published"},
        ],
        "observations": [
            {"id": "first", "statement": "An original document recorded 2020",
             "source_ids": ["alpha", "beta", "mirror"], "support_quote": "Original year: 2020",
             "refute_quote": "Original year: 2019"},
            {"id": "second", "statement": "A second independent event was recorded",
             "source_ids": ["alpha", "beta"], "support_quote": "Second event occurred",
             "refute_quote": "Second event did not occur"},
            {"id": "third", "statement": "A third event was recorded",
             "source_ids": ["beta"], "support_quote": "Third event confirmed",
             "refute_quote": "Third event disproved"},
        ],
        "hypotheses": [
            {"id": "h_chance", "description": "Dates coincide without shared authorship",
             "predictions": [{"observation_id": "first", "expected": "support"},
                             {"observation_id": "second", "expected": "refute"},
                             {"observation_id": "third", "expected": "support"}]},
            {"id": "h_coordination", "description": "Events are authored together",
             "predictions": [{"observation_id": "first", "expected": "refute"},
                             {"observation_id": "second", "expected": "support"},
                             {"observation_id": "third", "expected": "support"}]},
        ],
    }


def fake_fetch(host, path):
    pages = {
        ("alpha.example.org", "/facts"): b"Original year: 2020\nSecond event occurred",
        ("beta.example.edu", "/record"): b"Original year: 2020\nThird event disproved",
        ("mirror.example.org", "/facts"): b"Original year: 2020\n",
    }
    return mod.FetchResponse(200, {"content-type": "text/plain", "etag": '"test"'}, pages[(host, path)])


def fixed_clock():
    return "2030-01-01T00:00:00+00:00"


class ResearchConnectorTests(unittest.TestCase):
    def test_simulated_fetch_receipts_competing_explanations_and_reverification(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td) / "bundle"
            report = mod.collect(fixture(), root, fetcher=fake_fetch, clock=fixed_clock)
            self.assertEqual([o["status"] for o in report["observations"]],
                             ["supported", "supported", "refuted"])
            self.assertEqual(report["observations"][0]["distinct_support_group_count"], 2)
            self.assertEqual(report["comparisons"][0]["agreeing_observations"], ["first"])
            self.assertEqual(report["comparisons"][0]["contradicting_observations"], ["second", "third"])
            self.assertEqual(report["comparisons"][1]["agreeing_observations"], ["second"])
            self.assertEqual(report["discrimination"][0]["observed_discriminators"], ["first", "second"])
            self.assertFalse(report["sources"][0]["tls_hostname_verified"])
            self.assertEqual(report["sources"][0]["transport"], "test_transport")
            self.assertFalse(report["sources"][0]["publisher_ownership_independently_verified"])
            status = mod.verify_bundle(root)
            self.assertEqual(status["status"], "bundle_internal_consistency_pass")
            self.assertFalse(status["externally_witnessed_receipt"])
            self.assertEqual(status["manifest_sha256"], report["manifest_sha256"])

    def test_unknown_is_not_evidence_against_a_hypothesis(self):
        f = fixture()
        f["observations"][2]["support_quote"] = "Unmatched positive quote"
        f["observations"][2]["refute_quote"] = "Unmatched negative quote"
        with tempfile.TemporaryDirectory() as td:
            report = mod.collect(f, Path(td) / "bundle", fetcher=fake_fetch)
        self.assertEqual(report["observations"][2]["status"], "unknown")
        self.assertEqual(report["comparisons"][0]["unresolved_observations"][0]["reason"], "unknown")

    def test_conflicting_quotes_remain_conflicted(self):
        f = fixture()
        f["observations"][0]["refute_quote"] = "Third event disproved"
        with tempfile.TemporaryDirectory() as td:
            report = mod.collect(f, Path(td) / "bundle", fetcher=fake_fetch)
        self.assertEqual(report["observations"][0]["status"], "conflicting")
        self.assertEqual(report["comparisons"][0]["unresolved_observations"][0]["reason"], "conflicting")

    def test_same_publisher_on_distinct_hosts_not_independent(self):
        f = fixture()
        f["observations"][0]["source_ids"] = ["alpha", "mirror"]
        with tempfile.TemporaryDirectory() as td:
            report = mod.collect(f, Path(td) / "bundle", fetcher=fake_fetch)
        self.assertEqual(report["observations"][0]["distinct_support_group_count"], 1)

    def test_explicit_domain_allowlist_rejects_unsafe_urls(self):
        allowed = {"alpha.example.org"}
        for url in [
            "http://alpha.example.org/facts", "https://alpha.example.org.evil.test/facts",
            "https://user:pass@alpha.example.org/facts", "https://alpha.example.org:443/facts",
            "https://alpha.example.org/facts?token=x", "https://alpha.example.org/facts#fragment",
            "https://127.0.0.1/private", "file:///etc/passwd", "https://alpha.example.org/facts\nEvil",
        ]:
            with self.subTest(url=url), self.assertRaises(ValueError):
                mod.host_and_path(url, allowed)

    def test_non_public_dns_rejected_without_connecting(self):
        fake_addr = [(2, 1, 6, "", ("127.0.0.1", 443)),
                     (2, 1, 6, "", ("8.8.8.8", 443))]
        with patch.object(mod.socket, "getaddrinfo", return_value=fake_addr), \
             patch.object(mod.socket, "create_connection") as connect:
            with self.assertRaisesRegex(ValueError, "non-public DNS"):
                mod.PinnedHTTPSConnection("alpha.example.org", context=mod.ssl.create_default_context()).connect()
            connect.assert_not_called()

    def test_http_redirect_or_oversize_refused_before_writing(self):
        for response in [mod.FetchResponse(302, {"content-type": "text/plain"}, b"move"),
                         mod.FetchResponse(200, {"content-type": "text/plain"}, b"x" * (mod.MAX_BYTES_PER_SOURCE + 1))]:
            with tempfile.TemporaryDirectory() as td:
                root = Path(td) / "bundle"
                with self.assertRaises(ValueError):
                    mod.collect(fixture(), root, fetcher=lambda h, p: response)
                self.assertFalse(root.exists())

    def test_non_utf8_and_html_content_type_restrictions(self):
        with tempfile.TemporaryDirectory() as td:
            with self.assertRaisesRegex(ValueError, "UTF-8"):
                mod.collect(fixture(), Path(td) / "out",
                            fetcher=lambda h, p: mod.FetchResponse(200, {"content-type": "text/plain"}, b"\xff"))
        with tempfile.TemporaryDirectory() as td:
            with self.assertRaisesRegex(ValueError, "unsupported content type"):
                mod.collect(fixture(), Path(td) / "out",
                            fetcher=lambda h, p: mod.FetchResponse(200, {"content-type": "image/png"}, b"ok"))

    def test_snapshot_tamper_detected(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td) / "bundle"
            mod.collect(fixture(), root, fetcher=fake_fetch)
            (root / "snapshots/alpha.txt").write_text("Changed by an adversary", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "snapshot digest mismatch"):
                mod.verify_bundle(root)

    def test_receipt_and_manifest_tamper_detected(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td) / "bundle"
            mod.collect(fixture(), root, fetcher=fake_fetch)
            manifest_path = root / "manifest.json"
            report = json.loads(manifest_path.read_text())
            report["sources"][0]["tls_hostname_verified"] = True
            manifest_path.write_text(json.dumps(report))
            with self.assertRaisesRegex(ValueError, "manifest hash mismatch"):
                mod.verify_bundle(root)

    def test_bad_input_does_not_open_network(self):
        f = fixture()
        f["sources"][0]["publisher_group"] = "wrong-group!"
        with tempfile.TemporaryDirectory() as td:
            with patch.object(mod, "pinned_https_get") as fetch:
                with self.assertRaisesRegex(ValueError, "publisher_group"):
                    mod.collect(f, Path(td) / "out")
                fetch.assert_not_called()

    def test_cli_requires_live_opt_in_and_offline_verifier(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            (root / "input.json").write_text(json.dumps(fixture()))
            command = [sys.executable, str(SCRIPT), "collect", str(root / "input.json"), "--out", str(root / "bundle")]
            proc = subprocess.run(command, text=True, capture_output=True)
            self.assertEqual(proc.returncode, 2)
            self.assertIn("requires --live", proc.stderr)
            self.assertFalse((root / "bundle").exists())
            mod.collect(fixture(), root / "bundle", fetcher=fake_fetch)
            verify = subprocess.run([sys.executable, str(SCRIPT), "verify", str(root / "bundle")],
                                    text=True, capture_output=True)
            self.assertEqual(verify.returncode, 0, verify.stderr)
            self.assertEqual(json.loads(verify.stdout)["sources"], 3)

    def test_stable_hash_across_mock_runs(self):
        with tempfile.TemporaryDirectory() as td:
            first = mod.collect(fixture(), Path(td) / "a", fetcher=fake_fetch, clock=fixed_clock)
            second = mod.collect(fixture(), Path(td) / "b", fetcher=fake_fetch, clock=fixed_clock)
        self.assertEqual(first["manifest_sha256"], second["manifest_sha256"])


if __name__ == "__main__":
    unittest.main()
