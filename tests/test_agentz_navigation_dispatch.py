"""Focused checks for navigation and production dispatch boundaries."""
import os
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

    def test_navigation_subprocess_env_is_allowlisted(self):
        import tempfile
        from pathlib import Path
        from unittest.mock import MagicMock

        captured = {}

        def fake_run(argv, env=None, **kwargs):
            captured["env"] = env
            result = MagicMock()
            result.returncode = 0
            result.stdout = "snapshot"
            result.stderr = ""
            return result

        with tempfile.TemporaryDirectory() as tmp:
            binary = Path(tmp) / "agent-browser"
            binary.write_text("#!/bin/sh\nexit 0\n")
            binary.chmod(0o700)
            env = {
                "AGENTZ_BROWSER_NETWORK_ISOLATED": "true",
                "AGENTZ_BROWSER_BIN": str(binary),
                "AGENT_SECRET": "must-not-leak",
                "SUPABASE_SERVICE_ROLE_KEY": "must-not-leak",
                "PATH": os.environ.get("PATH", "/usr/bin"),
            }
            with patch.dict(os.environ, env, clear=False), patch(
                "agentz.core.public_navigation.subprocess.run", side_effect=fake_run
            ):
                navigate_public("https://example.org")
        self.assertIsNotNone(captured.get("env"))
        self.assertNotIn("AGENT_SECRET", captured["env"])
        self.assertNotIn("SUPABASE_SERVICE_ROLE_KEY", captured["env"])
        self.assertIn("PATH", captured["env"])
        self.assertIn("AGENT_BROWSER_SESSION", captured["env"])

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
