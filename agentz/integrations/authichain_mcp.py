"""AgentZ adapter for AuthiChain's free hosted MCP server.

Reads agentz/capabilities/registry.yaml, discovers the live tool list at the
hosted endpoint, reports drift between the two, and invokes a tool only when
every gate agrees:

1. the registry entry exists, is AVAILABLE and has agentz_executable: true;
2. agentz.core.capability_policy allows its policy capability autonomously;
3. the live server lists the tool with readOnlyHint=true and destructiveHint=false;
4. the arguments validate against the live inputSchema.

Nothing here signs, pays, writes, or runs a verifier on the AgentZ host. Paid,
financial and host-executable capabilities stay non-executable in the registry.
"""
from __future__ import annotations

import json
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

import yaml

from agentz.core.capability_policy import decide

REGISTRY_PATH = Path(__file__).resolve().parents[1] / "capabilities" / "registry.yaml"
STATUSES = frozenset({"AVAILABLE", "INTEGRATION_READY", "PARTIAL", "BLOCKED", "PROPOSED"})
REQUIRED_FIELDS = ("id", "name", "purpose", "source", "entrypoint", "risk",
                   "policy_capability", "status", "agentz_executable")
MAX_ATTEMPTS = 3
DEFAULT_TIMEOUT_S = 15.0

# A transport takes a JSON-RPC payload and returns (http_status, parsed_body).
Transport = Callable[[dict[str, Any]], tuple[int, Any]]


class CapabilityError(Exception):
    """Structured refusal or failure. `code` is stable for callers and tests."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code

    def as_dict(self) -> dict[str, str]:
        return {"error": self.code, "message": str(self)}


@dataclass(frozen=True)
class Registry:
    endpoint: str
    revision: str
    capabilities: dict[str, dict[str, Any]] = field(default_factory=dict)

    def by_tool(self) -> dict[str, dict[str, Any]]:
        return {c["entrypoint"]["tool"]: c for c in self.capabilities.values()
                if c["entrypoint"].get("adapter") == "mcp"}


def load_registry(path: Path = REGISTRY_PATH) -> Registry:
    """Load and validate the registry. Invalid entries fail loudly, never silently."""
    data = yaml.safe_load(Path(path).read_text(encoding="utf-8"))
    if not isinstance(data, dict) or data.get("schema_version") != 1:
        raise CapabilityError("registry_invalid", "unsupported registry schema_version")
    caps: dict[str, dict[str, Any]] = {}
    for entry in data.get("capabilities") or []:
        missing = [f for f in REQUIRED_FIELDS if f not in entry]
        if missing:
            raise CapabilityError("registry_invalid", f"{entry.get('id')}: missing {missing}")
        cid = entry["id"]
        if cid in caps:
            raise CapabilityError("registry_invalid", f"duplicate capability id {cid}")
        if entry["status"] not in STATUSES:
            raise CapabilityError("registry_invalid", f"{cid}: bad status {entry['status']}")
        if entry["agentz_executable"]:
            if entry["status"] != "AVAILABLE" or entry["risk"] != "read_only":
                raise CapabilityError(
                    "registry_invalid",
                    f"{cid}: only AVAILABLE read_only entries may be agentz_executable")
            if not decide(entry["policy_capability"]).allowed:
                raise CapabilityError(
                    "registry_invalid",
                    f"{cid}: policy capability {entry['policy_capability']} is governed")
        if entry["status"] == "BLOCKED" and not entry.get("blocker"):
            raise CapabilityError("registry_invalid", f"{cid}: BLOCKED needs a blocker")
        caps[cid] = entry
    return Registry(endpoint=data["hosted_mcp_endpoint"],
                    revision=data["baseline_revision"], capabilities=caps)


def httpx_transport(endpoint: str, timeout: float = DEFAULT_TIMEOUT_S) -> Transport:
    import httpx

    def send(payload: dict[str, Any]) -> tuple[int, Any]:
        resp = httpx.post(
            endpoint, json=payload, timeout=timeout,
            headers={"accept": "application/json, text/event-stream",
                     "user-agent": "agentz-capability-client/1"})
        try:
            body = resp.json()
        except ValueError:
            body = None
        return resp.status_code, body

    return send


class HostedMCPClient:
    def __init__(self, registry: Registry, transport: Transport | None = None,
                 sleep: Callable[[float], None] = time.sleep):
        self.registry = registry
        self.transport = transport or httpx_transport(registry.endpoint)
        self.sleep = sleep
        self._tools: dict[str, dict[str, Any]] | None = None

    def _rpc(self, method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        payload = {"jsonrpc": "2.0", "id": str(uuid.uuid4()), "method": method,
                   "params": params or {}}
        last = "no attempt made"
        for attempt in range(MAX_ATTEMPTS):
            try:
                status, body = self.transport(payload)
            except Exception as exc:  # network error: retry; every call here is read-only
                last = f"transport error: {type(exc).__name__}"
            else:
                if status >= 500 or status == 429:
                    last = f"http {status}"
                elif status != 200 or not isinstance(body, dict):
                    raise CapabilityError("upstream_rejected", f"http {status}")
                elif "error" in body:
                    err = body["error"] or {}
                    raise CapabilityError("rpc_error", str(err.get("message", err))[:300])
                else:
                    return body.get("result") or {}
            if attempt < MAX_ATTEMPTS - 1:
                self.sleep(0.5 * 2 ** attempt)
        raise CapabilityError("upstream_unavailable", last)

    def discover(self, refresh: bool = False) -> dict[str, dict[str, Any]]:
        if self._tools is None or refresh:
            tools = self._rpc("tools/list").get("tools") or []
            self._tools = {t["name"]: t for t in tools if isinstance(t, dict) and "name" in t}
        return self._tools

    def drift(self) -> dict[str, list[str]]:
        """Compare the live tool list with the registry. Empty lists mean no drift."""
        live = self.discover()
        registered = self.registry.by_tool()
        unsafe = []
        for name, cap in registered.items():
            if cap["agentz_executable"] and name in live and not _read_only(live[name]):
                unsafe.append(name)
        return {
            "unregistered_live_tools": sorted(set(live) - set(registered)),
            "registered_but_not_live": sorted(set(registered) - set(live)),
            "executable_but_live_not_read_only": sorted(unsafe),
        }

    def call(self, capability_id: str, arguments: dict[str, Any] | None = None) -> dict[str, Any]:
        arguments = arguments or {}
        cap = self.registry.capabilities.get(capability_id)
        if cap is None:
            raise CapabilityError("unknown_capability", capability_id)
        if cap["entrypoint"].get("adapter") != "mcp":
            raise CapabilityError("wrong_adapter", f"{capability_id} is not a hosted MCP tool")
        if not cap["agentz_executable"] or cap["status"] != "AVAILABLE":
            raise CapabilityError(
                "not_executable", cap.get("blocker") or f"status {cap['status']}")
        decision = decide(cap["policy_capability"])
        if not decision.allowed:
            raise CapabilityError("policy_refused", decision.reason)
        tool_name = cap["entrypoint"]["tool"]
        tool = self.discover().get(tool_name)
        if tool is None:
            raise CapabilityError("not_live", f"{tool_name} is not in the live tool list")
        if not _read_only(tool):
            raise CapabilityError("live_not_read_only",
                                  f"{tool_name} live annotations are not read-only")
        _validate(tool.get("inputSchema") or {"type": "object"}, arguments)

        started = time.monotonic()
        result = self._rpc("tools/call", {"name": tool_name, "arguments": arguments})
        return {
            "capability_id": capability_id,
            "tool": tool_name,
            "ok": not result.get("isError", False),
            "result": _content(result),
            "endpoint": self.registry.endpoint,
            "registry_revision": self.registry.revision,
            "elapsed_ms": round((time.monotonic() - started) * 1000),
        }


def _read_only(tool: dict[str, Any]) -> bool:
    ann = tool.get("annotations") or {}
    return ann.get("readOnlyHint") is True and ann.get("destructiveHint") is False


def _validate(schema: dict[str, Any], arguments: dict[str, Any]) -> None:
    import jsonschema

    try:
        jsonschema.validate(arguments, schema)
    except jsonschema.ValidationError as exc:
        raise CapabilityError("invalid_arguments", exc.message[:300]) from None


def _content(result: dict[str, Any]) -> Any:
    """Return parsed JSON from text content when it is JSON, otherwise the raw content."""
    parts = result.get("content") or []
    texts = [p.get("text", "") for p in parts if isinstance(p, dict) and p.get("type") == "text"]
    if len(texts) == 1:
        try:
            return json.loads(texts[0])
        except ValueError:
            return texts[0]
    return parts


def cli_capabilities(action: str, *, capability_id: str | None = None,
                     args_json: str | None = None, status: str | None = None) -> int:
    try:
        registry = load_registry()
        if action == "list":
            rows = [c for c in registry.capabilities.values()
                    if status is None or c["status"] == status]
            for c in rows:
                flag = "exec" if c["agentz_executable"] else "-"
                print(f"{c['status']:<18} {flag:<5} {c['id']:<36} {c['name']}")
            return 0
        client = HostedMCPClient(registry)
        if action == "discover":
            print(json.dumps({"live_tools": sorted(client.discover()),
                              "drift": client.drift()}, indent=2))
            return 0
        if action == "call":
            arguments = json.loads(args_json) if args_json else {}
            if not isinstance(arguments, dict):
                raise CapabilityError("invalid_arguments", "--args must be a JSON object")
            print(json.dumps(client.call(capability_id or "", arguments), indent=2))
            return 0
        raise CapabilityError("unknown_action", action)
    except CapabilityError as exc:
        print(json.dumps(exc.as_dict()))
        return 2
    except json.JSONDecodeError as exc:
        print(json.dumps({"error": "invalid_arguments", "message": str(exc)}))
        return 2
