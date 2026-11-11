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
