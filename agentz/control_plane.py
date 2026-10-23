"""AgentZ deployment control-plane adapters.

Read-only observation across GitHub, GitLab, Vercel and optional Cloudflare
Workers/Pages. The module normalizes provider state, correlates release
lineage, detects drift, and computes a conservative action gate.

It never deploys, merges, rotates credentials, sends money, or changes
provider state.
"""
from __future__ import annotations

import json
import os
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any


@dataclass
class SourceState:
    provider: str
    status: str
    configured: bool
    ref: str | None = None
    commit: str | None = None
    pipeline: str | None = None
    deployment: str | None = None
    url: str | None = None
    detail: str | None = None
    version_ids: list[str] | None = None


def _get_json(url: str, headers: dict[str, str] | None = None, timeout: int = 8) -> Any:
    req = urllib.request.Request(url, headers=headers or {"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def _unavailable(provider: str, detail: str) -> SourceState:
    return SourceState(provider=provider, status="unavailable", configured=False, detail=detail)


def github_state() -> SourceState:
    owner = os.getenv("AGENTZ_GITHUB_OWNER", "undone0603")
    repo = os.getenv("AGENTZ_GITHUB_REPO", "authichain-unified")
    ref = os.getenv("AGENTZ_GITHUB_REF", "main")
    headers = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
    token = os.getenv("GITHUB_TOKEN") or os.getenv("AGENTZ_GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        encoded_ref = urllib.parse.quote(ref, safe="")
        data = _get_json(f"https://api.github.com/repos/{owner}/{repo}/commits/{encoded_ref}", headers)
        sha = data.get("sha")
        return SourceState(
            provider="github",
            status="healthy" if sha else "degraded",
            configured=True,
            ref=ref,
            commit=sha,
            url=f"https://github.com/{owner}/{repo}/commit/{sha}" if sha else None,
        )
    except Exception as exc:
        return SourceState(provider="github", status="unavailable", configured=True, ref=ref, detail=str(exc))


def gitlab_state() -> SourceState:
    project = os.getenv("AGENTZ_GITLAB_PROJECT", "authichain-group/authichain-unified")
    ref = os.getenv("AGENTZ_GITLAB_REF", "main")
    token = os.getenv("GITLAB_TOKEN") or os.getenv("AGENTZ_GITLAB_TOKEN")
    if not token:
        return _unavailable("gitlab", "GITLAB_TOKEN/AGENTZ_GITLAB_TOKEN not configured")
    encoded = urllib.parse.quote(project, safe="")
    try:
        pipeline = _get_json(
            f"https://gitlab.com/api/v4/projects/{encoded}/pipelines?ref={urllib.parse.quote(ref, safe='')}&per_page=1",
            {"Accept": "application/json", "PRIVATE-TOKEN": token},
        )
        if not pipeline:
            return SourceState(provider="gitlab", status="degraded", configured=True, ref=ref, detail="no pipeline returned")
        p = pipeline[0]
        pipeline_status = p.get("status", "unknown")
        return SourceState(
            provider="gitlab",
            status="healthy" if pipeline_status == "success" else pipeline_status,
            configured=True,
            ref=ref,
            commit=p.get("sha"),
            pipeline=str(p.get("id")),
            url=p.get("web_url"),
        )
    except Exception as exc:
        return SourceState(provider="gitlab", status="unavailable", configured=True, ref=ref, detail=str(exc))


def vercel_state() -> SourceState:
    project_id = os.getenv("AGENTZ_VERCEL_PROJECT_ID", "prj_yIpOU1wEuFBZsGPALYKeoJnvm0fB")
    team_id = os.getenv("AGENTZ_VERCEL_TEAM_ID", "team_PKVRDwUXPRFjmGTM7PZxjNys")
    token = os.getenv("VERCEL_TOKEN") or os.getenv("AGENTZ_VERCEL_TOKEN")
    if not token:
        return _unavailable("vercel", "VERCEL_TOKEN/AGENTZ_VERCEL_TOKEN not configured")
    try:
        data = _get_json(
            "https://api.vercel.com/v6/deployments?"
            + urllib.parse.urlencode({"projectId": project_id, "teamId": team_id, "target": "production", "limit": 1}),
            {"Accept": "application/json", "Authorization": f"Bearer {token}"},
        )
        deployments = data.get("deployments", [])
        if not deployments:
            return SourceState(provider="vercel", status="degraded", configured=True, detail="no production deployment returned")
        d = deployments[0]
        state = d.get("state", "UNKNOWN")
        meta = d.get("meta", {}) or {}
        commit = meta.get("githubCommitSha") or meta.get("gitlabCommitSha")
        ref = meta.get("githubCommitRef") or meta.get("gitlabCommitRef")
        return SourceState(
            provider="vercel",
            status="healthy" if state == "READY" else str(state).lower(),
            configured=True,
            ref=ref,
            commit=commit,
            deployment=d.get("uid") or d.get("id"),
            url=("https://" + d["url"]) if d.get("url") else None,
        )
    except Exception as exc:
        return SourceState(provider="vercel", status="unavailable", configured=True, detail=str(exc))


def cloudflare_states() -> list[SourceState]:
    token = os.getenv("CLOUDFLARE_API_TOKEN") or os.getenv("AGENTZ_CLOUDFLARE_API_TOKEN")
    account_id = os.getenv("CLOUDFLARE_ACCOUNT_ID") or os.getenv("AGENTZ_CLOUDFLARE_ACCOUNT_ID")
    worker = os.getenv("AGENTZ_CLOUDFLARE_WORKER")
    pages_project = os.getenv("AGENTZ_CLOUDFLARE_PAGES_PROJECT")

    if not token or not account_id:
        return [_unavailable("cloudflare", "Cloudflare token/account not configured")]

    headers = {"Accept": "application/json", "Authorization": f"Bearer {token}"}
    states: list[SourceState] = []

    if worker:
        try:
            encoded_worker = urllib.parse.quote(worker, safe="")
            data = _get_json(
                f"https://api.cloudflare.com/client/v4/accounts/{account_id}/workers/scripts/{encoded_worker}/deployments",
                headers,
            )
            deployments = (data.get("result") or {}).get("deployments") or []
            if not deployments:
                states.append(SourceState(
                    provider="cloudflare-worker",
                    status="degraded",
                    configured=True,
                    ref="main",
                    detail="no deployment returned",
                ))
            else:
                latest = deployments[0]
                versions = latest.get("versions") or []
                version_ids = [v.get("version_id") for v in versions if v.get("version_id")]
                total = sum(float(v.get("percentage", 0)) for v in versions)
                states.append(SourceState(
                    provider="cloudflare-worker",
                    status="healthy" if abs(total - 100) < 0.001 else "degraded",
                    configured=True,
                    deployment=latest.get("id"),
                    detail=latest.get("created_on"),
                    version_ids=version_ids,
                ))
        except Exception as exc:
            states.append(SourceState(
                provider="cloudflare-worker",
                status="unavailable",
                configured=True,
                detail=str(exc),
            ))

    if pages_project:
        encoded_project = urllib.parse.quote(pages_project, safe="")
        try:
            data = _get_json(
                f"https://api.cloudflare.com/client/v4/accounts/{account_id}/pages/projects/{encoded_project}/deployments?per_page=1",
                headers,
            )
            deployments = data.get("result") or []
            if not deployments:
                states.append(SourceState(
                    provider="cloudflare-pages",
                    status="degraded",
                    configured=True,
                    detail="no deployment returned",
                ))
            else:
                latest = deployments[0]
                trigger = (latest.get("deployment_trigger") or {}).get("metadata") or {}
                stage_status = ((latest.get("latest_stage") or {}).get("status")) or ""
                status = "healthy" if stage_status in {"success", "idle", "active"} and not latest.get("is_skipped") else "degraded"
                states.append(SourceState(
                    provider="cloudflare-pages",
                    status=status,
                    configured=True,
                    ref=trigger.get("branch"),
                    commit=trigger.get("commit_hash"),
                    deployment=latest.get("id"),
                    url=(latest.get("aliases") or [None])[0],
                    detail=stage_status or None,
                ))
        except Exception as exc:
            states.append(SourceState(
                provider="cloudflare-pages",
                status="unavailable",
                configured=True,
                detail=str(exc),
            ))

    return states or [_unavailable("cloudflare", "Set AGENTZ_CLOUDFLARE_WORKER or AGENTZ_CLOUDFLARE_PAGES_PROJECT")]


def _relation(target: str | None, observed: str | None) -> str:
    if not target or not observed:
        return "unknown"
    return "match" if target == observed else "divergent"


def collect_state() -> dict[str, Any]:
    sources = [github_state(), gitlab_state(), vercel_state(), *cloudflare_states()]
    github = next((s for s in sources if s.provider == "github"), None)
    target_commit = github.commit if github else None

    lineage = [
        {
            "provider": s.provider,
            "relation_to_authoritative": _relation(target_commit, s.commit),
            "commit": s.commit,
            "ref": s.ref,
            "deployment": s.deployment,
        }
        for s in sources
        if s.configured
    ]

    required = [s for s in sources if s.provider in {"github", "gitlab", "vercel"}]
    configured_cloudflare = [s for s in sources if s.provider.startswith("cloudflare-") and s.configured]
    required_failures = [s for s in required if s.status != "healthy"]
    drift = [x for x in lineage if x["relation_to_authoritative"] == "divergent"]
    cloudflare_failures = [s for s in configured_cloudflare if s.status != "healthy"]

    gate_passed = not required_failures and not drift and not cloudflare_failures
    action = "deploy_eligible" if gate_passed else "blocked"
    if any(s.status == "unavailable" for s in required + configured_cloudflare):
        action = "observe_only"

    status = "healthy"
    if action != "deploy_eligible":
        status = "degraded" if action == "blocked" else "unavailable"
    if drift:
        status = "drift"

    return {
        "control_plane": "agentz",
        "status": status,
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "authoritative": {
            "provider": "github",
            "ref": github.ref if github else None,
            "commit": target_commit,
        },
        "release_gate": {
            "passed": gate_passed,
            "action_eligibility": action,
            "required_failures": [s.provider for s in required_failures],
            "cloudflare_failures": [s.provider for s in cloudflare_failures],
        },
        "sources": [asdict(s) for s in sources],
        "lineage": lineage,
        "drift": {
            "count": len(drift),
            "providers": [x["provider"] for x in drift],
            "same_commit": not drift,
        },
    }
