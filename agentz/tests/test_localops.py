"""Tests for zero-cost LocalOps read-only adapters and release boundary."""
from __future__ import annotations

import io
import json
import unittest
from contextlib import redirect_stdout, redirect_stderr
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from agentz import localops

SHA = "a" * 40
REPO = "undone0603/authichain-unified"


def green_reader(*, branches: bool = True, bypass: bool | None = False,
                 secrets: tuple[str, ...] | None = None):
    visited = []
    names = secrets if secrets is not None else tuple(localops.SECRET_NAMES)
    values = {
        f"repos/{REPO}/branches/main": {"commit": {"sha": SHA if branches else "b" * 40}},
        f"repos/{REPO}/commits/{SHA}/status": {"statuses": [
            {"context": context, "state": "success"} for context in sorted(localops.CI_CONTEXTS)
        ]},
        f"repos/{REPO}/environments/production-cloudflare": {
            "name": "production-cloudflare",
            "deployment_branch_policy": {"protected_branches": True, "custom_branch_policies": False},
            "protection_rules": [{"type": "required_reviewers", "prevent_self_review": True,
                                  "reviewers": [{"type": "User", "reviewer": {"login": "external-peer"}}]}],
            **({"can_admins_bypass": bypass} if bypass is not None else {}),
        },
        f"repos/{REPO}/environments/production-cloudflare/secrets": {
            "total_count": len(names), "secrets": [{"name": n} for n in names],
        },
    }
    def reader(path):
        visited.append(path)
        if path not in values:
            raise localops.LocalOpsError("not found")
        return values[path]
    return reader, values, visited


class LocalOpsTests(unittest.TestCase):
    def test_repo_and_sha_are_injection_safe(self):
        for repo in ("owner/repo;curl bad", "-X/DELETE", "owner/repo/extra", "", "owner/../x"):
            with self.subTest(repo=repo), self.assertRaises(localops.LocalOpsError):
                localops.validate_repo(repo)
        for sha in ("abc", "0" * 39 + "G", "0" * 40 + ";cmd"):
            with self.subTest(sha=sha), self.assertRaises(localops.LocalOpsError):
                localops.validate_sha(sha)

    def test_browser_origins_reject_private_and_external_hosts(self):
        for url in ("http://authichain.com", "javascript:alert(1)",
                    "https://authichain.com.evil.test", "https://localhost/x",
                    "https://127.0.0.1/x", "https://github.com:8443/x",
                    "https://user:token@github.com/x", "https://github.com/x#fragment",
                    "https://github.com/\r\nX-Forged: yes"):
            with self.subTest(url=url), self.assertRaises(localops.LocalOpsError):
                localops.safe_browser_url(url)
        self.assertEqual(localops.safe_browser_url("https://github.com/undone0603"),
                         "https://github.com/undone0603")

    def test_plan_selects_deterministic_zero_fee_readonly_adapters(self):
        r = localops.plan("github-release", repo=REPO, sha=SHA)
        self.assertEqual((r["provider"], r["execution"], r["provider_charges_authorized_usd"]),
                         ("github_cli", "read_only", 0))
        self.assertIn("environment writes", r["prohibited"])
        b = localops.plan("browser-inspect", url="https://authichain.com/verify")
        self.assertEqual(b["provider"], "playwright_edge")
        self.assertNotIn("https://authichain.com/verify", str(b))  # no URL secrets in plan
        self.assertIn("automa (human handoff)", b["alternatives"])

    def test_handoffs_never_claim_automation(self):
        for provider in ("automa", "power_automate_desktop", "browser_use_ollama"):
            x = localops.handoff(provider, "https://github.com")
            self.assertFalse(x["automation_executed"])
            self.assertTrue(x["require_user_approval_for_actions"])
        with self.assertRaises(localops.LocalOpsError):
            localops.handoff("tinyfish-paid", "https://github.com")

    def test_exact_head_mismatch_denies_and_stops_calls(self):
        reader, _, visited = green_reader(branches=False)
        r = localops.github_release_audit(REPO, SHA, reader)
        self.assertEqual(r["status"], "blocked")
        self.assertIn("expected_sha_not_current_main", r["issues"])
        self.assertEqual(len(visited), 1)

    def test_complete_snapshot_never_claims_deployment_approval(self):
        reader, _, visited = green_reader()
        r = localops.github_release_audit(REPO, SHA, reader)
        self.assertEqual(len(visited), 4)
        self.assertEqual(r["observed"]["seven_exact_head_checks_green"], True)
        self.assertTrue(r["observed"]["exactly_two_scoped_secrets"])
        self.assertEqual(r["status"], "blocked")
        self.assertIn("independent_reviewer_attestation_required", r["issues"])
        self.assertEqual(r["writes_executed"], 0)
        self.assertEqual(r["deployments_triggered"], 0)

    def test_admin_bypass_unverified_fails_closed(self):
        reader, _, _ = green_reader(bypass=None)
        r = localops.github_release_audit(REPO, SHA, reader)
        self.assertIn("administrator_bypass_not_independently_verified", r["issues"])

    def test_wrong_secret_inventory_fails_closed(self):
        reader, _, _ = green_reader(secrets=("OLD_PRODUCTION_TOKEN",))
        r = localops.github_release_audit(REPO, SHA, reader)
        self.assertIn("environment_secret_names_not_exactly_two", r["issues"])

    def test_environment_missing_fails_closed_without_secret_reads(self):
        reader, values, visited = green_reader()
        del values[f"repos/{REPO}/environments/production-cloudflare"]
        r = localops.github_release_audit(REPO, SHA, reader)
        self.assertIn("target_environment_missing_or_unreadable", r["issues"])
        self.assertEqual(len(visited), 3)

    def test_status_failure_denies(self):
        reader, values, _ = green_reader()
        values[f"repos/{REPO}/commits/{SHA}/status"]["statuses"][0]["state"] = "failure"
        r = localops.github_release_audit(REPO, SHA, reader)
        self.assertIn("required_exact_head_ci_missing_or_failing", r["issues"])

    def test_audit_omits_sensitive_payload_fields(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "audit.jsonl"
            localops._append_audit(path, {"task": "test", "token": "secret-abc", "html": "private", "body": "card"})
            doc = path.read_text()
            self.assertNotIn("secret-abc", doc)
            self.assertNotIn("private", doc)
            self.assertNotIn("card", doc)
            self.assertIn('"task":"test"', doc)

    def test_cli_plan_and_handoff_no_external_call(self):
        buf = io.StringIO()
        with redirect_stdout(buf), patch.object(localops, "_gh_get", side_effect=AssertionError("called")):
            code = localops.main(["plan", "--task", "github-release", "--sha", SHA])
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(buf.getvalue())["expected_sha"], SHA)

    def test_gh_uses_get_only_and_suppresses_stderr(self):
        from subprocess import CompletedProcess
        with patch.object(localops.shutil, "which", return_value="gh"), \
             patch.object(localops.subprocess, "run", return_value=CompletedProcess([], 0, '{"ok":true}', "secret")) as run:
            r = localops._gh_get("repos/owner/repo/branches/main")
            self.assertTrue(r["ok"])
            argv = run.call_args.args[0]
            self.assertEqual(argv[0:4], ["gh", "api", "--method", "GET"])
            self.assertFalse(run.call_args.kwargs.get("shell", False))
            self.assertTrue(run.call_args.kwargs["capture_output"])
        with patch.object(localops.shutil, "which", return_value="gh"), \
             patch.object(localops.subprocess, "run", return_value=CompletedProcess([], 1, "", "token-secret")):
            with self.assertRaises(localops.LocalOpsError) as error:
                localops._gh_get("repos/owner/repo/branches/main")
            self.assertNotIn("token-secret", str(error.exception))


if __name__ == "__main__":
    unittest.main()
