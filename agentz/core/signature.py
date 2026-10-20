"""
agentz.core.signature
---------------------
Signature check for /scan, done by the JavaScript passport scan rather than
a second Python implementation that could drift from it.

`signature_valid` is True only when all of these hold:
  - for a DigitalProductPassport, the passport scan is genuine (verdict
    `verified`). `valid-unanchored` is not that proof;
  - for any other record, the verifier accepts the Ed25519 signature and
    validity window (verdict `verified` or `valid-unanchored`);
  - the signing key is the issuer and is in AGENTZ_TRUSTED_ISSUERS: anyone
    can sign a record with their own did:key, so a valid signature from an
    unknown key proves nothing;
  - credentialSubject.id equals the product's digital identity, so a record
    signed for one product cannot verify another. That identity is
    metadata.subject_id when it is recorded, and otherwise
    credentialSubject.id on the passport stored on the product.

It is None ("not checked") whenever the check could not be completed: no
record, no trusted issuers configured, the product has no digital identity,
or Node or the verifier is unavailable. assess_scans treats None as
unverified. A registry status is not a record and not an identity.
"""
from __future__ import annotations

import asyncio
import json
import os
import shutil
from pathlib import Path
from typing import Any, Dict, Optional

VERIFIER = Path(__file__).with_name("verify_record.mjs")
TIMEOUT_SECONDS = 5.0


def trusted_issuers() -> set[str]:
    raw = os.environ.get("AGENTZ_TRUSTED_ISSUERS", "")
    return {d.split("#")[0].strip() for d in raw.split(",") if d.strip()}


def _result(valid: Optional[bool], reason: str, verdict: Optional[str] = None) -> Dict[str, Any]:
    return {"signature_valid": valid, "reason": reason, "verdict": verdict}


def _plain(value: Any) -> bool:
    return isinstance(value, dict)


def _passport_carrier(value: Any) -> Optional[Dict[str, Any]]:
    """Same shapes readStoredPassport accepts. This does not assign a GTIN."""
    if not _plain(value):
        return None
    types = value.get("type") if isinstance(value.get("type"), list) else []
    if "DigitalProductPassport" in types:
        return {"record": value, "anchor": None}
    record = value.get("record")
    if not _plain(record):
        return None
    inner = record.get("type") if isinstance(record.get("type"), list) else []
    if "DigitalProductPassport" not in inner:
        return None
    anchor = value.get("anchor")
    return {"record": record, "anchor": anchor if _plain(anchor) else None}


def stored_passport(metadata: Any) -> Optional[Dict[str, Any]]:
    """Passport already stored on the product, or None. Status is not one."""
    if not _plain(metadata):
        return None
    direct = _passport_carrier(metadata)
    if direct:
        return direct
    return _passport_carrier(metadata.get("passport"))


def digital_identity_of(record: Any) -> Optional[str]:
    """credentialSubject.id when this record is a product passport."""
    if not _plain(record):
        return None
    types = record.get("type") if isinstance(record.get("type"), list) else []
    if "DigitalProductPassport" not in types:
        return None
    subject = record.get("credentialSubject")
    if not _plain(subject):
        return None
    ident = subject.get("id")
    return ident if isinstance(ident, str) and ident else None


def resolve_scan_inputs(
    record: Any,
    anchor: Any,
    metadata: Any,
) -> tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]], Optional[str]]:
    """Submitted record wins. Otherwise use the passport stored on the product.

    The expected digital identity is metadata.subject_id when that is a
    non-empty string. Otherwise it is credentialSubject.id on the stored
    passport. The submitted record does not supply that identity by itself.
    A product status is not a passport. No GTIN is assigned.
    """
    meta = metadata if _plain(metadata) else {}
    stored = stored_passport(meta)
    chosen = record if _plain(record) else None
    chosen_anchor = anchor if _plain(anchor) else None
    if chosen is None and stored is not None:
        chosen = stored["record"]
        if chosen_anchor is None:
            chosen_anchor = stored["anchor"]
    subject = meta.get("subject_id")
    if not isinstance(subject, str) or not subject:
        subject = None
        if stored is not None:
            subject = digital_identity_of(stored["record"])
    return chosen, chosen_anchor, subject


async def run_verifier(record: Dict[str, Any], anchor: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Passport scan or verifyRecord() output, or None when the verifier could not run."""
    node = os.environ.get("AGENTZ_NODE_BIN") or shutil.which("node")
    if not node or not VERIFIER.is_file():
        return None
    try:
        proc = await asyncio.create_subprocess_exec(
            node, str(VERIFIER),
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        out, _ = await asyncio.wait_for(
            proc.communicate(json.dumps({"record": record, "anchor": anchor}).encode()),
            timeout=TIMEOUT_SECONDS,
        )
    except (OSError, asyncio.TimeoutError):
        return None
    if proc.returncode != 0:
        return None
    try:
        return json.loads(out)
    except ValueError:
        return None


async def check_scan_signature(
    record: Optional[Dict[str, Any]],
    anchor: Optional[Dict[str, Any]],
    expected_subject: Optional[str],
) -> Dict[str, Any]:
    if not record:
        return _result(None, "no_record")
    issuers = trusted_issuers()
    if not issuers:
        return _result(None, "no_trusted_issuers")
    if not expected_subject:
        return _result(None, "product_has_no_subject_id")

    verdict = await run_verifier(record, anchor)
    if verdict is None:
        return _result(None, "verifier_unavailable")

    name = verdict.get("verdict")
    types = record.get("type") if isinstance(record.get("type"), list) else []
    if "DigitalProductPassport" in types:
        if verdict.get("genuine") is not True:
            reasons = ",".join(verdict.get("reasons") or []) or "not_genuine"
            return _result(False, reasons, name)
    elif name == "invalid" or verdict.get("checks", {}).get("signature") is not True:
        reasons = ",".join(verdict.get("reasons") or []) or "invalid"
        return _result(False, reasons, name)
    # The verifier checks the signature against proof.verificationMethod when
    # present, so trust is decided on that key, and the issuer must be it:
    # otherwise a record could name a trusted issuer but be signed by any key.
    issuer = str(record.get("issuer", "")).split("#")[0]
    signer = str((record.get("proof") or {}).get("verificationMethod") or issuer).split("#")[0]
    if signer != issuer or signer not in issuers:
        return _result(False, "issuer_not_trusted", name)
    if (record.get("credentialSubject") or {}).get("id") != expected_subject:
        return _result(False, "subject_mismatch", name)
    return _result(True, "ok", name)
