"""MCP tool registration and readiness smoke tests (no live browser required)."""
import unittest
from unittest.mock import patch
from agentz.mcp_browser_server import readiness


class McpReadinessTests(unittest.TestCase):
    def test_default_not_ready(self):
        with patch.dict("os.environ", {
            "AGENTZ_BROWSER_BIN": "",
            "AGENTZ_BROWSER_EVIDENCE_DIR": "",
            "AGENTZ_BROWSER_NETWORK_ISOLATED": "false",
            "AGENTZ_GITHUB_CODE_TOKEN": "",
        }):
            status = readiness()
        self.assertFalse(status["ready_for_read_only_inspection"])
        self.assertFalse(status["ready_for_public_navigation"])
        self.assertFalse(status["production_dispatch_available"])
        self.assertFalse(status["remote_mcp_gateway_configured"])


if __name__ == "__main__":
    unittest.main()
