"""AgentZ LocalOps: zero-provider-fee, fail-closed *observation* adapters.

GitHub CLI handles deterministic release evidence; isolated Playwright/Edge
handles browser DOM inspection. Automa, Power Automate Desktop and a local
Browser Use/Ollama stack remain explicit *handoff* options. They are never
silently started, given credentials, or used to approve a release.

This module intentionally has NO write-capable GitHub, browser, Stripe,
Cloudflare, outbound messaging, or deployment operation.
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import importlib.util
import ipaddress
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urlsplit

REPO_RE = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")
SHA_RE = re.compile(r"^[a-f0-9]{40}$")
DEFAULT_REPO = "undone0603/authichain-unified"
TARGET_ENV = "production-cloudflare"
SECRET_NAMES = frozenset({
    "AUTHICHAIN_PRODUCTION_CLOUDFLARE_ACCOUNT_ID",
    "AUTHICHAIN_PRODUCTION_CLOUDFLARE_API_TOKEN",
})
CI_CONTEXTS = frozenset(f"ci/circleci: {name}" for name in (
    "test-workers", "test-other", "build", "extras", "quality",
    "typecheck-ratchet", "main-quality-gate",
))
# Default browser targets are the user's own public estate and GitHub.
BROWSER_ORIGINS = frozenset({
    "https://authichain.com", "https://github.com",
    "https://qron.space", "https://govchain.us", "https://strainchain.io",
})
PROVIDERS = (
    {"id": "github_cli", "use": "deterministic GitHub API inspection", "execution": "read_only"},
    {"id": "playwright_edge", "use": "isolated Edge DOM inspection and digest", "execution": "read_only"},
    {"id": "automa", "use": "visual browser workflow templates", "execution": "human_handoff"},
    {"id": "power_automate_desktop", "use": "attended Windows UI workflows", "execution": "human_handoff"},
    {"id": "browser_use_ollama", "use": "local-model browser task proposals", "execution": "human_handoff"},
)


class LocalOpsError(Exception):
    """Denial or failed preflight; never include remote responses or secrets."""


def validate_repo(repo: str) -> str:
    if not REPO_RE.fullmatch(repo) or ".." in repo or repo.startswith("-"):
        raise LocalOpsError("repository must be an explicit owner/name")
    return repo


def validate_sha(sha: str) -> str:
    if not SHA_RE.fullmatch(sha):
        raise LocalOpsError("expected SHA must be a full lowercase 40-hex commit")
    return sha


def safe_browser_url(url: str, origins: frozenset[str] = BROWSER_ORIGINS) -> str:
    if not isinstance(url, str) or len(url) > 2048 or any(ord(c) < 32 or ord(c) == 127 for c in url):
        raise LocalOpsError("invalid browser URL")
    try:
        parsed = urlsplit(url)
        hostname = parsed.hostname
        port = parsed.port
    except ValueError as exc:
        raise LocalOpsError("invalid browser URL") from exc
    if parsed.scheme != "https" or not hostname or parsed.username or parsed.password or parsed.fragment:
        raise LocalOpsError("only explicit public HTTPS URLs without credentials or fragments")
    if port not in (None, 443) or hostname.endswith(".") or hostname.endswith((".local", ".internal")):
        raise LocalOpsError("disallowed browser host or port")
    try:
        ipaddress.ip_address(hostname)
    except ValueError:
        pass
    else:
        raise LocalOpsError("numeric IP browser hosts are not allowed")
    origin = f"https://{hostname.lower()}"
    if origin not in origins:
        raise LocalOpsError("browser origin is not in AgentZ's explicit allowlist")
    return url


def doctor() -> dict[str, Any]:
    """Non-invasive local capability check; does not open sockets or run tools."""
    return {
        "mode": "observe_only", "provider_charges_authorized_usd": 0,
        "providers": [
            {**p, "available": (
                bool(shutil.which("gh")) if p["id"] == "github_cli" else
                "library_installed_edge_unverified" if importlib.util.find_spec("playwright") else False
                if p["id"] == "playwright_edge" else
                "manual_setup_required"
            )} for p in PROVIDERS
        ],
        "capabilities": {"github_mutation": False, "browser_mutation": False,
                         "payment": False, "production_deploy": False,
                         "autonomous_messages": False},
    }


def plan(kind: str, *, repo: str = DEFAULT_REPO, sha: str | None = None,
         url: str | None = None) -> dict[str, Any]:
    if kind == "github-release":
        validate_repo(repo)
        if sha is None:
            raise LocalOpsError("github-release requires --sha")
        validate_sha(sha)
        return {"task": kind, "provider": "github_cli", "execution": "read_only",
                "repository": repo, "expected_sha": sha,
                "requires": ["authenticated local gh CLI for GET requests"],
                "prohibited": ["merges", "dispatch", "environment writes", "secret writes",
                               "deploy", "charge", "review impersonation"],
                "next": "python -m agentz.cli localops github-audit --repo ... --sha ...",
                "provider_charges_authorized_usd": 0}
    if kind == "browser-inspect":
        if url is None:
            raise LocalOpsError("browser-inspect requires --url")
        safe_browser_url(url)
        return {"task": kind, "provider": "playwright_edge", "execution": "read_only",
                "url_sha256": hashlib.sha256(url.encode()).hexdigest(),
                "origin": f"https://{urlsplit(url).hostname}",
                "requires": ["Python playwright and locally installed Microsoft Edge"],
                "alternatives": ["automa (human handoff)", "power_automate_desktop (human handoff)",
                                 "browser_use_ollama (local-model human handoff)"],
                "prohibited": ["clicks", "form submissions", "saved browser profiles",
                               "cross-origin fetch", "downloads", "payments", "deploys"],
                "provider_charges_authorized_usd": 0}
    raise LocalOpsError("unsupported task; use github-release or browser-inspect")


def _gh_get(path: str) -> dict[str, Any]:
    """Fixed-method API client; no arbitrary gh CLI flags or mutation methods."""
    if not shutil.which("gh"):
        raise LocalOpsError("gh CLI is not installed on this host")
    try:
        p = subprocess.run(
            ["gh", "api", "--method", "GET", path],
            capture_output=True, text=True, timeout=25, check=False,
            env={**os.environ, "GH_PROMPT_DISABLED": "1"},
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise LocalOpsError(f"GitHub read unavailable ({type(exc).__name__})") from None
    if p.returncode != 0:
        # Do not echo stderr: it may expose authenticated URL/query details.
        raise LocalOpsError("GitHub API GET failed or access denied")
    try:
        payload = json.loads(p.stdout)
    except (json.JSONDecodeError, TypeError):
        raise LocalOpsError("GitHub returned invalid JSON") from None
    if not isinstance(payload, dict):
        raise LocalOpsError("GitHub returned an unexpected payload")
    return payload


def github_release_audit(repo: str, sha: str,
                         reader: Callable[[str], dict[str, Any]] = _gh_get) -> dict[str, Any]:
    """Read-only, fail-closed preflight with no ability to issue approvals.

    A green preflight never implies deployment authorization. Admin-bypass and
    true independence require human review, not assumptions from REST fields.
    """
    repo, sha = validate_repo(repo), validate_sha(sha)
    issues: list[str] = []
    observed: dict[str, Any] = {"main_matches_expected": False,
                                "seven_exact_head_checks_green": False,
                                "environment_exists": False,
                                "protected_branches_only": False,
                                "self_review_prevented": False,
                                "reviewers_configured": False,
                                "exactly_two_scoped_secrets": False,
                                "admin_bypass_disabled": "requires_separate_verification",
                                "reviewer_independence": "requires_separate_verification"}
    # Fail early on wrong main SHA; do not inspect unrelated commit/environments.
    try:
        branch = reader(f"repos/{repo}/branches/main")
    except LocalOpsError:
        issues.append("current_main_unreadable")
        return _audit_result(repo, sha, observed, issues)
    observed["main_matches_expected"] = branch.get("commit", {}).get("sha") == sha
    if not observed["main_matches_expected"]:
        issues.append("expected_sha_not_current_main")
        return _audit_result(repo, sha, observed, issues)
    try:
        status = reader(f"repos/{repo}/commits/{sha}/status")
        states = {s.get("context"): s.get("state") for s in status.get("statuses", [])
                  if isinstance(s, dict)}
        observed["seven_exact_head_checks_green"] = all(states.get(c) == "success" for c in CI_CONTEXTS)
        if not observed["seven_exact_head_checks_green"]:
            issues.append("required_exact_head_ci_missing_or_failing")
    except LocalOpsError:
        issues.append("exact_head_ci_unreadable")
    try:
        environment = reader(f"repos/{repo}/environments/{TARGET_ENV}")
    except LocalOpsError:
        issues.append("target_environment_missing_or_unreadable")
        return _audit_result(repo, sha, observed, issues)
    observed["environment_exists"] = environment.get("name") == TARGET_ENV
    if not observed["environment_exists"]:
        issues.append("environment_identity_mismatch")
        return _audit_result(repo, sha, observed, issues)
    branch_policy = environment.get("deployment_branch_policy") or {}
    observed["protected_branches_only"] = (branch_policy.get("protected_branches") is True
                                            and branch_policy.get("custom_branch_policies") is False)
    if not observed["protected_branches_only"]:
        issues.append("deployment_branch_policy_not_protected")
    review_rules = [r for r in environment.get("protection_rules", [])
                    if isinstance(r, dict) and r.get("type") == "required_reviewers"]
    observed["reviewers_configured"] = any(len(r.get("reviewers", [])) > 0 for r in review_rules)
    observed["self_review_prevented"] = any(r.get("prevent_self_review") is True for r in review_rules)
    if not observed["reviewers_configured"]:
        issues.append("required_reviewers_missing")
    if not observed["self_review_prevented"]:
        issues.append("self_review_not_prevented")
    # The public REST environment representation may omit admin-bypass state.
    # Even if present, independence cannot be inferred from a username.
    if environment.get("can_admins_bypass") is False:
        observed["admin_bypass_disabled"] = True
    else:
        issues.append("administrator_bypass_not_independently_verified")
    issues.append("independent_reviewer_attestation_required")
    try:
        secret_data = reader(f"repos/{repo}/environments/{TARGET_ENV}/secrets")
        names = {s.get("name") for s in secret_data.get("secrets", []) if isinstance(s, dict)}
        observed["exactly_two_scoped_secrets"] = names == SECRET_NAMES and secret_data.get("total_count") == 2
        if not observed["exactly_two_scoped_secrets"]:
            issues.append("environment_secret_names_not_exactly_two")
    except LocalOpsError:
        issues.append("environment_secret_names_unreadable")
    return _audit_result(repo, sha, observed, issues)


def _audit_result(repo: str, sha: str, observed: dict[str, Any], issues: list[str]) -> dict[str, Any]:
    return {"task": "github-release", "repository": repo, "expected_sha": sha,
            "checked_at": datetime.now(timezone.utc).isoformat(),
            "status": "blocked" if issues else "observed_not_authorized",
            "issues": sorted(set(issues)), "observed": observed,
            "writes_executed": 0, "deployments_triggered": 0,
            "provider_charges_authorized_usd": 0}


def _append_audit(path: Path, event: dict[str, Any]) -> None:
    """Append small redacted evidence, never API response bodies or page HTML."""
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    safe = {k: v for k, v in event.items() if k not in {"html", "body", "secrets", "raw_url", "token"}}
    encoded = (json.dumps(safe, sort_keys=True, separators=(",", ":")) + "\n").encode()
    flags = os.O_APPEND | os.O_CREAT | os.O_WRONLY
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    fd = os.open(path, flags, 0o600)
    try:
        os.write(fd, encoded)
    finally:
        os.close(fd)


async def browser_inspect(url: str) -> dict[str, Any]:
    """Inspect public pages in a fresh unauthenticated Edge context.

    Every network request is limited to same-origin GET/HEAD/OPTIONS. There are
    no clicks, posts, downloads, profile reuse, or LLM-generated instructions.
    """
    safe_browser_url(url)
    origin = f"https://{urlsplit(url).hostname.lower()}"
    try:
        from playwright.async_api import async_playwright
    except ImportError as exc:
        raise LocalOpsError("install optional local Playwright and Microsoft Edge") from exc
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(channel="msedge", headless=True)
        try:
            context = await browser.new_context(accept_downloads=False, service_workers="block")
            async def guard(route: Any) -> None:
                request = route.request
                target = request.url
                allowed = (request.method.upper() in {"GET", "HEAD", "OPTIONS"}
                           and urlsplit(target).scheme == "https"
                           and urlsplit(target).port in (None, 443)
                           and f"https://{urlsplit(target).hostname}" == origin)
                if allowed:
                    await route.continue_()
                else:
                    await route.abort()
            await context.route("**/*", guard)
            page = await context.new_page()
            try:
                response = await page.goto(url, wait_until="domcontentloaded", timeout=15000)
                safe_browser_url(page.url, frozenset({origin}))
                html = await page.content()
                return {"task": "browser-inspect", "provider": "playwright_edge",
                        "status": "observed", "http_status": response.status if response else None,
                        "page_title": (await page.title())[:120],
                        "dom_sha256": hashlib.sha256(html.encode()).hexdigest(),
                        "url_sha256": hashlib.sha256(url.encode()).hexdigest(),
                        "checked_at": datetime.now(timezone.utc).isoformat(),
                        "writes_executed": 0, "deployments_triggered": 0,
                        "provider_charges_authorized_usd": 0}
            finally:
                await context.close()
        finally:
            await browser.close()


def handoff(provider: str, url: str) -> dict[str, Any]:
    if provider not in {"automa", "power_automate_desktop", "browser_use_ollama"}:
        raise LocalOpsError("unknown manual provider")
    safe_browser_url(url)
    return {"provider": provider, "execution": "manual_handoff_only",
            "target_origin": f"https://{urlsplit(url).hostname}",
            "task": "read-only page inspection",
            "instructions": "Open the URL in a dedicated no-secrets profile. Read visible status only. Do not click, type, purchase or send.",
            "untrusted_content": True, "automation_executed": False,
            "require_user_approval_for_actions": True,
            "model_output_is_not_approval": True,
            "provider_charges_authorized_usd": 0}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="agentz localops", description="Safe local automation and release inspection")
    sub = parser.add_subparsers(dest="action", required=True)
    sub.add_parser("doctor")
    p = sub.add_parser("plan")
    p.add_argument("--task", choices=["github-release", "browser-inspect"], required=True)
    p.add_argument("--repo", default=DEFAULT_REPO)
    p.add_argument("--sha")
    p.add_argument("--url")
    a = sub.add_parser("github-audit")
    a.add_argument("--repo", default=DEFAULT_REPO)
    a.add_argument("--sha", required=True)
    a.add_argument("--audit-path", type=Path)
    b = sub.add_parser("browser-inspect")
    b.add_argument("--url", required=True)
    b.add_argument("--audit-path", type=Path)
    h = sub.add_parser("handoff")
    h.add_argument("--provider", choices=["automa", "power_automate_desktop", "browser_use_ollama"], required=True)
    h.add_argument("--url", required=True)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        if args.action == "doctor":
            result = doctor()
        elif args.action == "plan":
            result = plan(args.task, repo=args.repo, sha=args.sha, url=args.url)
        elif args.action == "github-audit":
            result = github_release_audit(args.repo, args.sha)
        elif args.action == "browser-inspect":
            result = asyncio.run(browser_inspect(args.url))
        elif args.action == "handoff":
            result = handoff(args.provider, args.url)
        else:
            raise LocalOpsError("unknown action")
        if getattr(args, "audit_path", None) is not None:
            _append_audit(args.audit_path, result)
        print(json.dumps(result, indent=2, sort_keys=True))
        return 2 if result.get("status") == "blocked" else 0
    except LocalOpsError as exc:
        print(json.dumps({"ok": False, "error": str(exc), "writes_executed": 0}), file=sys.stderr)
        return 2
    except Exception as exc:
        # Browser and local tool errors may contain private page text; redact.
        print(json.dumps({"ok": False, "error": "local provider execution failed",
                          "error_type": type(exc).__name__, "writes_executed": 0}), file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
