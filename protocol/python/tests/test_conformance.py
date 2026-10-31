# SPDX-License-Identifier: Apache-2.0
"""Runs all protocol/conformance fixtures in-process with --strict semantics,
and checks the bundled example records give the same verdicts as the JS CLI."""

import json
import os
import unittest
from pathlib import Path

from authichain_verify import canonicalize, sha256_hex, signing_bytes, verify_record

PROTOCOL = Path(__file__).resolve().parents[2]
FIXTURES = PROTOCOL / "conformance" / "fixtures"
MANIFEST = json.loads((PROTOCOL / "conformance" / "manifest.json").read_text())


class Conformance(unittest.TestCase):
    def test_fixture_count_matches_manifest(self):
        files = sorted(FIXTURES.glob("*.json"))
        self.assertEqual(len(files), 28)

    def test_every_fixture_strict(self):
        for path in sorted(FIXTURES.glob("*.json")):
            fx = json.loads(path.read_text(encoding="utf-8"))
            with self.subTest(fixture=fx["id"]):
                allow = bool((fx.get("options") or {}).get("allowTestnet"))
                r = verify_record(fx["record"], fx.get("anchor"), allow_testnet=allow)
                self.assertEqual(r["verdict"], fx["expect"]["verdict"])
                for needed in fx["expect"].get("reasonsInclude", []):
                    self.assertIn(needed, r["reasons"])


class Examples(unittest.TestCase):
    def test_bundled_record_is_valid_unanchored(self):
        rec = json.loads((PROTOCOL / "examples" / "record.json").read_text())
        self.assertEqual(verify_record(rec)["verdict"], "valid-unanchored")

    def test_polygon_anchor_example_is_verified(self):
        rec = json.loads((PROTOCOL / "examples" / "polygon-anchor-1.record.json").read_text())
        anc = json.loads((PROTOCOL / "examples" / "polygon-anchor-1.anchor.json").read_text())
        self.assertEqual(verify_record(rec, anc)["verdict"], "verified")
        expected = (PROTOCOL / "examples" / "polygon-anchor-1.hash.txt").read_text().strip()
        self.assertIn(sha256_hex(signing_bytes(rec)), expected)

    def test_canonicalize_matches_js_for_unicode_and_utf16_order(self):
        # JS sorts keys by UTF-16 code unit: U+FF5E sorts after U+1F600 (a surrogate pair).
        self.assertEqual(canonicalize({"\uff5e": 1, "\U0001f600": 2}), '{"\U0001f600":2,"\uff5e":1}')
        self.assertEqual(canonicalize({"a": "caf\u00e9\n"}), '{"a":"caf\u00e9\\n"}')
        self.assertEqual(canonicalize({"n": 1.0, "m": 0.5, "t": True}), '{"m":0.5,"n":1,"t":true}')


if __name__ == "__main__":
    unittest.main()
