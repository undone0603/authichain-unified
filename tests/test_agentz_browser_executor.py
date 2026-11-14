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

    def test_branch_and_ruleset_tasks_remain_read_only(self):
        urls = {
            "github-main-protection-inspect": "https://github.com/undone0603/authichain-unified/settings/branches",
            "github-repository-rulesets-inspect": "https://github.com/undone0603/authichain-unified/settings/rules",
            "circleci-dpp-2479-test-other-inspect": "https://app.circleci.com/workflow/31696fe1-369b-40f9-9fe4-0a60cc8da9b8/job/d4197b70-f190-4de2-9668-a22fbfc9ba73",
        }
        with tempfile.TemporaryDirectory() as tmp:
            binary = Path(tmp) / "agent-browser"
            binary.write_text("#!/bin/sh\\nexit 0\\n")
            binary.chmod(0o700)
            evidence = Path(tmp) / "evidence"
            evidence.mkdir()
            for task, url in urls.items():
                commands = []
                def fake_run(argv, **kwargs):
                    commands.append(argv)
                    class Result:
                        returncode = 0
                        stderr = ""
                        stdout = "synthetic browser snapshot"
                    return Result()
                with patch.dict(os.environ, {
                    "AGENTZ_BROWSER_BIN": str(binary),
                    "AGENTZ_BROWSER_EVIDENCE_DIR": str(evidence),
                }), patch("agentz.core.browser_executor.subprocess.run", side_effect=fake_run):
                    result = execute_browser_task(task)
                self.assertEqual([c[1] for c in commands], ["open", "snapshot", "close"])
                self.assertEqual(commands[0][2], url)
                self.assertFalse(result["verified"])
                self.assertEqual(Path(result["evidence_path"]).stat().st_mode & 0o777, 0o600)

    def test_rejects_unlisted_circleci_job(self):
        with self.assertRaises(ValueError):
            execute_browser_task("circleci-arbitrary-job-inspect")

    def test_rejects_url_substitution(self):
        with self.assertRaises(ValueError):
            execute_browser_task("https://app.circleci.com/workflow/other/job/other")

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
