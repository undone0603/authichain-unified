"""Code proposal path and branch safety tests."""
import unittest
from agentz.core.code_proposals import propose_code_change


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


    def test_rejects_draft_pr_for_main_and_unscoped_branches(self):
        from agentz.core.code_proposals import create_code_branch, create_draft_code_pr
        for ref in ("main", "refs/heads/main", "refs/heads/feat/other"):
            with self.subTest(ref=ref):
                with self.assertRaises(ValueError):
                    create_code_branch(ref)
                with self.assertRaises(ValueError):
                    create_draft_code_pr(ref, "Do not create")

    def test_branch_create_uses_current_main_and_only_feature_ref(self):
        from io import BytesIO
        from unittest.mock import patch
        from agentz.core.code_proposals import create_code_branch
        seen = []
        sha = "a" * 40
        def fake_open(request, timeout=0):
            seen.append(request)
            data = {"object": {"sha": sha}} if request.get_method() == "GET" else {
                "ref": "refs/heads/feat/agentz-self-build"}
            return BytesIO(__import__("json").dumps(data).encode())
        with patch.dict(__import__("os").environ, {"AGENTZ_GITHUB_CODE_TOKEN": "dummy"}):
            with patch("agentz.core.code_proposals.urlopen", side_effect=fake_open):
                result = create_code_branch("refs/heads/feat/agentz-self-build")
        self.assertEqual(result["base_main_sha"], sha)
        self.assertEqual([x.get_method() for x in seen], ["GET", "POST"])
        self.assertIn("/git/ref/heads/main", seen[0].full_url)
        data = __import__("json").loads(seen[1].data)
        self.assertEqual(data["ref"], "refs/heads/feat/agentz-self-build")
        self.assertEqual(data["sha"], sha)

    def test_pr_is_always_draft_against_main(self):
        from io import BytesIO
        from unittest.mock import patch
        from agentz.core.code_proposals import create_draft_code_pr
        seen = []
        def fake_open(request, timeout=0):
            seen.append(request)
            response = {"draft": True, "number": 1234,
                        "html_url": "https://github.com/undone0603/authichain-unified/pull/1234",
                        "head": {"ref": "feat/agentz-docs"}}
            return BytesIO(__import__("json").dumps(response).encode())
        with patch.dict(__import__("os").environ, {"AGENTZ_GITHUB_CODE_TOKEN": "dummy"}):
            with patch("agentz.core.code_proposals.urlopen", side_effect=fake_open):
                result = create_draft_code_pr("refs/heads/feat/agentz-docs", "docs: agent kit")
        payload = __import__("json").loads(seen[0].data)
        self.assertTrue(payload["draft"])
        self.assertEqual(payload["base"], "main")
        self.assertEqual(payload["head"], "feat/agentz-docs")
        self.assertEqual(result["status"], "draft_pr_created_not_merged")

    def test_missing_scoped_code_token_fails_closed(self):
        from unittest.mock import patch
        from agentz.core.code_proposals import create_draft_code_pr
        with patch.dict(__import__("os").environ, {"AGENTZ_GITHUB_CODE_TOKEN": ""}):
            with self.assertRaises(RuntimeError):
                create_draft_code_pr("refs/heads/feat/agentz-no-token", "docs: blocked")

    def test_hydrogen_playbook_contains_unattended_safe_execution_contract(self):
        from agentz.core.code_proposals import hydrogen_playbook
        playbook = hydrogen_playbook()
        for phrase in ("Observe", "Branch", "Draft PR", "exact-head CI",
                       "No direct production deployment", "No automatic spending"):
            self.assertIn(phrase, playbook)


if __name__ == "__main__":
    unittest.main()
