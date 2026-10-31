# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 Zachary Kietzman (AuthiChain)
"""Python port of the AuthiChain reference verifier (protocol/verifier.mjs).

Implements the AuthiChain Verification Specification v0.1.0 and the offline
check of v0.1 attestation seals (compact JWS) against a JWKS. Runs offline;
nothing here contacts an AuthiChain server. Its only dependency is
``cryptography`` (for Ed25519).

The JavaScript verifier is the reference. This port must pass the same
conformance fixtures (protocol/conformance, ``--strict``) and the same unit
test cases.
"""

from __future__ import annotations

import base64
import hashlib
import json
import math
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

__all__ = [
    "ATTESTATION_TYP",
    "MAINNET_CHAINS",
    "base58_decode",
    "base58_encode",
    "canonicalize",
    "did_key_from_jwk",
    "public_key_from_did_key",
    "sha256_hex",
    "signing_bytes",
    "verify_attestation_jws",
    "verify_record",
]

#: Chains considered production. A testnet anchor is not proof (SPEC 4.1).
MAINNET_CHAINS = frozenset({"polygon:137", "eip155:1", "eip155:137"})

#: JWS ``typ`` for AuthiChain attestation seals (docs/attestation/v0.1.md).
ATTESTATION_TYP = "AC-ATTESTATION+JWS"

REQUIRED_TOP = ["@context", "type", "issuer", "validFrom", "proof"]

_B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
_TX_HASH_RE = re.compile(r"^0x[0-9a-fA-F]{64}$")
_B64URL_RE = re.compile(r"^[A-Za-z0-9_-]*$")

Json = Any
Instant = Union[str, int, float, datetime, None]


# --- canonicalisation (RFC 8785 / JCS, same rules as verifier.mjs) -----------


def _utf16_key(s: str) -> bytes:
    # JS sorts object keys by UTF-16 code unit, not by code point.
    return s.encode("utf-16-be", "surrogatepass")


def _number(n: Union[int, float]) -> str:
    if isinstance(n, int):
        return str(n)
    if math.isnan(n) or math.isinf(n):
        return "null"  # what JSON.stringify emits
    if n.is_integer() and abs(n) < 1e21:
        return str(int(n))
    return repr(n)


def canonicalize(value: Json) -> str:
    """Deterministic JSON: object keys sorted, no insignificant whitespace."""
    if value is None or isinstance(value, bool):
        return json.dumps(value)
    if isinstance(value, (int, float)):
        return _number(value)
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, (list, tuple)):
        return "[" + ",".join(canonicalize(v) for v in value) + "]"
    if isinstance(value, dict):
        parts = [
            json.dumps(k, ensure_ascii=False) + ":" + canonicalize(value[k])
            for k in sorted(value.keys(), key=_utf16_key)
        ]
        return "{" + ",".join(parts) + "}"
    raise TypeError(f"not JSON-serialisable: {type(value).__name__}")


def signing_bytes(record: Dict[str, Any]) -> bytes:
    """The signed payload: the record minus proof.proofValue (SPEC 3.2)."""
    rest = {k: v for k, v in record.items() if k != "proof"}
    proof = record.get("proof")
    proof_rest = (
        {k: v for k, v in proof.items() if k != "proofValue"}
        if isinstance(proof, dict)
        else {}
    )
    rest["proof"] = proof_rest
    return canonicalize(rest).encode("utf-8")


def sha256_hex(data: Union[bytes, str]) -> str:
    if isinstance(data, str):
        data = data.encode("utf-8")
    return hashlib.sha256(data).hexdigest()


# --- base58 / did:key ---------------------------------------------------------


def base58_decode(s: str) -> bytes:
    """base58btc decode. Used for did:key identifiers and proofValue."""
    num = 0
    for ch in s:
        idx = _B58.find(ch)
        if idx == -1:
            raise ValueError(f"invalid base58 character: {ch}")
        num = num * 58 + idx
    body = num.to_bytes((num.bit_length() + 7) // 8, "big") if num else b""
    leading = len(s) - len(s.lstrip("1"))
    return b"\x00" * leading + body


def base58_encode(data: bytes) -> str:
    num = int.from_bytes(data, "big")
    out = ""
    while num > 0:
        num, rem = divmod(num, 58)
        out = _B58[rem] + out
    leading = len(data) - len(data.lstrip(b"\x00"))
    return "1" * leading + out


def public_key_from_did_key(did: str) -> Ed25519PublicKey:
    """Raw Ed25519 public key from a did:key ('z' + base58btc(0xed 0x01 || key))."""
    if not isinstance(did, str):
        raise ValueError("did:key must be a string")
    ident = did.split("#")[0]
    if ident.startswith("did:key:"):
        ident = ident[len("did:key:") :]
    if not ident.startswith("z"):
        raise ValueError("did:key must use base58btc (z) encoding")
    decoded = base58_decode(ident[1:])
    if len(decoded) != 34 or decoded[0] != 0xED or decoded[1] != 0x01:
        raise ValueError("not an Ed25519 did:key")
    return Ed25519PublicKey.from_public_bytes(decoded[2:])


def _b64url_decode(part: str) -> bytes:
    if not isinstance(part, str) or not _B64URL_RE.match(part):
        raise ValueError("not base64url")
    return base64.urlsafe_b64decode(part + "=" * (-len(part) % 4))


def did_key_from_jwk(jwk: Dict[str, Any]) -> str:
    """did:key for an Ed25519 public JWK ({kty: OKP, crv: Ed25519, x})."""
    if not isinstance(jwk, dict) or jwk.get("kty") != "OKP" or jwk.get("crv") != "Ed25519" or not isinstance(jwk.get("x"), str):
        raise ValueError("not an Ed25519 OKP JWK")
    raw = _b64url_decode(jwk["x"])
    if len(raw) != 32:
        raise ValueError("Ed25519 JWK x must be 32 bytes")
    return "did:key:z" + base58_encode(b"\xed\x01" + raw)


# --- time ---------------------------------------------------------------------


def _parse_time(value: Any) -> Optional[datetime]:
    """Parse an ISO 8601 instant. Returns None if malformed. Naive = UTC."""
    if isinstance(value, datetime):
        dt = value
    elif isinstance(value, (int, float)) and not isinstance(value, bool):
        return datetime.fromtimestamp(value / 1000, tz=timezone.utc)
    elif isinstance(value, str):
        s = value.strip()
        if s.endswith("Z") or s.endswith("z"):
            s = s[:-1] + "+00:00"
        try:
            dt = datetime.fromisoformat(s)
        except ValueError:
            return None
    else:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _now(opt: Instant) -> datetime:
    if opt is None:
        return datetime.now(timezone.utc)
    dt = _parse_time(opt)
    if dt is None:
        raise ValueError(f"invalid now: {opt!r}")
    return dt


# --- records ------------------------------------------------------------------


def _js_str(v: Any) -> str:
    # Mirrors JS String(x ?? '') for the values that matter here.
    if v is None:
        return ""
    if isinstance(v, bool):
        return "true" if v else "false"
    return str(v)


def verify_record(
    record: Any,
    anchor: Optional[Dict[str, Any]] = None,
    *,
    allow_testnet: bool = False,
    now: Instant = None,
    jwks: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Verify a record, and an anchor if supplied.

    Returns ``{"verdict", "reasons", "checks"}``; verdict is exactly one of
    ``verified`` | ``valid-unanchored`` | ``invalid`` (SPEC 5.1). Pass ``jwks``
    to also require that the signer is a key in that JWKS.
    """
    reasons: List[str] = []
    checks: Dict[str, Any] = {}
    at = _now(now)
    rec = record if isinstance(record, dict) else {}

    # 1. Required fields. Absence is rejection, not a warning.
    for field in REQUIRED_TOP:
        if field not in rec:
            reasons.append(f"missing_field:{field}")
    subject = rec.get("credentialSubject")
    if not isinstance(subject, dict) or "id" not in subject:
        reasons.append("missing_field:credentialSubject.id")
    if reasons:
        return {"verdict": "invalid", "reasons": reasons, "checks": checks}

    proof = rec["proof"] if isinstance(rec["proof"], dict) else {}
    vm = proof.get("verificationMethod")
    signer_ref = vm if vm is not None else rec.get("issuer")

    # 2 & 3. Resolve the key and verify the signature.
    try:
        key = public_key_from_did_key(signer_ref)
        sig_str = _js_str(proof.get("proofValue"))
        if not sig_str.startswith("z"):
            raise ValueError("proofValue must be base58btc (z-prefixed)")
        signature = base58_decode(sig_str[1:])
        try:
            key.verify(signature, signing_bytes(rec))
            ok = True
        except InvalidSignature:
            ok = False
        checks["signature"] = ok
        if not ok:
            reasons.append("signature_invalid")
    except Exception as err:  # noqa: BLE001 - any failure is "unverifiable"
        checks["signature"] = False
        reasons.append(f"signature_unverifiable:{err}")

    # Optional: pin the signer to a key in a JWKS the caller already holds.
    if jwks is not None:
        signer = _js_str(signer_ref).split("#")[0]
        pinned = False
        for k in (jwks.get("keys") or []) if isinstance(jwks, dict) else []:
            try:
                if did_key_from_jwk(k) == signer:
                    pinned = True
                    break
            except ValueError:
                continue
        checks["issuerInJwks"] = pinned
        if not pinned:
            reasons.append("issuer_not_in_jwks")

    # 4. Validity window.
    valid_from = _parse_time(rec.get("validFrom"))
    if valid_from is None:
        reasons.append("validFrom_malformed")
    elif valid_from > at:
        reasons.append("not_yet_valid")
    if rec.get("validUntil"):
        valid_until = _parse_time(rec["validUntil"])
        if valid_until is None:
            reasons.append("validUntil_malformed")
        elif valid_until < at:
            reasons.append("expired")

    if reasons:
        return {"verdict": "invalid", "reasons": reasons, "checks": checks}

    # No anchor is a legitimate state, distinct from a failed one (SPEC 4.1).
    if not anchor:
        return {"verdict": "valid-unanchored", "reasons": reasons, "checks": checks}

    # 5. Hash commitment.
    expected = sha256_hex(signing_bytes(rec))
    claimed = re.sub(r"^sha256:", "", _js_str(anchor.get("recordHash")))
    checks["anchorHash"] = expected == claimed
    if not checks["anchorHash"]:
        reasons.append("anchor_hash_mismatch")

    # 6. Chain and transaction sanity.
    chain = _js_str(anchor.get("chain"))
    if ":" not in chain:
        reasons.append("chain_not_caip2")
    elif chain not in MAINNET_CHAINS and not allow_testnet:
        reasons.append(f"anchor_not_mainnet:{chain}")

    tx_hash = _js_str(anchor.get("txHash"))
    if chain.startswith("eip155:") or chain.startswith("polygon:"):
        if not _TX_HASH_RE.match(tx_hash):
            reasons.append("tx_hash_malformed")
    elif not tx_hash:
        reasons.append("tx_hash_missing")

    if reasons:
        return {"verdict": "invalid", "reasons": reasons, "checks": checks}
    return {"verdict": "verified", "reasons": reasons, "checks": checks}


# --- attestation seals (compact JWS) -------------------------------------------


def verify_attestation_jws(
    jws: str, jwks: Dict[str, Any], *, now: Instant = None
) -> Dict[str, Any]:
    """Verify a compact-JWS attestation seal offline against a JWKS you hold.

    Same checks and result shape as ``verifyAttestationJws`` in verifier.mjs:
    EdDSA + typ AC-ATTESTATION+JWS, kid present in the JWKS as an Ed25519 OKP
    key, signature valid, not expired, signed ``decision: verified`` and
    ``status: active``. Live revocation is not checked (that needs the issuer's
    registry). A valid signature does not by itself prove the physical item in
    hand is the one the payload names.
    """
    reasons: List[str] = []
    checks: Dict[str, Any] = {}
    at = _now(now)
    header: Any = None
    payload: Any = None

    parts = _js_str(jws).strip().split(".")
    if len(parts) != 3:
        return {"verdict": "invalid", "reasons": ["jws_malformed"], "checks": checks, "header": header, "payload": payload}
    try:
        header = json.loads(_b64url_decode(parts[0]).decode("utf-8"))
        payload = json.loads(_b64url_decode(parts[1]).decode("utf-8"))
    except Exception:  # noqa: BLE001
        return {"verdict": "invalid", "reasons": ["jws_malformed"], "checks": checks, "header": None, "payload": None}

    h = header if isinstance(header, dict) else {}
    p = payload if isinstance(payload, dict) else {}
    if h.get("alg") != "EdDSA":
        reasons.append(f"alg_unsupported:{_js_undefined(h, 'alg')}")
    if h.get("typ") != ATTESTATION_TYP:
        reasons.append(f"typ_unexpected:{_js_undefined(h, 'typ')}")

    keys = jwks.get("keys") if isinstance(jwks, dict) else None
    keys = keys if isinstance(keys, list) else []
    jwk = next((k for k in keys if isinstance(k, dict) and isinstance(h.get("kid"), str) and k.get("kid") == h["kid"]), None)
    checks["kid"] = jwk is not None
    if jwk is None:
        reasons.append("kid_not_in_jwks")
    elif jwk.get("kty") != "OKP" or jwk.get("crv") != "Ed25519" or not isinstance(jwk.get("x"), str):
        reasons.append("jwk_not_ed25519")
    elif not reasons:
        try:
            key = Ed25519PublicKey.from_public_bytes(_b64url_decode(jwk["x"]))
            try:
                key.verify(_b64url_decode(parts[2]), f"{parts[0]}.{parts[1]}".encode("ascii"))
                ok = True
            except InvalidSignature:
                ok = False
            checks["signature"] = ok
            if not ok:
                reasons.append("signature_invalid")
        except Exception as err:  # noqa: BLE001
            checks["signature"] = False
            reasons.append(f"signature_unverifiable:{err}")
    if checks.get("signature") is not True:
        return {"verdict": "invalid", "reasons": reasons, "checks": checks, "header": header, "payload": payload}

    if "expires_at" in p:
        exp = _parse_time(p["expires_at"])
        if exp is None:
            reasons.append("expires_at_malformed")
        elif exp < at:
            reasons.append("expired")
    if p.get("decision") != "verified":
        reasons.append(f"decision:{_js_undefined(p, 'decision')}")
    if p.get("status") != "active":
        reasons.append(f"status:{_js_undefined(p, 'status')}")

    verdict = "invalid" if reasons else "valid-offline"
    return {"verdict": verdict, "reasons": reasons, "checks": checks, "header": header, "payload": payload}


def _js_undefined(obj: Dict[str, Any], key: str) -> str:
    # Template-literal rendering of a possibly-missing field, as in JS.
    if key not in obj:
        return "undefined"
    v = obj[key]
    if v is None:
        return "null"
    return _js_str(v)
