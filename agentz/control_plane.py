"""AgentZ deployment control-plane adapters.

The control plane observes GitHub, GitLab and Vercel deployment state and
returns one normalized snapshot. It never deploys, merges, rotates secrets,
or changes provider state. Missing credentials are reported explicitly.
"""
from __future__ import annotations

import json
import os
import urllib.request
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any


@dataclass
class SourceState:
    provider: str
    status: str
    ref: str | None = None
    commit: str | None = None
    pipeline: str | None = None
    deployment: str | None = None
    url: str | None = None
    detail: str | None = None


def _get_json(url: str, headers: dict[str, str] | None = None, timeout: int = 8) -> Any:
    req = urllib.request.Request(url, headers=headers or {"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def _unavailable(provider: str, detail: str) -> SourceState:
    return SourceState(provider=provider, status="unavailable", detail=detail)


def github_state() -> SourceState:
    owner = os.getenv("AGENTZ_GITHUB_OWNER", "undone0603")
    repo = os.getenv("AGENTZ_GITHUB_REPO", "authichain-unified")
    ref = os.getenv("AGENTZ_GITHUB_REF", "main")
    headers = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
    token = os.getenv("GITHUB_TOKEN") or os.getenv("AGENTZ_GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        data = _get_json(f"https://api.github.com/repos/{owner}/{repo}/commits/{ref}", headers)
        sha = data.get("sha")
        return SourceState(
            provider="github", status="healthy" if sha else "degraded", ref=ref,
            commit=sha, url=f"https://github.com/{owner}/{repo}/commit/{sha}" if sha else None,
        )
    except Exception as exc:
        return _unavailable("github", str(exc))


def gitlab_state() -> SourceState:
    project = os.getenv("AGENTZ_GITLAB_PROJECT", "authichain-group/authichain-unified")
    ref = os.getenv("AGENTZ_GITLAB_REF", "main")
    token = os.getenv("GITLAB_TOKEN") or os.getenv("AGENTZ_GITLAB_TOKEN")
    if not token:
        return _unavailable("gitlab", "GITLAB_TOKEN/AGENTZ_GITLAB_TOKEN not configured")
    encoded = project.replace("/", "%2F")
    try:
        pipeline = _get_json(
            f"https://gitlab.com/api/v4/projects/{encoded}/pipelines?ref={ref}&per_page=1",
            {"Accept": "application/json", "PRIVATE-TOKEN": token},
        )
        if not pipeline:
            return SourceState(provider="gitlab", status="degraded", ref=ref, detail="no pipeline returned")
        p = pipeline[0]
        pipeline_status = p.get("status", "unknown")
        return SourceState(
            provider="gitlab", status="healthy" if pipeline_status == "success" else pipeline_status,
            ref=ref, commit=p.get("sha"), pipeline=str(p.get("id")), url=p.get("web_url"),
        )
    except Exception as exc:
        return _unavailable("gitlab", str(exc))


def vercel_state() -> SourceState:
    project_id = os.getenv("AGENTZ_VERCEL_PROJECT_ID", "prj_yIpOU1wEuFBZsGPALYKeoJnvm0fB")
    team_id = os.getenv("AGENTZ_VERCEL_TEAM_ID", "team_PKVRDwUXPRFjmGTM7PZxjNys")
    token = os.getenv("VERCEL_TOKEN") or os.getenv("AGENTZ_VERCEL_TOKEN")
    if not token:
        return _unavailable("vercel", "VERCEL_TOKEN/AGENTZ_VERCEL_TOKEN not configured")
    try:
        data = _get_json(
            f"https://api.vercel.com/v6/deployments?projectId={project_id}&teamId={team_id}&target=production&limit=1",
            {"Accept": "application/json", "Authorization": f"Bearer {token}"},
        )
        deployments = data.get("deployments", [])
        if not deployments:
            return SourceState(provider="vercel", status="degraded", detail="no production deployment returned")
        d = deployments[0]
        state = d.get("state", "UNKNOWN")
        meta = d.get("meta", {}) or {}
        commit = meta.get("githubCommitSha") or meta.get("gitlabCommitSha")
        ref = meta.get("githubCommitRef") or meta.get("gitlabCommitRef")
        return SourceState(
            provider="vercel", status="healthy" if state == "READY" else state.lower(), ref=ref,
            commit=commit, deployment=d.get("uid") or d.get("id"),
            url=("https://" + d["url"]) if d.get("url") else None,
        )
    except Exception as exc:
        return _unavailable("vercel", str(exc))


def collect_state() -> dict[str, Any]:
    sources = [github_state(), gitlab_state(), vercel_state()]
    commits = {s.commit for s in sources if s.commit}
    status = "healthy"
    if any(s.status != "healthy" for s in sources):
        status = "degraded"
    if len(commits) > 1:
        status = "drift"
    return {
        "control_plane": "agentz",
        "status": status,
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "authoritative_ref": os.getenv("AGENTZ_AUTHORITATIVE_REF", "main"),
        "sources": [asdict(s) for s in sources],
        "drift": {"commit_count": len(commits), "commits": sorted(commits), "same_commit": len(commits) <= 1},
    }
