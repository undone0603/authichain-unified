"""AgentZ-compatible, fail-closed CircleCI proof adapter.

Default mode is read-only. Never prints tokens. Dispatch is deliberately unsupported
until available credits, approval, and project authorization are independently verified.
"""
from __future__ import annotations
import argparse
import json
import os
import re
import sys
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

REPO = "undone0603/authichain-unified"
PROJECT = "gh/" + REPO
SHA_RE = re.compile(r"^[a-f0-9]{40}$")
API = "https://circleci.com/api/v2"

def get_json(path: str) -> dict:
    token = os.environ.get("CIRCLECI_TOKEN", "")
    if not token:
        raise RuntimeError("CIRCLECI_TOKEN unavailable; read-only CircleCI API access not established")
    if not path.startswith("/project/gh/undone0603/authichain-unified/"):
        raise ValueError("CircleCI path outside allowlisted project")
    req = Request(API + path, headers={"Circle-Token": token, "Accept": "application/json"})
    try:
        with urlopen(req, timeout=15) as response:
            return json.load(response)
    except (HTTPError, URLError) as exc:
        raise RuntimeError("CircleCI read-only request failed; details withheld") from None

def inspect(sha: str) -> dict:
    if not SHA_RE.fullmatch(sha):
        raise ValueError("expected exact 40-character lowercase commit SHA")
    result = get_json(f"/project/{PROJECT}/pipeline?branch=fix%2Fworker-vitest-workspace-test-only-20261110")
    items = result.get("items", [])
    matches = [
        {"id": p.get("id"), "number": p.get("number"), "state": p.get("state"),
         "created_at": p.get("created_at"), "revision": p.get("vcs", {}).get("revision")}
        for p in items if p.get("vcs", {}).get("revision") == sha
    ]
    return {"repo": REPO, "sha": sha, "matching_pipelines": matches,
            "next_page_token_present": bool(result.get("next_page_token")),
            "proof": "unverified: pipeline metadata alone does not establish Vitest/TSX results"}

def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Read-only CircleCI A2A proof discovery")
    parser.add_argument("--sha", required=True)
    parser.add_argument("--dispatch", action="store_true")
    args = parser.parse_args(argv)
    if args.dispatch:
        print("BLOCKED: dispatch disabled pending independently verified credit reserve and approval", file=sys.stderr)
        return 78
    try:
        print(json.dumps(inspect(args.sha), indent=2))
        return 0
    except (ValueError, RuntimeError) as exc:
        print(f"BLOCKED: {exc}", file=sys.stderr)
        return 2

if __name__ == "__main__":
    raise SystemExit(main())
