"""Bounded, read-only MCP transport diagnostics for AuthiChain-owned endpoint.

HTTPX is used only for MCP initialize, notifications/initialized, tools/list.
No tools/call, token headers, cookies, payments, user-supplied hosts, retries,
or redirects. Error categories are evidence, not a conformance verdict.

Usage: python -m agentz.integrations.mcp_httpx_probe --live
Without --live, the command only prints a no-network description.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import re
from typing import Any

import httpx

ENDPOINT = "https://authichain.com/mcp"
PROTOCOL = "2025-06-18"
MODERN_PROTOCOL = "2026-07-28"
MAX_RESPONSE_BYTES = 65_536
MAX_TOOL_NAMES = 64
SESSION_PATTERN = re.compile(r"^[A-Za-z0-9._-]{1,128}$")


def _parse_message(body: bytes, content_type: str) -> dict[str, Any] | None:
    """JSON or bounded SSE data; never follow URLs or execute tool content."""
    try:
        text = body.decode("utf-8")
        if "text/event-stream" in content_type.lower():
            for line in text.splitlines():
                if line.startswith("data:"):
                    value = json.loads(line[5:].strip())
                    if isinstance(value, dict) and ("result" in value or "error" in value):
                        return value
            return None
        value = json.loads(text)
        return value if isinstance(value, dict) else None
    except (UnicodeError, ValueError):
        return None


async def _post(client: httpx.AsyncClient, method: str, *, session: str | None = None,
                protocol: str | None = None, message_id: int | None = None, modern: bool = False) -> dict[str, Any]:
    headers = {"Accept": "application/json, text/event-stream", "Content-Type": "application/json"}
    if session:
        headers["MCP-Session-Id"] = session
    if modern:
        headers["Mcp-Method"] = method
    if protocol:
        headers["MCP-Protocol-Version"] = protocol
    request: dict[str, Any] = {"jsonrpc": "2.0", "method": method}
    if message_id is not None:
        request["id"] = message_id
    if modern:
        request["params"] = {"_meta": {
            "io.modelcontextprotocol/protocolVersion": MODERN_PROTOCOL,
            "io.modelcontextprotocol/clientInfo": {"name": "authichain-httpx-diagnostic", "version": "0.2"},
            "io.modelcontextprotocol/clientCapabilities": {},
        }}
    elif method == "initialize":
        request["params"] = {"protocolVersion": PROTOCOL, "capabilities": {},
                             "clientInfo": {"name": "authichain-httpx-diagnostic", "version": "0.1"}}
    elif method == "tools/list":
        request["params"] = {}
    async with client.stream("POST", ENDPOINT, headers=headers, json=request) as response:
        raw = bytearray()
        async for chunk in response.aiter_bytes():
            raw.extend(chunk)
            if len(raw) > MAX_RESPONSE_BYTES:
                return {"status": response.status_code, "too_large": True}
        ct = response.headers.get("content-type", "")
        return {"status": response.status_code, "message": _parse_message(bytes(raw), ct),
                "session": response.headers.get("mcp-session-id")}


def _error_state(response: dict[str, Any]) -> str | None:
    code = response["status"]
    if 300 <= code < 400:
        return "redirect_blocked"
    if code in (401, 403):
        return "authentication_required"
    if code == 402:
        return "payment_required_no_payment_sent"
    if code >= 500:
        return "upstream_server_error"
    if response.get("too_large"):
        return "oversize_response"
    if code < 200 or code >= 300:
        return "unexpected_http_status"
    return None


async def probe(*, transport: httpx.AsyncBaseTransport | None = None) -> dict[str, Any]:
    """Three protocol frames at most; no retries or paid method calls."""
    result: dict[str, Any] = {"target": ENDPOINT, "mode": "read_only_httpx",
                              "payment": False, "tools_invoked": False, "confirmed": False}
    try:
        async with httpx.AsyncClient(transport=transport, timeout=httpx.Timeout(8.0),
                                     follow_redirects=False, trust_env=False,
                                     headers={"User-Agent": "AgentZ-MCP-Diagnostic/0.1"}) as client:
            first = await _post(client, "initialize", message_id=1)
            result["initialize_http_status"] = first["status"]
            if error := _error_state(first):
                result["state"] = error
                return result
            msg = first.get("message")
            if not isinstance(msg, dict) or msg.get("jsonrpc") != "2.0" or msg.get("id") != 1:
                result["state"] = "invalid_initialize_response"
                return result
            if "error" in msg:
                result["state"] = "mcp_initialize_error"
                return result
            details = msg.get("result")
            if not isinstance(details, dict) or not isinstance(details.get("protocolVersion"), str) or not isinstance(details.get("serverInfo"), dict):
                result["state"] = "invalid_initialize_result"
                return result
            version = details["protocolVersion"]
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", version):
                result["state"] = "invalid_protocol_version"
                return result
            result["negotiated_version"] = version
            session = first.get("session")
            if session is not None and not SESSION_PATTERN.fullmatch(session):
                result["state"] = "invalid_session_header"
                return result
            notified = await _post(client, "notifications/initialized", session=session, protocol=version)
            result["initialized_notification_http_status"] = notified["status"]
            if error := _error_state(notified):
                result["state"] = error
                return result
            listed = await _post(client, "tools/list", session=session, protocol=version, message_id=2)
            result["tools_list_http_status"] = listed["status"]
            if error := _error_state(listed):
                result["state"] = error
                return result
            msg = listed.get("message")
            if not isinstance(msg, dict) or msg.get("jsonrpc") != "2.0" or msg.get("id") != 2:
                result["state"] = "invalid_tools_list_response"
                return result
            if "error" in msg:
                result["state"] = "mcp_tools_list_error"
                return result
            data = msg.get("result")
            tools = data.get("tools") if isinstance(data, dict) else None
            if not isinstance(tools, list) or any(not isinstance(t, dict) or not isinstance(t.get("name"), str) for t in tools):
                result["state"] = "invalid_tools_list_result"
                return result
            result["tools_count"] = len(tools)
            result["tool_names"] = [t["name"][:64] for t in tools[:MAX_TOOL_NAMES]
                                      if re.fullmatch(r"[a-zA-Z0-9_.-]+", t["name"])]
            result["state"] = "mcp_handshake_and_listing_confirmed"
            result["confirmed"] = True
            return result
    except httpx.TimeoutException:
        result["state"] = "transport_timeout"
    except httpx.TransportError:
        result["state"] = "transport_unavailable"
    except (ValueError, TypeError):
        result["state"] = "unexpected_response_shape"
    return result



async def probe_modern(*, transport: httpx.AsyncBaseTransport | None = None) -> dict[str, Any]:
    """MCP 2026-07-28: one bounded stateless tools/list; no legacy handshake."""
    result: dict[str, Any] = {"target": ENDPOINT, "mode": "read_only_httpx",
                              "era": "2026-07-28", "payment": False, "tools_invoked": False, "confirmed": False}
    try:
        async with httpx.AsyncClient(transport=transport, timeout=httpx.Timeout(8.0),
                                     follow_redirects=False, trust_env=False,
                                     headers={"User-Agent": "AgentZ-MCP-Diagnostic/0.2"}) as client:
            response = await _post(client, "tools/list", protocol=MODERN_PROTOCOL,
                                   message_id=1, modern=True)
            result["tools_list_http_status"] = response["status"]
            if error := _error_state(response):
                result["state"] = error
                return result
            msg = response.get("message")
            if not isinstance(msg, dict) or msg.get("jsonrpc") != "2.0" or msg.get("id") != 1:
                result["state"] = "invalid_modern_tools_list_response"
                return result
            if "error" in msg:
                result["state"] = "modern_mcp_error"
                result["mcp_error_code"] = msg["error"].get("code") if isinstance(msg["error"], dict) else None
                return result
            data = msg.get("result")
            if not isinstance(data, dict) or data.get("resultType") != "complete":
                # Required on every MCP 2026-07-28 result. A missing or
                # input_required discriminator is not a completed tools list.
                result["state"] = "invalid_modern_result_type"
                return result
            tools = data.get("tools")
            if not isinstance(tools, list) or any(
                not isinstance(t, dict) or not isinstance(t.get("name"), str) for t in tools
            ):
                result["state"] = "invalid_modern_tools_list_result"
                return result
            result["tools_count"] = len(tools)
            result["tool_names"] = [t["name"][:64] for t in tools[:MAX_TOOL_NAMES]
                                      if re.fullmatch(r"[a-zA-Z0-9_.-]+", t["name"])]
            result["confirmed"] = True
            result["state"] = "modern_mcp_listing_confirmed"
            return result
    except httpx.TimeoutException:
        result["state"] = "transport_timeout"
    except httpx.TransportError:
        result["state"] = "transport_unavailable"
    except (ValueError, TypeError):
        result["state"] = "unexpected_response_shape"
    return result

def main() -> None:
    parser = argparse.ArgumentParser(description="Read-only HTTPX MCP handshake probe")
    parser.add_argument("--live", action="store_true", help="Allow three bounded HTTPS POST frames to fixed AuthiChain /mcp (no tools/call)")
    parser.add_argument("--era", choices=("modern", "legacy"), default="modern",
                        help="Explicit MCP transport era; no automatic fallback")
    args = parser.parse_args()
    if not args.live:
        requests = ["tools/list"] if args.era == "modern" else ["initialize", "notifications/initialized", "tools/list"]
        print(json.dumps({"state": "dry_run", "endpoint": ENDPOINT, "era": args.era,
                          "requests": requests, "network_called": False, "payment": False}))
    else:
        fn = probe_modern if args.era == "modern" else probe
        print(json.dumps(asyncio.run(fn()), sort_keys=True))


if __name__ == "__main__":
    main()
