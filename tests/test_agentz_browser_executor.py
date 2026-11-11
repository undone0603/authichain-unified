"""Unit tests for allowlisted local browser execution without network access."""
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from agentz.core.browser_executor import execute_browser_task


class BrowserExecutorTests(unittest.TestCase):
    def test_unlisted_task_rejected(self):
        with self.assertRaises(ValueError):
            execute_browser_task("run-arbitrary-shell")

    def test_requires_existing_local_binary(self):
        with patch.dict(os.environ, {"AGENTZ_BROWSER_BIN": "/nonexistent/agent-browser"}):
            with self.assertRaises(RuntimeError):
                execute_browser_task("github-workflow-inspect")

    def test_invalid_timeout_rejected(self):
        with self.assertRaises(ValueError):
            execute_browser_task("github-workflow-inspect", timeout=999)

    def test_fixed_commands_and_owner_only_evidence(self):
        with tempfile.TemporaryDirectory() as tmp:
            binary = Path(tmp) / "agent-browser"
            binary.write_text("#!/bin/sh\nexit 0\n")
            binary.chmod(0o700)
            evidence = Path(tmp) / "evidence"
            evidence.mkdir()
            calls = []
            def fake_run(argv, **kwargs):
                calls.append(argv)
                class Result:
                    returncode = 0
                    stderr = ""
                    stdout = "mock snapshot"
                return Result()
            with patch.dict(os.environ, {
                "AGENTZ_BROWSER_BIN": str(binary),
                "AGENTZ_BROWSER_EVIDENCE_DIR": str(evidence),
            }), patch("agentz.core.browser_executor.subprocess.run", side_effect=fake_run):
                result = execute_browser_task("github-workflow-inspect")
            self.assertEqual(result["status"], "observed")
            self.assertFalse(result["verified"])
            self.assertEqual([cmd[1] for cmd in calls], ["open", "snapshot", "close"])
            self.assertEqual(calls[0][2], "https://github.com/undone0603/authichain-unified/actions/workflows/deploy-authichain-com.yml")
            self.assertEqual(Path(result["evidence_path"]).stat().st_mode & 0o777, 0o600)


if __name__ == "__main__":
    unittest.main()
