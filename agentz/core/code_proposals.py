"""AgentZ autonomous draft code changes on isolated feature branches.

Uses GitHub's contents API rather than browser DOM automation to avoid brittle
selectors and accidental writes to main. The browser is used for inspection.
"""
import base64
import json
import os
import re
from urllib.parse import quote
from urllib.request import Request, urlopen

REPO = "undone0603/authichain-unified"
BRANCH = re.compile(r"^refs/heads/feat/agentz-[a-z0-9][a-z0-9-]{0,60}$")
PATH = re.compile(r"^(agentz|tests|docs)/[a-zA-Z0-9_./-]{1,180}$")


def propose_code_change(branch_ref: str, path: str, content: str,
                        *, expected_blob_sha: str | None = None) -> dict:
    from agentz.core.capability_policy import decide
    if not decide("code_branch").allowed:
        raise PermissionError("branch editing disabled")
    if not isinstance(branch_ref, str) or not BRANCH.fullmatch(branch_ref):
        raise ValueError("only feat/agentz-* branches are editable")
    if not isinstance(path, str) or not PATH.fullmatch(path) or ".." in path.split("/"):
        raise ValueError("path outside allowed development scope")
    if not isinstance(content, str) or len(content.encode("utf-8")) > 100_000:
        raise ValueError("content exceeds 100KB limit")
    if expected_blob_sha is not None and not re.fullmatch(r"[0-9a-f]{40}", expected_blob_sha):
        raise ValueError("invalid expected blob SHA")
    token = os.environ.get("AGENTZ_GITHUB_CODE_TOKEN")
    if not token:
        raise RuntimeError("scoped GitHub code token not configured")
    headers = {"Authorization": f"Bearer {token}",
               "Accept": "application/vnd.github+json",
               "X-GitHub-Api-Version": "2022-11-28"}
    payload = {"branch": branch_ref.removeprefix("refs/heads/"),
               "message": f"agentz: propose change to {path}",
               "content": base64.b64encode(content.encode()).decode()}
    if expected_blob_sha:
        payload["sha"] = expected_blob_sha
    encoded_path = quote(path, safe="/")
    request = Request(f"https://api.github.com/repos/{REPO}/contents/{encoded_path}",
                      headers={**headers, "Content-Type": "application/json"},
                      data=json.dumps(payload).encode(), method="PUT")
    with urlopen(request, timeout=20) as response:
        result = json.load(response)
    return {"status": "branch_updated_not_merged",
            "branch": payload["branch"], "path": path,
            "commit_sha": result["commit"]["sha"]}


# Self-build only creates feature branches and draft PRs. A separate
# protected-main process verifies required checks before any merge/deploy.
def _code_token_headers() -> dict:
    token = os.environ.get("AGENTZ_GITHUB_CODE_TOKEN")
    if not token:
        raise RuntimeError("scoped GitHub code token not configured")
    return {"Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28"}


def _validated_code_branch(branch_ref: str) -> str:
    if not isinstance(branch_ref, str) or not BRANCH.fullmatch(branch_ref):
        raise ValueError("only refs/heads/feat/agentz-* branches are allowed")
    return branch_ref.removeprefix("refs/heads/")


def create_code_branch(branch_ref: str) -> dict:
    """Create a new AgentZ development branch at current main. Never move main."""
    from agentz.core.capability_policy import decide
    if not decide("code_branch").allowed:
        raise PermissionError("development branch creation disabled")
    branch = _validated_code_branch(branch_ref)
    headers = _code_token_headers()
    read = Request(f"https://api.github.com/repos/{REPO}/git/ref/heads/main",
                   headers=headers, method="GET")
    with urlopen(read, timeout=20) as response:
        source_sha = json.load(response)["object"]["sha"]
    if not re.fullmatch(r"[0-9a-f]{40}", source_sha):
        raise RuntimeError("GitHub did not return a valid main commit SHA")
    write = Request(f"https://api.github.com/repos/{REPO}/git/refs",
                    headers={**headers, "Content-Type": "application/json"},
                    data=json.dumps({"ref": branch_ref, "sha": source_sha}).encode(),
                    method="POST")
    with urlopen(write, timeout=20) as response:
        result = json.load(response)
    if result.get("ref") != branch_ref:
        raise RuntimeError("GitHub branch response did not match requested ref")
    return {"status": "branch_created_not_merged", "branch": branch,
            "base_main_sha": source_sha}


def create_draft_code_pr(branch_ref: str, title: str, body: str = "") -> dict:
    """Submit an AgentZ patch as a draft PR; never merge or deploy."""
    from agentz.core.capability_policy import decide
    if not decide("pr_create").allowed:
        raise PermissionError("draft PR creation disabled")
    branch = _validated_code_branch(branch_ref)
    if not isinstance(title, str) or not title.strip() or len(title) > 120:
        raise ValueError("draft PR title must be 1-120 characters")
    if not isinstance(body, str) or len(body.encode("utf-8")) > 10000:
        raise ValueError("draft PR body exceeds 10KB")
    headers = _code_token_headers()
    payload = {
        "head": branch,
        "base": "main",
        "draft": True,
        "title": title.strip(),
        "body": body + "\n\nAgentZ autonomous proposal: draft only. "
                       "No authorization to merge, deploy, charge, or send messages. "
                       "Require exact-head CI and enforced protected-main eligibility.",
    }
    request = Request(f"https://api.github.com/repos/{REPO}/pulls",
                      headers={**headers, "Content-Type": "application/json"},
                      data=json.dumps(payload).encode(), method="POST")
    with urlopen(request, timeout=20) as response:
        result = json.load(response)
    if result.get("draft") is not True or result.get("head", {}).get("ref") != branch:
        raise RuntimeError("GitHub did not confirm the expected draft PR")
    return {"status": "draft_pr_created_not_merged",
            "pr_number": result["number"], "url": result["html_url"],
            "branch": branch}


def hydrogen_playbook() -> str:
    """Return the shared, local engineering instruction set for AgentZ reasoning."""
    from pathlib import Path
    path = Path(__file__).resolve().parents[1] / "knowledge" / "HYDROGEN_SELF_BUILD.md"
    return path.read_text(encoding="utf-8")
