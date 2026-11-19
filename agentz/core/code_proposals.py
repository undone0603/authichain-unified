"""AgentZ autonomous draft code changes on isolated feature branches.

Uses GitHub's contents API rather than browser DOM automation to avoid brittle
selectors and accidental writes to main. The browser is used for inspection.

Scope: any repo path on a feat/agentz-* branch, except CI definitions, code
owners, secret-looking files and AgentZ's own guardrails (changing those is a
governed POLICY_CHANGE, not CODE_BRANCH). Branches are created from main when
missing. Draft PRs into main are allowed (PR_CREATE); merging is not.
"""
import base64
import json
import os
import re
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen

REPO = "undone0603/authichain-unified"
BRANCH = re.compile(r"^refs/heads/feat/agentz-[a-z0-9][a-z0-9-]{0,60}$")
PATH = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_./@+-]{0,239}$")
DENIED_PREFIXES = (".github/workflows/", ".github/actions/", ".circleci/",
                   ".git/", ".husky/")
DENIED_PATHS = frozenset({
    "CODEOWNERS", ".github/CODEOWNERS", "docs/CODEOWNERS", ".gitmodules",
    "agentz/core/code_proposals.py", "agentz/core/capability_policy.py",
})
SENSITIVE = re.compile(
    r"(^|/)\.env($|\.)|(^|/)\.dev\.vars|secret|credential|private[-_]?key"
    r"|\.(pem|key|p12|pfx|keystore|jks)$|(^|/)id_(rsa|ed25519|ecdsa)",
    re.IGNORECASE)
MAX_TITLE = 200
MAX_BODY = 20_000


def _check_branch(branch_ref: str) -> str:
    if not isinstance(branch_ref, str) or not BRANCH.fullmatch(branch_ref):
        raise ValueError("only feat/agentz-* branches are editable")
    return branch_ref.removeprefix("refs/heads/")


def check_path(path: str) -> str:
    """Raise ValueError unless AgentZ may write this repo path."""
    if not isinstance(path, str) or not PATH.fullmatch(path) or ".." in path.split("/"):
        raise ValueError("path outside allowed development scope")
    if path in DENIED_PATHS or path.startswith(DENIED_PREFIXES):
        raise ValueError("path is CI, ownership or AgentZ policy; owner-only")
    if SENSITIVE.search(path):
        raise ValueError("path looks like a secret or key file")
    return path


def _github(method: str, api_path: str, payload: dict | None = None) -> dict:
    token = os.environ.get("AGENTZ_GITHUB_CODE_TOKEN")
    if not token:
        raise RuntimeError("scoped GitHub code token not configured")
    headers = {"Authorization": f"Bearer {token}",
               "Accept": "application/vnd.github+json",
               "X-GitHub-Api-Version": "2022-11-28",
               "User-Agent": "AuthiChain-AgentZ-CodeProposals/1.0"}
    data = None
    if payload is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(payload).encode()
    request = Request(f"https://api.github.com/repos/{REPO}/{api_path}",
                      headers=headers, data=data, method=method)
    with urlopen(request, timeout=20) as response:
        return json.load(response)


def ensure_branch(branch: str) -> bool:
    """Create feat/agentz-* from main's head if missing. True when created."""
    try:
        _github("GET", f"git/ref/heads/{quote(branch, safe='/')}")
        return False
    except HTTPError as exc:
        if exc.code != 404:
            raise
    main_sha = _github("GET", "git/ref/heads/main")["object"]["sha"]
    _github("POST", "git/refs", {"ref": f"refs/heads/{branch}", "sha": main_sha})
    return True


def propose_code_change(branch_ref: str, path: str, content: str,
                        *, expected_blob_sha: str | None = None) -> dict:
    from agentz.core.capability_policy import decide
    if not decide("code_branch").allowed:
        raise PermissionError("branch editing disabled")
    branch = _check_branch(branch_ref)
    check_path(path)
    if not isinstance(content, str) or len(content.encode("utf-8")) > 100_000:
        raise ValueError("content exceeds 100KB limit")
    if expected_blob_sha is not None and not re.fullmatch(r"[0-9a-f]{40}", expected_blob_sha):
        raise ValueError("invalid expected blob SHA")
    if not os.environ.get("AGENTZ_GITHUB_CODE_TOKEN"):
        raise RuntimeError("scoped GitHub code token not configured")
    created = ensure_branch(branch)
    payload = {"branch": branch,
               "message": f"agentz: propose change to {path}",
               "content": base64.b64encode(content.encode()).decode()}
    if expected_blob_sha:
        payload["sha"] = expected_blob_sha
    result = _github("PUT", f"contents/{quote(path, safe='/')}", payload)
    return {"status": "branch_updated_not_merged", "branch": branch,
            "branch_created": created, "path": path,
            "commit_sha": result["commit"]["sha"]}


def open_draft_pr(branch_ref: str, title: str, body: str = "") -> dict:
    """Open (or return the existing) draft PR from a feat/agentz-* branch into main."""
    from agentz.core.capability_policy import decide
    if not decide("pr_create").allowed:
        raise PermissionError("PR creation disabled")
    branch = _check_branch(branch_ref)
    if not isinstance(title, str) or not title.strip() or len(title) > MAX_TITLE:
        raise ValueError(f"title must be 1-{MAX_TITLE} characters")
    if not isinstance(body, str) or len(body) > MAX_BODY:
        raise ValueError(f"body exceeds {MAX_BODY} characters")
    owner = REPO.split("/")[0]
    existing = _github("GET", f"pulls?state=open&head={owner}:{quote(branch, safe='')}")
    if existing:
        pr = existing[0]
        return {"status": "already_open", "number": pr["number"],
                "url": pr["html_url"], "draft": pr.get("draft", False)}
    pr = _github("POST", "pulls", {
        "title": title.strip(), "head": branch, "base": "main", "draft": True,
        "body": (body.rstrip() + "\n\n" if body.strip() else "")
        + "_Opened by AgentZ as a draft. Merging is owner-only after required checks pass._",
    })
    return {"status": "draft_opened", "number": pr["number"],
            "url": pr["html_url"], "draft": True}
