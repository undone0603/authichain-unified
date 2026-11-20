"""Evidence-only protected ARM64 build dispatcher for AgentZ.

Separate from protected_dispatch.py (production releases).  A user-supplied
``authorized`` or ``gate_passed`` field is never consulted.  This requests one
manual *build-evidence* run; it does not launch AgentZ or issue an attestation.

The call must be made by an authenticated server process with an owner-pinned
SHA, a repo-scoped GitHub credential, and a functioning exclusive local lock.
The protected workflow enforces the same-SHA singleton at run time too.
"""
from __future__ import annotations

import base64
from contextlib import contextmanager
import fcntl
import hmac
import hashlib
import json
import os
from pathlib import Path
import re
import stat
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

REPO = "undone0603/authichain-unified"
WORKFLOW = "agentz-protected-host-artifact.yml"
MAIN_RULESET_ID = 24073494
FULL_SHA = re.compile(r"^[0-9a-f]{40}$")
CIRCLE_URL = re.compile(r"^https://app\.circleci\.com/workflow/[0-9a-f-]+/job/[0-9a-f-]+$")
REQUIRED_CIRCLECI = tuple(
    "ci/circleci: " + name for name in (
        "test-workers", "test-other", "typecheck-ratchet", "quality",
        "extras", "build", "runtime-db-attestation-postgres", "main-quality-gate",
    )
)
# These workflows have push-to-main jobs; optional/skipped jobs are not passes.
REQUIRED_GITHUB_PUSH_JOBS = {
    "lint.yml": ("lint", "test"),
    "main.yml": ("Protected main secret format",),
}
API = f"https://api.github.com/repos/{REPO}"


class GateBlocked(RuntimeError):
    """An unavailable, ambiguous, or failed gate; never retry via bypass."""


class GitHub:
    """Small fixed-host JSON API adapter.  No user-controlled API paths."""

    def __init__(self, token: str):
        if not token or not isinstance(token, str):
            raise GateBlocked("dedicated evidence GitHub credential missing")
        self._token = token

    def _request(self, method: str, resource: str, payload: dict | None = None):
        if resource and (not resource.startswith("/") or "//" in resource or ".." in resource):
            raise GateBlocked("unexpected GitHub resource")
        data = None if payload is None else json.dumps(payload).encode("utf-8")
        req = Request(
            API + resource,
            data=data,
            method=method,
            headers={
                "Authorization": "Bearer " + self._token,
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2026-03-10",
                "Content-Type": "application/json",
                "User-Agent": "AuthiChain-AgentZ-Evidence-Dispatcher/1",
            },
        )
        try:
            with urlopen(req, timeout=15) as response:
                raw = response.read(2_000_001)
                if len(raw) > 2_000_000:
                    raise GateBlocked("GitHub response too large for complete gate check")
                return response.status, json.loads(raw) if raw else None
        except (HTTPError, URLError, TimeoutError, OSError, ValueError) as exc:
            # Never print tokens or JSON payloads in errors.
            raise GateBlocked("GitHub API gate read/dispatch unavailable") from exc

    def get(self, resource: str) -> Any:
        status, value = self._request("GET", resource)
        if status != 200:
            raise GateBlocked("GitHub gate returned unexpected status")
        return value

    def dispatch(self, resource: str, payload: dict) -> tuple[int, Any]:
        return self._request("POST", resource, payload)


@contextmanager
def _host_lock():
    """Cross-process lock in the AgentZ host namespace, not the repo/workspace."""
    directory = Path.home() / ".config" / "agentz" / "locks"
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    if directory.is_symlink():
        raise GateBlocked("lock directory is a symlink")
    lock_path = directory / "arm64-evidence-dispatch.lock"
    fd = os.open(lock_path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    try:
        mode = os.fstat(fd).st_mode
        if not stat.S_ISREG(mode) or mode & 0o077:
            raise GateBlocked("unsafe local dispatch lock")
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as exc:
            raise GateBlocked("another evidence dispatch is in progress") from exc
        try:
            yield
        finally:
            fcntl.flock(fd, fcntl.LOCK_UN)
    finally:
        os.close(fd)


def _require(condition: bool, reason: str):
    if not condition:
        raise GateBlocked(reason)


def _valid_ci_statuses(value: Any) -> None:
    _require(isinstance(value, dict), "CI evidence malformed")
    statuses = value.get("statuses")
    total = value.get("total_count")
    _require(isinstance(statuses, list) and isinstance(total, int) and total == len(statuses)
             and len(statuses) >= len(REQUIRED_CIRCLECI) and len(statuses) < 100,
             "CI status list missing, partial, or truncated")
    newest = {}
    # GitHub's combined status API presents latest first for each context.
    for s in statuses:
        if isinstance(s, dict) and isinstance(s.get("context"), str):
            newest.setdefault(s["context"], s)
    for name in REQUIRED_CIRCLECI:
        s = newest.get(name) or {}
        _require(s.get("state") == "success" and
                 bool(CIRCLE_URL.fullmatch(s.get("target_url") or "")),
                 "missing/failed exact-SHA CircleCI check: " + name)


def _assert_ruleset(rules: Any) -> None:
    _require(isinstance(rules, dict) and rules.get("id") == MAIN_RULESET_ID and
             rules.get("name") == "main-no-direct-push" and
             rules.get("enforcement") == "active", "protected main ruleset absent")
    refs = ((rules.get("conditions") or {}).get("ref_name") or {}).get("include") or []
    _require("refs/heads/main" in refs, "ruleset not enforced on main")
    _require(any(isinstance(x, dict) and x.get("type") == "pull_request" for x in rules.get("rules") or []),
             "required PR protection missing")
    if "bypass_actors" in rules:
        _require(rules.get("bypass_actors") == [], "ruleset has bypass actors")
    _require(rules.get("current_user_can_bypass") != "always", "token can bypass rules")


def _assert_push_workflow(gh: Any, sha: str, workflow: str, required_jobs: tuple[str, ...]) -> None:
    result = gh.get(f"/actions/workflows/{workflow}/runs?branch=main&head_sha={sha}&event=push&per_page=100")
    runs = result.get("workflow_runs") if isinstance(result, dict) else None
    _require(isinstance(runs, list) and 0 < len(runs) < 100, "incomplete push workflow evidence: " + workflow)
    matches = [r for r in runs if r.get("head_sha") == sha and r.get("event") == "push"]
    _require(len(matches) == 1, "ambiguous exact-SHA workflow run: " + workflow)
    run = matches[0]
    _require(run.get("status") == "completed" and run.get("conclusion") == "success" and
             isinstance(run.get("id"), int), "unfinished/failed push workflow: " + workflow)
    jobs_result = gh.get(f"/actions/runs/{run['id']}/jobs?per_page=100")
    jobs = jobs_result.get("jobs") if isinstance(jobs_result, dict) else None
    total = jobs_result.get("total_count") if isinstance(jobs_result, dict) else None
    _require(isinstance(jobs, list) and isinstance(total, int) and total == len(jobs)
             and 0 < len(jobs) < 100, "incomplete GitHub job evidence: " + workflow)
    for name in required_jobs:
        matches = [j for j in jobs if j.get("name") == name]
        _require(len(matches) == 1 and matches[0].get("status") == "completed" and
                 matches[0].get("conclusion") == "success" and matches[0].get("head_sha", sha) == sha,
                 "missing/failed GitHub job: " + workflow + "/" + name)
    for job in jobs:
        _require(job.get("status") == "completed" and job.get("conclusion") in ("success", "skipped"),
                 "incomplete/failed GitHub job: " + workflow)


def verify_evidence_build_gates(expected_sha: str, gh: Any) -> dict:
    """Re-reads authoritative GitHub state. No caller-provided trust decisions."""
    _require(isinstance(expected_sha, str) and bool(FULL_SHA.fullmatch(expected_sha)),
             "expected protected main commit must be a full SHA")
    info = gh.get("")  # repository root; scope fixed in GitHub adapter
    _require(isinstance(info, dict) and info.get("full_name") == REPO and
             info.get("private") is False and info.get("archived") is False and
             info.get("default_branch") == "main", "standard public-repository cost gate not proven")
    branch = gh.get("/branches/main")
    _require(branch.get("name") == "main" and branch.get("protected") is True and
             (branch.get("commit") or {}).get("sha") == expected_sha,
             "protected main SHA changed or protection not established")
    _assert_ruleset(gh.get(f"/rulesets/{MAIN_RULESET_ID}"))
    # A reviewed workflow's immutable blob must be authorized on the SERVER;
    # never take a trusted digest or policy flag from the caller.
    expected_blob = os.environ.get("AGENTZ_EVIDENCE_APPROVED_WORKFLOW_BLOB_SHA", "")
    _require(bool(FULL_SHA.fullmatch(expected_blob)), "approved workflow blob SHA not provisioned")
    workflow = gh.get(f"/contents/.github/workflows/{WORKFLOW}?ref={expected_sha}")
    _require(isinstance(workflow, dict) and workflow.get("sha") == expected_blob and
             workflow.get("encoding") == "base64" and isinstance(workflow.get("content"), str),
             "protected workflow bytes not independently pinned")
    raw = base64.b64decode(workflow["content"], validate=False)
    actual_blob = hashlib.sha1(b"blob " + str(len(raw)).encode() + b"\0" + raw).hexdigest()
    _require(actual_blob == expected_blob, "protected workflow Git blob content mismatch")
    _require(b"workflow_dispatch:" in raw and b"github.ref_protected" in raw and
             b"inputs.expected_sha" in raw and b"concurrency:" in raw and
             b"Refuse duplicate ARM64 build" in raw and
             bool(re.search(rb"^\s{4}runs-on: ubuntu-24\.04-arm\s*$", raw, re.M)) and b"gh release create" in raw and
             b"actions/upload-artifact" not in raw and b"docker build" in raw,
             "unexpected protected evidence workflow structure")
    _valid_ci_statuses(gh.get(f"/commits/{expected_sha}/status?per_page=100"))
    for name, jobs in REQUIRED_GITHUB_PUSH_JOBS.items():
        _assert_push_workflow(gh, expected_sha, name, jobs)
    existing = gh.get(f"/actions/workflows/{WORKFLOW}/runs?branch=main&head_sha={expected_sha}&event=workflow_dispatch&per_page=100")
    runs = existing.get("workflow_runs") if isinstance(existing, dict) else None
    _require(isinstance(runs, list) and len(runs) < 100 and isinstance(existing.get("total_count"), int)
             and existing["total_count"] == len(runs), "evidence build history missing/truncated")
    _require(not any(r.get("head_sha") == expected_sha for r in runs),
             "evidence build already requested for this SHA")
    return {"eligible": True, "source_sha": expected_sha, "checks": len(REQUIRED_CIRCLECI),
            "github_workflows": tuple(REQUIRED_GITHUB_PUSH_JOBS), "workflow": WORKFLOW}


def dispatch_arm64_evidence(expected_sha: str, *, operator_token: str,
                            github: Any | None = None, lock=None) -> dict:
    """Owner-scoped, one-shot, evidence-only build dispatch. Never a release."""
    _require(os.environ.get("AGENTZ_EVIDENCE_DISPATCH_ENABLED") == "true",
             "evidence-only dispatch disabled")
    server_operator = os.environ.get("AGENTZ_EVIDENCE_OPERATOR_TOKEN", "")
    _require(bool(server_operator) and isinstance(operator_token, str) and
             hmac.compare_digest(operator_token, server_operator), "evidence operator authorization missing")
    _require(expected_sha == os.environ.get("AGENTZ_EVIDENCE_APPROVED_MAIN_SHA") and
             isinstance(expected_sha, str) and bool(FULL_SHA.fullmatch(expected_sha)),
             "owner-pinned SHA authorization missing or stale")
    dedicated = os.environ.get("AGENTZ_GITHUB_EVIDENCE_TOKEN", "")
    _require(bool(dedicated), "dedicated evidence GitHub token unavailable")
    gh = github if github is not None else GitHub(dedicated)
    guard = lock if lock is not None else _host_lock
    with guard():
        proof = verify_evidence_build_gates(expected_sha, gh)
        status, result = gh.dispatch(
            f"/actions/workflows/{WORKFLOW}/dispatches",
            {"ref": "main", "inputs": {"expected_sha": expected_sha}, "return_run_details": True},
        )
        if status == 200:
            _require(isinstance(result, dict) and isinstance(result.get("workflow_run_id"), int)
                     and result["workflow_run_id"] > 0,
                     "GitHub acknowledged dispatch but did not return a verified run ID")
            return {**proof, "status": "DISPATCHED_NOT_BUILT", "run_id": result["workflow_run_id"],
                    "run_url": f"https://github.com/{REPO}/actions/runs/{result['workflow_run_id']}",
                    "attestation": "NOT_ISSUED", "runtime_image_match": "NOT_PROVEN"}
        if status == 204:
            return {**proof, "status": "DISPATCH_ACCEPTED_RUN_ID_UNKNOWN", "run_id": None,
                    "attestation": "NOT_ISSUED", "runtime_image_match": "NOT_PROVEN"}
        raise GateBlocked("GitHub did not acknowledge evidence dispatch")
