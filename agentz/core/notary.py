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
The public paid stamp is sold over Lightning by the edge worker (POST /api/notary),
which calls the operator endpoint here; see docs/strategy/LIGHTNING_L402.md.
"""
from __future__ import annotations

import base64
import hashlib
import http.client
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
_SHA256 = re.compile(r"^[0-9a-f]{64}$")


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


_UNARY_OPS = {0x02, 0x03, 0x08, 0x67, 0xF2, 0xF3}  # sha1 ripemd160 sha256 keccak256 reverse hexlify
_BINARY_OPS = {0xF0, 0xF1}  # append, prepend (one varbytes argument)
_PENDING_TAG = bytes.fromhex("83dfe30d2ef90c8e")
# The character set the official client accepts in a pending attestation URI.
_URI_CHARS = frozenset(b"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._/:")
_MAX_OP_ARG = 4096
_MAX_ATTESTATION = 8192
_MAX_DEPTH = 256


def valid_calendar_timestamp(buf: bytes) -> bool:
    """True only for a well-formed OpenTimestamps timestamp, as a calendar returns.

    Follows the serialization the official client reads: items are operations
    (each followed by a sub-timestamp) or attestations, 0xff marks a fork.
    It requires at least one attestation, no unknown tags, no trailing bytes,
    and a pending attestation whose URI is https. An error page that answers
    200 is refused here instead of being signed into a record.
    """
    pos = 0
    attestations = 0

    def byte() -> int:
        nonlocal pos
        if pos >= len(buf):
            raise ValueError("truncated")
        b = buf[pos]
        pos += 1
        return b

    def varuint(read=byte) -> int:
        value = shift = 0
        while True:
            b = read()
            value |= (b & 0x7F) << shift
            if not b & 0x80:
                return value
            shift += 7
            if shift > 63:
                raise ValueError("varuint too long")

    def varbytes(max_len: int, min_len: int = 0) -> bytes:
        nonlocal pos
        n = varuint()
        if n < min_len or n > max_len or pos + n > len(buf):
            raise ValueError("bad length")
        out = buf[pos:pos + n]
        pos += n
        return out

    def pending_uri_ok(payload: bytes) -> bool:
        it = iter(payload)
        n = varuint(lambda: next(it))
        uri = bytes(it)
        return n == len(uri) and uri.startswith(b"https://") and all(c in _URI_CHARS for c in uri)

    def item(tag: int, depth: int) -> None:
        nonlocal attestations
        if tag == 0x00:
            att_tag = bytes(byte() for _ in range(8))
            payload = varbytes(_MAX_ATTESTATION)
            if att_tag == _PENDING_TAG and not pending_uri_ok(payload):
                raise ValueError("bad pending uri")
            attestations += 1
        elif tag in _UNARY_OPS:
            timestamp(depth + 1)
        elif tag in _BINARY_OPS:
            varbytes(_MAX_OP_ARG, 1)
            timestamp(depth + 1)
        else:
            raise ValueError("unknown tag")

    def timestamp(depth: int) -> None:
        if depth > _MAX_DEPTH:
            raise ValueError("too deep")
        tag = byte()
        while tag == 0xFF:
            item(byte(), depth)
            tag = byte()
        item(tag, depth)

    try:
        timestamp(0)
    except (ValueError, StopIteration, RecursionError):
        return False
    return pos == len(buf) and attestations > 0


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
        except (OSError, http.client.HTTPException) as exc:
            # HTTPException covers a response cut short (IncompleteRead), which
            # is not an OSError: one broken calendar must not stop the others.
            out.append({"calendar": cal, "accepted": False, "error": type(exc).__name__})
            continue
        if status != 200 or not body or len(body) > MAX_CALENDAR_RESPONSE:
            out.append({"calendar": cal, "accepted": False, "error": f"http_{status}"})
            continue
        if not valid_calendar_timestamp(body):
            out.append({"calendar": cal, "accepted": False, "error": "invalid_timestamp"})
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
             now: Optional[datetime] = None) -> Dict[str, Any]:
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
    return {
        "record": payload,
        "jws": sign_record(payload, key_pem, expected_did_key),
        "proofs": accepted,
        "calendars_refused": [p for p in proofs if not p["accepted"]],
        "next": "After Bitcoin confirms (about 1 h+), run `ots upgrade` then `ots verify` on each .ots proof.",
    }
