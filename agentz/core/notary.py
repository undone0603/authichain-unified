"""AgentZ notary: sign a file's SHA-256 and anchor it in Bitcoin.

A notary record says one thing: AgentZ saw this SHA-256 at this time. It is
an EdDSA JWS signed with AgentZ's published identity key (identity.py,
did:web:authichain.com:agents:agentz#key-1), in the same format as the
key-possession proof. It never says what the file is, who made it, or that
it is authentic.

Bitcoin anchoring uses public OpenTimestamps calendars. Each calendar that
accepts the digest returns a pending timestamp, saved as its own standalone
.ots file (header, SHA-256 op, digest, calendar timestamp). Anyone can
upgrade it once Bitcoin confirms (about an hour or more) and verify it with
the official client (`ots upgrade` / `ots verify`), with no AgentZ involvement.
Each proof's sha256 is inside the signed record, so a proof can't be swapped.

The file itself never reaches AgentZ: callers send only its SHA-256.
Selling stamps over Lightning (L402) is in agentz/api/main.py and stays off
until the owner chooses a Lightning backend (docs/strategy/LIGHTNING_L402.md).
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

from agentz.core import identity

CALENDARS = (
    "https://a.pool.opentimestamps.org",
    "https://b.pool.opentimestamps.org",
    "https://finney.calendar.eternitywall.com",
)
OTS_MAGIC = b"\x00OpenTimestamps\x00\x00Proof\x00\xbf\x89\xe2\xe8\x84\xe8\x92\x94"
OTS_MAJOR_VERSION = b"\x01"
OTS_OP_SHA256 = b"\x08"
MAX_CALENDAR_RESPONSE = 10_000
ISSUER = "did:web:authichain.com:agents:agentz"
KID = ISSUER + "#key-1"
JWS_TYP = "agentz-notary+jws"
NOTARY_PRICE_USD = 0.05
_SHA256 = re.compile(r"^[0-9a-f]{64}$")


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def ots_file(digest: bytes, calendar_timestamp: bytes) -> bytes:
    """A standalone detached OpenTimestamps proof for a SHA-256 digest."""
    if len(digest) != 32:
        raise ValueError("digest must be 32 bytes")
    return OTS_MAGIC + OTS_MAJOR_VERSION + OTS_OP_SHA256 + digest + calendar_timestamp


def submit(digest: bytes, calendars: Iterable[str] = CALENDARS,
           opener=urllib.request.urlopen, timeout: float = 10.0) -> List[Dict[str, Any]]:
    """POST the digest to each calendar; one entry per calendar, accepted or not."""
    out: List[Dict[str, Any]] = []
    for cal in calendars:
        req = urllib.request.Request(
            cal.rstrip("/") + "/digest", data=digest, method="POST",
            headers={"Accept": "application/vnd.opentimestamps.v1",
                     "User-Agent": "agentz-notary/1"})
        try:
            with opener(req, timeout=timeout) as res:
                body = res.read(MAX_CALENDAR_RESPONSE + 1)
                status = getattr(res, "status", 200)
        except OSError as exc:
            out.append({"calendar": cal, "accepted": False, "error": type(exc).__name__})
            continue
        if status != 200 or not body or len(body) > MAX_CALENDAR_RESPONSE:
            out.append({"calendar": cal, "accepted": False, "error": f"http_{status}"})
            continue
        proof = ots_file(digest, body)
        out.append({"calendar": cal, "accepted": True, "status": "pending",
                    "ots_base64": base64.b64encode(proof).decode(),
                    "ots_sha256": hashlib.sha256(proof).hexdigest()})
    return out


def _load_key(key_pem: bytes, expected_did_key: str):
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

    if identity.did_key_from_pem(key_pem) != expected_did_key:
        raise PermissionError("key is not the published AgentZ identity")
    key = serialization.load_pem_private_key(key_pem, password=None)
    if not isinstance(key, Ed25519PrivateKey):
        raise PermissionError("not an Ed25519 key")
    return key


def sign_record(payload: Dict[str, Any], key_pem: bytes,
                expected_did_key: Optional[str] = None) -> str:
    """Compact EdDSA JWS over the record; refuses any key but the published one."""
    key = _load_key(key_pem, expected_did_key or identity.DID_KEY)
    header = {"alg": "EdDSA", "kid": KID, "typ": JWS_TYP}
    signing_input = (_b64url(json.dumps(header, separators=(",", ":")).encode()) + "." +
                     _b64url(json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()))
    return signing_input + "." + _b64url(key.sign(signing_input.encode()))


def notarize(sha256_hex: str, *, key_pem: Optional[bytes] = None,
             expected_did_key: Optional[str] = None,
             calendars: Iterable[str] = CALENDARS, opener=urllib.request.urlopen,
             now: Optional[datetime] = None, paid: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Sign and anchor one SHA-256. Raises ValueError (bad input), RuntimeError (no calendar)."""
    digest_hex = (sha256_hex or "").strip().lower()
    if not _SHA256.match(digest_hex):
        raise ValueError("sha256 must be 64 hex characters")
    if key_pem is None:
        key_dir = os.environ.get("AGENTZ_KEY_DIR")
        if not key_dir:
            raise RuntimeError("AGENTZ_KEY_DIR not set")
        key_pem = (Path(key_dir) / identity.KEY_FILE).read_bytes()
    key = _load_key(key_pem, expected_did_key or identity.DID_KEY)  # refuse before any network call
    del key
    proofs = submit(bytes.fromhex(digest_hex), calendars, opener)
    accepted = [p for p in proofs if p["accepted"]]
    if not accepted:
        raise RuntimeError("no_calendar_accepted")
    issued_at = (now or datetime.now(timezone.utc)).isoformat(timespec="seconds")
    payload = {
        "type": "AgentZNotaryRecord",
        "v": 1,
        "sha256": digest_hex,
        "issued_at": issued_at,
        "issuer": ISSUER,
        "did_key": expected_did_key or identity.DID_KEY,
        "anchors": [{"calendar": p["calendar"], "kind": "opentimestamps",
                     "status": "pending", "ots_sha256": p["ots_sha256"]} for p in accepted],
        "claims": "AgentZ saw this SHA-256 at issued_at. Nothing about the file's content or origin.",
    }
    if paid:
        payload["paid"] = paid
    return {
        "record": payload,
        "jws": sign_record(payload, key_pem, expected_did_key),
        "proofs": accepted,
        "calendars_refused": [p for p in proofs if not p["accepted"]],
        "next": "After Bitcoin confirms (about 1 h+), run `ots upgrade` then `ots verify` on each .ots proof.",
    }
