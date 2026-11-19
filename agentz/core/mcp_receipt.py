"""Fail-closed AgentZ MCP execution receipt. No arbitrary client-supplied evidence signing."""
from __future__ import annotations

import base64
import hashlib
import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

from agentz.core.identity import DID_KEY, KEY_FILE, identity_status, did_key_from_pem

ALLOWED_ENDPOINT = "https://authichain.com/mcp"
SCHEMA = "authichain.agentz.mcp-execution-receipt/1"


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _digest(data: bytes) -> str:
    return "sha256:" + hashlib.sha256(data).hexdigest()


def _canonical(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode("utf-8")


def execute_and_sign(*, opener=urlopen, now=None, endpoint=None, source_sha=None):
    """Server performs its own read-only call and signs exactly its observed bytes.

    Caller cannot supply a response, URL, tool name, signature, or claimed result.
    """
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

    now = now or datetime.now(timezone.utc)
    status = identity_status(now)
    if not status["can_sign_as_self"]:
        raise RuntimeError("AGENTZ_IDENTITY_NOT_PROVEN")
    endpoint = endpoint or os.environ.get("AGENTZ_RECEIPT_MCP_URL", ALLOWED_ENDPOINT)
    if endpoint != ALLOWED_ENDPOINT or urlsplit(endpoint).hostname != "authichain.com":
        raise RuntimeError("MCP_ENDPOINT_NOT_ALLOWLISTED")
    source_sha = source_sha or os.environ.get("AGENTZ_SOURCE_SHA", "")
    if len(source_sha) != 40 or any(c not in "0123456789abcdef" for c in source_sha):
        raise RuntimeError("SOURCE_SHA_REQUIRED")
    deployment_sha = os.environ.get("AGENTZ_DEPLOYED_COMMIT_SHA", "")
    if not deployment_sha or deployment_sha != source_sha:
        raise RuntimeError("DEPLOYED_SHA_ATTESTATION_REQUIRED")
    key_dir = os.environ.get("AGENTZ_KEY_DIR")
    if not key_dir:
        raise RuntimeError("KEY_UNBOUND")
    pem = (Path(key_dir) / KEY_FILE).read_bytes()
    if did_key_from_pem(pem) != DID_KEY:
        raise RuntimeError("KEY_MISMATCH")
    key = serialization.load_pem_private_key(pem, password=None)
    if not isinstance(key, Ed25519PrivateKey):
        raise RuntimeError("KEY_NOT_ED25519")

    execution_id = str(uuid.uuid4())  # Fresh server-generated ID; client supplies no ID or evidence.
    request_obj = {"jsonrpc": "2.0", "id": execution_id, "method": "tools/call",
                   "params": {"name": "get_pricing", "arguments": {}}}
    request_bytes = _canonical(request_obj)
    req = Request(endpoint, data=request_bytes, method="POST",
                  headers={"Content-Type": "application/json", "Accept": "application/json"})
    with opener(req, timeout=12) as response:
        http_status = response.status
        response_bytes = response.read(65537)
    if len(response_bytes) > 65536:
        raise RuntimeError("MCP_RESPONSE_TOO_LARGE")
    parsed = json.loads(response_bytes)
    if http_status != 200 or not isinstance(parsed, dict) or parsed.get("id") != execution_id or "result" not in parsed or "error" in parsed:
        raise RuntimeError("MCP_EXECUTION_UNSUCCESSFUL")
    if isinstance(parsed["result"], dict) and parsed["result"].get("isError") is True:
        raise RuntimeError("MCP_TOOL_ERROR")

    payload = {"schema": SCHEMA, "executionId": execution_id, "sourceCommit": source_sha,
               "sourceProvenance": "deployment-env-match-unverified",
               "tool": "get_pricing", "endpoint": endpoint, "httpStatus": http_status,
               "requestSha256": _digest(request_bytes), "responseSha256": _digest(response_bytes),
               "signedAt": now.isoformat().replace("+00:00", "Z"), "noProductionWrite": True,
               "kid": DID_KEY + "#" + DID_KEY.split(":")[-1]}
    header = {"alg": "EdDSA", "typ": "JWT", "kid": payload["kid"]}
    signing_input = _b64(_canonical(header)) + "." + _b64(_canonical(payload))
    jws = signing_input + "." + _b64(key.sign(signing_input.encode("ascii")))
    return {"payload": payload, "jws": jws, "requestRaw": request_bytes.decode("utf-8"),
            "responseRaw": response_bytes.decode("utf-8"), "identity": status["did_key"]}



def sign_identity_challenge(*, challenge: str, now=None) -> dict:
    """Sign an operator-provided challenge with the published AgentZ identity.

    This proves possession at invocation time; it does not prove source
    provenance, authorization of any business operation, or key custody.
    """
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

    if not isinstance(challenge, str) or not 16 <= len(challenge) <= 256 or not challenge.isascii():
        raise ValueError("INVALID_CHALLENGE")
    if any(ord(c) < 33 or ord(c) > 126 for c in challenge):
        raise ValueError("INVALID_CHALLENGE")
    now = now or datetime.now(timezone.utc)
    status = identity_status(now)
    if not status["can_sign_as_self"]:
        raise RuntimeError("AGENTZ_IDENTITY_NOT_PROVEN")
    key_dir = os.environ.get("AGENTZ_KEY_DIR")
    if not key_dir:
        raise RuntimeError("KEY_UNBOUND")
    pem = (Path(key_dir) / KEY_FILE).read_bytes()
    if did_key_from_pem(pem) != DID_KEY:
        raise RuntimeError("KEY_MISMATCH")
    key = serialization.load_pem_private_key(pem, password=None)
    if not isinstance(key, Ed25519PrivateKey):
        raise RuntimeError("KEY_NOT_ED25519")
    payload = {"schema": "authichain.agentz.identity-challenge/1",
               "challenge": challenge, "didKey": DID_KEY,
               "signedAt": now.isoformat().replace("+00:00", "Z")}
    header = {"alg": "EdDSA", "typ": "AGENTZ-CHALLENGE+JWS", "kid": DID_KEY}
    signing_input = _b64(_canonical(header)) + "." + _b64(_canonical(payload))
    return {"jws": signing_input + "." + _b64(key.sign(signing_input.encode("ascii"))),
            "payload": payload}


def verify_receipt(receipt: dict, *, expected_execution_id: str | None = None) -> bool:
    """Verify signature and exact supplied request/response bytes, without private key."""
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
    from agentz.core.identity import _B58
    jws = receipt["jws"]
    h, p, s = jws.split(".")
    decode = lambda x: base64.urlsafe_b64decode(x + "=" * (-len(x) % 4))
    header, payload = json.loads(decode(h)), json.loads(decode(p))
    if header != {"alg": "EdDSA", "typ": "JWT", "kid": DID_KEY + "#" + DID_KEY.split(":")[-1]}:
        return False
    if payload != receipt["payload"] or payload.get("schema") != SCHEMA or payload.get("tool") != "get_pricing" or payload.get("noProductionWrite") is not True:
        return False
    if expected_execution_id is not None and payload.get("executionId") != expected_execution_id:
        return False
    if payload.get("sourceProvenance") != "deployment-env-match-unverified" or payload.get("endpoint") != ALLOWED_ENDPOINT or payload.get("httpStatus") != 200:
        return False
    request_bytes = receipt["requestRaw"].encode("utf-8")
    response_bytes = receipt["responseRaw"].encode("utf-8")
    if payload["requestSha256"] != _digest(request_bytes) or payload["responseSha256"] != _digest(response_bytes):
        return False
    request, response = json.loads(request_bytes), json.loads(response_bytes)
    if request.get("method") != "tools/call" or request.get("params") != {"name": "get_pricing", "arguments": {}} or request.get("id") != payload["executionId"]:
        return False
    if response.get("id") != payload["executionId"] or "result" not in response or "error" in response or (isinstance(response["result"], dict) and response["result"].get("isError") is True):
        return False
    # did:key Ed25519 multicodec: 0xed01 followed by 32 raw public-key bytes.
    z = DID_KEY.removeprefix("did:key:z")
    n = 0
    for char in z:
        n = n * 58 + _B58.index(char)
    raw = n.to_bytes(34, "big")
    if raw[:2] != bytes((0xed, 0x01)):
        return False
    try:
        Ed25519PublicKey.from_public_bytes(raw[2:]).verify(decode(s), (h + "." + p).encode("ascii"))
    except (ValueError, Exception):
        return False
    return True
