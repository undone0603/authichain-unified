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
