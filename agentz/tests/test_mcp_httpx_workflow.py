"""Fail-closed AgentZ workflow activation tests."""
import unittest
from unittest.mock import patch
from agentz.core.modes import ExecutionContext, Mode
from agentz.workflows.handlers import mcp_httpx_readonly


class HttpxWorkflowTests(unittest.TestCase):
    def test_default_automatic_mode_has_no_network(self):
        ctx = ExecutionContext(mode=Mode.AUTO, workflow_id="mcp_httpx_readonly")
        with patch.dict("os.environ", {"AGENTZ_HTTPX_MCP_LIVE": "false"}), patch.object(mcp_httpx_readonly, "probe") as p:
            r = mcp_httpx_readonly.run(ctx)
        self.assertEqual(r["state"], "dry_run")
        self.assertFalse(r["network_called"])
        p.assert_not_called()

    def test_dry_run_never_sends_even_when_gate_enabled(self):
        ctx = ExecutionContext(mode=Mode.DRY_RUN, workflow_id="mcp_httpx_readonly")
        with patch.dict("os.environ", {"AGENTZ_HTTPX_MCP_LIVE": "true"}), patch.object(mcp_httpx_readonly, "probe") as p:
            r = mcp_httpx_readonly.run(ctx)
        self.assertEqual(r["state"], "dry_run")
        p.assert_not_called()

    def test_explicit_auto_opt_in_invokes_only_probe(self):
        ctx = ExecutionContext(mode=Mode.AUTO, workflow_id="mcp_httpx_readonly")
        async def stub():
            return {"state":"transport_unavailable", "payment":False}
        with patch.dict("os.environ", {"AGENTZ_HTTPX_MCP_LIVE": "true"}), patch.object(mcp_httpx_readonly, "probe_modern", side_effect=stub) as p:
            r = mcp_httpx_readonly.run(ctx)
        self.assertEqual(r["state"], "transport_unavailable")
        p.assert_called_once_with()

    def test_unrecognized_era_fails_closed(self):
        ctx = ExecutionContext(mode=Mode.AUTO, workflow_id="mcp_httpx_readonly")
        with patch.dict("os.environ", {"AGENTZ_HTTPX_MCP_LIVE": "true", "AGENTZ_HTTPX_MCP_ERA": "nonsense"}), patch.object(mcp_httpx_readonly, "probe_modern") as p:
            r = mcp_httpx_readonly.run(ctx)
        self.assertEqual(r["state"], "invalid_era_configuration")
        p.assert_not_called()


if __name__ == "__main__":
    unittest.main()
