"""Code proposal path and branch safety tests."""
import os
import unittest
from unittest import mock
from urllib.error import HTTPError

from agentz.core import code_proposals
from agentz.core.code_proposals import check_path, open_draft_pr, propose_code_change

NO_TOKEN = {k: v for k, v in os.environ.items() if k != "AGENTZ_GITHUB_CODE_TOKEN"}


class CodeProposalTests(unittest.TestCase):
    def test_refuses_main_and_unscoped_branches(self):
        for ref in ("main", "refs/heads/main", "refs/heads/feat/other",
                    "refs/heads/feat/agentz-../../main"):
            with self.subTest(ref=ref), self.assertRaises(ValueError):
                propose_code_change(ref, "agentz/example.py", "print(1)")

    def test_refuses_path_traversal_and_sensitive_files(self):
        for path in ("../../.env", ".github/workflows/release.yml",
                     "agentz/../../.env", "worker-app/secret.py"):
            with self.subTest(path=path), self.assertRaises(ValueError):
                propose_code_change("refs/heads/feat/agentz-demo", path, "test")

    def test_rejects_large_content(self):
        with self.assertRaises(ValueError):
            propose_code_change("refs/heads/feat/agentz-demo",
                                "agentz/example.py", "x" * 100001)

    def test_allows_any_ordinary_repo_path(self):
        for path in ("src/lib/plans.ts", "workers/authichain-com/src/x.ts",
                     "scripts/battery-gap-report/generate.ts", "package.json",
                     "protocol/verifier.mjs", "agentz/core/governor.py", "README.md"):
            with self.subTest(path=path):
                self.assertEqual(check_path(path), path)

    def test_refuses_ci_ownership_policy_and_key_files(self):
        for path in (".github/workflows/lint.yml", ".github/actions/setup/action.yml",
                     ".circleci/config.yml", "CODEOWNERS", ".github/CODEOWNERS",
                     "agentz/core/code_proposals.py", "agentz/core/capability_policy.py",
                     ".env.local", "apps/x/.env", "workers/a/.dev.vars",
                     "keys/agentz.ed25519.pem", "certs/server.key", "docs/CREDENTIALS.md",
                     "agentz/private_key.py", "/etc/passwd", ".git/config"):
            with self.subTest(path=path), self.assertRaises(ValueError):
                check_path(path)

    def test_valid_proposal_without_token_fails_closed_before_any_request(self):
        with mock.patch.dict(os.environ, NO_TOKEN, clear=True), \
                mock.patch.object(code_proposals, "urlopen") as net:
            with self.assertRaises(RuntimeError):
                propose_code_change("refs/heads/feat/agentz-demo", "src/lib/x.ts", "x")
            net.assert_not_called()

    def test_github_requests_use_identified_agent_and_bearer_auth(self):
        with mock.patch.dict(os.environ, {"AGENTZ_GITHUB_CODE_TOKEN": "test-token"}), \
                mock.patch.object(code_proposals, "urlopen") as net:
            net.return_value.__enter__.return_value.read.return_value = b"{}"
            self.assertEqual(code_proposals._github("GET", "git/ref/heads/main"), {})
        request = net.call_args.args[0]
        self.assertEqual(request.get_header("User-agent"),
                         "AuthiChain-AgentZ-CodeProposals/1.0")
        self.assertEqual(request.get_header("Authorization"), "Bearer test-token")

    def test_creates_missing_branch_from_main_then_commits(self):
        calls = []

        def fake(method, api_path, payload=None):
            calls.append((method, api_path, payload))
            if method == "GET" and api_path == "git/ref/heads/feat/agentz-demo":
                raise HTTPError(api_path, 404, "Not Found", {}, None)
            if api_path == "git/ref/heads/main":
                return {"object": {"sha": "a" * 40}}
            if method == "PUT":
                return {"commit": {"sha": "b" * 40}}
            return {}

        with mock.patch.dict(os.environ, {"AGENTZ_GITHUB_CODE_TOKEN": "t"}), \
                mock.patch.object(code_proposals, "_github", side_effect=fake):
            out = propose_code_change("refs/heads/feat/agentz-demo", "src/lib/x.ts", "x")
        self.assertTrue(out["branch_created"])
        self.assertEqual(out["commit_sha"], "b" * 40)
        self.assertIn(("POST", "git/refs", {"ref": "refs/heads/feat/agentz-demo",
                                            "sha": "a" * 40}), calls)
        self.assertEqual(calls[-1][0], "PUT")
        self.assertEqual(calls[-1][2]["branch"], "feat/agentz-demo")


class DraftPrTests(unittest.TestCase):
    def test_refuses_unscoped_branch_and_bad_title(self):
        for ref, title in (("refs/heads/main", "t"), ("refs/heads/feat/x", "t"),
                           ("refs/heads/feat/agentz-demo", ""),
                           ("refs/heads/feat/agentz-demo", "x" * 201)):
            with self.subTest(ref=ref, title=title[:10]), self.assertRaises(ValueError):
                open_draft_pr(ref, title)

    def test_opens_a_draft_into_main_only(self):
        sent = {}

        def fake(method, api_path, payload=None):
            if method == "GET":
                return []
            sent.update(payload)
            return {"number": 9, "html_url": "https://github.com/x/pull/9"}

        with mock.patch.object(code_proposals, "_github", side_effect=fake):
            out = open_draft_pr("refs/heads/feat/agentz-demo", "Add x", "why")
        self.assertEqual(out["status"], "draft_opened")
        self.assertTrue(sent["draft"])
        self.assertEqual(sent["base"], "main")
        self.assertEqual(sent["head"], "feat/agentz-demo")
        self.assertIn("Opened by AgentZ as a draft", sent["body"])

    def test_returns_existing_open_pr_instead_of_a_duplicate(self):
        with mock.patch.object(code_proposals, "_github",
                               return_value=[{"number": 7, "html_url": "u", "draft": True}]) as gh:
            out = open_draft_pr("refs/heads/feat/agentz-demo", "Add x")
        self.assertEqual(out, {"status": "already_open", "number": 7, "url": "u", "draft": True})
        self.assertEqual(gh.call_count, 1)


if __name__ == "__main__":
    unittest.main()
