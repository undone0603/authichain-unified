#!/usr/bin/env python3
"""Smoke claw + AgentZ without sending cold email or inventing gateway URLs.

Public hosts (not secrets):
  CLAW_URL        default https://claw.authichain.com
  AGENTZ_API_URL  default https://agentz.authichain.com

Auth (Actions/Cloudflare secrets — never invent values):
  OPENCLAW_API_KEY / AGENTZ_API_KEY / AGENT_SECRET / CLAW_BRIDGE_API_KEY
  Optional Access service token: CF_ACCESS_CLIENT_ID + CF_ACCESS_CLIENT_SECRET
    (aliases: CLOUDFLARE_ACCESS_CLIENT_ID / CLOUDFLARE_ACCESS_CLIENT_SECRET)

Does not read or set OPENCLAW_GATEWAY_URL. Architect is dry-run only.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from typing import Any
from urllib.parse import urlparse

DEFAULT_CLAW_URL = "https://claw.authichain.com"
DEFAULT_AGENTZ_URL = "https://agentz.authichain.com"
ALLOWED_ARCHITECT_MODES = frozenset({"dry-run"})
BEARER_SECRET_NAMES = (
    "OPENCLAW_API_KEY",
    "AGENTZ_API_KEY",
    "AGENT_SECRET",
    "CLAW_BRIDGE_API_KEY",
)
ACCESS_ID_NAMES = ("CF_ACCESS_CLIENT_ID", "CLOUDFLARE_ACCESS_CLIENT_ID")
ACCESS_SECRET_NAMES = ("CF_ACCESS_CLIENT_SECRET", "CLOUDFLARE_ACCESS_CLIENT_SECRET")


def _env_first(*names: str) -> str:
    for name in names:
        val = (os.environ.get(name) or "").strip()
        if val:
            return val
    return ""


def claw_url() -> str:
    return (_env_first("CLAW_URL", "CLAW_BRIDGE_URL", "OPENCLAW_BRIDGE_URL") or DEFAULT_CLAW_URL).rstrip(
        "/"
    )


def agentz_url() -> str:
    return (_env_first("AGENTZ_API_URL") or DEFAULT_AGENTZ_URL).rstrip("/")


def require_https_public_host(url: str, *, label: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme != "https":
        raise SystemExit(f"{label} must be https (got {parsed.scheme or 'empty'})")
    host = (parsed.hostname or "").lower()
    if host in {"localhost", "127.0.0.1", "0.0.0.0"} or host.endswith(".local"):
        raise SystemExit(f"{label} must be a public host, not {host}")
    if "trycloudflare.com" in host:
        raise SystemExit(f"{label} must not be a trycloudflare smoke URL")


def access_headers() -> dict[str, str]:
    client_id = _env_first(*ACCESS_ID_NAMES)
    client_secret = _env_first(*ACCESS_SECRET_NAMES)
    if client_id and client_secret:
        return {
            "CF-Access-Client-Id": client_id,
            "CF-Access-Client-Secret": client_secret,
        }
    return {}


def bearer_token() -> str:
    return _env_first(*BEARER_SECRET_NAMES)


def request_json(
    method: str,
    url: str,
    *,
    body: dict[str, Any] | None = None,
    auth: bool = False,
    timeout_s: float = 30.0,
) -> tuple[int, Any]:
    headers = {
        "Accept": "application/json",
        "User-Agent": "authichain-agentz-orchestration-ping",
        **access_headers(),
    }
    if body is not None:
        headers["Content-Type"] = "application/json"
    if auth:
        token = bearer_token()
        if not token:
            raise SystemExit(
                "missing bearer secret for authenticated call. "
                f"Set one of: {', '.join(BEARER_SECRET_NAMES)}"
            )
        headers["Authorization"] = f"Bearer {token}"

    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            payload: Any
            try:
                payload = json.loads(raw) if raw else {}
            except json.JSONDecodeError:
                payload = {"raw": raw[:500]}
            return int(resp.status), payload
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace") if exc.fp else ""
        if exc.code in (301, 302, 303, 307, 308):
            loc = exc.headers.get("Location", "")
            if "cloudflareaccess.com" in loc:
                raise SystemExit(
                    f"{url} is behind Cloudflare Access (HTTP {exc.code}). "
                    "Set repo secrets CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET "
                    "(Access service token) if Actions should call this host."
                ) from exc
        try:
            payload = json.loads(raw) if raw else {"raw": raw[:500]}
        except json.JSONDecodeError:
            payload = {"raw": raw[:500]}
        return int(exc.code), payload


def ping_health() -> dict[str, Any]:
    claw = claw_url()
    agentz = agentz_url()
    require_https_public_host(claw, label="CLAW_URL")
    require_https_public_host(agentz, label="AGENTZ_API_URL")

    claw_status, claw_body = request_json("GET", f"{claw}/health")
    agentz_status, agentz_body = request_json("GET", f"{agentz}/health")

    out = {
        "claw_url": claw,
        "agentz_url": agentz,
        "openclaw_gateway_url_set_in_job": bool(_env_first("OPENCLAW_GATEWAY_URL")),
        "claw_health": {"http": claw_status, "body": claw_body},
        "agentz_health": {"http": agentz_status, "body": agentz_body},
    }

    if claw_status != 200 or not isinstance(claw_body, dict) or claw_body.get("status") != "ok":
        raise SystemExit(f"claw /health failed: HTTP {claw_status} {claw_body}")
    if claw_body.get("service") != "authichain-openclaw":
        raise SystemExit(f"claw /health unexpected service: {claw_body.get('service')}")
    if claw_body.get("agentz_api") != "configured":
        raise SystemExit(
            "claw reports agentz_api != configured. Bind AGENTZ_API_URL on "
            "authichain-openclaw (https://agentz.authichain.com) — do not invent "
            "OPENCLAW_GATEWAY_URL."
        )
    if agentz_status != 200 or not isinstance(agentz_body, dict):
        raise SystemExit(f"agentz /health failed: HTTP {agentz_status} {agentz_body}")
    if agentz_body.get("status") != "sovereign":
        raise SystemExit(f"agentz /health unexpected: {agentz_body}")
    return out


def architect_dry_run(*, goal: str) -> dict[str, Any]:
    claw = claw_url()
    require_https_public_host(claw, label="CLAW_URL")
    status, body = request_json(
        "POST",
        f"{claw}/architect/cycle",
        body={
            "mode": "dry-run",
            "goal": goal,
        },
        auth=True,
        timeout_s=60.0,
    )
    return {"http": status, "body": body}


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "--health-only",
        action="store_true",
        help="Only GET /health on claw and AgentZ (no architect call)",
    )
    p.add_argument(
        "--architect",
        action="store_true",
        help="Also POST claw /architect/cycle in dry-run (requires a bearer secret)",
    )
    p.add_argument(
        "--mode",
        default="dry-run",
        help="Architect mode. Only dry-run is allowed from this script.",
    )
    p.add_argument(
        "--goal",
        default="Orchestration smoke — assess fleet health. Do not send email or publish social.",
    )
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    if args.mode not in ALLOWED_ARCHITECT_MODES:
        print(
            f"refusing architect mode={args.mode!r}; only dry-run is allowed "
            "(no auto / confirm from Actions orchestration)",
            file=sys.stderr,
        )
        return 2

    report = ping_health()
    if args.architect and not args.health_only:
        report["architect"] = architect_dry_run(goal=args.goal)
        http = report["architect"]["http"]
        if http >= 400:
            print(json.dumps(report, indent=2))
            print(f"architect dry-run failed HTTP {http}", file=sys.stderr)
            return 1
    elif not args.health_only and not args.architect:
        # Default: health. Architect is opt-in so a missing Actions key
        # does not fail the first enablement smoke.
        report["architect"] = "skipped_health_only_default"

    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
