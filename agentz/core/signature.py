"""
agentz.core.signature
---------------------
Signature check for /scan, done by the JavaScript reference verifier
(protocol/verifier.mjs) rather than a second Python implementation that
could drift from it.

`signature_valid` is True only when all of these hold:
  - the verifier accepts the record's Ed25519 signature and validity window
    (verdict `verified` or `valid-unanchored`);
  - the signing key is the issuer and is in AGENTZ_TRUSTED_ISSUERS: anyone
    can sign a record with their own did:key, so a valid signature from an
    unknown key proves nothing;
  - credentialSubject.id equals the product's metadata.subject_id, so a record
    signed for one product cannot verify another.

It is None ("not checked") whenever the check could not be completed: no
record, no trusted issuers configured, product has no subject_id, or Node or
the verifier is unavailable. assess_scans treats None as unverified.
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


async def run_verifier(record: Dict[str, Any], anchor: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """verifyRecord() output, or None when the verifier could not run."""
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
    if name == "invalid" or verdict.get("checks", {}).get("signature") is not True:
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
