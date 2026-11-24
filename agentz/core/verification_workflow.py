"""End-to-end AgentZ verification request.

request -> discover approved tools -> verify -> provenance -> validate -> receipt

Uses only hosted MCP capabilities that the registry marks AVAILABLE and
executable, through HostedMCPClient.call, so every registry, policy, live
annotation and schema gate applies. Nothing runs a verifier on the AgentZ host,
signs, pays, or writes to production.

The verdict is deliberately conservative. A signature over a demonstration
record, or one from a non-production issuer, is never reported as verified. A
tool error or unavailable registry is inconclusive, never a pass. Physical
authenticity is never claimed.
"""
from __future__ import annotations

import hashlib
import json
import time
import uuid
from datetime import datetime, timezone
from typing import Any

from agentz.integrations.authichain_mcp import CapabilityError, HostedMCPClient

REQUEST_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "record_id": {"type": "string", "minLength": 1, "maxLength": 200},
        "record": {"type": "object"},
        "anchor": {"type": "object"},
        "asset_id": {"type": "string", "minLength": 1, "maxLength": 200},
    },
    "anyOf": [{"required": ["record_id"]}, {"required": ["record"]},
              {"required": ["asset_id"]}],
    "not": {"required": ["record_id", "record"]},
    "dependentRequired": {"anchor": ["record"]},
}

VERIFY_RECORD = "authichain.mcp.verify_record"
QUERY_PROVENANCE = "authichain.mcp.query_provenance"
VERIFY_ATTESTATION = "authichain.mcp.verify_attestation"
ALLOWED = frozenset({VERIFY_RECORD, QUERY_PROVENANCE, VERIFY_ATTESTATION})


def digest(value: Any) -> str:
    canonical = json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)
    return "sha256:" + hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def validate_request(request: Any) -> dict[str, Any]:
    import jsonschema

    try:
        jsonschema.validate(request, REQUEST_SCHEMA)
    except jsonschema.ValidationError as exc:
        raise CapabilityError("invalid_request", exc.message[:300]) from None
    return request


def plan(request: dict[str, Any]) -> list[tuple[str, dict[str, Any]]]:
    steps: list[tuple[str, dict[str, Any]]] = []
    if "record_id" in request:
        steps.append((VERIFY_RECORD, {"id": request["record_id"]}))
    elif "record" in request:
        args = {"record": request["record"]}
        if "anchor" in request:
            args["anchor"] = request["anchor"]
        steps.append((VERIFY_RECORD, args))
    if "asset_id" in request:
        steps.append((QUERY_PROVENANCE, {"assetId": request["asset_id"]}))
        steps.append((VERIFY_ATTESTATION, {"assetId": request["asset_id"]}))
    assert {cid for cid, _ in steps} <= ALLOWED
    return steps


def record_verdict(result: Any) -> str:
    if not isinstance(result, dict):
        return "inconclusive"
    if result.get("verdict") != "verified":
        return "unverified" if result.get("verdict") else "inconclusive"
    signer = result.get("signer") or {}
    if result.get("demonstration") is True or signer.get("productionIssuer") is not True:
        return "verified_demonstration_only"
    return "verified"


def attestation_verdict(result: Any) -> str:
    if not isinstance(result, dict):
        return "inconclusive"
    if result.get("verified") is True:
        return "verified"
    status = str(result.get("status", ""))
    if "unavailable" in status or "error" in result:
        return "inconclusive"
    return "unverified"


def provenance_summary(result: Any) -> dict[str, Any]:
    if not isinstance(result, dict):
        return {"status": "inconclusive"}
    registry = result.get("registry") or {}
    return {
        "status": result.get("status"),
        "verified": result.get("verified") is True,
        "registry_state": registry.get("state"),
        "product_present": result.get("product") is not None,
    }


def combine(verdicts: list[str]) -> str:
    """Weakest link wins. One inconclusive step makes the whole result inconclusive."""
    order = ["inconclusive", "unverified", "verified_demonstration_only", "verified"]
    return min(verdicts, key=order.index) if verdicts else "inconclusive"


def run_verification(client: HostedMCPClient, request: dict[str, Any], *,
                     execution_id: str | None = None) -> dict[str, Any]:
    request = validate_request(request)
    execution_id = execution_id or str(uuid.uuid4())
    started = datetime.now(timezone.utc)
    steps_out: list[dict[str, Any]] = []
    verdicts: list[str] = []
    provenance: dict[str, Any] | None = None

    for capability_id, arguments in plan(request):
        t0 = time.monotonic()
        step: dict[str, Any] = {"capability_id": capability_id,
                                "arguments_digest": digest(arguments)}
        try:
            out = client.call(capability_id, arguments)
        except CapabilityError as exc:
            step.update(ok=False, error=exc.code, message=str(exc)[:300])
            verdicts.append("inconclusive")
        else:
            result = out["result"]
            step.update(ok=out["ok"], result_digest=digest(result))
            if capability_id == VERIFY_RECORD:
                v = record_verdict(result) if out["ok"] else "inconclusive"
                step["verdict"] = v
                verdicts.append(v)
            elif capability_id == VERIFY_ATTESTATION:
                v = attestation_verdict(result)
                step["verdict"] = v
                verdicts.append(v)
            else:
                provenance = provenance_summary(result)
                step["provenance"] = provenance
        step["elapsed_ms"] = round((time.monotonic() - t0) * 1000)
        steps_out.append(step)

    return {
        "receipt_version": 1,
        "execution_id": execution_id,
        "workflow": "verify_request",
        "started_at": started.isoformat(),
        "finished_at": datetime.now(timezone.utc).isoformat(),
        "request_digest": digest(request),
        "endpoint": client.registry.endpoint,
        "registry_revision": client.registry.revision,
        "steps": steps_out,
        "provenance": provenance,
        "verdict": combine(verdicts),
        "physical_authenticity": "not_inspected",
        "environment": "production_hosted_mcp_read_only",
    }
