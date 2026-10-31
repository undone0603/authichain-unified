#!/usr/bin/env python3
"""Fail-closed GitHub PR landing helper.

This script is the repository-local landing surface required by the PR-completion
workflow. It never calls GitHub's merge REST/GraphQL endpoints directly; the
confirmed path delegates to the protected GitHub CLI merge/auto-merge flow.

Read-only mode prints a canonical plan and readinessPolicyDigest. Confirm mode
requires that exact digest, exact head SHA, and a fresh re-check of readiness.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shlex
import subprocess
import sys
from dataclasses import dataclass
from typing import Any


class LandError(RuntimeError):
    pass


def run(*args: str) -> str:
    proc = subprocess.run(
        list(args),
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if proc.returncode:
        raise LandError(f"{shlex.join(args)} failed ({proc.returncode}): {proc.stderr.strip()}")
    return proc.stdout


def gh_json(*args: str) -> Any:
    return json.loads(run("gh", *args))


def parse_repo_pr(value: str) -> tuple[str, int]:
    if value.startswith("https://github.com/"):
        parts = value.rstrip("/").split("/")
        if len(parts) < 5 or parts[-2] != "pull":
            raise LandError(f"invalid PR URL: {value}")
        return "/".join(parts[3:-2]), int(parts[-1])
    if "#" in value:
        repo, number = value.rsplit("#", 1)
        return repo, int(number)
    raise LandError("PR must be owner/repo#number or a GitHub PR URL")


@dataclass(frozen=True)
class Policy:
    mode: str
    method: str | None
    reviewers: tuple[str, ...]
    check_policy: str
    strict_changes_requested: bool
    config_source: str

    def canonical(self) -> dict[str, Any]:
        return {
            "mode": self.mode,
            "method": self.method,
            "reviewers": list(self.reviewers),
            "checkPolicy": self.check_policy,
            "strictChangesRequested": self.strict_changes_requested,
            "configSource": self.config_source,
        }


def get_policy(args: argparse.Namespace) -> Policy:
    if args.mode == "queue" and args.method:
        raise LandError("--mode queue cannot be combined with --method")
    if args.mode == "auto" and args.method not in {"merge", "squash", "rebase"}:
        raise LandError("--mode auto requires --method merge|squash|rebase")
    return Policy(
        mode=args.mode,
        method=args.method,
        reviewers=tuple(sorted(set(args.reviewer))),
        check_policy=args.check_policy,
        strict_changes_requested=args.strict_changes_requested,
        config_source="none" if args.no_config else "default",
    )


def readiness(repo: str, number: int, head: str, policy: Policy) -> dict[str, Any]:
    pr = gh_json("pr", "view", str(number), "--repo", repo, "--json",
                 "number,state,isDraft,mergeable,mergeStateStatus,headRefOid,baseRefName,url,reviews")
    if pr["state"] != "OPEN":
        raise LandError(f"PR is not open: {pr['state']}")
    if pr.get("isDraft"):
        raise LandError("PR is draft")
    if pr.get("headRefOid") != head:
        raise LandError(f"head changed: expected {head}, observed {pr.get('headRefOid')}")
    if pr.get("mergeable") == "CONFLICTING":
        raise LandError("PR is conflicting")
    if pr.get("mergeStateStatus") in {"BLOCKED", "DIRTY", "BEHIND", "UNKNOWN"}:
        raise LandError(f"GitHub merge state is not ready: {pr.get('mergeStateStatus')}")

    checks = gh_json("pr", "checks", str(number), "--repo", repo, "--json",
                     "name,state,bucket,workflow")
    failed = []
    pending = []
    for check in checks:
        bucket = str(check.get("bucket", "")).lower()
        state = str(check.get("state", "")).upper()
        if bucket in {"fail", "cancel"} or state in {"FAILURE", "ERROR", "CANCELLED", "TIMED_OUT"}:
            failed.append(check.get("name"))
        elif bucket in {"pending", "skipping"} or state in {"PENDING", "QUEUED", "IN_PROGRESS", "EXPECTED"}:
            pending.append(check.get("name"))
    if failed:
        raise LandError("failed checks: " + ", ".join(sorted(filter(None, failed))))
    if pending:
        raise LandError("pending checks: " + ", ".join(sorted(filter(None, pending))))

    reviews = pr.get("reviews") or []
    latest: dict[str, dict[str, Any]] = {}
    for review in reviews:
        login = ((review.get("author") or {}).get("login") or "").lower()
        if login:
            latest[login] = review
    for reviewer in policy.reviewers:
        review = latest.get(reviewer.lower())
        if not review or review.get("state") != "APPROVED":
            raise LandError(f"required reviewer approval missing: {reviewer}")

    requested_changes = [
        r.get("author", {}).get("login")
        for r in reviews
        if r.get("state") == "CHANGES_REQUESTED"
    ]
    if policy.strict_changes_requested and requested_changes:
        raise LandError("changes requested by: " + ", ".join(sorted(set(requested_changes))))

    return {
        "pr": number,
        "url": pr["url"],
        "state": pr["state"],
        "head": head,
        "base": pr["baseRefName"],
        "mergeable": pr.get("mergeable"),
        "mergeStateStatus": pr.get("mergeStateStatus"),
        "checks": sorted(check.get("name", "") for check in checks),
        "reviewers": sorted(policy.reviewers),
        "requestedChanges": sorted(set(filter(None, requested_changes))),
        "policy": policy.canonical(),
    }


def digest_for(plan: dict[str, Any]) -> str:
    canonical = json.dumps(plan, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(canonical).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", required=True)
    parser.add_argument("--pr", required=True)
    parser.add_argument("--head", required=True)
    parser.add_argument("--mode", choices=("auto", "queue"), default="auto")
    parser.add_argument("--method", choices=("merge", "squash", "rebase"))
    parser.add_argument("--config")
    parser.add_argument("--no-config", action="store_true")
    parser.add_argument("--reviewer", action="append", default=[])
    parser.add_argument("--check-policy", default="all-required")
    parser.add_argument("--strict-changes-requested", action="store_true")
    parser.add_argument("--policy-digest")
    parser.add_argument("--confirm", action="store_true")
    args = parser.parse_args()

    repo_from_pr, number = parse_repo_pr(args.pr)
    if repo_from_pr != args.repo:
        raise LandError(f"--repo {args.repo} does not match --pr repository {repo_from_pr}")
    if args.config and args.no_config:
        raise LandError("--config and --no-config are mutually exclusive")

    policy = get_policy(args)
    plan = readiness(args.repo, number, args.head, policy)
    digest = digest_for(plan)

    output = {
        "state": "ready",
        "action": "landing_requested" if args.confirm else "preflight",
        "repository": args.repo,
        "pr": number,
        "head": args.head,
        "mode": policy.mode,
        "method": policy.method,
        "readinessPolicyDigest": digest,
        "plan": plan,
        "warning": "Confirmation may merge this pull request immediately through GitHub's protected path.",
    }

    if not args.confirm:
        print(json.dumps(output, indent=2, sort_keys=True))
        return 0

    if not args.policy_digest:
        raise LandError("--confirm requires --policy-digest from the immediately preceding preflight")
    if args.policy_digest != digest:
        raise LandError("readinessPolicyDigest mismatch; re-run preflight and obtain fresh authorization")

    # Re-read the PR immediately before mutation. The readiness() call above is
    # deliberately repeated rather than trusting the preflight snapshot.
    plan = readiness(args.repo, number, args.head, policy)
    fresh_digest = digest_for(plan)
    if fresh_digest != args.policy_digest:
        raise LandError("readiness changed between preflight and confirmation")

    if policy.mode == "queue":
        cmd = ("gh", "pr", "merge", str(number), "--repo", args.repo, "--auto")
    else:
        cmd = ("gh", "pr", "merge", str(number), "--repo", args.repo, "--auto", f"--{policy.method}")

    started = run(*cmd)
    output.update({
        "state": "landing_requested",
        "requestedAt": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
        "command": list(cmd),
        "stdout": started.strip(),
        "readinessPolicyDigest": args.policy_digest,
    })
    print(json.dumps(output, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except LandError as exc:
        print(json.dumps({"state": "blocked", "error": str(exc)}), file=sys.stderr)
        raise SystemExit(20)
