import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from agentz.core.modes import Mode
from agentz.workflows.handlers.mcp_a2a_connection_audit import run


class McpA2aConnectionAuditTest(unittest.TestCase):
    def test_dry_run_never_calls_external_tools(self):
        with patch("agentz.workflows.handlers.mcp_a2a_connection_audit.subprocess.run") as cmd:
            msg = run(SimpleNamespace(mode=Mode.DRY_RUN))
        self.assertIn("no third-party connection", msg)
        cmd.assert_not_called()

    def test_approved_local_probe_report_cannot_claim_peer_connection(self):
        report = {
            "connection": "AUTHICHAIN_ENDPOINTS_ONLY_NOT_EXTERNAL_PEER_CONNECTED",
            "mcp": {"technical_status": "compatible"},
            "a2a": {"technical_status": "compatible"},
            "permissions": {"payment": False},
        }
        mock_completed = SimpleNamespace(returncode=0, stdout=json.dumps(report))
        with patch("pathlib.Path.is_file", return_value=True), patch(
            "agentz.workflows.handlers.mcp_a2a_connection_audit.subprocess.run",
            return_value=mock_completed,
        ) as cmd:
            result = run(SimpleNamespace(mode=Mode.CONFIRM))
        self.assertIn("external_peers_connected=0", result)
        self.assertIn("paid_calls=0", result)
        self.assertEqual(cmd.call_args.kwargs["timeout"], 40)

    def test_failed_or_unexpected_connection_report_refused(self):
        report = {
            "connection": "PEER_CONNECTED",
            "mcp": {"technical_status": "compatible"},
            "a2a": {"technical_status": "compatible"},
            "permissions": {"payment": False},
        }
        mock_completed = SimpleNamespace(returncode=0, stdout=json.dumps(report))
        with patch("pathlib.Path.is_file", return_value=True), patch(
            "agentz.workflows.handlers.mcp_a2a_connection_audit.subprocess.run",
            return_value=mock_completed,
        ):
            with self.assertRaisesRegex(RuntimeError, "boundary"):
                run(SimpleNamespace(mode=Mode.CONFIRM))


if __name__ == "__main__":
    unittest.main()
