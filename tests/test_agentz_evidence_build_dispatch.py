"""Hermetic safety tests: never contact GitHub, never dispatch an actual job."""
import base64
from contextlib import nullcontext
import copy
import hashlib
import os
import re
from unittest import TestCase
from unittest.mock import patch

from agentz.core.evidence_build_dispatch import (
    GateBlocked, REPO, WORKFLOW, MAIN_RULESET_ID,
    REQUIRED_CIRCLECI, REQUIRED_GITHUB_PUSH_JOBS,
    dispatch_arm64_evidence, verify_evidence_build_gates,
)

SHA = "a" * 40
WORKFLOW_BYTES = b"""name: AgentZ protected host artifact
on:
  workflow_dispatch:
    inputs:
      expected_sha:
        required: true
concurrency:
  group: evidence
jobs:
  build:
    if: github.ref_protected && github.sha == inputs.expected_sha
    runs-on: ubuntu-24.04-arm
    steps:
      - name: Refuse duplicate ARM64 build
      - run: docker build -t image .
      - run: gh release create evidence --draft
"""
BLOB_SHA = hashlib.sha1(b"blob " + str(len(WORKFLOW_BYTES)).encode() + b"\0" + WORKFLOW_BYTES).hexdigest()


class FakeGitHub:
    def __init__(self):
        self.get_calls = []
        self.dispatch_calls = []
        self.response_status = 200
        self.responses = {
            "": {"full_name": REPO, "private": False, "archived": False, "default_branch": "main"},
            "/branches/main": {"name": "main", "protected": True, "commit": {"sha": SHA}},
            f"/rulesets/{MAIN_RULESET_ID}": {"id": MAIN_RULESET_ID, "name": "main-no-direct-push", "enforcement": "active",
                "conditions": {"ref_name": {"include": ["refs/heads/main"]}},
                "rules": [{"type": "pull_request"}], "bypass_actors": []},
            f"/contents/.github/workflows/{WORKFLOW}?ref={SHA}": {
                "sha": BLOB_SHA, "encoding": "base64", "content": base64.b64encode(WORKFLOW_BYTES).decode()},
            f"/commits/{SHA}/status?per_page=100": {
                "statuses": [{"context": c, "state": "success",
                              "target_url": "https://app.circleci.com/workflow/ab01/job/0a02"}
                             for c in REQUIRED_CIRCLECI],
                "total_count": len(REQUIRED_CIRCLECI),
            },
            f"/actions/workflows/{WORKFLOW}/runs?branch=main&head_sha={SHA}&event=workflow_dispatch&per_page=100": {
                "total_count": 0, "workflow_runs": []},
        }
        for i, (workflow, required_jobs) in enumerate(REQUIRED_GITHUB_PUSH_JOBS.items(), 1):
            self.responses[f"/actions/workflows/{workflow}/runs?branch=main&head_sha={SHA}&event=push&per_page=100"] = {
                "workflow_runs": [{"id": 900+i, "event": "push", "head_sha": SHA,
                                   "status": "completed", "conclusion": "success"}]}
            self.responses[f"/actions/runs/{900+i}/jobs?per_page=100"] = {
                "total_count": len(required_jobs),
                "jobs": [{"name": job, "status": "completed", "conclusion": "success", "head_sha": SHA}
                         for job in required_jobs]}

    def get(self, url):
        self.get_calls.append(url)
        return copy.deepcopy(self.responses[url])

    def dispatch(self, path, data):
        self.dispatch_calls.append((path, data))
        return (self.response_status,
                {"workflow_run_id": 12345} if self.response_status == 200 else None)


class EvidenceBuildDispatchTests(TestCase):
    def setUp(self):
        self.gh = FakeGitHub()
        self.env = {
            "AGENTZ_EVIDENCE_DISPATCH_ENABLED": "true",
            "AGENTZ_EVIDENCE_OPERATOR_TOKEN": "operator-fixture-only",
            "AGENTZ_EVIDENCE_APPROVED_MAIN_SHA": SHA,
            "AGENTZ_EVIDENCE_APPROVED_WORKFLOW_BLOB_SHA": BLOB_SHA,
            "AGENTZ_GITHUB_EVIDENCE_TOKEN": "GITHUB_TEST_FAKE_DO_NOT_USE",
            "AGENTZ_RELEASE_DISPATCH_ENABLED": "false", # production dispatch unaffected
        }
        self.patch_env = patch.dict(os.environ, self.env, clear=True)
        self.patch_env.start()
        self.addCleanup(self.patch_env.stop)

    def dispatch(self):
        return dispatch_arm64_evidence(SHA, operator_token="operator-fixture-only",
                                     github=self.gh, lock=nullcontext)

    def blocked(self, needle):
        with self.assertRaises(GateBlocked) as exc:
            self.dispatch()
        self.assertIn(needle, str(exc.exception))
        self.assertEqual([], self.gh.dispatch_calls)

    def test_valid_dispatch_returns_run_id_and_never_releases(self):
        result = self.dispatch()
        self.assertEqual(result["status"], "DISPATCHED_NOT_BUILT")
        self.assertEqual(result["run_id"], 12345)
        self.assertEqual(result["runtime_image_match"], "NOT_PROVEN")
        self.assertEqual(result["attestation"], "NOT_ISSUED")
        self.assertEqual(len(self.gh.dispatch_calls), 1)
        self.assertEqual(self.gh.dispatch_calls[0][0],
                         f"/actions/workflows/{WORKFLOW}/dispatches")
        self.assertEqual(self.gh.dispatch_calls[0][1], {"ref": "main", "inputs": {"expected_sha": SHA}, "return_run_details": True})
        self.assertFalse(any("deploy-authichain-com" in x for x in self.gh.get_calls))

    def test_production_dispatch_does_not_become_enabled(self):
        self.dispatch()
        self.assertEqual(os.environ["AGENTZ_RELEASE_DISPATCH_ENABLED"], "false")

    def test_feature_flag_fail_closed(self):
        os.environ["AGENTZ_EVIDENCE_DISPATCH_ENABLED"] = "false"
        self.blocked("disabled")
        self.assertEqual([], self.gh.get_calls)

    def test_missing_or_bad_operator_token_denied_before_network(self):
        for token in ("", "wrong", None):
            with self.subTest(token=token), self.assertRaises(GateBlocked):
                dispatch_arm64_evidence(SHA, operator_token=token, github=self.gh, lock=nullcontext)
        self.assertEqual([], self.gh.get_calls)

    def test_missing_github_credential_denied(self):
        os.environ.pop("AGENTZ_GITHUB_EVIDENCE_TOKEN")
        self.blocked("dedicated")

    def test_wrong_authorized_sha_fails(self):
        os.environ["AGENTZ_EVIDENCE_APPROVED_MAIN_SHA"] = "f"*40
        self.blocked("owner-pinned")

    def test_sha_not_full_sha_fails(self):
        with self.assertRaises(GateBlocked):
            dispatch_arm64_evidence("main", operator_token="operator-fixture-only",
                                    github=self.gh, lock=nullcontext)
        self.assertEqual([], self.gh.get_calls)

    def test_private_repo_or_paid_runners_denied(self):
        self.gh.responses[""]["private"] = True
        self.blocked("public-repository")

    def test_unprotected_main_denied(self):
        self.gh.responses["/branches/main"]["protected"] = False
        self.blocked("protected main")

    def test_stale_main_sha_denied(self):
        self.gh.responses["/branches/main"]["commit"]["sha"] = "c"*40
        self.blocked("protected main")

    def test_disabled_ruleset_denied(self):
        self.gh.responses[f"/rulesets/{MAIN_RULESET_ID}"]["enforcement"] = "disabled"
        self.blocked("ruleset")

    def test_missing_pull_request_protection_denied(self):
        self.gh.responses[f"/rulesets/{MAIN_RULESET_ID}"]["rules"] = []
        self.blocked("PR protection")

    def test_bypass_actors_denied(self):
        self.gh.responses[f"/rulesets/{MAIN_RULESET_ID}"]["bypass_actors"] = [{"actor_id": 1}]
        self.blocked("bypass")

    def test_workflow_blob_not_approved_denied(self):
        self.gh.responses[f"/contents/.github/workflows/{WORKFLOW}?ref={SHA}"]["sha"] = "d"*40
        self.blocked("workflow bytes")

    def test_workflow_bytes_missing_free_runner_denied(self):
        data = self.gh.responses[f"/contents/.github/workflows/{WORKFLOW}?ref={SHA}"]
        data["content"] = base64.b64encode(WORKFLOW_BYTES.replace(b"ubuntu-24.04-arm", b"ubuntu-24.04-arm-large")).decode()
        self.blocked("Git blob content mismatch")

    def test_workflow_blob_pin_not_configured(self):
        os.environ.pop("AGENTZ_EVIDENCE_APPROVED_WORKFLOW_BLOB_SHA")
        self.blocked("blob SHA not provisioned")

    def test_pending_circle_ci_denied(self):
        self.gh.responses[f"/commits/{SHA}/status?per_page=100"]["statuses"][1]["state"] = "pending"
        self.blocked("CircleCI")

    def test_missing_main_quality_gate_denied(self):
        ci = self.gh.responses[f"/commits/{SHA}/status?per_page=100"]
        ci["statuses"].pop()
        ci["total_count"] -= 1
        self.blocked("CI status list")

    def test_truncated_statuses_denied(self):
        self.gh.responses[f"/commits/{SHA}/status?per_page=100"]["total_count"] = 100
        self.blocked("partial")

    def test_untrusted_ci_target_denied(self):
        self.gh.responses[f"/commits/{SHA}/status?per_page=100"]["statuses"][0]["target_url"] = "https://evil.example/green"
        self.blocked("CircleCI")

    def test_pending_github_lint_denied(self):
        self.gh.responses[f"/actions/workflows/lint.yml/runs?branch=main&head_sha={SHA}&event=push&per_page=100"]["workflow_runs"][0]["status"] = "in_progress"
        self.blocked("workflow")

    def test_skipped_required_github_job_denied(self):
        self.gh.responses["/actions/runs/901/jobs?per_page=100"]["jobs"][1]["conclusion"] = "skipped"
        self.blocked("GitHub job")

    def test_failed_other_github_job_denied(self):
        self.gh.responses["/actions/runs/902/jobs?per_page=100"]["jobs"][0]["conclusion"] = "failure"
        self.blocked("GitHub job")

    def test_duplicate_pending_run_denied(self):
        k = f"/actions/workflows/{WORKFLOW}/runs?branch=main&head_sha={SHA}&event=workflow_dispatch&per_page=100"
        self.gh.responses[k] = {"total_count": 1, "workflow_runs": [
            {"head_sha": SHA, "status": "queued", "event": "workflow_dispatch", "id": 44}]}
        self.blocked("already requested")

    def test_duplicate_completed_run_denied(self):
        k = f"/actions/workflows/{WORKFLOW}/runs?branch=main&head_sha={SHA}&event=workflow_dispatch&per_page=100"
        self.gh.responses[k] = {"total_count": 1, "workflow_runs": [
            {"head_sha": SHA, "status": "completed", "conclusion": "failure", "event": "workflow_dispatch", "id": 42}]}
        self.blocked("already requested")

    def test_duplicate_history_not_complete_denied(self):
        k = f"/actions/workflows/{WORKFLOW}/runs?branch=main&head_sha={SHA}&event=workflow_dispatch&per_page=100"
        self.gh.responses[k]["total_count"] = 2
        self.blocked("history")

    def test_legacy_204_response_not_claimed_build(self):
        self.gh.response_status = 204
        result = self.dispatch()
        self.assertEqual(result["status"], "DISPATCH_ACCEPTED_RUN_ID_UNKNOWN")
        self.assertIsNone(result["run_id"])

    def test_invalid_success_payload_does_not_fabricate_receipt(self):
        orig = self.gh.dispatch
        self.gh.dispatch = lambda path, data: (200, {"workflow_run_id": "not-an-int"})
        with self.assertRaises(GateBlocked): self.dispatch()

    def test_missing_lock_prevents_network(self):
        class BrokenLock:
            def __enter__(self): raise GateBlocked("lock held")
            def __exit__(self, *a): return False
        with self.assertRaisesRegex(GateBlocked, "lock held"):
            dispatch_arm64_evidence(SHA, operator_token="operator-fixture-only",
                                    github=self.gh, lock=BrokenLock)
        self.assertEqual([], self.gh.get_calls)

    def test_unknown_github_response_blocks(self):
        self.gh.get = lambda path: (_ for _ in ()).throw(GateBlocked("network disconnected"))
        self.blocked("network disconnected")


if __name__ == "__main__":
    import unittest
    unittest.main()
