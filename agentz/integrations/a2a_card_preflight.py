"""AgentZ: bounded, no-wallet public A2A AgentCard discovery preflight.

Run: python -m agentz.integrations.a2a_card_preflight [--live]
Default is an offline refusal. --live performs one GET to the fixed owned host.
This is a limited declaration check, not an A2A TCK, key-verification,
authorization, physical-product-verification, or A2A task invocation.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any, Callable

CARD_URL = "https://authichain.com/.well-known/agent-card.json"
MAX_BYTES = 131_072


class NoRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def fetch_card() -> bytes:
    """One HTTPS GET, no redirect, no token/cookie, no paid endpoint."""
    request = urllib.request.Request(
        CARD_URL,
        method="GET",
        headers={"Accept": "application/json", "User-Agent": "AgentZ-A2A-Card-Preflight/0.1"},
    )
    opener = urllib.request.build_opener(NoRedirects())
    with opener.open(request, timeout=6) as response:
        if response.status != 200:
            raise ValueError("unexpected_http_status")
        content_type = response.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
        if content_type != "application/json":
            raise ValueError("unexpected_content_type")
        length = response.headers.get("Content-Length", "")
        if length and length.isdigit() and int(length) > MAX_BYTES:
            raise ValueError("oversize_response")
        body = response.read(MAX_BYTES + 1)
        if len(body) > MAX_BYTES:
            raise ValueError("oversize_response")
        return body


def validate_declaration(card: Any) -> dict[str, Any]:
    """Conservative AuthiChain-specific declaration checks; not full A2A schema."""
    errors: list[str] = []
    if not isinstance(card, dict):
        return {"structure_valid": False, "checks": ["agent_card_not_object"], "interface_count": 0, "skill_count": 0}
    for key in ("name", "description", "version"):
        if not isinstance(card.get(key), str) or not card[key].strip():
            errors.append(f"missing_{key}")
    if not isinstance(card.get("capabilities"), dict):
        errors.append("missing_capabilities")
    for key in ("defaultInputModes", "defaultOutputModes"):
        modes = card.get(key)
        if not isinstance(modes, list) or not modes or any(not isinstance(v, str) or not v for v in modes):
            errors.append(f"invalid_{key}")
    interfaces = card.get("supportedInterfaces")
    if not isinstance(interfaces, list) or not interfaces:
        errors.append("missing_supported_interfaces")
        interfaces = []
    seen_a2a = False
    for index, interface in enumerate(interfaces):
        if not isinstance(interface, dict):
            errors.append(f"interface_{index}_not_object")
            continue
        url = interface.get("url")
        if not isinstance(url, str):
            errors.append(f"interface_{index}_missing_url")
            continue
        try:
            u = urllib.parse.urlsplit(url)
            origin = (u.scheme, u.hostname, u.port, u.username, u.password, u.query, u.fragment)
        except ValueError:
            errors.append(f"interface_{index}_malformed_url")
            continue
        if origin != ("https", "authichain.com", None, None, None, "", ""):
            errors.append(f"interface_{index}_unexpected_origin")
        if interface.get("protocolBinding") == "JSONRPC" and u.path == "/api/a2a":
            seen_a2a = True
            if not re.fullmatch(r"\d+\.\d+(?:\.\d+)?", str(interface.get("protocolVersion", ""))):
                errors.append("invalid_jsonrpc_protocol_version")
    if not seen_a2a:
        errors.append("missing_jsonrpc_a2a_interface")
    skills = card.get("skills")
    if not isinstance(skills, list) or not skills:
        errors.append("missing_skills")
        skills = []
    ids: set[str] = set()
    for index, skill in enumerate(skills):
        if not isinstance(skill, dict) or not isinstance(skill.get("id"), str) or not skill["id"].strip():
            errors.append(f"invalid_skill_{index}")
        elif skill["id"] in ids:
            errors.append("duplicate_skill_id")
        else:
            ids.add(skill["id"])
    return {
        "structure_valid": not errors,
        "checks": errors,
        "interface_count": len(interfaces),
        "skill_count": len(skills),
        "advertised_card_version": card.get("version") if isinstance(card.get("version"), str) else None,
        "advertised_jsonrpc": seen_a2a,
    }


def probe_live(reader: Callable[[], bytes] = fetch_card) -> dict[str, Any]:
    result: dict[str, Any] = {
        "agent": "AgentZ", "target": CARD_URL, "method": "GET", "read_only": True,
        "wallet_used": False, "task_invoked": False, "mcp_tool_invoked": False,
        "official_a2a_tck_executed": False, "independent_peer_review": False,
        "identity_verified": False, "payment_settlement_verified": False,
        "observed_at_utc": datetime.now(timezone.utc).isoformat(),
    }
    try:
        body = reader()
        if not isinstance(body, bytes) or len(body) > MAX_BYTES:
            raise ValueError("oversize_or_invalid_body")
        card = json.loads(body.decode("utf-8", errors="strict"))
        result.update(validate_declaration(card))
        result["content_sha256"] = hashlib.sha256(body).hexdigest()
        result["state"] = "card_declared_shape_observed" if result["structure_valid"] else "invalid_declaration"
    except urllib.error.HTTPError as ex:
        result.update(state="coverage_unknown", reason="redirect_blocked" if 300 <= ex.code < 400 else "http_error")
    except (urllib.error.URLError, TimeoutError, ConnectionError, OSError):
        result.update(state="coverage_unknown", reason="transport_unavailable")
    except (json.JSONDecodeError, UnicodeError):
        result.update(state="coverage_unknown", reason="invalid_json")
    except ValueError as ex:
        reason = str(ex)
        result.update(state="coverage_unknown", reason=reason if reason in (
            "unexpected_http_status", "unexpected_content_type", "oversize_response", "oversize_or_invalid_body"
        ) else "unexpected_response")
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="AgentZ fixed-target AuthiChain AgentCard GET preflight")
    parser.add_argument("--live", action="store_true", help="Explicitly opt in to one public read-only GET")
    args = parser.parse_args()
    if not args.live:
        print(json.dumps({"agent": "AgentZ", "state": "dry_run", "network_called": False, "target": CARD_URL,
                          "requires": "--live", "payment": False, "official_a2a_tck_executed": False}))
        return
    print(json.dumps(probe_live(), indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
