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


if __name__ == "__main__":
    unittest.main()
