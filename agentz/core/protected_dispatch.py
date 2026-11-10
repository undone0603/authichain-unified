"""SHA-pinned workflow dispatch through GitHub's authenticated API.

The workflow's native release gate remains authoritative. Dispatch only
requests a run; it is not proof of deployment or release eligibility.
"""
import json
import os
import re
from urllib.request import Request, urlopen

REPO = "undone0603/authichain-unified"
WORKFLOW = "deploy-authichain-com.yml"
SHA = re.compile(r"^[a-f0-9]{40}$")
API = f"https://api.github.com/repos/{REPO}"


def dispatch_protected_release(expected_sha: str, *, authorized: bool = False,
                               release_gate_passed: bool = False) -> dict:
    from agentz.core.capability_policy import decide
    decision = decide("deploy", authorized=authorized,
                      release_gate_passed=release_gate_passed)
    if not decision.allowed:
        raise PermissionError(decision.reason)
    if not isinstance(expected_sha, str) or not SHA.fullmatch(expected_sha):
        raise ValueError("full lowercase 40-character SHA required")
    token = os.environ.get("AGENTZ_GITHUB_WORKFLOW_TOKEN")
    if not token:
        raise RuntimeError("dedicated GitHub workflow token unavailable")
    headers = {"Authorization": f"Bearer {token}",
               "Accept": "application/vnd.github+json",
               "X-GitHub-Api-Version": "2022-11-28"}
    request = Request(f"{API}/git/ref/heads/main", headers=headers)
    with urlopen(request, timeout=15) as response:
        main_sha = json.load(response)["object"]["sha"]
    if main_sha != expected_sha:
        raise ValueError("main SHA changed; refusing stale dispatch")
    payload = json.dumps({"ref": "main", "inputs": {"expected_sha": expected_sha}}).encode()
    request = Request(f"{API}/actions/workflows/{WORKFLOW}/dispatches",
                      headers={**headers, "Content-Type": "application/json"},
                      data=payload, method="POST")
    with urlopen(request, timeout=15) as response:
        if response.status != 204:
            raise RuntimeError("GitHub did not acknowledge dispatch")
    return {"status": "dispatched_not_deployed", "sha": expected_sha,
            "workflow": WORKFLOW,
            "runs_url": f"https://github.com/{REPO}/actions/workflows/{WORKFLOW}"}
