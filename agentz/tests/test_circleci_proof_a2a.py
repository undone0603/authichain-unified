"""Offline regression tests: no CircleCI credentials or network required."""
import unittest
from unittest.mock import patch
from agentz.integrations import circleci_proof_a2a as adapter

SHA = "4ec0aef58f69c5ab338836f374413327b9def6a1"

class CircleCIProofTests(unittest.TestCase):
    def test_exact_sha_required(self):
        with self.assertRaises(ValueError):
            adapter.inspect("main")

    def test_only_exact_revision_qualifies(self):
        with patch.object(adapter, "get_json", return_value={
            "items": [
                {"id": "match", "vcs": {"revision": SHA}, "state": "created"},
                {"id": "wrong", "vcs": {"revision": "0" * 40}},
            ]
        }):
            result = adapter.inspect(SHA)
        self.assertEqual(len(result["matching_pipelines"]), 1)
        self.assertEqual(result["matching_pipelines"][0]["id"], "match")
        self.assertIn("unverified", result["proof"])

    def test_dispatch_is_always_denied(self):
        self.assertEqual(adapter.main(["--sha", SHA, "--dispatch"]), 78)

    def test_missing_token_is_fail_closed(self):
        with patch.dict("os.environ", {"CIRCLECI_TOKEN": ""}):
            with self.assertRaises(RuntimeError):
                adapter.get_json("/project/gh/undone0603/authichain-unified/pipeline")

    def test_foreign_project_rejected(self):
        with patch.dict("os.environ", {"CIRCLECI_TOKEN": "dummy"}):
            with self.assertRaises(ValueError):
                adapter.get_json("/project/gh/other/repo/pipeline")

if __name__ == "__main__":
    unittest.main()
