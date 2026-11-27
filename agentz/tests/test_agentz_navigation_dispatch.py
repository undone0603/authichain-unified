"""Focused checks for navigation and production dispatch boundaries."""
import os
import tempfile
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from agentz.core.public_navigation import validate_public_url, navigate_public
from agentz.core.protected_dispatch import dispatch_protected_release


class NavigationDispatchTests(unittest.TestCase):
    def test_public_urls(self):
        self.assertEqual(validate_public_url("https://example.org/path"), "https://example.org/path")
        for url in ("http://example.org", "https://localhost", "https://127.0.0.1",
                    "https://10.1.1.1", "https://169.254.169.254",
                    "https://user:pass@example.org", "file:///etc/passwd"):
            with self.subTest(url=url), self.assertRaises(ValueError):
                validate_public_url(url)

    def test_navigation_requires_isolated_host(self):
        with patch.dict(os.environ, {"AGENTZ_BROWSER_NETWORK_ISOLATED": "false"}):
            with self.assertRaises(RuntimeError):
                navigate_public("https://example.org")

    def test_navigation_passes_only_browser_environment_to_cli(self):
        with tempfile.TemporaryDirectory() as tmp:
            executable = Path(tmp) / "agent-browser"
            executable.write_text("#!/bin/sh\n", encoding="utf-8")
            calls = []

            def fake_run(argv, **kwargs):
                calls.append((argv, kwargs["env"]))
                return SimpleNamespace(returncode=0, stdout="snapshot", stderr="")

            env = {
                "PATH": os.environ.get("PATH", ""),
                "AGENTZ_BROWSER_BIN": str(executable),
                "AGENTZ_BROWSER_NETWORK_ISOLATED": "true",
                "AGENTZ_BROWSER_CDP_URL": "http://127.0.0.1:9222",
                "BROWSERBASE_API_KEY": "browser-provider-key",
                "BROWSERBASE_PROJECT_ID": "browser-project",
                "AGENT_SECRET": "must-not-cross-process-boundary",
                "STRIPE_SECRET_KEY": "must-not-cross-process-boundary",
                "SUPABASE_SERVICE_ROLE_KEY": "must-not-cross-process-boundary",
                "AGENTZ_GITHUB_CODE_TOKEN": "must-not-cross-process-boundary",
            }
            with patch.dict(os.environ, env, clear=True):
                with patch("agentz.core.public_navigation.subprocess.run", side_effect=fake_run):
                    result = navigate_public("https://example.org")

            self.assertEqual(result["snapshot"], "snapshot")
            self.assertEqual(len(calls), 3)  # open, snapshot, close
            for _argv, child_env in calls:
                self.assertTrue(child_env["AGENT_BROWSER_SESSION"].startswith("agentz-public-"))
                self.assertEqual(child_env["AGENTZ_BROWSER_CDP_URL"], "http://127.0.0.1:9222")
                self.assertEqual(child_env["BROWSERBASE_API_KEY"], "browser-provider-key")
                self.assertEqual(child_env["BROWSERBASE_PROJECT_ID"], "browser-project")
                for secret in (
                    "AGENT_SECRET", "STRIPE_SECRET_KEY",
                    "SUPABASE_SERVICE_ROLE_KEY", "AGENTZ_GITHUB_CODE_TOKEN",
                    "AGENTZ_BROWSER_NETWORK_ISOLATED",
                ):
                    self.assertNotIn(secret, child_env)

    def test_dispatch_needs_authorization_and_gate(self):
        sha = "a" * 40
        with self.assertRaises(PermissionError):
            dispatch_protected_release(sha)
        with self.assertRaises(PermissionError):
            dispatch_protected_release(sha, authorized=True)
        with patch.dict(os.environ, {"AGENTZ_RELEASE_DISPATCH_ENABLED": "false"}):
            with self.assertRaises(PermissionError):
                dispatch_protected_release(sha, authorized=True, release_gate_passed=True)

    def test_dispatch_rejects_invalid_sha(self):
        with self.assertRaises(ValueError):
            dispatch_protected_release("main", authorized=True, release_gate_passed=True)


if __name__ == "__main__":
    unittest.main()
