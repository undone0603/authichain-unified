"""Zero-spend AgentZ Glama Inspector audit, using an isolated local Chromium.

The browser only visits Glama's public inspector. A separately allowlisted,
no-payment script tests AuthiChain's MCP JSON-RPC transport. Neither component
reads a saved browser profile, auth token, wallet, database, or API key.

Invoke through the AgentZ registry, in confirm mode:
  python -m agentz.cli run glama_browser_audit --mode confirm
"""
from __future__ import annotations

from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
from urllib.parse import urlsplit
from typing import Any

INSPECTOR_URL = "https://glama.ai/mcp/inspector"
MCP_URL = "https://authichain.com/mcp"
REPO_ROOT = Path(__file__).resolve().parents[3]
EVIDENCE_DIR = REPO_ROOT / "agentz" / "logs" / "glama-browser"
SMOKE_SCRIPT = REPO_ROOT / "scripts" / "ci" / "glama-mcp-free-smoke.mjs"


def is_allowed_browser_request(url: str, method: str) -> bool:
    """Allow only read-only requests on the Glama first-party origin and CDN."""
    if method.upper() not in {"GET", "HEAD", "OPTIONS"}:
        return False
    parts = urlsplit(url)
    return (
        parts.scheme == "https"
        and parts.username is None
        and parts.password is None
        and (parts.hostname == "glama.ai" or (parts.hostname or "").endswith(".glama.ai"))
    )


def guard_browser_route(route: Any) -> None:
    request = route.request
    if is_allowed_browser_request(request.url, request.method):
        route.continue_()
    else:
        route.abort()


def inspect_public_glama(*, screenshot: Path | None = None) -> dict[str, Any]:
    """Open public Inspector in a *new*, unauthenticated, read-only browser."""
    from playwright.sync_api import sync_playwright

    with sync_playwright() as playwright:
        try:
            browser = playwright.chromium.launch(headless=True)
        except Exception:
            # Reuse already-installed system Chromium on a self-hosted WSL box;
            # do not download a browser or use an existing profile.
            binary = shutil.which("chromium") or shutil.which("chromium-browser")
            if not binary:
                raise
            browser = playwright.chromium.launch(headless=True, executable_path=binary)
        try:
            context = browser.new_context(accept_downloads=False, service_workers="block")
            page = context.new_page()
            page.route("**/*", guard_browser_route)
            response = page.goto(INSPECTOR_URL, wait_until="domcontentloaded", timeout=25000)
            status = response.status if response else None
            title = page.title()[:120]
            body = page.locator("body").inner_text(timeout=5000)[:6000]
            has_inspector = "MCP Inspector" in title or "MCP Inspector" in body
            has_server_ui = bool(re.search(r"Add Server|Connect", body, re.IGNORECASE))
            if screenshot:
                screenshot.parent.mkdir(parents=True, exist_ok=True)
                page.screenshot(path=str(screenshot), full_page=False)
            context.close()
            return {
                "inspector_url": INSPECTOR_URL,
                "http_status": status,
                "title": title,
                "inspector_visible": has_inspector,
                "connection_controls_visible": has_server_ui,
                "browser_passed": status == 200 and has_inspector,
                "authenticated": False,
                "ui_actions": ["navigate", "inspect_text"],
            }
        finally:
            browser.close()


def run_free_mcp_smoke() -> dict[str, Any]:
    """Run only the pre-reviewed static allowlist of four no-payment calls."""
    if not SMOKE_SCRIPT.is_file():
        return {"ok": False, "reason": "missing_free_smoke_script"}
    node = shutil.which("node")
    if not node:
        return {"ok": False, "reason": "node_unavailable"}
    # Clear inherited environment, including API keys, wallets, proxy secrets,
    # and NODE_OPTIONS. The checked-in smoke never reads other files/credentials.
    env = {"PATH": os.path.dirname(node), "REQUIRE_MCP_HINTS": "0"}
    try:
        completed = subprocess.run(
            [node, str(SMOKE_SCRIPT)],
            cwd=REPO_ROOT,
            env=env,
            text=True,
            capture_output=True,
            timeout=60,
            check=False,
        )
    except subprocess.TimeoutExpired:
        return {"ok": False, "reason": "smoke_timeout"}
    if completed.returncode:
        # Don't echo stderr/page content into a persistent evidence record.
        return {"ok": False, "reason": "mcp_smoke_failed", "exit_code": completed.returncode}
    # Script prints four PASS lines followed by final JSON object.
    text = completed.stdout
    start = text.rfind('\n{')
    if start < 0:
        return {"ok": False, "reason": "smoke_evidence_missing"}
    try:
        payload = json.loads(text[start + 1:])
    except (ValueError, TypeError):
        return {"ok": False, "reason": "smoke_evidence_invalid"}
    if (
        payload.get("ok") is not True
        or payload.get("endpoint") != MCP_URL
        or payload.get("paidCalls") != 0
        or payload.get("settlementAttempts") != 0
        or payload.get("toolCount") != 8
    ):
        return {"ok": False, "reason": "smoke_evidence_unexpected"}
    return {
        "ok": True,
        "endpoint": MCP_URL,
        "server_version": payload.get("serverVersion"),
        "protocol_version": payload.get("protocolVersion"),
        "tool_count": 8,
        "paid_calls": 0,
        "settlement_attempts": 0,
    }


def collect_evidence(*, evidence_dir: Path = EVIDENCE_DIR) -> dict[str, Any]:
    """Save allowlisted, non-sensitive observed evidence; unknown stays unknown."""
    started = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    evidence_dir.mkdir(parents=True, exist_ok=True)
    filename = started.replace(":", "-")
    screenshot = evidence_dir / f"{filename}.png"
    try:
        browser = inspect_public_glama(screenshot=screenshot)
    except Exception as exc:
        # Avoid persisting exception strings because they could include URLs.
        browser = {"browser_passed": False, "error_type": type(exc).__name__}
    smoke = run_free_mcp_smoke()
    result = {
        "run_started_utc": started,
        "task": "glama_browser_audit",
        "browser": browser,
        "mcp_smoke": smoke,
        "glama_profile_saved": False,
        "paid_actions": 0,
        "production_deployed": False,
        "ok": browser.get("browser_passed") is True and smoke.get("ok") is True,
    }
    output = evidence_dir / f"{filename}.json"
    output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    result["evidence_path"] = str(output)
    return result


def run(ctx: Any) -> dict[str, str]:
    """AgentZ registry handler. No auto mode; confirmation is explicit."""
    mode = getattr(getattr(ctx, "mode", None), "value", "")
    if mode == "dry-run":
        return {"status": "skipped", "notes": "Would inspect public Glama and run no-payment MCP smoke; no browser opened"}
    if mode != "confirm":
        return {"status": "blocked", "notes": "Only confirm mode is authorized"}
    result = ctx.step(
        "Run isolated local browser audit of public Glama Inspector and free AuthiChain MCP metadata (no login/payment)",
        action=collect_evidence,
    )
    if result is None:
        return {"status": "skipped", "notes": "Operator declined browser audit"}
    return {
        "status": "ok" if result["ok"] else "failed",
        "notes": "Local evidence: " + result["evidence_path"] + ("; both checks passed" if result["ok"] else "; at least one check unresolved"),
    }
