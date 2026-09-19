"""
AgentZ → OpenClaw bridge client.

Talks to the authichain-openclaw Cloudflare Worker at claw.authichain.com
(or CLAW_BRIDGE_URL / OPENCLAW_BRIDGE_URL). The Worker is the public control
plane; AgentZ does not need a direct WebSocket to the OpenClaw gateway.

Env (any of):
  CLAW_BRIDGE_URL / OPENCLAW_BRIDGE_URL  — default https://claw.authichain.com
  OPENCLAW_API_KEY / CLAW_BRIDGE_API_KEY — Bearer for /command, /notify, …
"""

from __future__ import annotations

import json
import os
import uuid
from dataclasses import dataclass, field
from typing import Any, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

DEFAULT_BRIDGE_URL = "https://claw.authichain.com"
DEFAULT_TIMEOUT_S = 30.0


def _env(*names: str, default: str = "") -> str:
    for name in names:
        val = (os.environ.get(name) or "").strip()
        if val:
            return val
    return default


@dataclass
class OpenClawConfig:
    bridge_url: str = DEFAULT_BRIDGE_URL
    api_key: str = ""
    timeout_s: float = DEFAULT_TIMEOUT_S

    @classmethod
    def from_env(cls) -> "OpenClawConfig":
        return cls(
            bridge_url=_env(
                "CLAW_BRIDGE_URL",
                "OPENCLAW_BRIDGE_URL",
                default=DEFAULT_BRIDGE_URL,
            ).rstrip("/"),
            api_key=_env("OPENCLAW_API_KEY", "CLAW_BRIDGE_API_KEY"),
            timeout_s=float(_env("OPENCLAW_TIMEOUT_S", default=str(DEFAULT_TIMEOUT_S))),
        )


@dataclass
class OpenClawResult:
    ok: bool
    status_code: int
    data: Any = None
    error: Optional[str] = None
    dry_run: bool = False
    request: dict[str, Any] = field(default_factory=dict)


class OpenClawClient:
    """HTTP client for the AuthiChain OpenClaw bridge Worker."""

    def __init__(self, config: Optional[OpenClawConfig] = None) -> None:
        self.config = config or OpenClawConfig.from_env()

    def _headers(self, *, auth: bool = True) -> dict[str, str]:
        headers = {"Content-Type": "application/json", "Accept": "application/json"}
        if auth and self.config.api_key:
            headers["Authorization"] = f"Bearer {self.config.api_key}"
        return headers

    def _request(
        self,
        method: str,
        path: str,
        body: Optional[dict[str, Any]] = None,
        *,
        auth: bool = True,
        dry_run: bool = False,
    ) -> OpenClawResult:
        url = f"{self.config.bridge_url}{path}"
        payload = json.dumps(body).encode("utf-8") if body is not None else None
        meta = {
            "method": method,
            "url": url,
            "auth": bool(auth and self.config.api_key),
            "body": body,
        }
        if dry_run:
            return OpenClawResult(
                ok=True,
                status_code=0,
                data={"dry_run": True, "would_request": meta},
                dry_run=True,
                request=meta,
            )

        req = Request(url, data=payload, headers=self._headers(auth=auth), method=method)
        try:
            with urlopen(req, timeout=self.config.timeout_s) as resp:
                raw = resp.read().decode("utf-8", errors="replace")
                try:
                    data = json.loads(raw) if raw else {}
                except json.JSONDecodeError:
                    data = {"raw": raw}
                return OpenClawResult(
                    ok=200 <= resp.status < 300,
                    status_code=resp.status,
                    data=data,
                    request=meta,
                )
        except HTTPError as exc:
            raw = exc.read().decode("utf-8", errors="replace") if exc.fp else ""
            try:
                data = json.loads(raw) if raw else {}
            except json.JSONDecodeError:
                data = {"raw": raw}
            return OpenClawResult(
                ok=False,
                status_code=int(exc.code),
                data=data,
                error=str(exc),
                request=meta,
            )
        except URLError as exc:
            return OpenClawResult(
                ok=False,
                status_code=0,
                error=f"unreachable: {exc.reason}",
                request=meta,
            )
        except Exception as exc:  # noqa: BLE001
            return OpenClawResult(ok=False, status_code=0, error=str(exc), request=meta)

    def health(self) -> OpenClawResult:
        """GET /health — public liveness (no auth)."""
        return self._request("GET", "/health", auth=False)

    def status(self) -> OpenClawResult:
        """Prefer GET /gateway/status; fall back to /health."""
        result = self._request("GET", "/gateway/status", auth=True)
        if result.status_code == 404:
            return self.health()
        return result

    def list_agents(self) -> OpenClawResult:
        return self._request("GET", "/agents", auth=True)

    def list_workflows(self) -> OpenClawResult:
        return self._request("GET", "/workflows", auth=True)

    def command(self, command: str, args: str = "", *, dry_run: bool = False) -> OpenClawResult:
        """POST /command — run a bridge command (agents, workflows, architect, …)."""
        return self._request(
            "POST",
            "/command",
            {"command": command, "args": args},
            auth=True,
            dry_run=dry_run,
        )

    def notify(
        self,
        text: str,
        *,
        channel: Optional[str] = None,
        to: Optional[str] = None,
        dry_run: bool = True,
        mode: str = "wake",
    ) -> OpenClawResult:
        """
        POST /notify — AgentZ → OpenClaw outbound notify via the Worker.

        Defaults to dry_run=True so CI/CLI never spam channels accidentally.
        """
        body: dict[str, Any] = {
            "text": text,
            "mode": mode,
            "idempotency_key": f"agentz-{uuid.uuid4().hex[:12]}",
        }
        if channel:
            body["channel"] = channel
        if to:
            body["to"] = to
        return self._request("POST", "/notify", body, auth=True, dry_run=dry_run)


def status_summary(client: Optional[OpenClawClient] = None) -> dict[str, Any]:
    """Machine-readable status for CLI / workflow steps."""
    client = client or OpenClawClient()
    cfg = client.config
    health = client.health()
    out: dict[str, Any] = {
        "bridge_url": cfg.bridge_url,
        "api_key_set": bool(cfg.api_key),
        "health_ok": health.ok,
        "health": health.data if health.ok else {"error": health.error, "status_code": health.status_code},
    }
    if health.ok and isinstance(health.data, dict):
        out["openclaw_gateway"] = health.data.get("openclaw_gateway")
        out["agentz_api"] = health.data.get("agentz_api")
    return out
