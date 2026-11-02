"""No-network regression suite for AgentZ public A2A card preflight."""
from __future__ import annotations

import json
import unittest
import urllib.error
from unittest.mock import patch

from agentz.integrations.a2a_card_preflight import (
    CARD_URL, MAX_BYTES, fetch_card, probe_live, validate_declaration,
)


CARD = {
    "name": "AuthiChain", "description": "Published test agent", "version": "1.3.2",
    "capabilities": {"streaming": False},
    "defaultInputModes": ["application/json"], "defaultOutputModes": ["application/json"],
    "supportedInterfaces": [{"url": "https://authichain.com/api/a2a", "protocolBinding": "JSONRPC", "protocolVersion": "1.0"}],
    "skills": [{"id": "paid-evidence-check", "name": "Paid evidence check"}],
}


class CardTests(unittest.TestCase):
    def test_valid_card_declared_shape_only(self):
        r = validate_declaration(CARD)
        self.assertTrue(r["structure_valid"])
        self.assertEqual(r["advertised_card_version"], "1.3.2")

    def test_non_object_refused(self):
        self.assertFalse(validate_declaration([])["structure_valid"])

    def test_missing_interface_refused(self):
        self.assertIn("missing_supported_interfaces", validate_declaration({**CARD, "supportedInterfaces": []})["checks"])

    def test_cross_domain_interface_refused(self):
        bad = {**CARD, "supportedInterfaces": [{"url": "https://evil.invalid/api/a2a", "protocolBinding": "JSONRPC", "protocolVersion": "1.0"}]}
        self.assertIn("interface_0_unexpected_origin", validate_declaration(bad)["checks"])

    def test_unauthorized_port_refused(self):
        bad = {**CARD, "supportedInterfaces": [{"url": "https://authichain.com:444/api/a2a", "protocolBinding": "JSONRPC", "protocolVersion": "1.0"}]}
        self.assertFalse(validate_declaration(bad)["structure_valid"])

    def test_duplicate_skill_ids_refused(self):
        self.assertIn("duplicate_skill_id", validate_declaration({**CARD, "skills": CARD["skills"] * 2})["checks"])

    def test_missing_modes_refused(self):
        self.assertIn("invalid_defaultInputModes", validate_declaration({**CARD, "defaultInputModes": []})["checks"])

    def test_invalid_protocol_version_refused(self):
        bad = {**CARD, "supportedInterfaces": [{"url": "https://authichain.com/api/a2a", "protocolBinding": "JSONRPC", "protocolVersion": "bogus"}]}
        self.assertIn("invalid_jsonrpc_protocol_version", validate_declaration(bad)["checks"])

    def test_success_does_not_claim_identity_tck_or_payment(self):
        r = probe_live(lambda: json.dumps(CARD).encode())
        self.assertEqual(r["state"], "card_declared_shape_observed")
        for key in ("identity_verified", "official_a2a_tck_executed", "independent_peer_review", "payment_settlement_verified", "wallet_used", "task_invoked"):
            self.assertFalse(r[key], key)
        self.assertEqual(len(r["content_sha256"]), 64)

    def test_bad_json_is_unknown(self):
        r = probe_live(lambda: b"{broken")
        self.assertEqual(r["state"], "coverage_unknown")
        self.assertEqual(r["reason"], "invalid_json")

    def test_network_error_is_unknown(self):
        def outage():
            raise urllib.error.URLError("hidden network detail")
        r = probe_live(outage)
        self.assertEqual(r["state"], "coverage_unknown")
        self.assertEqual(r["reason"], "transport_unavailable")

    def test_redirect_is_denied(self):
        def redirect():
            raise urllib.error.HTTPError(CARD_URL, 302, "redirect", {}, None)
        r = probe_live(redirect)
        self.assertEqual(r["reason"], "redirect_blocked")

    def test_oversize_body_refused(self):
        r = probe_live(lambda: b"x" * (MAX_BYTES + 1))
        self.assertEqual(r["reason"], "oversize_or_invalid_body")

    def test_dry_run_cli_no_network(self):
        from agentz.integrations.a2a_card_preflight import main
        with patch("sys.argv", ["agentz.a2a_card_preflight"]), patch("agentz.integrations.a2a_card_preflight.probe_live") as f, patch("builtins.print") as out:
            main()
        f.assert_not_called()
        self.assertIn('"dry_run"', out.call_args.args[0])


if __name__ == "__main__":
    unittest.main()
